import { z } from "zod";
import { defaultSelections } from "../products/selections.ts";
import { formatPrice, type Currency } from "../catalog/pricing.ts";
import type { MonetarySettings } from "../currencies/settings.ts";

export const lineNote = z.string().trim().max(160);
export const orderBody = z.object({
  currency: z.enum(["MXN", "USD"]),
  lines: z.array(z.object({
    id: z.uuid(), quantity: z.number().int().min(1).max(20),
    selections: defaultSelections, note: lineNote.default(""),
  }).strict()).min(1).max(25),
  name: z.string().trim().max(80).default(""),
  note: z.string().trim().max(300).default(""),
  confirmation: z.object({ id: z.uuid(), fingerprint: z.string().regex(/^[a-f0-9]{64}$/) }).optional(),
}).strict();

export type OrderInput = z.output<typeof orderBody>;
export type OrderLine = {
  id: string; name: string; quantity: number; selections: OrderInput["lines"][number]["selections"]; note: string;
  unit: number; baseUnit: number; subtotal: number; discount: number; total: number; labels: string[]; offers: string[]; components: string[];
};
export type OrderSummary = {
  reference: string; lines: OrderLine[]; subtotal: number; discount: number; total: number;
  currency: Currency; baseCurrency: Currency; baseTotal: number; name: string; note: string;
  exchange: Pick<MonetarySettings, "rate" | "direction" | "updatedAt" | "guaranteed">;
};
export type QuoteReply = { id: string; fingerprint: string; summary: OrderSummary; changed?: boolean; url?: string };

const oneLine = (value: string) => value.replace(/\s+/gu, " ").trim();

export function whatsappMessage(summary: OrderSummary, introduction: string, accepted: Currency) {
  const money = (value: number) => formatPrice(value, summary.currency);
  const lines = summary.lines.map(line => [
    line.name,
    `Cantidad: ${line.quantity}`,
    ...line.labels,
    ...line.components.map(component => "Incluye: " + component),
    ...(line.note ? ["Nota del platillo: " + oneLine(line.note)] : []),
    "Precio unitario: " + money(line.unit),
    "Subtotal: " + money(line.subtotal),
    ...(line.discount ? ["Descuento: " + money(line.discount), ...line.offers.map(offer => "Promoción: " + offer)] : []),
  ].join("\n"));
  const exchange = summary.exchange;
  return [
    oneLine(introduction),
    `SOLICITUD DE MENÚ DIGITAL · ${summary.currency}`,
    lines.join("\n\n"),
    [
      "RESUMEN", "Subtotal: " + money(summary.subtotal), "Descuentos: " + money(summary.discount), "TOTAL: " + money(summary.total),
      ...(summary.currency !== summary.baseCurrency ? [
        "Total en moneda base: " + formatPrice(summary.baseTotal, summary.baseCurrency),
        "Tipo de cambio: " + (exchange.direction === "mxn-per-usd" ? `1 USD = ${exchange.rate} MXN` : `1 MXN = ${exchange.rate} USD`),
        exchange.guaranteed ? "Tipo de cambio garantizado por el restaurante." : "Conversión de referencia.",
      ] : []),
      `Moneda principal aceptada: ${accepted}.`,
      ...(summary.name ? ["Nombre: " + oneLine(summary.name)] : []),
      ...(summary.note ? ["Notas generales: " + oneLine(summary.note)] : []),
      "Referencia: " + summary.reference, "Gracias. ¿Podrían confirmar disponibilidad y total?",
    ].join("\n"),
  ].filter(Boolean).join("\n\n");
}
