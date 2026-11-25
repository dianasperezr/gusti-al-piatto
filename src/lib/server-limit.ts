import "server-only";

export function minuteLimit(globalLimit: number, clientLimit: number = globalLimit) {
  let resetAt = 0;
  let total = 0;
  const clients = new Map<string, number>();

  return (client?: string | null) => {
    const now = Date.now();
    if (now >= resetAt) {
      resetAt = now + 60_000;
      total = 0;
      clients.clear();
    }
    const retry = Math.ceil((resetAt - now) / 1000);
    const used = client ? clients.get(client) ?? 0 : 0;
    if (total >= globalLimit || used >= clientLimit) return retry;
    total += 1;
    if (client) clients.set(client, used + 1);
    return 0;
  };
}
