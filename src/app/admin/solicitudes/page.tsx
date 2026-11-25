import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/modules/auth/session";
import { AdminShell } from "@/modules/admin/shell";
import { ActionForm } from "@/modules/admin/action-form";
import { parseOptions } from "@/modules/admin/config";
import type { OrderSummary } from "@/modules/orders/checkout";
import { cancelRequest } from "@/modules/orders/history-actions";
import { ValidatedSummary } from "@/modules/orders/summary";
import { formatPrice } from "@/modules/catalog/pricing";
import { Pagination, pageSize, readPage } from "@/modules/admin/pagination";

export default async function RequestHistory({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const user = await requireUser(true);
  const page = readPage((await searchParams).pagina);
  const [requests, settings] = await Promise.all([
    db().orderRequest.findMany({
      select: { id: true, reference: true, status: true, snapshot: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize + 1,
    }),
    db().content.findUnique({ where: { id: "contact" }, select: { options: true } }),
  ]);
  const zone = settings ? parseOptions("CONTACT", settings.options).timezone : "America/Mexico_City";
  const date = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: zone });
  return <AdminShell section="pedidos" title="Solicitudes preparadas" user={user}>
    <section className="panel">
      <p className="muted">La recepción del mensaje y la confirmación del pedido se coordinan en WhatsApp.</p>
      <div className="export-links"><Link className="button" href="/admin/pedidos">Configuración de pedidos</Link></div>
      {requests.length === 0 ? <p>Todavía no hay solicitudes registradas.</p> : <ul className="admin-list">
        {requests.slice(0, pageSize).map(request => {
          const summary = request.snapshot as unknown as OrderSummary;
          return <li key={request.id}><div><details>
            <summary>{request.reference} · {date.format(request.createdAt)} · {request.status === "CANCELLED" ? "Cancelada localmente" : "Enlace de WhatsApp generado"}</summary>
            <ValidatedSummary summary={summary} />
            <p>Total base {formatPrice(summary.baseTotal, summary.baseCurrency)} · Tipo de cambio {summary.exchange.rate}
              {" "}{summary.exchange.direction === "mxn-per-usd" ? "MXN por USD" : "USD por MXN"}</p>
            {request.status === "LINK_GENERATED" && <ActionForm action={cancelRequest.bind(null, request.id)} label="Cancelar referencia"
              confirm="¿Cancelar esta referencia en el historial local? Los mensajes que ya se compartieron se gestionan en WhatsApp." />}
          </details></div></li>;
        })}
      </ul>}
      <Pagination path="/admin/solicitudes" page={page} more={requests.length > pageSize} />
    </section>
  </AdminShell>;
}
