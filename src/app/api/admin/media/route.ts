import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser } from "@/modules/auth/session";

const search = z.object({
  q: z.string().trim().max(150),
  images: z.enum(["0", "1"]),
  offset: z.coerce.number().int().min(0).max(24_000),
});
const size = 24;
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  if (!await currentUser()) return Response.json({ error: "Inicia sesión para consultar archivos." }, { status: 401, headers });
  const params = search.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!params.success) return Response.json({ error: "Búsqueda inválida." }, { status: 400, headers });
  const { q, images, offset } = params.data;
  const assets = await db().media.findMany({
    where: { ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(images === "1" ? { mime: { startsWith: "image/" } } : {}) },
    select: { id: true, name: true, mime: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: offset, take: size + 1,
  });
  return Response.json({ assets: assets.slice(0, size), next: assets.length > size ? offset + size : null }, { headers });
}
