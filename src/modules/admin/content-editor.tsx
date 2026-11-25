import Link from "next/link";
import type { Content } from "@/generated/prisma/client";
import { ActionForm } from "./action-form";
import { removeContent, saveContent } from "./content-actions";
import { panels, parseOptions, weekdays } from "./config";
import { RecordBrowser } from "./record-browser";
import { RecordEditorDialog } from "./record-editor-dialog";
import { ScheduleFields } from "@/modules/hours/schedule-fields";
import { MediaPicker, type MediaOption } from "@/modules/media/picker";
import { optionGroups } from "@/modules/products/options";
import { VariantEditor } from "@/modules/products/variant-editor";
import { productStatuses, statusFor } from "./product-status";

type Entry = Content & { comboItems: { productId: string; quantity: number }[]; gallery: { mediaId: string }[] };
type EntrySummary = Pick<Content, "id" | "name" | "description" | "slug" | "externalId" | "categoryId" | "published" | "active" | "featured" | "archivedAt" | "mediaId"> & {
  media: { mime: string; thumbnail: string | null } | null;
  options?: Content["options"];
};
type Reference = { id: string; name: string; categoryId?: string | null; active?: boolean; published?: boolean; priceCents?: number | null };

export function ContentEditor({ section, record, showEditor, entries, media, categories, products, targets, schedules, affected, filters, typeKey, typeChoices }: {
  section: string;
  record?: Entry | null;
  showEditor: boolean;
  entries: EntrySummary[];
  media: MediaOption[];
  filters: { q: string; estado: string; categoria: string; pagina: string; tipo: string };
  typeChoices: readonly (readonly [string, string])[];
  typeKey: string;
  categories: Reference[];
  products: Reference[];
  targets: Reference[];
  schedules: Reference[];
  affected: Reference[];
}) {
  const panel = panels[section];

  const properties = record?.options as Record<string, unknown> | undefined;
  const defaults: Record<string, string> = { DESIGN: "Gusti al piatto", CONTACT: "Contacto y pedidos", CURRENCY: "Tipo de cambio" };
  const path = `/admin/${section}`;
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  const newPath = path + (query.size ? "?" + query : "");
  const specialized = ["PRODUCT", "CATEGORY", "COMBO", "PROMOTION", "HOURS"].includes(panel.kind);
  const primaryCategories = categories.filter(category => !category.categoryId);

  const title = panel.singleton ? "Configuración" : record ? "Editar registro" : "Nuevo registro";
  const form = showEditor && <>
        {record?.archivedAt ? <p>Registro archivado. Selecciónalo en la vista de archivados para restaurarlo.</p> : <ActionForm action={saveContent.bind(null, section, record?.id ?? null)}>
          <label>Nombre<input name="name" required maxLength={120} defaultValue={record?.name ?? defaults[panel.kind]}
            placeholder={panel.kind === "HOURS" ? "Ej. Desayuno o cierre de Navidad" : undefined} /></label>
          {record && panel.kind === "PRODUCT" && <small>UUID {record.id}<br />Creado: {record.createdAt.toISOString().slice(0, 10)} · Actualizado: {record.updatedAt.toISOString().slice(0, 10)}</small>}
          {panel.kind === "PRODUCT" && <div className="field-grid"><label>Slug<input name="slug" defaultValue={record?.slug ?? ""} placeholder="Se genera si se deja vacío" /></label><label>ID de Google Sheets<input name="externalId" maxLength={160} defaultValue={record?.externalId ?? ""} /></label></div>}
          {panel.kind !== "CURRENCY" && <label>{panel.kind === "PRODUCT" ? "Descripción corta" : "Descripción"}<textarea name="description" rows={3} maxLength={2000} defaultValue={record?.description} /></label>}
          {!panel.singleton && <div className="field-grid">
            <label>Orden<input name="position" type="number" min="0" max="9999" defaultValue={record?.position ?? 0} required /></label>
            {panel.kind === "PRODUCT" ? <label>Estado del platillo<select name="productStatus" defaultValue={statusFor(record ?? undefined)}>
              {Object.entries(productStatuses).map(([value, status]) => <option key={value} value={value}>{status.label}</option>)}
            </select></label> : <label className="check"><input name="published" type="checkbox" defaultChecked={record?.published} /> Publicar</label>}
          </div>}
          {specialized && panel.kind !== "PRODUCT" && <div className="field-grid"><input type="hidden" name="manageStatus" value="1" /><label className="check"><input name="active" type="checkbox" defaultChecked={record?.active ?? true} /> Activo</label><label className="check"><input name="featured" type="checkbox" defaultChecked={record?.featured} /> Destacado</label></div>}
          {["PRODUCT", "CATEGORY"].includes(panel.kind) && <label>{panel.kind === "CATEGORY" ? "Categoría padre" : "Categoría"}<select name="categoryId" defaultValue={record?.categoryId ?? ""}>
            <option value="">Sin categoría</option>
            {primaryCategories.filter(category => category.id !== record?.id).map(category => <option value={category.id} key={category.id}>{category.name}</option>)}
          </select></label>}
          {panel.kind === "PRODUCT" && <label>Subcategoría<select name="subcategoryId" defaultValue={record?.subcategoryId ?? ""}><option value="">Sin subcategoría</option>
            {categories.filter(category => category.categoryId).map(category => <option key={category.id} value={category.id}>{primaryCategories.find(parent => parent.id === category.categoryId)?.name} / {category.name}</option>)}
          </select></label>}
          {panel.kind === "CATEGORY" && products.length > 0 && <label>Asignar varios platillos<select name="assign" multiple size={5}>
            {products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select></label>}
          {affected.length > 0 && <p className="form-error">Paquetes relacionados: {affected.map(item => item.name).join(", ")}.</p>}
          {panel.kind === "COMBO" && <fieldset><legend>Platillos incluidos</legend>
            {products.length ? products.map(product => <div className="gallery-row" key={product.id}><label className="check">
              <input name="products" type="checkbox" value={product.id} defaultChecked={record?.comboItems.some(item => item.productId === product.id)} />
              {product.name} · {((product.priceCents ?? 0) / 100).toFixed(2)}{!product.active || !product.published ? " (no disponible)" : ""}
            </label><input aria-label={"Cantidad de " + product.name} type="number" min="1" max="50" name={"quantity-" + product.id} defaultValue={record?.comboItems.find(item => item.productId === product.id)?.quantity ?? 1} /></div>) : <p className="muted">Crea platillos para agregarlos al paquete.</p>}
          </fieldset>}
          {panel.media && <MediaPicker label={panel.kind === "DESIGN" ? "Portada" : "Archivo multimedia"} name="mediaId"
            initial={media.filter(file => file.id === record?.mediaId)} selected={record?.mediaId ? [record.mediaId] : []} />}
          {["PRODUCT", "COMBO"].includes(panel.kind) && <MediaPicker label="Galería multimedia" name="gallery" multiple ordered
            initial={media.filter(file => record?.gallery.some(item => item.mediaId === file.id))}
            selected={record?.gallery.map(item => item.mediaId) ?? []} />}
          {panel.kind === "CURRENCY" && <p className="muted">Tipo de cambio actualizado: {typeof properties?.updatedAt === "string" && properties.updatedAt ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(properties.updatedAt)) : "sin fecha registrada"}.</p>}
          {panel.kind === "HOURS" ? <ScheduleFields initial={parseOptions("HOURS", properties ?? { opens: "12:00", closes: "22:00" })} targets={targets} /> : <div className="field-grid">
            {panel.fields.map(field => {
              const value = field.name === "price" ? (record?.priceCents ?? 0) / 100
                : properties?.[field.name] ?? field.initial;
              if (field.type === "currencies") return <fieldset key={field.name}><legend>{field.label}</legend>
                {["MXN", "USD"].map(currency => <label className="check" key={currency}><input name="enabled" type="checkbox" value={currency} defaultChecked={!Array.isArray(value) || value.includes(currency)} /> {currency}</label>)}
                <small>La moneda base queda habilitada.</small>
              </fieldset>;
              if (field.type === "groups") return null;
              if (field.type === "textarea") return <label key={field.name}>{field.label}<textarea name={field.name} rows={3} defaultValue={String(value)} /></label>;
              if (field.type === "list") return <label key={field.name}>{field.label}<input name={field.name} defaultValue={Array.isArray(value) ? value.join(", ") : ""} /></label>;
              if (field.type === "days" || field.type === "targets") return <label key={field.name}>{field.label}<select name={field.name} multiple size={5} defaultValue={Array.isArray(value) ? value.map(String) : []}>
                {field.type === "days" ? weekdays.map((day, index) => <option key={day} value={index}>{day}</option>) :
                  targets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select></label>;
              if (field.type === "schedule") return <label key={field.name}>{field.label}<select name={field.name} defaultValue={String(value)}>
                <option value="">Sin regla</option>{schedules.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select></label>;
              if (field.type === "checkbox") return <label className="check" key={field.name}><input name={field.name} type="checkbox" defaultChecked={value === true} />{field.label}</label>;
              if (field.type === "image") return <MediaPicker key={field.name} label={field.label} name={field.name} images
                initial={media.filter(file => file.id === value)} selected={typeof value === "string" && value ? [value] : []} />;
              if (field.name === "headline") return <label key={field.name}>{field.label}
                <input name={field.name} defaultValue={String(value)} list="export-title-presets" maxLength={120} placeholder="Menú del día" />
                <datalist id="export-title-presets">{["Menú del día", ...weekdays.map(day => "Menú " + day.toLowerCase())].map(title => <option key={title} value={title} />)}</datalist>
              </label>;
              return <label key={field.name}>{field.label}
                {field.type === "select" ? <select name={field.name} defaultValue={String(value)}>
                  {field.choices?.map(([key, title]) => <option key={key} value={key}>{title}</option>)}
                </select> : <input name={field.name} type={field.type} defaultValue={String(value)} step={field.step} required={!field.optional} />}
              </label>;
            })}
          </div>}
          {panel.kind === "PRODUCT" && <VariantEditor initial={optionGroups.safeParse(properties?.groups).data ?? []} />}
        </ActionForm>}
        {panel.kind === "TEMPLATE" && record?.published && <div className="export-links">
          <a className="button" href={`/api/admin/export?id=${record.id}&format=pdf`}>Descargar PDF</a>
          <a className="button" href={`/api/admin/export?id=${record.id}&format=png`}>Descargar PNG</a>
        </div>}
        {record && !record.archivedAt && !panel.singleton && <div className="delete-block">
          <ActionForm action={removeContent.bind(null, section, record.id)} label="Archivar" confirm="¿Archivar este registro?" />
        </div>}
  </>;

  if (specialized) return <>
    <RecordBrowser section={section} current={record?.id} categories={categories} filters={filters} typeChoices={typeChoices} records={entries.map(entry => {
      const options = entry.options as Record<string, unknown> | undefined;
      const schedule = panel.kind === "HOURS" && options ? parseOptions("HOURS", options) : null;
      const period = schedule && [schedule.date || (schedule.days.length ? schedule.days.map(day => weekdays[day].slice(0, 3)).join(", ") : "Toda la semana"),
        schedule.opens === schedule.closes ? "Todo el día" : schedule.opens + "–" + schedule.closes].join(" · ");
      return {
        id: entry.id, name: entry.name, categoryId: entry.categoryId,
        meta: period || entry.description.slice(0, 150), type: typeChoices.find(([key]) => key === options?.[typeKey])?.[1]
          ?? (entry.categoryId ? categories.find(category => category.id === entry.categoryId)?.name : undefined),
        published: entry.published, active: entry.active, featured: entry.featured, archived: !!entry.archivedAt, mediaId: entry.mediaId,
        mediaIsVideo: !!entry.media?.mime.startsWith("video/"), mediaHasPreview: !!entry.media && (entry.media.mime.startsWith("image/") || !!entry.media.thumbnail),
      };
    })} />
    {showEditor && <RecordEditorDialog key={record?.id ?? "new"} title={title} closeHref={newPath}>{form}</RecordEditorDialog>}
  </>;

  return <div className={panel.singleton ? "admin-single" : "admin-columns"}>
    {!panel.singleton && <aside className="panel record-list">
      <div className="panel-heading"><h2>Registros</h2><Link className="button small" href={newPath + "#editor-registro"}>Nuevo</Link></div>
      {entries.length ? entries.map(entry => (
        <Link className="record-link" aria-current={record?.id === entry.id ? "page" : undefined}
          key={entry.id} href={`${path}?${new URLSearchParams({ ...Object.fromEntries(query), editar: entry.id })}#editor-registro`}>
          <span>{entry.name}</span><span className="status">{entry.published ? "Publicado" : "Borrador"}</span>
        </Link>
      )) : <p className="muted">Todavía no hay registros.</p>}
    </aside>}
    <section className="panel" id="editor-registro" tabIndex={-1} key={record?.id ?? "new"}><h2>{title}</h2>{form}</section>
  </div>;
}
