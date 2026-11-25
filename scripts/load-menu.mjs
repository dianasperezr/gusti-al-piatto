import { performance } from "node:perf_hooks";

const [base = "http://127.0.0.1:3000", secondsArg = "20", clientsArg = "4"] = process.argv.slice(2);
const url = new URL("/menu", base);
const seconds = Number(secondsArg);
const clients = Number(clientsArg);
if (!["http:", "https:"].includes(url.protocol) || !Number.isInteger(seconds) || seconds < 1 || seconds > 300 ||
    !Number.isInteger(clients) || clients < 1 || clients > 16) {
  throw new Error("Uso: node scripts/load-menu.mjs URL SEGUNDOS CONCURRENCIA (1–300 s, 1–16 clientes)");
}

const warm = await fetch(url, { signal: AbortSignal.timeout(5000) });
if (!warm.ok) throw new Error(`El menú devolvió ${warm.status} durante el calentamiento.`);
await warm.arrayBuffer();

const samples = [];
let errors = 0;
const start = performance.now();
const deadline = start + seconds * 1000;

await Promise.all(Array.from({ length: clients }, async () => {
  while (performance.now() < deadline) {
    const before = performance.now();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const elapsed = performance.now() - before;
      await response.arrayBuffer();
      if (!response.ok) errors += 1;
      else samples.push(elapsed);
    } catch {
      errors += 1;
    }
  }
}));

const elapsed = (performance.now() - start) / 1000;
samples.sort((a, b) => a - b);
const percentile = value => samples.length ? Number(samples[Math.ceil(samples.length * value) - 1].toFixed(1)) : null;
console.log(JSON.stringify({
  elapsedSeconds: Number(elapsed.toFixed(1)), clients, responses: samples.length, errors,
  responsesPerSecond: Number((samples.length / elapsed).toFixed(1)), headersMsP50: percentile(0.5), headersMsP95: percentile(0.95),
}, null, 2));
process.exitCode = errors || !samples.length ? 1 : 0;
