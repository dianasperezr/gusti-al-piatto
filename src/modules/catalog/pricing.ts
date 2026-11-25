import type { OptionGroup, Selections } from "../products/options.ts";
import { resolveSelections } from "../products/selection-pricing.ts";
import { applyOffers, type Offer } from "../promotions/offer-pricing.ts";

import type { MonetarySettings, Currency } from "../currencies/settings.ts";
export type { Currency } from "../currencies/settings.ts";
export type PublicMedia = { id?: string; src: string; video: boolean; poster?: string };
export type CatalogItem = {
  id: string;
  slug?: string;
  kind: "PRODUCT" | "COMBO";
  name: string;
  description: string;
  details?: string;
  ingredients?: string[];
  nutrition?: string;
  media: PublicMedia | null;
  gallery: PublicMedia[];
  categoryId: string | null;
  subcategory: string | null;
  priceCents: number;
  available: boolean;
  featured: boolean;
  last: boolean;
  components: { id: string; name: string; quantity: number; priceCents: number }[];
  groups: OptionGroup[];
  offers: Offer[];
};

export function itemMediaList(item: Pick<CatalogItem, "media" | "gallery">) {
  return [...new Map([item.media, ...item.gallery].flatMap(media => media ? [[media.src, media] as const] : [])).values()];
}

export function previewMedia(item: Pick<CatalogItem, "media" | "gallery">) {
  return itemMediaList(item).find(media => !media.video || media.poster);
}

type Conversion = Pick<MonetarySettings, "direction" | "rounding" | "increment">;
export function convertCents(cents: number, from: Currency, to: Currency, rate: number, settings: Conversion = { direction: "mxn-per-usd", rounding: "nearest", increment: 1 }) {
  if (from === to) return cents;
  const scale = BigInt(1_000_000);
  const exchange = BigInt(Math.round(rate * Number(scale)));
  const multiply = (from === "USD") === (settings.direction === "mxn-per-usd");
  const numerator = BigInt(cents) * (multiply ? exchange : scale);
  const step = BigInt(settings.increment);
  const denominator = (multiply ? scale : exchange) * step;
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const roundUp = remainder > BigInt(0) && (settings.rounding === "up" ||
    settings.rounding === "nearest" && remainder * BigInt(2) >= denominator);
  return Number((quotient + BigInt(Number(roundUp))) * step);
}

export function unitCents(item: Pick<CatalogItem, "priceCents">, currency: Currency, rate: number, base: Currency = "MXN", settings?: Conversion) {
  return convertCents(item.priceCents, base, currency, rate, settings);
}

type CartInput = { item?: CatalogItem; quantity: number; selections: Selections };
type Quote = { unit: number; subtotal: number; discount: number; total: number; labels: string[]; offers: string[] };

export function quoteCart(lines: CartInput[], currency: Currency, rate: number, base: Currency, settings?: Conversion) {
  const quotes: Array<Quote | null> = lines.map(() => null);
  const products = new Map<string, { item: CatalogItem; indexes: number[]; quantity: number }>();
  for (const [index, { item, quantity, selections }] of lines.entries()) {
    const options = item && resolveSelections(item.groups, selections);
    if (!item || !options) continue;
    const unit = unitCents(item, currency, rate, base, settings);
    const extras = convertCents(options.extraCents, base, currency, rate, settings);
    const subtotal = (unit + extras) * quantity;
    quotes[index] = { unit: unit + extras, subtotal, discount: 0, total: subtotal, labels: options.labels, offers: [] };
    const group = products.get(item.id) ?? { item, indexes: [], quantity: 0 };
    group.indexes.push(index);
    group.quantity += quantity;
    products.set(item.id, group);
  }
  for (const { item, indexes, quantity } of products.values()) {
    const offer = applyOffers(item.priceCents, quantity, item.offers);
    const unit = unitCents(item, currency, rate, base, settings);
    const discount = Math.min(unit * quantity, convertCents(item.priceCents * quantity - offer.total, base, currency, rate, settings));
    let remainder = discount;
    indexes.forEach((index, position) => {
      const line = quotes[index];
      if (!line) return;
      const share = position === indexes.length - 1 ? remainder : Math.floor(discount * lines[index].quantity / quantity);
      const applied = Math.min(share, unit * lines[index].quantity);
      line.total -= applied;
      line.discount = applied;
      line.offers = applied ? offer.applied : [];
      remainder -= applied;
    });
  }
  return quotes;
}

const priceFormatters = new Map<string, Intl.NumberFormat>();

export function formatPrice(cents: number, currency: Currency, settings?: Pick<MonetarySettings, "display" | "mxnSymbol" | "usdSymbol">) {
  const mode = settings?.display ?? "code";
  const custom = currency === "MXN" ? settings?.mxnSymbol : settings?.usdSymbol;
  const currencyDisplay = mode === "code" ? "code" : "symbol";
  const key = currency + currencyDisplay;
  let formatter = priceFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("es-MX", { style: "currency", currency, currencyDisplay });
    priceFormatters.set(key, formatter);
  }
  if (!custom || mode === "code") return formatter.format(cents / 100) + (mode === "both" ? " " + currency : "");
  const value = formatter.formatToParts(cents / 100)
    .map(part => part.type === "currency" ? custom : part.value).join("");
  return mode === "both" ? value + " " + currency : value;
}
