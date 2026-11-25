import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getMenu } from "@/modules/catalog/menu";
import { quoteCart } from "@/modules/catalog/pricing";
import { closedText } from "./settings";
import { whatsappMessage, type OrderInput, type OrderLine, type QuoteReply } from "./checkout";

const reply = (data: object, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function checkout(input: OrderInput) {
  const menu = await getMenu(new Date(), false, true);
  const { contact, money } = menu;
  const { currency, lines, confirmation } = input;
  if (!money.enabled.includes(currency)) return reply({ error: "La moneda seleccionada ya no está habilitada." }, 409);
  if (!contact.cartEnabled || menu.visual?.style.cartVisible === false || !contact.ordering || !contact.whatsapp) {
    return reply({ error: "Las solicitudes por WhatsApp están desactivadas." }, 409);
  }
  if (!menu.orderOpen) return reply({ error: contact.outsideText || closedText }, 409);
  const active = new Map(menu.items.filter(item => item.available).map(item => [item.id, item]));
  const entries = lines.map(line => ({ ...line, item: active.get(line.id) }));
  const quotes = quoteCart(entries, currency, menu.rate, menu.base, money);
  const baseQuotes = currency === menu.base ? quotes : quoteCart(entries, menu.base, menu.rate, menu.base, money);
  const finalLines: OrderLine[] = [];
  const unique = new Set<string>();
  for (const [index, { id, quantity, item, note, selections }] of entries.entries()) {
    const quote = quotes[index];
    if (!item || !quote) return reply({ error: "Un platillo o complemento cambió de disponibilidad. Actualiza tu selección." }, 409);
    const key = JSON.stringify([id, quote.labels, note]);
    if (unique.has(key)) return reply({ error: "Combina las unidades de los artículos con las mismas opciones y notas." }, 400);
    unique.add(key);
    finalLines.push({
      id, name: item.name, quantity, selections, note, ...quote, baseUnit: baseQuotes[index]?.unit ?? quote.unit,
      components: item.components.map(component => `${component.quantity} × ${component.name} por paquete`),
    });
  }

  const totals = {
    lines: finalLines, currency, baseCurrency: menu.base, name: input.name, note: input.note,
    subtotal: finalLines.reduce((sum, line) => sum + line.subtotal, 0),
    discount: finalLines.reduce((sum, line) => sum + line.discount, 0),
    total: finalLines.reduce((sum, line) => sum + line.total, 0),
    baseTotal: baseQuotes.reduce((sum, line) => sum + (line?.total ?? 0), 0),
    exchange: { rate: menu.rate, direction: money.direction, updatedAt: money.updatedAt, guaranteed: money.guaranteed },
  };
  function version(id: string) {
    const summary = { ...totals, reference: "ORD-" + id.replaceAll("-", "").slice(0, 16).toUpperCase() };
    const message = whatsappMessage(summary, contact.introduction, contact.acceptedCurrency);
    const fingerprint = createHash("sha256").update(JSON.stringify([id, summary, contact.whatsapp, message])).digest("hex");
    const result: QuoteReply = { id, fingerprint, summary };
    return { result, message };
  }
  const { result, message } = version(confirmation?.id ?? randomUUID());
  const { id, summary, fingerprint } = result;
  if (!confirmation) return reply(result);
  if (confirmation.fingerprint !== fingerprint) return reply({ ...version(randomUUID()).result, changed: true });

  const url = `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(message.toWellFormed())}`;
  if (url.length > 12000) return reply({ error: "Reduce el tamaño del carrito o de las notas para abrir WhatsApp." }, 413);
  if (contact.logRequests) {
    const { name, ...snapshot } = summary;
    void name;
    const existing = await db().$transaction(async tx => {
      const { count } = await tx.orderRequest.createMany({
        data: {
          id, reference: summary.reference, snapshot: { ...snapshot, fingerprint },
          customerNote: summary.note || null, currencyCode: currency, baseCurrency: menu.base,
          exchangeRateSnapshot: String(summary.exchange.rate),
          subtotalCents: summary.subtotal, discountCents: summary.discount, totalCents: summary.total,
          whatsappLinkGeneratedAt: new Date(),
        },
        skipDuplicates: true,
      });
      if (count) {
        await tx.orderIntentItem.createMany({
          data: finalLines.map((line, index) => ({
            orderIntentId: id, itemType: entries[index].item?.kind === "COMBO" ? "BUNDLE" : "DISH",
            itemId: line.id, itemNameSnapshot: line.name, quantity: line.quantity,
            unitPriceCents: line.unit, subtotalCents: line.subtotal, configurationSnapshot: line,
          })),
        });
      }
      return tx.orderRequest.findUnique({ where: { id }, select: { status: true, snapshot: true } });
    });
    const current = existing?.snapshot as { fingerprint?: string } | undefined;
    if (current?.fingerprint !== fingerprint || existing?.status === "CANCELLED") {
      return reply({ error: "Vuelve a revisar la solicitud para generar una nueva referencia." }, 409);
    }
  }
  return reply({ ...result, url });
}
