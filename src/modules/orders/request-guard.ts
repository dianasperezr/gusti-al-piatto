import "server-only";
import { isIP } from "node:net";

import { minuteLimit } from "@/lib/server-limit";

const consumeOrder = minuteLimit(180, 30);

export function isSameOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || site === "same-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (process.env.APP_ORIGIN) return origin === process.env.APP_ORIGIN;
  try {
    const url = new URL(origin);
    return ["http:", "https:"].includes(url.protocol) && url.host === (request.headers.get("host") ?? new URL(request.url).host);
  } catch {
    return false;
  }
}

export function orderRetryAfter(request: Request) {
  // Enable only when ingress overwrites this header and the app is unreachable directly.
  const client = process.env.ORDER_TRUST_PROXY === "true" ? request.headers.get("x-real-ip") : null;
  return consumeOrder(client && isIP(client) ? client : null);
}
