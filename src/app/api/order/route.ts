import { orderBody } from "@/modules/orders/checkout";
import { checkout } from "@/modules/orders/server";
import { isSameOrigin, orderRetryAfter } from "@/modules/orders/request-guard";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origen no autorizado." }, { status: 403 });
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return Response.json({ error: "El pedido requiere JSON." }, { status: 415 });
  }
  const retry = orderRetryAfter(request);
  if (retry) return Response.json({ error: "Demasiadas solicitudes. Inténtalo de nuevo en un minuto." }, {
    status: 429, headers: { "Retry-After": String(retry), "Cache-Control": "no-store" },
  });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "Solicitud inválida." }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  let payload: unknown;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 32768) {
        await reader.cancel();
        return Response.json({ error: "Solicitud demasiado grande." }, { status: 413 });
      }
      chunks.push(chunk.value);
    }
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return Response.json({ error: "Solicitud inválida." }, { status: 400 });
  } finally {
    reader.releaseLock();
  }
  const result = orderBody.safeParse(payload);
  if (!result.success) return Response.json({ error: "Revisa el contenido del carrito." }, { status: 400 });
  return checkout(result.data);
}
