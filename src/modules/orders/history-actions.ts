"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/modules/auth/session";
import type { FormStatus } from "@/modules/admin/content-actions";

export async function cancelRequest(id: string): Promise<FormStatus> {
  const actor = await requireUser(true);
  if (!z.uuid().safeParse(id).success) return { error: "Solicitud inválida." };
  try {
    await db().$transaction(async tx => {
      const record = await tx.orderRequest.update({
        where: { id, status: "LINK_GENERATED" }, data: { status: "CANCELLED" }, select: { reference: true },
      });
      await tx.audit.create({ data: {
        userId: actor.id, entityType: "ORDER_INTENT", entityId: id,
        action: "Cancelar referencia local", target: record.reference,
        previousData: { status: "LINK_GENERATED" }, newData: { status: "CANCELLED" },
      } });
    });
  } catch {
    return { error: "La solicitud ya no se puede cancelar." };
  }
  revalidatePath("/admin/solicitudes");
  return { success: "Referencia cancelada en el historial local." };
}
