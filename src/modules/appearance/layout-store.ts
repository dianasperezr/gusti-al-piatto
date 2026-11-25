import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { parseOptions } from "@/modules/admin/config";
import { emptySection, readVisualLayout, type SectionKind, type VisualLayout } from "./layout-schema";

export const draftKey = "visual:draft";
export const publishedKey = "visual:published";

async function visualStates(preview: boolean) {
  const states = await db().integrationState.findMany({ where: { key: { in: preview ? [draftKey, publishedKey] : [publishedKey] } } });
  return {
    draft: readVisualLayout(states.find(state => state.key === draftKey)?.value),
    published: readVisualLayout(states.find(state => state.key === publishedKey)?.value),
  };
}

export async function getVisual(preview = false) {
  const { draft, published } = await visualStates(preview);
  return draft ?? published ?? null;
}

export async function initialVisual(): Promise<{ layout: VisualLayout; published: boolean }> {
  const { draft, published } = await visualStates(true);
  const existing = draft ?? published;
  if (existing) return { layout: existing, published: Boolean(published) };
  const records = await db().content.findMany({
    where: { OR: [{ kind: "DESIGN" }, { kind: "SECTION", published: true, archivedAt: null, active: true }] },
    orderBy: { position: "asc" },
  });
  const design = records.find(record => record.kind === "DESIGN");
  const options = design ? parseOptions("DESIGN", design.options) : null;
  const old = records.filter(record => record.kind === "SECTION").map(record => {
    const options = parseOptions("SECTION", record.options);
    const type: SectionKind = options.type === "text" ? "info" : options.type;
    return {
      ...emptySection(record.id, type), title: record.name, description: record.description,
      media: record.mediaId ? [record.mediaId] : [], button: options.label, url: options.url,
    };
  });
  const existingTypes = new Set(old.map(section => section.type));
  const sections = [
    { ...emptySection(randomUUID(), "hero"), title: "" },
    ...old,
    ...(["catalog", "combos", "promotions", "contact", "footer"] as const)
      .filter(type => !existingTypes.has(type)).map(type => emptySection(randomUUID(), type)),
  ];
  return { published: false, layout: {
    style: {
      name: design?.name ?? "Gusti al piatto", description: design?.description ?? "La cocina italiana, servida a tu manera.",
      logoId: options?.logoId ?? "", coverId: design?.mediaId ?? "", primary: options?.accent ?? "#a94f2b",
      secondary: "#56603b", background: options?.background ?? "#f8f3e8",
      typography: "classic", icon: "utensils", headerStyle: "photo", fixedHeader: true, navigation: "horizontal",
      fixedNavigation: false, compactMobile: true, categoryNavigation: true,
      cartVisible: true, orderButton: "Abrir WhatsApp",
    },
    sections,
  } };
}
