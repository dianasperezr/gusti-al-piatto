import type { ReactNode } from "react";
import type { OrderSummary } from "./checkout";
import { formatPrice } from "../catalog/pricing";

export function ValidatedSummary({ summary, thumbnail }: { summary: OrderSummary; thumbnail?: (id: string) => ReactNode }) {
  const money = (amount: number) => formatPrice(amount, summary.currency);
  const showBreakdown = !thumbnail;
  return <section className="validated-order" aria-label="Resumen validado">
    <h3>Resumen validado{showBreakdown ? " · " + summary.currency : ""}</h3>
    <ul>{summary.lines.map((line, index) => <li key={index}>
      {thumbnail?.(line.id)}
      <div className="cart-item-copy">
        <strong>{line.quantity} × {line.name}</strong>
        {showBreakdown && <span>{money(line.unit)} por unidad · Subtotal {money(line.subtotal)}</span>}
        {line.labels.map(label => <small key={label}>{label}</small>)}
        {line.components.map(component => <small key={component}>Incluye {component}</small>)}
        {line.note && <small>Nota: {line.note}</small>}
        {showBreakdown && !!line.discount && <small>Descuento: {money(line.discount)} {line.offers.join(" · ")}</small>}
      </div>
    </li>)}</ul>
    <dl>
      {showBreakdown && <>
        <div><dt>Subtotal</dt><dd>{money(summary.subtotal)}</dd></div>
        <div><dt>Descuentos</dt><dd>{money(summary.discount)}</dd></div>
      </>}
      <div><dt>Total</dt><dd>{money(summary.total)}</dd></div>
    </dl>
    {summary.name && <p>Nombre: {summary.name}</p>}
    {summary.note && <p>Notas generales: {summary.note}</p>}
    {showBreakdown && <small>Referencia {summary.reference}</small>}
  </section>;
}
