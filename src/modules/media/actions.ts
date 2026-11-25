"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { invalidatePublicMenu } from "@/modules/catalog/menu-cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/modules/auth/session";
import { mediaUsed, visualLayout } from "@/modules/appearance/layout-schema";
import type { FormStatus } from "@/modules/admin/content-actions";
import type { MediaOption } from "./picker";
import { storage } from "./files";
import { maxBytes, processImage, processVideo } from "./process";

export async function saveMedia(id: string | null, _: FormStatus, form: FormData): Promise<FormStatus & { asset?: MediaOption }> {
  const user = await requireUser();
  const file = form.get("file");
  const poster = form.get("poster");
  const folder = z.enum(["dishes", "categories", "bundles", "promotions", "restaurant", "logos", "banners", "exports"]).safeParse(form.get("folder") ?? "restaurant");
  if (!(file instanceof File) || !file.size || file.size > maxBytes() || !folder.success || (id && !z.uuid().safeParse(id).success)) {
    return { error: "Selecciona un archivo válido dentro del límite de tamaño." };
  }

  const filename = randomUUID();
  const thumbnail = "uploads/thumbnails/" + filename + ".webp";
  let path: string | undefined;
  let asset: MediaOption;
  const original = id ? await db().media.findUnique({ where: { id } }) : null;
  try {
    if (id && !original) return { error: "No se encontró el archivo original." };
    const video = file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name);
    if (original && video !== original.mime.startsWith("video/")) return { error: "Reemplaza el archivo con el mismo tipo de contenido." };
    const processed = video ? await processVideo(file, poster instanceof File ? poster : undefined) : await processImage(file, form);
    path = "uploads/" + folder.data + "/" + filename + "." + processed.ext;
    await storage.put(path, processed.data);
    await storage.put(thumbnail, processed.thumbnail);

    const details = { path, thumbnail, mediaType: video ? "VIDEO" as const : "IMAGE" as const, name: file.name.slice(0, 150), mime: processed.mime, size: processed.data.length, duration: processed.duration };
    const record = await db().$transaction(async tx => {
      if (original) {
        const updated = await tx.media.updateMany({ where: { id: original.id, path: original.path }, data: details });
        if (updated.count !== 1) throw new Error("Revisa el archivo. Otro usuario lo modificó.");
      }
      const record = original ?? await tx.media.create({ data: details, select: { id: true } });
      await tx.audit.create({ data: { userId: user.id, action: original ? "Reemplazar archivo" : "Subir archivo", target: details.name } });
      return record;
    });
    asset = { id: record.id, name: details.name, mime: details.mime, hasThumbnail: true };
  } catch (error) {
    if (path) await storage.remove(path);
    await storage.remove(thumbnail);
    return { error: error instanceof Error && /^Revisa/.test(error.message) ? error.message : "No se pudo procesar el archivo. Revisa el formato y la instalación de FFmpeg." };
  }

  if (original) {
    await storage.remove(original.path ?? original.id);
    if (original.thumbnail) await storage.remove(original.thumbnail);
  }
  revalidatePath("/admin/multimedia");
  invalidatePublicMenu();
  return { success: id ? "Archivo reemplazado." : "Archivo subido.", asset };
}

export async function deleteMedia(id: string): Promise<FormStatus> {
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) return { error: "Archivo inválido." };

  try {
    const media = await db().$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(672554)::text`;
      const layouts = await tx.integrationState.findMany({ where: { key: { in: ["visual:draft", "visual:published"] } } });
      if (layouts.some(layout => {
        const current = visualLayout.safeParse(layout.value);
        return current.success && mediaUsed(current.data).includes(id);
      })) throw new Error("Archivo usado por el constructor visual.");
      await tx.$queryRaw`SELECT id FROM "media_assets" WHERE id = ${id}::uuid FOR UPDATE`;
      const logo = await tx.content.findFirst({ where: { kind: { in: ["DESIGN", "TEMPLATE"] }, options: { path: ["logoId"], equals: id } } });
      if (logo) throw new Error("Logotipo en uso.");
      const media = await tx.media.delete({ where: { id } });
      await tx.audit.create({ data: { userId: user.id, action: "Eliminar archivo", target: media.name } });
      return media;
    });
    await storage.remove(media.path ?? media.id);
    if (media.thumbnail) await storage.remove(media.thumbnail);
  } catch {
    return { error: "No se pudo eliminar. Desvincula primero el archivo del contenido." };
  }
  revalidatePath("/admin/multimedia");
  invalidatePublicMenu();
  return { success: "Archivo eliminado." };
}
