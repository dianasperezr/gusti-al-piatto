import { requireUser } from "@/modules/auth/session";
import { canvaConfig, finishCanva } from "@/modules/appearance/canva";

export async function GET(request: Request) {
  const user = await requireUser(true);
  const config = canvaConfig();
  if (!config) return new Response("Canva no está configurado.", { status: 503 });
  const next = new URL("/admin/canva", config.callback);
  const query = new URL(request.url).searchParams;
  const state = query.get("state");
  const code = query.get("code");

  let outcome = "error";
  if (code && code.length <= 2048 && state && /^[\w-]{43}$/.test(state)) {
    try {
      await finishCanva(user.id, code, state);
      outcome = "conectado";
    } catch {
      outcome = "error";
    }
  }
  next.searchParams.set("resultado", outcome);
  return Response.redirect(next, 303);
}
