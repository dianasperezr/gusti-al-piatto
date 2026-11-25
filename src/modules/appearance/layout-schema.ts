import { z } from "zod";

export const sectionNames = {
  hero: "Portada principal", banner: "Banner", daily: "Menú del día", featured: "Platillos destacados",
  catalog: "Categorías y platillos", combos: "Paquetes", promotions: "Promociones", gallery: "Galería",
  videos: "Videos", info: "Información del restaurante", contact: "Contacto", footer: "Pie de página",
} as const;
export type SectionKind = keyof typeof sectionNames;

export const sectionControls: Record<SectionKind, {
  layout?: boolean;
  category?: boolean;
  limit?: boolean;
  media?: "one" | "images" | "videos" | "all";
}> = {
  hero: { media: "one" },
  banner: { media: "one" },
  catalog: { layout: true, category: true, limit: true, media: "one" },
  daily: { layout: true, category: true, limit: true, media: "one" },
  featured: { layout: true, category: true, limit: true, media: "one" },
  combos: { layout: true, limit: true, media: "one" },
  promotions: { layout: true, limit: true, media: "one" },
  gallery: { layout: true, limit: true, media: "images" },
  videos: { layout: true, limit: true, media: "videos" },
  info: { layout: true, limit: true, media: "all" },
  contact: {},
  footer: {},
};

export const sectionPresentations = { grid: "Cuadrícula", list: "Lista", wide: "Ancho completo" } as const;

export function sectionTitle(section: Pick<VisualSection, "type" | "title">, restaurant: string) {
  const { title, type } = section;
  return title || ({ catalog: "Nuestro menú", contact: "Tu próxima mesa.", footer: restaurant } as Partial<Record<SectionKind, string>>)[type] || "";
}

const text = z.string().trim().max(140);
const paragraphs = z.string().trim().max(2000);
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const asset = z.union([z.uuid(), z.literal("")]);
const external = z.union([z.literal(""), z.url({ protocol: /^https?$/ }).max(1000)]);

export const visualSettings = z.object({
  name: text.min(1), description: paragraphs, logoId: asset, coverId: asset,
  primary: color, secondary: color, background: color,
  typography: z.enum(["classic", "modern", "editorial"]),
  icon: z.enum(["utensils", "leaf", "none"]),
  headerStyle: z.enum(["minimal", "photo", "banner", "compact", "integrated"]),
  fixedHeader: z.boolean(),
  navigation: z.enum(["horizontal", "side", "tabs", "none"]),
  fixedNavigation: z.boolean(), compactMobile: z.boolean(),
  categoryNavigation: z.boolean(),
  cartVisible: z.boolean(),
  orderButton: text.min(1),
});

export const visualSection = z.object({
  id: z.uuid(), type: z.enum(Object.keys(sectionNames) as [SectionKind, ...SectionKind[]]),
  title: text, description: paragraphs, hidden: z.boolean(),
  layout: z.enum(["grid", "list", "wide"]),
  media: z.array(z.uuid()).max(16),
  categoryId: asset,
  limit: z.number().int().min(1).max(48),
  button: text, url: external,
});
export type VisualSection = z.infer<typeof visualSection>;

export const visualLayout = z.object({
  style: visualSettings,
  sections: z.array(visualSection).max(32),
}).refine(layout => new Set(layout.sections.map(section => section.id)).size === layout.sections.length,
"Cada sección requiere un identificador único.");
export type VisualLayout = z.infer<typeof visualLayout>;

const legacyLayout = z.object({ style: z.object({ cartStyle: z.enum(["panel", "center"]) }) });

export function readVisualLayout(input: unknown): VisualLayout | undefined {
  const layout = visualLayout.safeParse(input).data;
  if (!layout || !legacyLayout.safeParse(input).success) return layout;
  const { style } = layout;
  return {
    style: {
      ...style,
      primary: style.primary === "#a84027" ? "#a94f2b" : style.primary,
      secondary: style.secondary === "#303d2c" ? "#56603b" : style.secondary,
      background: style.background === "#f8f4e9" ? "#f8f3e8" : style.background,
    },
    sections: layout.sections.map(section => {
      const { title, type } = section;
      const defaultTitle = (type === "hero" && [sectionNames.hero, style.name].some(name => name.toLowerCase() === title.toLowerCase()))
        || (type === "catalog" && [sectionNames.catalog, "A la carta"].includes(title))
        || ((type === "contact" || type === "footer") && title === sectionNames[type]);
      return defaultTitle ? { ...section, title: "" } : section;
    }),
  };
}

export function mediaUsed(layout: VisualLayout) {
  return [...new Set([layout.style.logoId, layout.style.coverId, ...layout.sections.flatMap(section => section.media)].filter(Boolean))];
}

export function emptySection(id: string, type: SectionKind): VisualSection {
  const title = ["hero", "catalog", "contact", "footer"].includes(type) ? "" : sectionNames[type];
  return { id, type, title, description: "", hidden: false, layout: "grid", media: [], categoryId: "", limit: 12, button: "", url: "" };
}
