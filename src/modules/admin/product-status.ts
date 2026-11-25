import { z } from "zod";

export const productStatuses = {
  draft: { label: "Activo · Borrador", published: false, active: true, featured: false },
  published: { label: "Publicado · Activo", published: true, active: true, featured: false },
  featured: { label: "Publicado · Destacado", published: true, active: true, featured: true },
  featuredDraft: { label: "Activo · Borrador destacado", published: false, active: true, featured: true },
  inactive: { label: "Desactivado · Borrador", published: false, active: false, featured: false },
  inactiveFeaturedDraft: { label: "Desactivado · Borrador destacado", published: false, active: false, featured: true },
  inactivePublished: { label: "Desactivado · Publicado", published: true, active: false, featured: false },
  inactiveFeatured: { label: "Desactivado · Publicado destacado", published: true, active: false, featured: true },
} as const;

type ProductStatus = keyof typeof productStatuses;
type StatusFlags = { published: boolean; active: boolean; featured: boolean };

export const productStatus = z.custom<ProductStatus>(value =>
  typeof value === "string" && Object.hasOwn(productStatuses, value), "Selecciona un estado válido.");

export function statusFor(flags?: StatusFlags): ProductStatus {
  if (!flags) return "draft";
  return (Object.keys(productStatuses) as ProductStatus[]).find(key => {
    const { published, active, featured } = productStatuses[key];
    return published === flags.published && active === flags.active && featured === flags.featured;
  }) ?? "draft";
}
