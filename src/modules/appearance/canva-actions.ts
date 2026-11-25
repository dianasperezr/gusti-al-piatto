"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/modules/auth/session";
import type { FormStatus } from "@/modules/admin/content-actions";
import { disconnectCanva, getCanvaJob, sendToCanva, startCanva } from "./canva";

export async function connectCanva() {
  const user = await requireUser(true);
  const authorization = await startCanva(user.id).catch(() => null);
  redirect(authorization ?? "/admin/canva?resultado=error");
}

export async function unlinkCanva(): Promise<FormStatus> {
  const user = await requireUser(true);
  await disconnectCanva(user.id);
  revalidatePath("/admin/canva");
  return { success: "Cuenta desvinculada de Gusti." };
}

export async function createCanvaJob(_: FormStatus, form: FormData): Promise<FormStatus> {
  const user = await requireUser(true);
  const template = z.uuid().safeParse(form.get("template"));
  if (!template.success) return { error: "Selecciona una plantilla." };
  try {
    await sendToCanva(template.data, user.id);
  } catch (error) {
    return { error: error instanceof Error && /^(Canva|Conecta|Selecciona)/.test(error.message) ? error.message : "No se pudo enviar el diseño a Canva." };
  }
  revalidatePath("/admin/canva");
  return { success: "Importación iniciada. Consulta su estado para abrir el diseño." };
}

export async function checkCanvaJob(): Promise<FormStatus> {
  await requireUser(true);
  let job;
  try {
    job = await getCanvaJob();
  } catch {
    return { error: "No se pudo consultar el estado en Canva." };
  }
  if (job.status === "failed") return { error: "Canva informó que la importación falló." };
  if (job.url) redirect(job.url);
  if (job.status === "success") return { success: "El diseño está disponible en tu cuenta de Canva." };
  return { success: "Canva está procesando el archivo. Consulta de nuevo en unos segundos." };
}
