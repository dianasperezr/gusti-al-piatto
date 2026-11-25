import { z } from "zod";
import { clock, daysOfWeek, inWindow, localDateTimeAt } from "../hours/rules.ts";

export const closedText = "El restaurante está fuera de su horario de pedidos.";

export const orderSettings = {
  whatsapp: z.string().regex(/^(?:[1-9]\d{7,14})?$/),
  countryCode: z.string().regex(/^(?:[1-9]\d{0,2})?$/).default(""),
  ordering: z.boolean(),
  cartEnabled: z.boolean().default(true),
  respectHours: z.boolean().default(false),
  acceptedCurrency: z.enum(["MXN", "USD"]).default("MXN"),
  actionText: z.string().trim().max(90).default(""),
  introduction: z.string().trim().max(300).default("Hola, quisiera realizar el siguiente pedido:"),
  confirmationText: z.string().trim().max(300).default("Tu solicitud está preparada para que la envíes por WhatsApp."),
  customerInstructions: z.string().trim().max(500).default(""),
  outsideText: z.string().trim().max(300).default(closedText),
  orderDays: daysOfWeek.default([]),
  orderOpens: z.union([z.literal(""), clock]).default(""),
  orderCloses: z.union([z.literal(""), clock]).default(""),
  logRequests: z.boolean().default(false),
};

export type OrderSettings = z.output<z.ZodObject<typeof orderSettings>>;

export function normalizeNumber(input: string, countryCode: string) {
  const raw = input.trim();
  const country = countryCode.trim().replace(/^\+/, "");
  if (country && !/^[1-9]\d{0,2}$/.test(country)) throw new Error("Revisa el código de país.");
  if (!raw) return { whatsapp: "", countryCode: country };
  if (!/^\+?[\d\s().-]+$/.test(raw)) throw new Error("Revisa el número de WhatsApp.");
  const digits = raw.replace(/\D/g, "");
  const international = raw.startsWith("+") ? digits : raw.startsWith("00") ? digits.slice(2) : digits;
  if (!/^[1-9]\d{7,14}$/.test(international) || country && (!international.startsWith(country) || international.length - country.length < 6)) {
    throw new Error("Revisa el número. Escribe el número internacional completo, incluido el código de país.");
  }
  return { whatsapp: international, countryCode: country };
}

export function withinOrderHours(settings: OrderSettings & { timezone: string }, open: boolean, closed: boolean, date = new Date()) {
  if (closed || settings.respectHours && !open) return false;
  return inWindow(localDateTimeAt(date, settings.timezone), { days: settings.orderDays, opens: settings.orderOpens, closes: settings.orderCloses });
}
