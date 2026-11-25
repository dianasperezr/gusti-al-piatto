import { Readable } from "node:stream";
import { z } from "zod";
import { getVisual } from "@/modules/appearance/layout-store";
import { mediaUsed } from "@/modules/appearance/layout-schema";
import { db } from "@/lib/db";
import { currentUser } from "@/modules/auth/session";
import { storage } from "@/modules/media/files";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response(null, { status: 404 });
  const media = await db().media.findUnique({
    where: { id },
    include: { contents: { where: { published: true, active: true, archivedAt: null }, select: { id: true }, take: 1 }, gallery: { where: { content: { published: true, active: true, archivedAt: null } }, select: { contentId: true }, take: 1 } },
  });
  if (!media) return new Response(null, { status: 404 });

  let publicFile = media.contents.length > 0 || media.gallery.length > 0 || !!await db().content.findFirst({
    where: { kind: "DESIGN", published: true, options: { path: ["logoId"], equals: id } },
    select: { id: true },
  });
  if (!publicFile) {
    const visual = await getVisual();
    publicFile = Boolean(visual && mediaUsed({ ...visual, sections: visual.sections.filter(section => !section.hidden) }).includes(id));
  }
  if (!publicFile && !await currentUser()) return new Response(null, { status: 404 });

  const thumbnail = new URL(request.url).searchParams.get("thumbnail") === "1";
  const key = thumbnail ? media.thumbnail ?? (!media.mime.startsWith("video/") ? media.path ?? id : null) : media.path ?? id;
  const bytes = key && await storage.size(key);
  if (!key || !bytes) return new Response(null, { status: 404 });
  const headers = new Headers({
    "Content-Type": thumbnail && media.thumbnail ? "image/webp" : media.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": publicFile ? "public, max-age=60" : "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const range = request.headers.get("range");
  let start = 0;
  let end = bytes - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match && (match[1] || match[2])) {
      if (match[1]) {
        start = Number(match[1]);
        if (match[2]) end = Math.min(end, Number(match[2]));
      } else {
        start = Math.max(0, bytes - Number(match[2]));
      }
    }
    if (!match || (!match[1] && !match[2]) || start > end) {
      headers.set("Content-Range", `bytes */${bytes}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${bytes}`);
  }

  headers.set("Content-Length", String(end - start + 1));
  const stream = Readable.toWeb(storage.read(key, start, end)) as ReadableStream<Uint8Array>;
  return new Response(stream, { status: range ? 206 : 200, headers });
}
