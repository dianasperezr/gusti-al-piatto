"use server";

import { createHash, createSign } from "node:crypto";
import { revalidatePath } from "next/cache";
import { invalidatePublicMenu } from "@/modules/catalog/menu-cache";
import { minuteLimit } from "@/lib/server-limit";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/modules/auth/session";
import { decimalCents } from "@/modules/products/options";
import { contentFields, parseOptions } from "@/modules/admin/config";
import type { FormStatus } from "@/modules/admin/content-actions";

const sheetName = "Gusti";
const legacyHeader = ["ID", "Tipo", "Nombre", "Descripción", "Publicado", "Orden", "Categoría ID", "Precio MXN", "Precio USD", "Disponible"];
const previousHeader = [...legacyHeader.slice(0, 7), "Precio base", ...legacyHeader.slice(8), "ID externo"];
const header = previousHeader.map((column, index) => index === 8 ? "USD anterior (sin uso)" : column);
const maxRows = 2000;
type Cell = string | number | boolean;
type Row = Cell[];
const digest = (rows: Row[]) => createHash("sha256").update(JSON.stringify(rows)).digest("hex");

const sheetConfig = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]+$/),
  email: z.email(),
  privateKey: z.string().min(40),
});

function config() {
  return sheetConfig.safeParse({
    id: process.env.GOOGLE_SHEETS_ID,
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replaceAll("\\n", "\n"),
  });
}

async function accessToken(email: string, privateKey: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const auth = "https://oauth2.googleapis.com/token";
  const unsigned = [
    encode({ alg: "RS256", typ: "JWT" }),
    encode({ iss: email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: auth, iat: now, exp: now + 600 }),
  ].join(".");
  const assertion = `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(privateKey, "base64url")}`;
  const result = await fetch(auth, {
    method: "POST",
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(8000),
  });
  if (!result.ok) throw new Error("Google rechazó las credenciales de la cuenta de servicio.");
  return z.object({ access_token: z.string() }).parse(await result.json()).access_token;
}

async function localRows(tx: Prisma.TransactionClient) {
  const entries = await tx.content.findMany({ where: { kind: { in: ["CATEGORY", "PRODUCT"] }, archivedAt: null }, orderBy: [{ kind: "asc" }, { id: "asc" }], take: maxRows + 1 });
  if (entries.length > maxRows) throw new Error("La sincronización admite hasta 2000 registros.");
  return [header, ...entries.map(entry => {
    const base = [entry.id, entry.kind, entry.name, entry.description, entry.published, entry.position, entry.categoryId ?? ""];
    if (entry.kind === "CATEGORY") return [...base, "", "", "", ""];
    const { available } = parseOptions("PRODUCT", entry.options);
    return [...base, (entry.priceCents ?? 0) / 100, "", available, entry.externalId ?? ""];
  })];
}

function cellValue(value: Cell) {
  if (typeof value === "boolean") return { boolValue: value };
  if (typeof value === "number") return { numberValue: value };
  return { stringValue: value };
}

const rawRows = z.object({ values: z.array(z.array(z.union([z.string(), z.number(), z.boolean()]))).optional() });
const rowKind = z.enum(["CATEGORY", "PRODUCT"]);
const truth = (value: Cell) => z.union([z.boolean(), z.literal("").transform(() => false), z.stringbool({ truthy: ["true"], falsy: ["false"] })]).parse(value);
const isBlank = (row: Row) => !row.some(cell => cell !== "");
const syncLimit = minuteLimit(12, 6);

export async function syncCatalog(direction: "push" | "pull", _: FormStatus, form: FormData): Promise<FormStatus> {
  const actor = await requireUser(true);
  if (direction !== "push" && direction !== "pull") return { error: "Dirección inválida." };
  const settings = config();
  if (!settings.success) return { error: "Configura la cuenta de servicio y la hoja de cálculo en el servidor." };
  if (syncLimit(actor.id)) return { error: "Demasiadas sincronizaciones. Inténtalo de nuevo en un minuto." };

  const force = form.get("accept") === "on";
  const { id, email, privateKey } = settings.data;
  const key = `sheets:${id}`;
  try {
    const token = await accessToken(email, privateKey);
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${id}`;
    async function google(path: string, body?: object) {
      const response = await fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Google no pudo completar la operación. Revisa el acceso y la pestaña Gusti.");
      return response.json();
    }

    const summary = await db().$transaction(async tx => {
      const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`SELECT pg_try_advisory_xact_lock(672551) AS acquired`;
      if (!lock.acquired) throw new Error("Ya hay una sincronización en curso.");
      const metadata = z.object({ sheets: z.array(z.object({
        properties: z.object({ title: z.string(), sheetId: z.number(), gridProperties: z.object({ rowCount: z.number() }).optional() }),
      })) }).parse(await google("?fields=sheets.properties(title,sheetId,gridProperties.rowCount)"));
      const sheet = metadata.sheets.find(item => item.properties.title === sheetName)?.properties;
      if (!sheet) throw new Error("Crea una pestaña llamada Gusti y vuelve a intentarlo.");

      const data = rawRows.parse(await google(`/values/${encodeURIComponent(sheetName + "!A:K")}?valueRenderOption=UNFORMATTED_VALUE`));
      const remote = (data.values ?? []).map(row => header.map((_, index) => row[index] ?? ""));
      if (remote.length > maxRows + 1) throw new Error("La pestaña supera los 2000 registros.");
      if (remote.length && JSON.stringify(remote[0]) !== JSON.stringify(header) && JSON.stringify(remote[0]) !== JSON.stringify([...legacyHeader, ""]) && JSON.stringify(remote[0]) !== JSON.stringify(previousHeader)) {
        throw new Error("La pestaña tiene encabezados incompatibles. Usa una pestaña dedicada a Gusti.");
      }
      const local = await localRows(tx);
      const state = await tx.integrationState.findUnique({ where: { key } });
      const baseline = z.object({ remote: z.string(), local: z.string() }).safeParse(state?.value).data;
      const remoteHash = digest(remote);
      const localHash = digest(local);

      if (direction === "push") {
        if (!force && remote.length > 1 && remoteHash !== baseline?.remote) {
          throw new Error("Hay datos nuevos en Sheets. Impórtalos primero o confirma que quieres sobrescribirlos.");
        }
        const count = Math.max(local.length, remote.length);
        const rowCount = sheet.gridProperties?.rowCount ?? 0;
        const requests: object[] = [];
        if (count > rowCount) requests.push({ appendDimension: { sheetId: sheet.sheetId, dimension: "ROWS", length: count - rowCount } });
        requests.push({ updateCells: {
          fields: "userEnteredValue",
          range: { sheetId: sheet.sheetId, startRowIndex: 0, endRowIndex: count, startColumnIndex: 0, endColumnIndex: header.length },
          rows: local.map(row => ({ values: row.map(value => ({ userEnteredValue: cellValue(value) })) })),
        } });
        await google(":batchUpdate", { requests });
        const value = { remote: digest(local), local: localHash };
        await tx.integrationState.upsert({ where: { key }, create: { key, value }, update: { value } });
        await tx.audit.create({ data: { userId: actor.id, action: "Exportar a Google Sheets", target: "Catálogo" } });
        return `${local.length - 1} registros exportados.`;
      }

      if (!remote.length) throw new Error("La pestaña está vacía. Envía primero el catálogo.");
      if (!force && local.length > 1 && localHash !== baseline?.local) {
        throw new Error("Hay cambios locales. Envíalos primero o confirma que quieres aplicar los valores de Sheets.");
      }
      const seen = new Set<string>();
      const validRows = remote.slice(1).flatMap((row, index) => {
        if (isBlank(row)) return [];
        try {
          const [id, type, name, description, published, position, categoryId, price, , available, externalId] = row;
          const kind = rowKind.parse(type);
          const rowId = z.uuid().parse(id);
          if (seen.has(rowId)) throw new Error();
          seen.add(rowId);
          const content = contentFields.parse({
            name, description, published: truth(published), position, categoryId: kind === "PRODUCT" && categoryId ? categoryId : null, mediaId: null,
          });
          const pricing = kind === "PRODUCT" ? { priceCents: decimalCents(String(price)), externalId: externalId === "" ? null : z.string().trim().min(1).max(160).parse(externalId) } : {};
          return [{ id: rowId, kind, content, pricing, available: kind === "PRODUCT" && truth(available) }];
        } catch {
          throw new Error(`Revisa los campos de la fila ${index + 2}. Cada fila requiere un UUID único.`);
        }
      });

      for (const row of validRows.sort((a, b) => a.kind.localeCompare(b.kind))) {
        const existing = await tx.content.findUnique({ where: { id: row.id }, select: { kind: true, options: true, archivedAt: true, categoryId: true } });
        if (existing && existing.kind !== row.kind) throw new Error("Un ID ya pertenece a otro tipo de contenido.");
        if (existing?.archivedAt) throw new Error("Hay un registro archivado en la hoja. Restaura el registro o retira esa fila.");
        const { mediaId, ...fields } = row.content;
        if (fields.categoryId && !await tx.content.findFirst({ where: { id: fields.categoryId, kind: "CATEGORY" } })) {
          throw new Error(`La categoría de «${fields.name}» no existe.`);
        }
        const options = row.kind === "PRODUCT" ? { ...parseOptions("PRODUCT", existing?.options ?? { available: row.available }), available: row.available } : parseOptions("CATEGORY", existing?.options ?? {});
        const data = { ...fields, ...row.pricing, options, ...(existing?.categoryId !== fields.categoryId ? { subcategoryId: null } : {}) };
        await tx.content.upsert({ where: { id: row.id }, create: { ...data, mediaId, id: row.id, kind: row.kind, slug: row.kind === "PRODUCT" ? "platillo-" + row.id : null }, update: data });
      }

      const value = { remote: remoteHash, local: digest(await localRows(tx)) };
      await tx.integrationState.upsert({ where: { key }, create: { key, value }, update: { value } });
      await tx.audit.create({ data: { userId: actor.id, action: "Importar desde Google Sheets", target: "Catálogo" } });
      return `${validRows.length} registros aplicados. Las filas omitidas se conservan en el CMS.`;
    }, { timeout: 35000, maxWait: 5000 });
    invalidatePublicMenu();
    revalidatePath("/admin", "layout");
    return { success: summary };
  } catch (error) {
    if (error instanceof Error && /^(Google|La |Crea |Hay |Revisa |Un ID|Ya hay )/.test(error.message)) return { error: error.message };
    return { error: "No se pudo sincronizar. Comprueba los permisos y vuelve a intentarlo." };
  }
}
