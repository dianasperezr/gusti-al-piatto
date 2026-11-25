import { z } from "zod";
import { closedText, orderSettings } from "@/modules/orders/settings";
import { monetarySettings } from "@/modules/currencies/settings";
import { optionGroups } from "@/modules/products/options";
import { promotion } from "@/modules/promotions/rules";
import { behaviors, schedule, timing } from "@/modules/hours/rules";

const short = z.string().trim().max(120);
const copy = z.string().trim().max(2000);
const link = z.union([z.literal(""), z.url({ protocol: /^https?$/ })]);
const color = z.string().regex(/^#[\da-f]{6}$/i);
const timezone = z.string().max(80).refine(value => {
  try {
    new Intl.DateTimeFormat("es-MX", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Zona horaria inválida.");

export const options = {
  CATEGORY: z.object({ scheduleId: z.union([z.uuid(), z.literal("")]).default("") }),
  PRODUCT: z.object({
    available: z.boolean(),
    details: copy.default(""),
    tags: z.array(short).max(30).default([]),
    ingredients: z.array(short).max(60).default([]),
    allergens: z.array(short).max(30).default([]),
    nutrition: copy.default(""),
    groups: optionGroups.default([]),
  }),
  COMBO: z.object({
    available: z.boolean(),
    priceMode: z.enum(["fixed", "calculated"]).default("fixed"),
    ...timing,
  }),
  PROMOTION: promotion,
  HOURS: schedule,
  SECTION: z.object({
    type: z.enum(["text", "promotions", "combos", "catalog"]),
    label: short,
    url: link,
  }),
  TEMPLATE: z.object({
    background: color, foreground: color, accent: color, format: z.enum(["portrait", "square"]),
    content: z.enum(["menu", "bundles", "promotions"]).default("menu"),
  }),
  DESIGN: z.object({ eyebrow: short, accent: color, background: color, logoId: z.union([z.uuid(), z.literal("")]) }),
  CONTACT: z.object({
    ...orderSettings,
    address: short,
    phone: short,
    instagram: link,
    facebook: link,
    timezone,
  }),
  CURRENCY: monetarySettings,
};

export type Kind = keyof typeof options;
export type MenuOptions<K extends Kind> = z.output<(typeof options)[K]>;

type Field = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "checkbox" | "time" | "datetime-local" | "url" | "color" | "select" | "image" | "date" | "days" | "targets" | "schedule" | "list" | "groups" | "currencies";
  initial: string | boolean;
  choices?: readonly (readonly [string, string])[];
  step?: string;
  optional?: boolean;
};

const dateFields: Field[] = [
  { name: "starts", label: "Inicio (hora del restaurante)", type: "datetime-local", initial: "", optional: true },
  { name: "ends", label: "Fin (hora del restaurante)", type: "datetime-local", initial: "", optional: true },
  { name: "days", label: "Días de la semana (vacío: todos)", type: "days", initial: "", optional: true },
  { name: "opens", label: "Desde", type: "time", initial: "", optional: true },
  { name: "closes", label: "Hasta", type: "time", initial: "", optional: true },
];
const behaviorChoices: Field["choices"] = behaviors.map((behavior, index) => [behavior, [
  "Mostrar normalmente", "Destacar", "Mover al final", "Ocultar", "Marcar como no disponible",
][index]]);

export const weekdays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const pricing: Field[] = [
  { name: "price", label: "Precio en moneda base", type: "number", initial: "0", step: "0.01" },
  { name: "usd", label: "Precio USD fijo (base MXN)", type: "number", initial: "", step: "0.01", optional: true },
  { name: "available", label: "Disponible para el carrito", type: "checkbox", initial: true },
];

type Panel = { title: string; kind: Kind; fields: Field[]; singleton?: boolean; admin?: boolean; media?: boolean };
export const panels: Record<string, Panel> = {
  platillos: { title: "Platillos", kind: "PRODUCT", media: true, fields: [
    ...pricing,
    { name: "details", label: "Descripción completa", type: "textarea", initial: "", optional: true },
    { name: "tags", label: "Etiquetas (separadas por coma)", type: "list", initial: "", optional: true },
    { name: "ingredients", label: "Ingredientes (separados por coma)", type: "list", initial: "", optional: true },
    { name: "allergens", label: "Alérgenos (separados por coma)", type: "list", initial: "", optional: true },
    { name: "nutrition", label: "Información alimentaria", type: "textarea", initial: "", optional: true },
    { name: "groups", label: "Variantes y complementos", type: "groups", initial: "", optional: true },
  ] },
  categorias: { title: "Categorías", kind: "CATEGORY", media: true, fields: [
    { name: "scheduleId", label: "Regla de horario asociada", type: "schedule", initial: "", optional: true },
  ] },
  paquetes: { title: "Paquetes y combos", kind: "COMBO", media: true, fields: [
    ...pricing,
    { name: "priceMode", label: "Tipo de precio", type: "select", initial: "fixed", choices: [["fixed", "Fijo"], ["calculated", "Suma de los platillos"]] },
    ...dateFields,
  ] },
  promociones: { title: "Promociones", kind: "PROMOTION", media: true, fields: [
    { name: "method", label: "Tipo de promoción", type: "select", initial: "notice", choices: [["notice", "Anuncio"], ["percent", "Descuento porcentual"], ["fixed", "Descuento fijo"], ["price", "Precio promocional"]] },
    { name: "amount", label: "Importe en centavos o porcentaje entero", type: "number", initial: "0" },
    { name: "minimum", label: "Unidades de cada grupo promocional", type: "number", initial: "1" },
    { name: "targets", label: "Platillos, categorías y paquetes", type: "targets", initial: "", optional: true },
    { name: "priority", label: "Prioridad (mayor primero)", type: "number", initial: "0" },
    { name: "stacking", label: "Permitir acumulación con otras promociones acumulables", type: "checkbox", initial: false },
    { name: "restrictions", label: "Restricciones que verá el cliente", type: "textarea", initial: "", optional: true },
    { name: "banner", label: "Mostrar como banner", type: "checkbox", initial: false },
    ...dateFields,
  ] },
  horarios: { title: "Horarios y disponibilidad", kind: "HOURS", fields: [
    { name: "mode", label: "Tipo de regla", type: "select", initial: "menu", choices: [["menu", "Disponibilidad del menú"], ["restaurant", "Horario del restaurante"], ["closed", "Cierre especial"]] },
    { name: "days", label: "Días de apertura (vacío: todos)", type: "days", initial: "", optional: true },
    { name: "date", label: "Aplicar solo en esta fecha", type: "date", initial: "", optional: true },
    { name: "opens", label: "Apertura", type: "time", initial: "12:00" },
    { name: "closes", label: "Cierre (igual a apertura: todo el día)", type: "time", initial: "22:00" },
    { name: "targets", label: "Categorías, platillos, paquetes y promociones", type: "targets", initial: "", optional: true },
    { name: "priority", label: "Prioridad (mayor primero)", type: "number", initial: "0" },
    { name: "inside", label: "Comportamiento durante el horario", type: "select", initial: "normal", choices: behaviorChoices },
    { name: "outside", label: "Comportamiento fuera del horario", type: "select", initial: "unavailable", choices: behaviorChoices },
    { name: "blockOutside", label: "Bloquear pedidos fuera del horario", type: "checkbox", initial: true },
  ] },
  diseno: { title: "Diseño del menú", kind: "DESIGN", singleton: true, media: true, fields: [
    { name: "eyebrow", label: "Texto superior", type: "text", initial: "Cocina italiana" },
    { name: "logoId", label: "Logotipo", type: "image", initial: "", optional: true },
    { name: "accent", label: "Color de acento", type: "color", initial: "#a84027" },
    { name: "background", label: "Color de fondo", type: "color", initial: "#f8f4e9" },
  ] },
  secciones: { title: "Constructor de secciones", kind: "SECTION", media: true, fields: [
    { name: "type", label: "Contenido", type: "select", initial: "text", choices: [
      ["text", "Texto e imagen"], ["promotions", "Promociones"], ["combos", "Paquetes"], ["catalog", "Catálogo"],
    ] },
    { name: "label", label: "Texto del enlace", type: "text", initial: "", optional: true },
    { name: "url", label: "Destino del enlace", type: "url", initial: "", optional: true },
  ] },
  plantillas: { title: "Plantillas y exportaciones", kind: "TEMPLATE", fields: [
    { name: "content", label: "Contenido de la pieza", type: "select", initial: "menu", choices: [
      ["menu", "Carta completa"], ["bundles", "Paquetes"], ["promotions", "Promociones"],
    ] },
    { name: "background", label: "Fondo", type: "color", initial: "#f8f4e9" },
    { name: "foreground", label: "Texto", type: "color", initial: "#242720" },
    { name: "accent", label: "Acento", type: "color", initial: "#a84027" },
    { name: "format", label: "Formato", type: "select", initial: "portrait", choices: [["portrait", "Vertical"], ["square", "Cuadrado"]] },
  ] },
  pedidos: { title: "Pedidos y WhatsApp", kind: "CONTACT", singleton: true, admin: true, fields: [
    { name: "whatsapp", label: "Número internacional completo de WhatsApp", type: "text", initial: "", optional: true },
    { name: "countryCode", label: "Código de país (por ejemplo, 52)", type: "text", initial: "", optional: true },
    { name: "cartEnabled", label: "Habilitar carrito", type: "checkbox", initial: true },
    { name: "acceptedCurrency", label: "Moneda principal aceptada por el restaurante", type: "select", initial: "MXN", choices: [["MXN", "MXN"], ["USD", "USD"]] },
    { name: "actionText", label: "Texto del botón de WhatsApp", type: "text", initial: "", optional: true },
    { name: "introduction", label: "Introducción del mensaje", type: "textarea", initial: "Hola, quisiera realizar el siguiente pedido.", optional: true },
    { name: "confirmationText", label: "Mensaje visual al abrir WhatsApp", type: "textarea", initial: "Tu solicitud está preparada para que la envíes por WhatsApp.", optional: true },
    { name: "customerInstructions", label: "Instrucciones adicionales", type: "textarea", initial: "", optional: true },
    { name: "outsideText", label: "Mensaje fuera del horario", type: "textarea", initial: closedText, optional: true },
    { name: "orderDays", label: "Días de pedidos (vacío: todos)", type: "days", initial: "", optional: true },
    { name: "orderOpens", label: "Inicio del horario de pedidos", type: "time", initial: "", optional: true },
    { name: "orderCloses", label: "Fin del horario de pedidos", type: "time", initial: "", optional: true },
    { name: "logRequests", label: "Registrar solicitudes preparadas y sus notas", type: "checkbox", initial: false },
    { name: "ordering", label: "Habilitar solicitudes", type: "checkbox", initial: false },
    { name: "respectHours", label: "Aceptar solicitudes solo en el horario publicado", type: "checkbox", initial: false },
    { name: "address", label: "Dirección", type: "text", initial: "", optional: true },
    { name: "phone", label: "Teléfono visible", type: "text", initial: "", optional: true },
    { name: "instagram", label: "Instagram", type: "url", initial: "", optional: true },
    { name: "facebook", label: "Facebook", type: "url", initial: "", optional: true },
    { name: "timezone", label: "Zona horaria (IANA)", type: "text", initial: "America/Mexico_City" },
  ] },
  monedas: { title: "Monedas y precios", kind: "CURRENCY", singleton: true, admin: true, fields: [
    { name: "base", label: "Moneda base", type: "select", initial: "MXN", choices: [["MXN", "Pesos mexicanos"], ["USD", "Dólares estadounidenses"]] },
    { name: "enabled", label: "Monedas habilitadas", type: "currencies", initial: "" },
    { name: "direction", label: "Tipo de conversión", type: "select", initial: "mxn-per-usd", choices: [["mxn-per-usd", "MXN por 1 USD"], ["usd-per-mxn", "USD por 1 MXN"]] },
    { name: "rate", label: "Tipo de cambio manual", type: "number", initial: "18", step: "0.000001" },
    { name: "rounding", label: "Redondear conversiones", type: "select", initial: "nearest", choices: [["nearest", "Al valor más cercano"], ["up", "Hacia arriba"], ["down", "Hacia abajo"]] },
    { name: "increment", label: "Incremento de redondeo", type: "select", initial: "1", choices: [["1", "Un centavo"], ["5", "Cinco centavos"], ["100", "Una unidad monetaria"]] },
    { name: "display", label: "Formato de importes", type: "select", initial: "code", choices: [["code", "Código ISO"], ["symbol", "Símbolo"], ["both", "Símbolo y código ISO"]] },
    { name: "mxnSymbol", label: "Símbolo MXN personalizado", type: "text", initial: "", optional: true },
    { name: "usdSymbol", label: "Símbolo USD personalizado", type: "text", initial: "", optional: true },
    { name: "guaranteed", label: "El restaurante garantiza el tipo de cambio publicado", type: "checkbox", initial: false },
  ] },
};

export function panelFor(section: string) {
  return Object.hasOwn(panels, section) ? panels[section] : undefined;
}

export const contentFields = z.object({
  name: short.min(1),
  description: copy,
  position: z.coerce.number<string | number>().int().min(0).max(9999),
  published: z.boolean(),
  categoryId: z.uuid().nullable(),
  mediaId: z.uuid().nullable(),
});

export function parseOptions<K extends Kind>(kind: K, input: unknown): MenuOptions<K> {
  return options[kind].parse(input) as MenuOptions<K>;
}
