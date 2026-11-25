import type { OrderSummary } from "./checkout";
import { formatPrice } from "../catalog/pricing";

export function ValidatedSummary({ summary }: { summary: OrderSummary }) {
  const money = (amount: number) => formatPrice(amount, summary.currency);
  return <section className="validated-order" aria-label="Resumen validado">
    <h3>Resumen validado · {summary.currency}</h3>
    <ul>{summary.lines.map((line, index) => <li key={index}>
      <strong>{line.quantity} × {line.name}</strong>
      <span>{money(line.unit)} por unidad · Subtotal {money(line.subtotal)}</span>
      {line.labels.map(label => <small key={label}>{label}</small>)}
      {line.components.map(component => <small key={component}>Incluye {component}</small>)}
      {line.note && <small>Nota: {line.note}</small>}
      {!!line.discount && <small>Descuento: {money(line.discount)} {line.offers.join(" · ")}</small>}
    </li>)}</ul>
    <dl>
      <div><dt>Subtotal</dt><dd>{money(summary.subtotal)}</dd></div>
      <div><dt>Descuentos</dt><dd>{money(summary.discount)}</dd></div>
      <div><dt>Total</dt><dd><strong>{money(summary.total)}</strong></dd></div>
    </dl>
    {summary.name && <p>Nombre: {summary.name}</p>}
    {summary.note && <p>Notas generales: {summary.note}</p>}
    <small>Referencia {summary.reference}</small>
  </section>;
}
