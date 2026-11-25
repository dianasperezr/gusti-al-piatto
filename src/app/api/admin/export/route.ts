import { z } from "zod";
import { requireUser } from "@/modules/auth/session";
import { renderMenuExport } from "@/modules/exports/render";
import { minuteLimit } from "@/lib/server-limit";
import { isSameOrigin } from "@/modules/orders/request-guard";

const params = z.object({ id: z.uuid(), format: z.enum(["pdf", "png"]) });
const limit = minuteLimit(30, 10);

export async function GET(request: Request) {
  const user = await requireUser();
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const input = params.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!input.success) return new Response("Exportación inválida.", { status: 400 });

  const { id, format } = input.data;
  const retry = limit(user.id);
  if (retry) return new Response("Inténtalo de nuevo en un minuto.", {
    status: 429, headers: { "Retry-After": String(retry), "Cache-Control": "no-store" },
  });
  const file = await renderMenuExport(id, format);
  if (!file) return new Response("Plantilla no disponible o exportación demasiado extensa para PNG.", { status: 404 });

  return new Response(Uint8Array.from(file), {
    headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "image/png",
      "Content-Disposition": `attachment; filename="gusti-menu.${format}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
