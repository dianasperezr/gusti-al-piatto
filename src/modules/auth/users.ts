"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import type { FormStatus } from "@/modules/admin/content-actions";
import { hashPassword } from "./password";
import { requireUser } from "./session";

const fields = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(254).transform(value => value.toLowerCase()),
  role: z.enum(["ADMIN", "EDITOR"]),
  password: z.union([z.literal(""), z.string().min(12).max(256)]),
});

export async function saveUser(id: string | null, _: FormStatus, form: FormData): Promise<FormStatus> {
  const user = await requireUser(true);
  const parsed = fields.safeParse(Object.fromEntries(form));
  if (!parsed.success || (!id && !parsed.data.password) || (id && !z.uuid().safeParse(id).success)) {
    return { error: "Revisa el correo, el nombre y la contraseña (mínimo 12 caracteres)." };
  }
  const { password, ...profile } = parsed.data;
  const active = form.get("active") === "on";
  if (id === user.id && (!active || profile.role !== "ADMIN")) {
    return { error: "Tu cuenta debe conservar el acceso de administrador." };
  }

  try {
    const passwordHash = password ? await hashPassword(password) : undefined;
    await db().$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "users" ORDER BY id FOR UPDATE`;
      const actor = await tx.user.findUnique({ where: { id: user.id } });
      if (actor?.role !== "ADMIN" || !actor.active) throw new Error("Acceso revocado.");
      if (id) {
        await tx.user.update({ where: { id }, data: { ...profile, active, ...(passwordHash ? { passwordHash } : {}) } });
        if (passwordHash || !active) await tx.session.deleteMany({ where: { userId: id } });
      } else if (passwordHash) {
        await tx.user.create({ data: { ...profile, active, passwordHash } });
      }
      await tx.audit.create({ data: { userId: user.id, action: "Guardar usuario", target: profile.email } });
    });
  } catch {
    return { error: "No se pudo guardar la cuenta. Comprueba que el correo esté disponible." };
  }

  revalidatePath("/admin/usuarios");
  return { success: "Cuenta guardada." };
}
