import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage, type PDFFont } from "pdf-lib";
import sharp from "sharp";
import { db } from "@/lib/db";
import { parseOptions, type MenuOptions } from "@/modules/admin/config";
import { getMenu, type MenuData } from "@/modules/catalog/menu";
import { formatPrice, previewMedia, unitCents } from "@/modules/catalog/pricing";
import { storage } from "@/modules/media/files";

type Card = { name: string; description?: string; price?: string; mediaId?: string };
type Group = { title: string; cards: Card[] };
type Row = { top: number; title?: string; cards: Card[] };
type Raster = { bytes: Buffer; width: number; height: number; format: "png" | "jpeg" };
type Media = { id: string; mime: string; path: string | null; thumbnail: string | null };
type Theme = MenuOptions<"TEMPLATE">;

const width = 612;
const margin = 38;
const gap = 14;
const cardWidth = (width - 2 * margin - gap) / 2;
const cardHeight = 150;
const headingHeight = 24;
const pngPageLimit = 24;

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function compatibleText(value: string, font: PDFFont) {
  return Array.from(value.replace(/\s+/gu, " ").trim(), character => {
    try {
      font.encodeText(character);
      return character.codePointAt(0)! >= 32 ? character : "";
    } catch {
      return "?";
    }
  }).join("");
}

function fitText(value: string, size: number, available: number, font: PDFFont) {
  const text = compatibleText(value, font);
  if (font.widthOfTextAtSize(text, size) <= available) return text;
  let shortened = text;
  while (shortened && font.widthOfTextAtSize(shortened + "…", size) > available) shortened = shortened.slice(0, -1);
  return shortened.trimEnd() + "…";
}

function titleLines(value: string, size: number, available: number, font: PDFFont) {
  const words = compatibleText(value, font).split(" ");
  let first = "";
  for (const [index, word] of words.entries()) {
    const next = first ? first + " " + word : word;
    if (font.widthOfTextAtSize(next, size) > available) {
      if (!first) return [fitText(words.join(" "), size, available, font)];
      return [first, fitText(words.slice(index).join(" "), size, available, font)];
    }
    first = next;
  }
  return [first];
}

const channels = (hex: string) => [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16));
const rgbHex = (hex: string) => rgb(...channels(hex).map(channel => channel / 255) as [number, number, number]);
const tint = (background: string, foreground: string, fraction: number) => {
  const ink = channels(foreground);
  return "#" + channels(background).map((color, index) => Math.round(color * (1 - fraction) + ink[index] * fraction).toString(16).padStart(2, "0")).join("");
};

function collect(menu: MenuData, theme: Theme): Group[] {
  const groups: Group[] = [];
  function append(title: string, items: MenuData["items"]) {
    if (!items.length) return;
    groups.push({ title, cards: items.map(item => ({
      name: item.name,
      description: item.description || item.components.map(component => component.quantity + " × " + component.name).join(" · "),
      price: formatPrice(unitCents(item, menu.base, menu.rate, menu.base, menu.money), menu.base, menu.money),
      mediaId: previewMedia(item)?.id,
    })) });
  }
  if (theme.content === "menu") {
    for (const category of menu.categories) append(category.name, menu.items.filter(item => item.categoryId === category.id));
    append("Platillos", menu.items.filter(item => item.kind === "PRODUCT" && !item.categoryId));
  }
  if (theme.content !== "promotions") append("Paquetes", menu.items.filter(item => item.kind === "COMBO"));
  else if (menu.promotions.length) groups.push({
    title: "Promociones",
    cards: menu.promotions.map(promotion => ({ name: promotion.name, description: promotion.description, mediaId: promotion.media?.id })),
  });
  return groups;
}

function paginate(groups: Group[], start: number, bottom: number) {
  const pages: Row[][] = [[]];
  let top = start;
  for (const group of groups) {
    for (let index = 0; index < group.cards.length; index += 2) {
      let title = index === 0 ? group.title : undefined;
      if (top + cardHeight + (title ? headingHeight : 0) > bottom) {
        pages.push([]);
        top = start;
        title = index === 0 ? group.title : group.title + " (cont.)";
      }
      pages.at(-1)!.push({ top, title, cards: group.cards.slice(index, index + 2) });
      top += cardHeight + gap + (title ? headingHeight : 0);
    }
  }
  return pages;
}

async function raster(media: Media | undefined, logo = false): Promise<Raster | null> {
  if (!media || (logo && !media.mime.startsWith("image/"))) return null;
  const original = media.path ?? media.id;
  const candidates = logo ? [original] : [media.thumbnail, media.mime.startsWith("image/") ? original : null];
  for (const key of new Set(candidates)) {
    if (!key) continue;
    try {
      const size = await storage.size(key);
      if (!size || size > 32 * 1024 * 1024) continue;
      const chunks: Buffer[] = [];
      for await (const chunk of storage.read(key, 0, size - 1)) chunks.push(chunk);
      const source = sharp(Buffer.concat(chunks), { limitInputPixels: 30_000_000 }).rotate();
      const { data, info } = logo
        ? await source.resize(300, 140, { fit: "inside", withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true })
        : await source.resize(522, 164, { fit: "cover" }).flatten({ background: "#ffffff" }).jpeg({ quality: 79 }).toBuffer({ resolveWithObject: true });
      return { bytes: data, width: info.width, height: info.height, format: logo ? "png" : "jpeg" };
    } catch {
      // The original can still be used when only the thumbnail is missing or damaged.
    }
  }
  return null;
}

export async function renderMenuExport(templateId: string, format: "pdf" | "png") {
  const template = await db().content.findFirst({ where: { id: templateId, kind: "TEMPLATE", published: true } });
  if (!template) return null;
  const theme = parseOptions("TEMPLATE", template.options);
  const menu = await getMenu();
  const height = theme.format === "square" ? 612 : 792;
  const groups = collect(menu, theme);
  const ids = [...new Set([theme.logoId, ...groups.flatMap(group => group.cards.map(card => card.mediaId ?? ""))].filter(Boolean))];
  const files = ids.length ? await db().media.findMany({ where: { id: { in: ids } }, select: { id: true, mime: true, path: true, thumbnail: true } }) : [];
  const mediaById = new Map(files.map(file => [file.id, file]));
  const logo = await raster(mediaById.get(theme.logoId), true);
  const centered = !!logo && theme.logoPosition === "center";
  const headerBottom = centered ? 148 : 105;
  const pages = paginate(groups, headerBottom + 16, height - 46);
  if (format === "png" && pages.length > pngPageLimit) return null;

  const headline = theme.headline || template.name;
  const document = await PDFDocument.create();
  document.setTitle(headline);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const serif = await document.embedFont(StandardFonts.TimesRomanBold);
  const cardstock = tint(theme.background, theme.foreground, .025);
  const placeholder = tint(theme.background, theme.foreground, .105);
  const embedded = new WeakMap<Raster, PDFImage>();
  const images: string[] = [];

  for (const [index, rows] of pages.entries()) {
    const page: PDFPage | undefined = format === "pdf" ? document.addPage([width, height]) : undefined;
    const svg: string[] = [];
    const idsOnPage = [...new Set(rows.flatMap(row => row.cards.flatMap(card => card.mediaId ? [card.mediaId] : [])))];
    const photos = new Map(await Promise.all(idsOnPage.map(async id => [id, await raster(mediaById.get(id))] as const)));
    function block(x: number, y: number, w: number, h: number, color: string) {
      if (page) page.drawRectangle({ x, y: height - y - h, width: w, height: h, color: rgbHex(color) });
      else svg.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`);
    }
    function text(value: string, x: number, y: number, size: number, color: string, maxWidth: number, font: PDFFont = regular) {
      const fitted = fitText(value, size, maxWidth, font);
      if (page) page.drawText(fitted, { x, y: height - y, size, font, color: rgbHex(color) });
      else svg.push(`<text x="${x}" y="${y}" fill="${color}" font-family="${font === serif ? "DejaVu Serif, Georgia, serif" : "DejaVu Sans, Arial, sans-serif"}" font-size="${size}" font-weight="${font === regular ? "normal" : "bold"}">${escapeXml(fitted)}</text>`);
    }
    async function image(value: Raster, x: number, y: number, w: number, h: number) {
      if (page) {
        let picture = embedded.get(value);
        if (!picture) {
          picture = value.format === "png" ? await document.embedPng(value.bytes) : await document.embedJpg(value.bytes);
          embedded.set(value, picture);
        }
        page.drawImage(picture, { x, y: height - y - h, width: w, height: h });
      } else svg.push(`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/${value.format};base64,${value.bytes.toString("base64")}"/>`);
    }

    block(0, 0, width, height, theme.background);
    block(0, 0, width, 8, theme.accent);
    const textX = logo && theme.logoPosition === "left" ? margin + 148 : margin;
    const textWidth = width - 2 * margin - (logo && !centered ? 148 : 0);
    if (logo) {
      const scale = Math.min(128 / logo.width, 58 / logo.height);
      const logoWidth = logo.width * scale;
      const x = centered ? (width - logoWidth) / 2 : theme.logoPosition === "left" ? margin : width - margin - logoWidth;
      await image(logo, x, 25, logoWidth, logo.height * scale);
    }
    text(menu.name, textX, centered ? 103 : 46, 11, theme.foreground, textWidth, bold);
    text(headline, textX, centered ? 132 : 81, 31, theme.foreground, textWidth, serif);
    block(margin, headerBottom, width - 2 * margin, 1, theme.accent);

    if (!rows.length) text("Menú en preparación.", margin, headerBottom + 45, 14, theme.foreground, 400);
    for (const row of rows) {
      const y = row.top + (row.title ? headingHeight : 0);
      if (row.title) text(row.title, margin, row.top + 15, 17, theme.foreground, width - 2 * margin, serif);
      for (const [column, card] of row.cards.entries()) {
        const x = margin + column * (cardWidth + gap);
        block(x, y, cardWidth, cardHeight, cardstock);
        const photo = card.mediaId ? photos.get(card.mediaId) : null;
        if (photo) await image(photo, x, y, cardWidth, 82);
        else block(x, y, cardWidth, 82, placeholder);
        titleLines(card.name, 13, cardWidth - 22, bold).forEach((line, lineIndex) =>
          text(line, x + 11, y + 100 + lineIndex * 14, 13, theme.foreground, cardWidth - 22, bold));
        if (card.description) text(card.description, x + 11, y + 128, 10, theme.foreground, cardWidth - 22);
        if (card.price) text(card.price, x + 11, y + 142, 10, theme.foreground, cardWidth - 22);
      }
    }
    block(margin, height - 37, width - 2 * margin, .75, theme.accent);
    text(`${index + 1} / ${pages.length}`, margin, height - 21, 10, theme.foreground, 100);
    if (!page) images.push(`<g transform="translate(0 ${index * height})">${svg.join("")}</g>`);
  }
  if (format === "pdf") return document.save();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="${height * pages.length * 2}" viewBox="0 0 ${width} ${height * pages.length}">${images.join("")}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
