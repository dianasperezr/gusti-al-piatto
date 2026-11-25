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

export function whatsappMessage(summary: OrderSummary, introduction: string) {
  const lines = summary.lines.map(line => [
    `${line.quantity} × ${line.name}`,
    ...line.labels,
    ...line.components.map(component => "Incluye: " + component),
    ...(line.note ? ["Nota del platillo: " + oneLine(line.note)] : []),
  ].join("\n"));
  return [
    oneLine(introduction),
    lines.join("\n\n"),
    [
      ...(summary.name ? ["Nombre: " + oneLine(summary.name)] : []),
      ...(summary.note ? ["Notas generales: " + oneLine(summary.note)] : []),
      "Total: " + formatPrice(summary.total, summary.currency),
    ].join("\n"),
  ].filter(Boolean).join("\n\n");
}
