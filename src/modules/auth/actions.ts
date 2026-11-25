"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { minuteLimit } from "@/lib/server-limit";
import { verifyPassword } from "./password";
import { endSession, startSession } from "./session";

const credentials = z.object({
  email: z.email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(1).max(256),
});
const loginRate = minuteLimit(180);
const tooMany = "Demasiados intentos. Inténtalo de nuevo en unos minutos.";

export async function signIn(_: string, form: FormData) {
  const result = credentials.safeParse(Object.fromEntries(form));
  if (!result.success) return "Introduce un correo y una contraseña válidos.";
  if (loginRate()) return tooMany;

  const { email, password } = result.data;
  const now = new Date();
  const resetAt = new Date(now.getTime() + 15 * 60 * 1000);
  const emailKey = createHash("sha256").update(email).digest("hex");
  const allowed = await db().$transaction(async tx => {
    const increment = (key: string, limit: number) => tx.$queryRaw<{ count: number }[]>`
      INSERT INTO "LoginAttempt" ("key", "count", "resetAt") VALUES (${key}, 1, ${resetAt})
      ON CONFLICT ("key") DO UPDATE SET
        count = CASE WHEN "LoginAttempt"."resetAt" <= ${now} THEN 1 ELSE "LoginAttempt".count + 1 END,
        "resetAt" = CASE WHEN "LoginAttempt"."resetAt" <= ${now} THEN ${resetAt} ELSE "LoginAttempt"."resetAt" END
      WHERE "LoginAttempt"."resetAt" <= ${now} OR "LoginAttempt".count < ${limit}
      RETURNING count`;
    const [global] = await increment("global", 120);
    if (!global) return false;
    if (global.count === 1) await tx.loginAttempt.deleteMany({ where: { resetAt: { lte: now } } });
    return (await increment(emailKey, 8)).length > 0;
  });
  if (!allowed) return tooMany;

  const user = await db().user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash ?? undefined);
  if (!valid || !user?.active || !user.passwordHash) return "El correo o la contraseña no coinciden.";
  await startSession(user.id);
  redirect("/admin");
}

export async function signOut() {
  await endSession();
  redirect("/admin/login");
}
