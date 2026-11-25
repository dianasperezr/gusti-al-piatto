import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import sharp from "sharp";
import { db } from "@/lib/db";
import { parseOptions } from "@/modules/admin/config";
import { getMenu } from "@/modules/catalog/menu";
import { formatPrice, unitCents } from "@/modules/catalog/pricing";

type Line = { name: string; price?: string; heading?: boolean };

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function fitText(value: string, size: number, width: number, font: PDFFont) {
  const compatible = Array.from(value.replace(/\s+/gu, " "), character => {
    try {
      font.encodeText(character);
      return character.codePointAt(0)! >= 32 ? character : "";
    } catch {
      return "?";
    }
  }).join("");
  if (font.widthOfTextAtSize(compatible, size) <= width) return compatible;
  let shortened = compatible;
  while (font.widthOfTextAtSize(shortened + "…", size) > width) shortened = shortened.slice(0, -1);
  return shortened + "…";
}

const rgbHex = (hex: string) => rgb(...([1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255) as [number, number, number]));

export async function renderMenuExport(templateId: string, format: "pdf" | "png") {
  const [template, menu] = await Promise.all([
    db().content.findFirst({ where: { id: templateId, kind: "TEMPLATE", published: true } }),
    getMenu(),
  ]);
  if (!template) return null;
  const theme = parseOptions("TEMPLATE", template.options);
  const width = 612;
  const height = theme.format === "square" ? 612 : 792;
  const lines: Line[] = [];
  const append = (title: string, items: typeof menu.items) => {
    if (!items.length) return;
    lines.push({ name: title, heading: true });
    for (const item of items) {
      lines.push({ name: item.name, price: formatPrice(unitCents(item, menu.base, menu.rate, menu.base), menu.base) });
      if (item.components.length) lines.push({ name: item.components.map(component => component.quantity + " × " + component.name).join(" · ") });
    }
  };

  if (theme.content === "menu") {
    for (const category of menu.categories) append(category.name, menu.items.filter(item => item.categoryId === category.id));
    append("Platillos", menu.items.filter(item => item.kind === "PRODUCT" && !item.categoryId));
  }
  if (theme.content !== "promotions") append("Paquetes", menu.items.filter(item => item.kind === "COMBO"));
  if (theme.content === "promotions") {
    for (const promotion of menu.promotions) {
      lines.push({ name: promotion.name, heading: true });
      if (promotion.description) lines.push({ name: promotion.description });
    }
  }
  if (!lines.length) lines.push({ name: "Menú en preparación." });

  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const capacity = Math.floor((height - 186) / 28);
  const pages = Math.ceil(lines.length / capacity);
  if (format === "png" && pages > 24) return null;

  const images: string[] = [];
  for (let index = 0; index < pages; index++) {
    const page: PDFPage | undefined = format === "pdf" ? document.addPage([width, height]) : undefined;
    const commands: string[] = [];
    function block(x: number, y: number, w: number, h: number, color: string) {
      if (page) page.drawRectangle({ x, y: height - y - h, width: w, height: h, color: rgbHex(color) });
      else commands.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`);
    }
    function text(value: string, x: number, y: number, size: number, color: string, maxWidth: number, strong = false) {
      const font = strong ? bold : regular;
      const fitted = fitText(value, size, maxWidth, font);
      if (page) page.drawText(fitted, { x, y: height - y, size, font, color: rgbHex(color) });
      else commands.push(`<text x="${x}" y="${y}" fill="${color}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${size}" font-weight="${strong ? "bold" : "normal"}">${escapeXml(fitted)}</text>`);
    }
    block(0, 0, width, height, theme.background);
    block(0, 0, width, 12, theme.accent);
    text(menu.name, 44, 75, 36, theme.foreground, 520, true);
    text(template.name, 45, 105, 15, theme.accent, 515, true);
    block(45, 123, 522, 1, theme.accent);
    lines.slice(index * capacity, (index + 1) * capacity).forEach((line, row) => {
      const y = 156 + row * 28;
      text(line.name, 45, y, line.heading ? 16 : 13, line.heading ? theme.accent : theme.foreground, line.price ? 410 : 520, line.heading);
      if (line.price) text(line.price, 466, y, 13, theme.foreground, 102, true);
    });
    text(`${index + 1} / ${pages}`, 45, height - 26, 11, theme.accent, 100);
    if (!page) images.push(`<g transform="translate(0 ${index * height})">${commands.join("")}</g>`);
  }

  if (format === "pdf") return document.save();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="${height * pages * 2}" viewBox="0 0 ${width} ${height * pages}">${images.join("")}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
