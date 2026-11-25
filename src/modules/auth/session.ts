import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

const cookieName = "gusti_session";
const sessionAge = 7 * 24 * 60 * 60;
const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function currentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;

  const session = await db().session.findUnique({
    where: { hash: tokenHash(token) },
    select: { expiresAt: true, user: { select: { id: true, name: true, role: true, active: true } } },
  });

  return session && session.expiresAt > new Date() && session.user.active ? session.user : null;
}

export async function requireUser(adminOnly = false) {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  if (adminOnly && user.role !== "ADMIN") redirect("/admin");
  return user;
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + sessionAge * 1000);
  await db().$transaction([
    db().session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    db().session.create({ data: { hash: tokenHash(token), expiresAt, userId } }),
  ]);
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production",
    maxAge: sessionAge,
    path: "/",
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await db().session.deleteMany({ where: { hash: tokenHash(token) } });
  jar.delete(cookieName);
}
