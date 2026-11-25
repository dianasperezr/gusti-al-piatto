import Link from "next/link";
import { z } from "zod";
import { mediaUsed } from "@/modules/appearance/layout-schema";
import { Pagination, pageSize, readPage } from "@/modules/admin/pagination";
import { notFound } from "next/navigation";
import { LayoutEditor } from "@/modules/appearance/layout-editor";
import { initialVisual } from "@/modules/appearance/layout-store";
import { db } from "@/lib/db";
import { ActionForm } from "@/modules/admin/action-form";
import { ContentEditor } from "@/modules/admin/content-editor";
import { panelFor } from "@/modules/admin/config";
import { AdminShell } from "@/modules/admin/shell";
import { requireUser } from "@/modules/auth/session";
import { saveUser } from "@/modules/auth/users";
import { deleteMedia, saveMedia } from "@/modules/media/actions";
import { UploadFields } from "@/modules/media/upload-fields";
import { BatchUpload } from "@/modules/media/batch-upload";
import { maxBytes, maxDuration } from "@/modules/media/process";
import { syncCatalog } from "@/modules/sheets-sync/sync";
import { canvaConfig, canvaStatus } from "@/modules/appearance/canva";
import { checkCanvaJob, connectCanva, createCanvaJob, unlinkCanva } from "@/modules/appearance/canva-actions";

const mediaOption = { id: true, mime: true, name: true } as const;
const detail = {
  comboItems: { select: { productId: true, quantity: true } },
  gallery: { orderBy: { position: "asc" as const }, select: { mediaId: true } },
};
const summary = { id: true, name: true, slug: true, externalId: true, categoryId: true, published: true,
  active: true, featured: true, archivedAt: true, mediaId: true } as const;
const ordering = [{ position: "asc" }, { name: "asc" }, { id: "asc" }] as const;
const statuses = z.enum(["", "published", "draft", "inactive", "featured", "archive"]).catch("");

const privileged: Record<string, string> = {
  sheets: "Google Sheets", canva: "Integración Canva", usuarios: "Usuarios y permisos", auditoria: "Historial y auditoría",
};

export default async function AdminSection({ params, searchParams }: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ editar?: string; resultado?: string; pagina?: string; q?: string; estado?: string; categoria?: string }>;
}) {
  const { section } = await params;
  const { editar, resultado, pagina, q, estado, categoria } = await searchParams;
  const page = readPage(pagina);
  const paging = { skip: (page - 1) * pageSize, take: pageSize + 1 };
  const editable = z.uuid().safeParse(editar).data;
  const search = z.string().trim().max(120).catch("").parse(q);
  const status = statuses.parse(estado);
  const category = section === "platillos" ? z.uuid().safeParse(categoria).data : undefined;
  const panel = panelFor(section);
  const title = panel?.title ?? (section === "multimedia" ? "Biblioteca multimedia" : Object.hasOwn(privileged, section) ? privileged[section] : undefined);
  if (!title) notFound();
  const user = await requireUser(panel?.admin || Object.hasOwn(privileged, section));

  let body;
  if (section === "diseno" || section === "secciones") {
    const [{ layout, published }, categories] = await Promise.all([
      initialVisual(),
      db().content.findMany({ where: { kind: "CATEGORY", archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    const ids = mediaUsed(layout);
    const assets = ids.length ? await db().media.findMany({ where: { id: { in: ids } }, select: mediaOption }) : [];
    body = <LayoutEditor initial={layout} assets={assets} categories={categories} published={published} />;
  } else if (panel) {
    const specialized = ["PRODUCT", "CATEGORY", "COMBO", "PROMOTION", "HOURS"].includes(panel.kind);
    const [entries, record, categories, products, targets, schedules, affected] = await Promise.all([
      panel.singleton ? [] : db().content.findMany({
        where: {
          kind: panel.kind, ...(specialized ? { archivedAt: status === "archive" ? { not: null } : null } : {}),
          ...(status === "published" ? { published: true } : status === "draft" ? { published: false } :
            status === "inactive" ? { active: false } : status === "featured" ? { featured: true } : {}),
          ...(category ? { categoryId: category } : {}),
          ...(search ? { OR: [
            { id: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } }, { externalId: { contains: search, mode: "insensitive" } },
          ] } : {}),
        },
        select: summary, orderBy: [...ordering], ...paging,
      }),
      panel.singleton || editable ? db().content.findFirst({
        where: { kind: panel.kind, ...(panel.singleton ? {} : { id: editable }) }, orderBy: [...ordering], include: detail,
      }) : null,
      ["PRODUCT", "CATEGORY"].includes(panel.kind) ? db().content.findMany({
        where: { kind: "CATEGORY", archivedAt: null }, select: { id: true, name: true, categoryId: true }, orderBy: { name: "asc" },
      }) : [],
      ["COMBO", "CATEGORY"].includes(panel.kind) ? db().content.findMany({
        where: { kind: "PRODUCT", ...(panel.kind === "CATEGORY" ? { archivedAt: null } : {}) },
        select: { id: true, name: true, active: true, published: true, priceCents: true }, orderBy: { name: "asc" },
      }) : [],
      ["HOURS", "PROMOTION"].includes(panel.kind) ? db().content.findMany({
        where: { kind: { in: panel.kind === "HOURS" ? ["CATEGORY", "PRODUCT", "COMBO", "PROMOTION"] : ["CATEGORY", "PRODUCT", "COMBO"] }, archivedAt: null },
        select: { id: true, name: true, kind: true }, orderBy: { name: "asc" },
      }) : [],
      panel.kind === "CATEGORY" ? db().content.findMany({ where: { kind: "HOURS", archivedAt: null, options: { path: ["mode"], equals: "menu" } }, select: { id: true, name: true } }) : [],
      panel.kind === "PRODUCT" && editable ? db().content.findMany({
        where: { kind: "COMBO", archivedAt: null, comboItems: { some: { productId: editable } } }, select: { id: true, name: true },
      }) : [],
    ]);
    const options = record?.options as { logoId?: string } | undefined;
    const mediaIds = [record?.mediaId, options?.logoId, ...record?.gallery.map(item => item.mediaId) ?? []]
      .filter((id): id is string => z.uuid().safeParse(id).success);
    const media = mediaIds.length ? await db().media.findMany({ where: { id: { in: mediaIds } }, select: mediaOption }) : [];
    const filters = { q: search, estado: status, categoria: category ?? "", pagina: page > 1 ? String(page) : "" };
    const labels = { CATEGORY: "Categoría", PRODUCT: "Platillo", COMBO: "Paquete", PROMOTION: "Promoción" };
    body = <>
      {section === "pedidos" && <div className="export-links">
        <Link className="button" href="/admin/solicitudes">Historial de solicitudes</Link>
        <Link className="button" href="/admin/monedas">Monedas visibles</Link>
      </div>}
      <ContentEditor section={section} record={record} filters={filters} entries={entries.slice(0, pageSize)} media={media} categories={categories}
        products={products} targets={targets.map(target => ({ ...target, name: (labels[target.kind as keyof typeof labels] ?? "") + " / " + target.name }))}
        schedules={schedules} affected={affected} />
      <Pagination path={`/admin/${section}`} page={page} more={entries.length > pageSize} params={{ ...filters, editar: editable }} />
    </>;
  } else if (section === "multimedia") {
    const [records, replacement] = await Promise.all([
      db().media.findMany({ where: search ? { name: { contains: search, mode: "insensitive" } } : {},
        orderBy: [{ createdAt: "desc" }, { id: "desc" }], ...paging }),
      editable ? db().media.findUnique({ where: { id: editable }, select: { id: true, name: true } }) : null,
    ]);
    const upload = <UploadFields maxMegabytes={maxBytes() / 1024 / 1024} maxSeconds={maxDuration()} />;
    body = <>
      <section className="panel upload-panel" key={replacement?.id ?? "new"}>
        <div className="panel-heading"><h2>{replacement ? "Reemplazar " + replacement.name : "Subir archivos"}</h2>
          {replacement && <Link href="/admin/multimedia" className="button small">Cancelar</Link>}
        </div>
        {!replacement && <>
          <BatchUpload maxMegabytes={maxBytes() / 1024 / 1024} maxSeconds={maxDuration()} />
          <details className="upload-manual"><summary>Subir un archivo con recorte o portada</summary>
            <ActionForm action={saveMedia.bind(null, null)} label="Subir archivo">{upload}</ActionForm>
          </details>
        </>}
        {replacement && <ActionForm action={saveMedia.bind(null, replacement.id)} label="Reemplazar" confirm="¿Reemplazar este archivo?">
          {upload}
        </ActionForm>}
      </section>
      <section className="panel"><h2>Archivos</h2>
        <form className="media-search action-form" action="/admin/multimedia" role="search">
          <label>Buscar archivos<input type="search" name="q" maxLength={120} defaultValue={search} /></label>
          <button className="button small">Buscar</button>
        </form>
        {records.length ? <ul className="admin-list">{records.slice(0, pageSize).map(record => <li key={record.id}>
          <div><a href={`/media/${record.id}`} target="_blank" rel="noreferrer">{record.name}</a><small>{record.mime} · {Math.ceil(record.size / 1024)} KB{record.duration ? " · " + record.duration.toFixed(1) + " s" : ""}</small><Link href={"/admin/multimedia?editar=" + record.id}>Reemplazar archivo</Link></div>
          <ActionForm action={deleteMedia.bind(null, record.id)} label="Eliminar" confirm="¿Eliminar este archivo?" />
        </li>)}</ul> : <p className="muted">{search ? "No hay archivos que coincidan." : "No hay archivos en esta página."}</p>}
        <Pagination path="/admin/multimedia" page={page} more={records.length > pageSize} params={{ q: search }} />
      </section>
    </>;
  } else if (section === "usuarios") {
    const fields = { id: true, name: true, email: true, role: true, active: true } as const;
    const [accounts, account] = await Promise.all([
      db().user.findMany({ select: fields, orderBy: [{ name: "asc" }, { id: "asc" }], ...paging }),
      editable ? db().user.findUnique({ where: { id: editable }, select: fields }) : null,
    ]);
    body = <div className="admin-columns">
      <aside className="panel record-list"><div className="panel-heading"><h2>Cuentas</h2><Link className="button small" href="/admin/usuarios">Nueva</Link></div>
        {accounts.slice(0, pageSize).map(entry => <Link key={entry.id} className="record-link" href={`/admin/usuarios?editar=${entry.id}`} aria-current={entry.id === account?.id ? "page" : undefined}>
          <span>{entry.name}</span><small>{entry.active ? entry.role === "ADMIN" ? "Admin" : "Editor" : "Inactiva"}</small>
        </Link>)}
        <Pagination path="/admin/usuarios" page={page} more={accounts.length > pageSize} params={{ editar: editable }} />
      </aside>
      <section className="panel" key={account?.id ?? "new"}>
        <h2>{account ? "Editar cuenta" : "Nueva cuenta"}</h2>
        <ActionForm action={saveUser.bind(null, account?.id ?? null)}>
          <label>Nombre<input name="name" required maxLength={100} defaultValue={account?.name} /></label>
          <label>Correo<input name="email" type="email" required defaultValue={account?.email} /></label>
          <label>Contraseña<input name="password" type="password" minLength={12} maxLength={256} required={!account} autoComplete="new-password" placeholder={account ? "Deja en blanco para conservarla" : "Mínimo 12 caracteres"} /></label>
          <label>Rol<select name="role" defaultValue={account?.role ?? "EDITOR"}><option value="EDITOR">Editor</option><option value="ADMIN">Administrador</option></select></label>
          <label className="check"><input name="active" type="checkbox" defaultChecked={account?.active ?? true} /> Cuenta activa</label>
        </ActionForm>
      </section>
    </div>;
  } else if (section === "auditoria") {
    const events = await db().audit.findMany({ ...paging, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { user: { select: { name: true } } } });
    const timestamp = new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short", timeZone: "America/Mexico_City" });
    body = <section className="panel"><h2>Cambios registrados</h2>
      {events.length ? <ul className="admin-list">{events.slice(0, pageSize).map(event => <li key={event.id}>
        <div><strong>{event.action}</strong><small>{event.target} · {event.user?.name ?? "Sistema"}</small></div>
        <time dateTime={event.createdAt.toISOString()}>{timestamp.format(event.createdAt)}</time>
      </li>)}</ul> : <p>Todavía no hay cambios registrados.</p>}
      <Pagination path="/admin/auditoria" page={page} more={events.length > pageSize} />
    </section>;
  } else if (section === "sheets") {
    body = <div className="admin-integration">
      <section className="panel"><h2>Sincronizar el catálogo</h2><p>Utiliza una pestaña llamada Gusti en la hoja compartida con la cuenta de servicio. La sincronización incluye categorías, platillos, precios y disponibilidad.</p></section>
      <div className="integration-grid">
        <section className="panel"><h2>CMS a Google Sheets</h2><p>Actualiza las columnas A a K con el catálogo del panel.</p>
          <ActionForm action={syncCatalog.bind(null, "push")} label="Enviar catálogo">
            <label className="check"><input type="checkbox" name="accept" /> Sobrescribir cambios de la pestaña</label>
          </ActionForm>
        </section>
        <section className="panel"><h2>Google Sheets al CMS</h2><p>Actualiza por ID. El CMS conserva los registros de las filas omitidas.</p>
          <ActionForm action={syncCatalog.bind(null, "pull")} label="Importar catálogo">
            <label className="check"><input type="checkbox" name="accept" /> Sobrescribir cambios locales</label>
          </ActionForm>
        </section>
      </div>
    </div>;
  } else {
    const configured = !!canvaConfig();
    const account = configured ? await canvaStatus() : null;
    const templates = account?.connected ? await db().content.findMany({ where: { kind: "TEMPLATE", published: true }, select: { id: true, name: true } }) : [];
    body = <div className="admin-integration">
      <section className="panel"><h2>Canva Connect</h2>
        <p>Envía una exportación PDF a Canva para continuar su edición, según los permisos de tu cuenta.</p>
        {resultado === "error" && <p className="form-error" role="alert">No se pudo autorizar Canva. Revisa la configuración y vuelve a intentarlo.</p>}
        {resultado === "conectado" && <p className="form-success" role="status">Cuenta conectada.</p>}
        {!configured ? <p>Configura las credenciales de Canva y la URL de retorno en el servidor.</p>
          : account?.connected ? <ActionForm action={unlinkCanva} label="Desconectar Canva" confirm="¿Desconectar la cuenta de Canva?" />
            : <form action={connectCanva}><button className="button primary">Conectar Canva</button></form>}
      </section>
      {account?.connected && <section className="panel"><h2>Importar un diseño</h2>
        {templates.length ? <ActionForm action={createCanvaJob} label="Enviar PDF a Canva">
          <label>Plantilla publicada<select name="template" required><option value="">Selecciona una plantilla</option>
            {templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select></label>
        </ActionForm> : <p>Publica una plantilla para exportar el menú.</p>}
        {account.pending && <ActionForm action={checkCanvaJob} label="Consultar importación" />}
      </section>}
    </div>;
  }

  return <AdminShell section={section} title={title} user={user}>{body}</AdminShell>;
}
