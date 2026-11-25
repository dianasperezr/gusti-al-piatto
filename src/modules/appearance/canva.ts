import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { renderMenuExport } from "@/modules/exports/render";

const api = "https://api.canva.com/rest/v1";
const connectionKey = "canva:connection";
const jobKey = "canva:job";

const settings = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  callback: z.url({ protocol: /^https?$/ }),
  encryptionKey: z.string().regex(/^[a-f0-9]{64}$/i),
});
const tokenSchema = z.object({ access_token: z.string(), refresh_token: z.string(), expires_in: z.number().positive() });
const secretSchema = tokenSchema.extend({ expiresAt: z.number() });
const oauthFlow = z.object({ state: z.string(), verifier: z.string(), until: z.number() });
const jobSchema = z.object({ job: z.object({
  id: z.string(),
  status: z.enum(["in_progress", "success", "failed"]),
  result: z.object({ designs: z.array(z.object({ urls: z.object({ edit_url: z.url() }) })) }).optional(),
}) });

export function canvaConfig() {
  return settings.safeParse({
    clientId: process.env.CANVA_CLIENT_ID,
    clientSecret: process.env.CANVA_CLIENT_SECRET,
    callback: process.env.CANVA_REDIRECT_URI,
    encryptionKey: process.env.INTEGRATION_ENCRYPTION_KEY,
  }).data;
}

function requireConfig() {
  const config = canvaConfig();
  if (!config) throw new Error("Canva no está configurado.");
  return config;
}

function seal(value: object, key: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), nonce);
  const payload = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return [nonce, cipher.getAuthTag(), payload].map(buffer => buffer.toString("base64url")).join(".");
}

function unseal(value: unknown, key: string) {
  const [nonce, tag, payload] = z.string().parse(value).split(".").map(part => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), nonce);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(payload), decipher.final()]).toString("utf8")) as unknown;
}

async function exchange(config: z.infer<typeof settings>, body: Record<string, string>) {
  const result = await fetch(api + "/oauth/token", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}` },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!result.ok) throw new Error("Canva rechazó la autorización. Vuelve a conectar la cuenta.");
  const token = tokenSchema.parse(await result.json());
  return { ...token, expiresAt: Date.now() + token.expires_in * 1000 };
}

export async function startCanva(userId: string) {
  const config = requireConfig();
  const verifier = randomBytes(64).toString("base64url");
  const state = randomBytes(32).toString("base64url");
  const key = `canva:oauth:${userId}`;
  const value = seal({ state, verifier, until: Date.now() + 600000 }, config.encryptionKey);
  await db().integrationState.upsert({ where: { key }, create: { key, value }, update: { value } });
  const url = new URL("https://www.canva.com/api/oauth/authorize");
  url.search = new URLSearchParams({
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    scope: "design:content:write",
    response_type: "code",
    client_id: config.clientId,
    state,
    redirect_uri: config.callback,
  }).toString();
  return url.toString();
}

export async function finishCanva(userId: string, code: string, state: string) {
  const config = requireConfig();
  const key = `canva:oauth:${userId}`;
  const record = await db().integrationState.findUniqueOrThrow({ where: { key } });
  const flow = oauthFlow.parse(unseal(record.value, config.encryptionKey));
  if (flow.state !== state || flow.until < Date.now()) throw new Error("La autorización caducó.");
  const consumed = await db().integrationState.deleteMany({ where: { key, value: { equals: record.value ?? "" } } });
  if (consumed.count !== 1) throw new Error("La autorización ya se utilizó.");

  const token = await exchange(config, {
    grant_type: "authorization_code", code, code_verifier: flow.verifier, redirect_uri: config.callback,
  });
  const value = seal(token, config.encryptionKey);
  await db().$transaction([
    db().integrationState.upsert({ where: { key: connectionKey }, create: { key: connectionKey, value }, update: { value } }),
    db().integrationState.deleteMany({ where: { key: jobKey } }),
    db().audit.create({ data: { userId, action: "Conectar Canva", target: "Integración" } }),
  ]);
}

async function canvaToken() {
  const config = requireConfig();
  return db().$transaction(async tx => {
    await tx.$queryRaw`SELECT key FROM "IntegrationState" WHERE key = ${connectionKey} FOR UPDATE`;
    const record = await tx.integrationState.findUnique({ where: { key: connectionKey } });
    if (!record) throw new Error("Conecta una cuenta de Canva.");
    const stored = secretSchema.parse(unseal(record.value, config.encryptionKey));
    if (stored.expiresAt > Date.now() + 60000) return stored.access_token;
    const token = await exchange(config, { grant_type: "refresh_token", refresh_token: stored.refresh_token });
    await tx.integrationState.update({ where: { key: connectionKey }, data: { value: seal(token, config.encryptionKey) } });
    return token.access_token;
  }, { timeout: 12000 });
}

export async function canvaStatus() {
  const rows = await db().integrationState.findMany({ where: { key: { in: [connectionKey, jobKey] } }, select: { key: true, value: true } });
  const job = z.object({ id: z.string() }).safeParse(rows.find(row => row.key === jobKey)?.value).data;
  return { connected: rows.some(row => row.key === connectionKey), pending: !!job };
}

export async function disconnectCanva(userId: string) {
  await db().$transaction([
    db().integrationState.deleteMany({ where: { key: { in: [connectionKey, jobKey, `canva:oauth:${userId}`] } } }),
    db().audit.create({ data: { userId, action: "Desconectar Canva", target: "Integración" } }),
  ]);
}

export async function sendToCanva(templateId: string, userId: string) {
  const file = await renderMenuExport(templateId, "pdf");
  if (!file) throw new Error("Selecciona una plantilla publicada.");
  const token = await canvaToken();
  const response = await fetch(api + "/imports", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Import-Metadata": JSON.stringify({ title_base64: Buffer.from("Gusti al piatto · Menú").toString("base64"), mime_type: "application/pdf" }),
    },
    body: Uint8Array.from(file),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Canva rechazó la importación. Revisa los permisos de la aplicación.");
  const { job } = jobSchema.parse(await response.json());
  const value = { id: job.id };
  await db().$transaction([
    db().integrationState.upsert({ where: { key: jobKey }, create: { key: jobKey, value }, update: { value } }),
    db().audit.create({ data: { userId, action: "Importar a Canva", target: "Menú en PDF" } }),
  ]);
}

export async function getCanvaJob() {
  const record = await db().integrationState.findUnique({ where: { key: jobKey } });
  if (!record) throw new Error("No hay una importación reciente.");
  const { id } = z.object({ id: z.string() }).parse(record.value);
  const token = await canvaToken();
  const response = await fetch(api + "/imports/" + encodeURIComponent(id), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Canva no pudo recuperar la importación.");
  const { job } = jobSchema.parse(await response.json());
  const url = job.result?.designs[0]?.urls.edit_url;
  const edit = url && new URL(url);
  return {
    status: job.status,
    url: edit && edit.protocol === "https:" && edit.hostname === "www.canva.com" ? edit.toString() : undefined,
  };
}
