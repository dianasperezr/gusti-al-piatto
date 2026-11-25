import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { publicMenuTag } from "./menu-cache";
import { getVisual } from "@/modules/appearance/layout-store";
import { mediaUsed } from "@/modules/appearance/layout-schema";
import { db } from "@/lib/db";
import { parseOptions } from "@/modules/admin/config";
import { withinOrderHours } from "@/modules/orders/settings";
import { evaluateRules, inWindow, localDateTimeAt } from "@/modules/hours/rules";
import type { Offer } from "@/modules/promotions/offer-pricing";
import type { CatalogItem, PublicMedia } from "./pricing";

const mediaInfo = { select: { id: true, mime: true, thumbnail: true } } as const;
const mediaUrl = (id: string) => `/media/${id}`;
const describeMedia = (media: { id: string; mime: string; thumbnail: string | null } | null): PublicMedia | null => media && ({
  src: mediaUrl(media.id), video: media.mime.startsWith("video/"),
  poster: media.thumbnail ? mediaUrl(media.id) + "?thumbnail=1" : undefined,
});

type Ranked = { featured: boolean; last: boolean };
const rank = (a: Ranked, b: Ranked) => Number(a.last) - Number(b.last) || Number(b.featured) - Number(a.featured);

async function readMenu(preview = false) {
  const recordsPromise = db().content.findMany({
    where: { published: true, active: true, archivedAt: null, kind: { not: "TEMPLATE" } },
    select: { id: true, name: true, kind: true, description: true, options: true, position: true,
      categoryId: true, subcategoryId: true, featured: true, priceCents: true, slug: true, media: mediaInfo,
      comboItems: { select: { productId: true, quantity: true } },
      gallery: { orderBy: { position: "asc" }, select: { media: mediaInfo } },
    },
    orderBy: [{ position: "asc" }, { name: "asc" }, { id: "asc" }],
  });
  const [records, visual] = await Promise.all([recordsPromise, getVisual(preview)]);
  const ids = visual ? mediaUsed(visual) : [];
  const assets = ids.length ? await db().media.findMany({ where: { id: { in: ids } }, ...mediaInfo }) : [];
  return { records, visual, assets };
}

const publicMenuData = unstable_cache(() => readMenu(), ["public-menu-v1"], { tags: [publicMenuTag], revalidate: 60 });
const renderMenuData = cache(publicMenuData);

export async function getMenu(date = new Date(), preview = false, fresh = false) {
  const { records, visual, assets } = preview || fresh ? await readMenu(preview) : await renderMenuData();
  const design = records.find(record => record.kind === "DESIGN");
  const appearance = parseOptions("DESIGN", design?.options ?? {
    eyebrow: "Cocina italiana", accent: "#a84027", background: "#f8f4e9", logoId: "",
  });
  const contact = parseOptions("CONTACT", records.find(record => record.kind === "CONTACT")?.options ?? {
    whatsapp: "", ordering: false, address: "", phone: "", instagram: "", facebook: "", timezone: "America/Mexico_City",
  });
  const money = parseOptions("CURRENCY", records.find(record => record.kind === "CURRENCY")?.options ?? {});
  const { rate, base } = money;
  const now = localDateTimeAt(date, contact.timezone);
  const schedules = records.filter(record => record.kind === "HOURS").map(record => ({
    id: record.id, name: record.name, position: record.position, ...parseOptions("HOURS", record.options),
  }));
  const closed = schedules.some(rule => rule.mode === "closed" && inWindow(now, rule));
  const open = !closed && schedules.some(rule => rule.mode === "restaurant" && inWindow(now, rule));
  const categoryStatus = new Map(records.filter(record => record.kind === "CATEGORY").map(record => {
    const { scheduleId } = parseOptions("CATEGORY", record.options);
    return [record.id, { record, scheduleId }];
  }));
  const rankWith = (behavior: string, featured: boolean) => ({
    featured: behavior === "featured" || (behavior === "normal" && featured),
    last: behavior === "last",
  });

  const categories = [...categoryStatus.values()].filter(entry => !entry.record.categoryId).flatMap(({ record, scheduleId }) => {
    const state = evaluateRules(now, schedules, [record.id, scheduleId]);
    return state.behavior === "hidden" ? [] : [{
      id: record.id, name: record.name, description: record.description, media: describeMedia(record.media),
      ...rankWith(state.behavior, record.featured),
    }];
  }).sort(rank);

  const offerCards = records.flatMap(record => {
    if (record.kind !== "PROMOTION") return [];
    const offer = parseOptions("PROMOTION", record.options);
    const state = evaluateRules(now, schedules, [record.id]);
    if (!inWindow(now, offer) || ["hidden", "unavailable"].includes(state.behavior) || !state.orderable) return [];
    return [{ ...offer, id: record.id, name: record.name, description: record.description, media: describeMedia(record.media),
      ...rankWith(state.behavior, record.featured) }];
  }).sort(rank);
  const offersFor = (ids: Array<string | null>): Offer[] =>
    offerCards.filter(offer => !offer.targets.length || offer.targets.some(target => ids.includes(target)))
      .map(({ id, name, method, amount, minimum, priority, stacking, targets }) => ({ id, name, method, amount, minimum, priority, stacking, targets }));

  const items: CatalogItem[] = [];
  const productRefs = new Map<string, CatalogItem>();
  for (const record of records.filter(entry => entry.kind === "PRODUCT")) {
    const main = record.categoryId ? categoryStatus.get(record.categoryId) : null;
    const sub = record.subcategoryId ? categoryStatus.get(record.subcategoryId) : null;
    if ((record.categoryId && (!main || !categories.some(category => category.id === record.categoryId))) ||
      (record.subcategoryId && (!sub || sub.record.categoryId !== record.categoryId))) continue;
    const parentBehavior = main && evaluateRules(now, schedules, [main.record.id, main.scheduleId]);
    const subBehavior = sub && evaluateRules(now, schedules, [sub.record.id, sub.scheduleId]);
    const state = evaluateRules(now, schedules, [record.id, record.categoryId ?? "", record.subcategoryId ?? "", main?.scheduleId ?? "", sub?.scheduleId ?? ""]);
    if (state.behavior === "hidden" || subBehavior?.behavior === "hidden") continue;
    const data = parseOptions("PRODUCT", record.options);
    const item: CatalogItem = {
      id: record.id, slug: record.slug ?? undefined, kind: "PRODUCT", name: record.name,
      description: record.description, details: data.details, tags: data.tags, ingredients: data.ingredients,
      allergens: data.allergens, nutrition: data.nutrition, groups: data.groups, components: [],
      media: describeMedia(record.media), gallery: record.gallery.flatMap(asset => describeMedia(asset.media) ?? []),
      categoryId: record.categoryId, subcategory: sub?.record.name ?? null,
      priceCents: record.priceCents ?? 0,
      available: data.available && state.orderable && (parentBehavior?.orderable ?? true) && (subBehavior?.orderable ?? true),
      ...rankWith(state.behavior, record.featured),
      offers: offersFor([record.id, record.categoryId, record.subcategoryId]),
    };
    items.push(item);
    productRefs.set(item.id, item);
  }
  const productRecords = new Map(records.filter(record => record.kind === "PRODUCT").map(record => [record.id, record]));
  for (const record of records.filter(entry => entry.kind === "COMBO")) {
    const data = parseOptions("COMBO", record.options);
    if (!inWindow(now, data)) continue;
    const state = evaluateRules(now, schedules, [record.id]);
    if (state.behavior === "hidden") continue;
    const components = record.comboItems.flatMap(({ productId, quantity }) => {
      const product = productRecords.get(productId);
      return product ? [{ id: productId, name: product.name, quantity, priceCents: product.priceCents ?? 0 }] : [];
    });
    const sum = components.reduce((total, item) => total + item.quantity * item.priceCents, 0);
    items.push({
      id: record.id, kind: "COMBO", name: record.name, description: record.description, groups: [], components,
      media: describeMedia(record.media), gallery: record.gallery.flatMap(asset => describeMedia(asset.media) ?? []),
      categoryId: null, subcategory: null,
      priceCents: data.priceMode === "calculated" ? Math.min(sum, 100_000_000) : record.priceCents ?? 0,
      available: data.available && state.orderable && record.comboItems.length > 0 &&
        (data.priceMode !== "calculated" || sum <= 100_000_000) &&
        record.comboItems.every(({ productId }) => productRefs.get(productId)?.available),
      ...rankWith(state.behavior, record.featured), offers: offersFor([record.id]),
    });
  }
  const hours = schedules.filter(rule => rule.mode !== "menu");
  const refresh = !!contact.orderOpens || contact.orderDays.length > 0 || schedules.length > 0 || records.some(record => {
    if (record.kind !== "PROMOTION" && record.kind !== "COMBO") return false;
    const window = record.kind === "PROMOTION" ? parseOptions("PROMOTION", record.options) : parseOptions("COMBO", record.options);
    return Boolean(window.starts || window.ends || window.opens || window.closes || window.days.length);
  });

  const visuals = new Map(assets.map(asset => [asset.id, describeMedia(asset)]));
  return {
    visual: visual ? {
      style: visual.style,
      sections: visual.sections.filter(section => !section.hidden).map(section => ({
        ...section, assets: section.media.flatMap(id => visuals.get(id) ?? []),
      })),
    } : null,
    name: visual?.style.name ?? design?.name ?? "Gusti al piatto",
    headline: visual?.style.description ?? design?.description ?? "La cocina italiana, servida a tu manera.",
    cover: visual ? visuals.get(visual.style.coverId) ?? null : describeMedia(design?.media ?? null),
    logo: (visual?.style.logoId ?? appearance.logoId) ? mediaUrl(visual?.style.logoId ?? appearance.logoId) : "",
    appearance, contact, orderOpen: withinOrderHours(contact, open, closed, date), money, rate, base, categories, items: items.sort(rank), promotions: offerCards,
    hours, open, closed, refresh,
    sections: records.filter(record => record.kind === "SECTION").map(record => ({
      id: record.id, name: record.name, description: record.description, media: describeMedia(record.media),
      ...parseOptions("SECTION", record.options),
    })),
  };
}

export type MenuData = Awaited<ReturnType<typeof getMenu>>;
