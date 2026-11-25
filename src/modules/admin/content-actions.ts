"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { invalidatePublicMenu } from "@/modules/catalog/menu-cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/modules/auth/session";
import { normalizeNumber } from "@/modules/orders/settings";
import { convertCents } from "@/modules/catalog/pricing";
import { cents } from "@/modules/products/options";
import { decimalCents, parseGroups, uuidList } from "@/modules/products/options";
import { contentFields, panelFor, parseOptions } from "./config";

export type FormStatus = { error?: string; success?: string };

const uniqueIds = (value: unknown) => [...new Set(uuidList.parse(value))];
const slugify = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const slugSuffix = () => "-" + randomUUID().slice(0, 8);
const commands = z.enum(["publish", "unpublish", "activate", "deactivate", "feature", "unfeature", "archive", "restore", "move", "order", "duplicate"]);

export async function saveContent(section: string, suppliedId: string | null, _: FormStatus, form: FormData): Promise<FormStatus> {
  const panel = panelFor(section);
  if (!panel) return { error: "Sección inválida." };
  const user = await requireUser(panel.admin);
  const id = panel.singleton ? panel.kind.toLowerCase() : suppliedId;
  if (!panel.singleton && id && !z.uuid().safeParse(id).success) return { error: "Registro inválido." };

  const values = Object.fromEntries(form);
  let savedId: string;
  try {
    const content = contentFields.parse({
      name: values.name, description: values.description ?? "", position: values.position ?? 0,
      published: panel.singleton || values.published === "on",
      categoryId: ["PRODUCT", "CATEGORY"].includes(panel.kind) ? values.categoryId || null : null,
      mediaId: panel.media ? values.mediaId || null : null,
    });
    if (panel.kind === "CONTACT") Object.assign(values, normalizeNumber(String(values.whatsapp ?? ""), String(values.countryCode ?? "")));
    const options = parseOptions(panel.kind, Object.fromEntries(panel.fields.filter(field => !["price", "usd"].includes(field.name)).map(field => {
      const value = values[field.name] ?? field.initial;
      if (field.type === "checkbox") return [field.name, value === "on"];
      if (field.type === "days") {
        const days = form.getAll(field.name).map(Number);
        return [field.name, !days.length && form.has("day") ? [Number(form.get("day"))] : days];
      }
      if (field.type === "currencies") return [field.name, form.getAll(field.name)];
      if (field.type === "targets") return [field.name, form.getAll(field.name)];
      if (field.type === "list") return [field.name, String(value).split(",").map(text => text.trim()).filter(Boolean)];
      if (field.type === "groups") return [field.name, parseGroups(String(value))];
      return [field.name, value];
    })));
    if ("opens" in options && Boolean(options.opens) !== Boolean(options.closes)) {
      return { error: "Completa ambas horas o deja ambas vacías." };
    }
    if ("starts" in options && options.starts && options.ends && options.starts >= options.ends) {
      return { error: "El fin debe ser posterior al inicio." };
    }

    const comboIds = panel.kind === "COMBO" ? uniqueIds(form.getAll("products")) : [];
    const quantities = comboIds.map(productId => ({
      productId, quantity: z.coerce.number().int().min(1).max(50).parse(form.get("quantity-" + productId) ?? 1),
    }));
    const gallery = ["PRODUCT", "COMBO"].includes(panel.kind)
      ? uniqueIds(String(values.gallery ?? "").split(",").map(value => value.trim()).filter(Boolean)) : [];
    const assignments = panel.kind === "CATEGORY" ? uniqueIds(form.getAll("assign")) : [];
    const priced = panel.kind === "PRODUCT" || panel.kind === "COMBO";
    const priceCents = priced ? decimalCents(String(values.price || "0")) : null;
    const subcategoryId = panel.kind === "PRODUCT" && values.subcategoryId ? z.uuid().parse(values.subcategoryId) : null;
    const externalId = panel.kind === "PRODUCT" && values.externalId ? z.string().trim().min(1).max(160).parse(values.externalId) : null;
    const slug = panel.kind === "PRODUCT" ? z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160).parse(
      String(values.slug || (slugify(content.name).slice(0, 100).replace(/-$/, "") || "platillo") + slugSuffix()),
    ) : null;
    if (panel.kind === "COMBO" && content.published && !comboIds.length) {
      return { error: "Selecciona al menos un platillo para publicar el paquete." };
    }
    if ("orderOpens" in options && Boolean(options.orderOpens) !== Boolean(options.orderCloses)) {
      return { error: "Completa las dos horas del horario de pedidos o deja ambas vacías." };
    }
    if ("ordering" in options && options.ordering && !options.whatsapp) {
      return { error: "Configura el número de WhatsApp antes de habilitar los pedidos." };
    }

    savedId = await db().$transaction(async tx => {
      let storedOptions = options;
      if ("base" in options) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(672553)::text`;
        const previous = await tx.content.findUnique({ where: { id: "currency" }, select: { options: true } });
        const prior = parseOptions("CURRENCY", previous?.options ?? {});
        const from = prior.base;
        const changed = prior.rate !== options.rate || prior.direction !== options.direction;
        storedOptions = { ...options, updatedAt: changed || !prior.updatedAt ? new Date().toISOString() : prior.updatedAt };
        if (options.base !== from) {
          const convert = (value: number) => cents.parse(convertCents(value, from, options.base, options.rate, { direction: options.direction, rounding: "nearest", increment: 1 }));
          const records = await tx.content.findMany({ where: { kind: { in: ["PRODUCT", "COMBO", "PROMOTION"] } } });
          for (const entry of records) {
            if (entry.kind === "PRODUCT") {
              const product = parseOptions("PRODUCT", entry.options);
              const groups = product.groups.map(group => ({ ...group, choices: group.choices.map(choice => ({ ...choice, cents: convert(choice.cents) })) }));
              await tx.content.update({ where: { id: entry.id }, data: { priceCents: convert(entry.priceCents ?? 0), options: { ...product, groups } } });
            } else if (entry.kind === "COMBO") {
              await tx.content.update({ where: { id: entry.id }, data: { priceCents: convert(entry.priceCents ?? 0) } });
            } else {
              const offer = parseOptions("PROMOTION", entry.options);
              if (offer.method === "fixed" || offer.method === "price") {
                await tx.content.update({ where: { id: entry.id }, data: { options: { ...offer, amount: convert(offer.amount) } } });
              }
            }
          }
        }
      }
      if ("type" in options && options.type !== "text" && content.published) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(672552)::text`;
        const duplicate = await tx.content.findFirst({
          where: { kind: "SECTION", published: true, archivedAt: null, ...(id ? { id: { not: id } } : {}),
            options: { path: ["type"], equals: options.type } },
        });
        if (duplicate) throw new Error("Selecciona otro tipo de sección. Ya hay una publicada de este tipo.");
      }
      if (content.categoryId && (content.categoryId === id || !await tx.content.findFirst({
        where: { id: content.categoryId, kind: "CATEGORY", categoryId: null, archivedAt: null },
      }))) throw new Error("Selecciona una categoría principal válida.");
      if (subcategoryId && (!content.categoryId || !await tx.content.findFirst({
        where: { id: subcategoryId, kind: "CATEGORY", categoryId: content.categoryId, archivedAt: null },
      }))) throw new Error("Selecciona una subcategoría de la categoría elegida.");
      if (id && panel.kind === "CATEGORY" && content.categoryId && await tx.content.count({ where: { categoryId: id } })) {
        throw new Error("Selecciona una categoría principal sin platillos ni subcategorías dependientes.");
      }
      if (comboIds.length && await tx.content.count({ where: { id: { in: comboIds }, kind: "PRODUCT" } }) !== comboIds.length) {
        throw new Error("Selecciona platillos válidos.");
      }
      if ("scheduleId" in options && options.scheduleId && !await tx.content.findFirst({ where: { id: options.scheduleId, kind: "HOURS" } })) {
        throw new Error("Selecciona una regla de horario válida.");
      }
      if ("logoId" in options && options.logoId) {
        const logo = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "media_assets" WHERE id = ${options.logoId}::uuid AND mime_type LIKE 'image/%' FOR KEY SHARE`;
        if (!logo.length) throw new Error("Selecciona un logotipo válido.");
      }

      const active = !form.has("manageStatus") || values.active === "on";
      const data = { ...content, options: storedOptions, active, featured: values.featured === "on", priceCents, slug, externalId, subcategoryId };
      const record = panel.singleton && id
        ? await tx.content.upsert({ where: { id }, update: data, create: { ...data, id, kind: panel.kind } })
        : id
          ? await tx.content.update({ where: { id, kind: panel.kind, archivedAt: null }, data })
          : await tx.content.create({ data: { ...data, kind: panel.kind } });
      if (panel.kind === "COMBO") {
        await tx.comboItem.deleteMany({ where: { comboId: record.id } });
        await tx.comboItem.createMany({ data: quantities.map(item => ({ comboId: record.id, ...item })) });
      }
      if (["PRODUCT", "COMBO"].includes(panel.kind)) {
        await tx.contentMedia.deleteMany({ where: { contentId: record.id } });
        await tx.contentMedia.createMany({ data: gallery.map((mediaId, position) => ({ mediaId, position, contentId: record.id })) });
      }
      if (assignments.length) {
        await tx.content.updateMany({ where: { id: { in: assignments }, kind: "PRODUCT", archivedAt: null },
          data: { categoryId: content.categoryId ?? record.id, subcategoryId: content.categoryId ? record.id : null } });
      }
      await tx.audit.create({ data: { userId: user.id, action: "Guardar", target: panel.title + " / " + record.name } });
      return record.id;
    }, { timeout: 20000 });
  } catch (error) {
    if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Revisa los campos." };
    if (error instanceof Error && /^(Selecciona|Revisa)/.test(error.message)) return { error: error.message };
    return { error: "No se pudo guardar. Comprueba las referencias y que el slug y el identificador externo sean únicos." };
  }
  invalidatePublicMenu();
  revalidatePath(`/admin/${section}`);
  if (!id) redirect(`/admin/${section}?editar=${savedId}`);
  return { success: "Cambios guardados." };
}

export async function manageContent(section: string, ids: string[], command: z.infer<typeof commands>, categoryId?: string): Promise<FormStatus> {
  const panel = panelFor(section);
  if (!panel || panel.singleton || panel.kind === "SECTION") return { error: "Sección inválida." };
  const actor = await requireUser(panel.admin);
  try {
    const valid = uniqueIds(ids);
    const operation = commands.parse(command);
    if (!valid.length) return { error: "Selecciona al menos un registro." };
    await db().$transaction(async tx => {
      if (operation === "order") await tx.$queryRaw`SELECT pg_advisory_xact_lock(672555)::text`;
      const list = await tx.content.findMany({ where: { id: { in: valid }, kind: panel.kind }, include: { comboItems: true, gallery: true } });
      if (list.length !== valid.length) throw new Error("Revisa la selección.");
      if (operation === "duplicate") {
        for (const source of list) {
          const copy = await tx.content.create({ data: {
            kind: source.kind, name: (source.name + " (copia)").slice(0, 120), description: source.description,
            options: source.options ?? {}, featured: source.featured, priceCents: source.priceCents,
            categoryId: source.categoryId, subcategoryId: source.subcategoryId, mediaId: source.mediaId, position: source.position,
            slug: source.slug ? source.slug.slice(0, 140).replace(/-$/, "") + slugSuffix() : null,
          } });
          await tx.comboItem.createMany({ data: source.comboItems.map(item => ({ ...item, comboId: copy.id })) });
          await tx.contentMedia.createMany({ data: source.gallery.map(item => ({ ...item, contentId: copy.id })) });
        }
      } else if (operation === "order") {
        await tx.$executeRaw`
          WITH ranked AS (
            SELECT id, (ROW_NUMBER() OVER (ORDER BY position, name, id) - 1)::int AS slot
            FROM "Content" WHERE kind = ${panel.kind}::"ContentKind"
          ), incoming AS (
            SELECT id, sequence FROM unnest(ARRAY[${Prisma.join(valid)}]::text[]) WITH ORDINALITY AS items(id, sequence)
          ), slots AS (
            SELECT slot, ROW_NUMBER() OVER (ORDER BY slot) AS sequence
            FROM ranked JOIN incoming USING (id)
          ), reordered AS (
            SELECT ranked.id, COALESCE(slots.slot, ranked.slot) AS position
            FROM ranked LEFT JOIN incoming USING (id) LEFT JOIN slots ON slots.sequence = incoming.sequence
          )
          UPDATE "Content" entry SET position = reordered.position, "updatedAt" = CURRENT_TIMESTAMP
          FROM reordered WHERE entry.id = reordered.id AND entry.position <> reordered.position
        `;
      } else if (operation === "move") {
        const target = categoryId ? await tx.content.findFirst({ where: { id: z.uuid().parse(categoryId), kind: "CATEGORY", categoryId: null, archivedAt: null } }) : null;
        if (panel.kind !== "PRODUCT" || (categoryId && !target)) throw new Error("Selecciona una categoría principal válida.");
        await tx.content.updateMany({ where: { id: { in: valid } }, data: { categoryId: target?.id ?? null, subcategoryId: null } });
      } else {
        const edits = {
          publish: { published: true }, unpublish: { published: false },
          activate: { active: true }, deactivate: { active: false },
          feature: { featured: true }, unfeature: { featured: false },
          archive: { archivedAt: new Date(), active: false, published: false },
          restore: { archivedAt: null, active: true, published: false },
        };
        if (!["restore", "archive"].includes(operation) && list.some(record => record.archivedAt)) {
          throw new Error("Revisa la selección. Restaura los registros archivados primero.");
        }
        if (operation === "publish" && panel.kind === "COMBO" && list.some(record => !record.comboItems.length)) {
          throw new Error("Selecciona paquetes con al menos un platillo para publicar.");
        }
        await tx.content.updateMany({ where: { id: { in: valid } }, data: edits[operation] });
      }
      await tx.audit.create({ data: { userId: actor.id, action: "Gestión de catálogo: " + operation, target: panel.title + " · " + list.length } });
    });
    invalidatePublicMenu();
    revalidatePath(`/admin/${section}`);
    return { success: "Cambios aplicados." };
  } catch (error) {
    return { error: error instanceof Error && /^(Selecciona|Revisa)/.test(error.message) ? error.message : "No se pudo aplicar el cambio." };
  }
}

export async function removeContent(section: string, id: string): Promise<FormStatus> {
  const panel = panelFor(section);
  if (!panel || panel.singleton || !z.uuid().safeParse(id).success) return { error: "Registro inválido." };
  const user = await requireUser(panel.admin);
  await db().$transaction(async tx => {
    const record = await tx.content.update({ where: { id, kind: panel.kind },
      data: { archivedAt: new Date(), published: false, active: false } });
    await tx.audit.create({ data: { userId: user.id, action: "Archivar", target: panel.title + " / " + record.name } });
  });
  invalidatePublicMenu();
  revalidatePath(`/admin/${section}`);
  redirect(`/admin/${section}`);
}
