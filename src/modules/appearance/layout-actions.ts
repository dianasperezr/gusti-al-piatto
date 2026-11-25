"use server";

import { revalidatePath } from "next/cache";
import { invalidatePublicMenu } from "@/modules/catalog/menu-cache";
import { db } from "@/lib/db";
import { requireUser } from "@/modules/auth/session";
import { mediaUsed, visualLayout, type VisualLayout } from "./layout-schema";
import { draftKey, publishedKey } from "./layout-store";
import type { FormStatus } from "@/modules/admin/content-actions";

export async function saveVisual(input: VisualLayout, publish: boolean): Promise<FormStatus> {
  const actor = await requireUser();
  if (typeof publish !== "boolean") return { error: "Operación inválida." };
  const result = visualLayout.safeParse(input);
  if (!result.success) return { error: result.error.issues[0]?.message ?? "Revisa las secciones del menú." };
  const value = result.data;
  try {
    await db().$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(672554)::text`;
      const ids = mediaUsed(value);
      const media = await tx.media.findMany({ where: { id: { in: ids } }, select: { id: true, mime: true } });
      if (media.length !== ids.length) throw new Error("Revisa los archivos seleccionados. Al menos uno dejó de existir.");
      if (value.style.logoId && !media.find(asset => asset.id === value.style.logoId)?.mime.startsWith("image/")) {
        throw new Error("Revisa el logotipo. Debe ser una imagen.");
      }
      const categoryIds = [...new Set(value.sections.map(section => section.categoryId).filter(Boolean))];
      if (await tx.content.count({ where: { kind: "CATEGORY", id: { in: categoryIds }, archivedAt: null } }) !== categoryIds.length) {
        throw new Error("Revisa las categorías seleccionadas.");
      }
      await tx.integrationState.upsert({ where: { key: draftKey }, create: { key: draftKey, value }, update: { value } });
      if (publish) await tx.integrationState.upsert({ where: { key: publishedKey }, create: { key: publishedKey, value }, update: { value } });
      await tx.audit.create({ data: { userId: actor.id, action: publish ? "Publicar diseño del menú" : "Guardar borrador del menú", target: value.style.name } });
    });
    revalidatePath("/admin/preview");
    if (publish) invalidatePublicMenu();
  } catch (error) {
    return { error: error instanceof Error && error.message.startsWith("Revisa") ? error.message : "No se pudo guardar el diseño." };
  }
  return { success: publish ? "Diseño publicado." : "Borrador guardado." };
}

type VisualStatus = FormStatus & { revision?: number };

export async function saveVisualForm(_: VisualStatus, form: FormData): Promise<VisualStatus> {
  const raw = form.get("layout");
  if (typeof raw !== "string" || raw.length > 160_000) return { error: "Diseño inválido." };
  let layout: VisualLayout;
  try {
    layout = JSON.parse(raw);
  } catch {
    return { error: "Diseño inválido." };
  }
  const result = await saveVisual(layout, form.get("operation") === "publish");
  return { ...result, revision: result.success ? Date.now() : undefined };
}
