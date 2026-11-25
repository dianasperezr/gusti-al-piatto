import "dotenv/config";
import { mkdir, copyFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { hashPassword } from "../src/modules/auth/password.ts";
import { emptySection, visualLayout } from "../src/modules/appearance/layout-schema.ts";
import { parseDatabaseUrl } from "../src/lib/database-url.ts";

const connectionString = parseDatabaseUrl(process.env.DATABASE_URL ?? "");
const database = new URL(connectionString);
if (process.env.NODE_ENV === "production" || !["127.0.0.1", "localhost", "[::1]"].includes(database.hostname) ||
    database.pathname !== "/gusti_demo" || !process.env.MEDIA_DIRECTORY) {
  throw new Error("La demo requiere una base local gusti_demo y MEDIA_DIRECTORY dedicado.");
}

const id = number => `bc066100-77d5-4295-82a0-${String(number).padStart(12, "0")}`;
const photo = "demo/cocina-italiana.webp";
const storage = resolve(process.env.MEDIA_DIRECTORY);
await mkdir(resolve(storage, "demo"), { recursive: true });
await copyFile(new URL("../public/gusti-hero.webp", import.meta.url), resolve(storage, photo));
const { size } = await stat(resolve(storage, photo));

const categories = ["Entradas", "Pastas", "Pizzas", "Postres", "Bebidas"];
const dishes = [
  [0, "Bruschetta al pomodoro", "Pan rústico tostado, jitomate marinado y albahaca fresca.", 10500],
  [0, "Ensalada caprese", "Mozzarella, jitomate, albahaca y aceite de oliva.", 12900],
  [1, "Tagliatelle al ragù", "Pasta larga con ragù de cocción lenta y parmesano.", 22900],
  [1, "Fettuccine al funghi", "Champiñones salteados y salsa cremosa de parmesano.", 20500],
  [1, "Penne al pomodoro", "Salsa de jitomate asado, ajo y albahaca.", 17900],
  [2, "Margherita", "Mozzarella, jitomate y hojas de albahaca.", 18500],
  [2, "Diavola", "Salami picante, mozzarella y salsa de jitomate.", 22900],
  [2, "Quattro formaggi", "Mozzarella, gorgonzola, parmesano y provolone.", 23900],
  [3, "Tiramisú della casa", "Bizcocho con espresso, crema de mascarpone y cacao.", 11900],
  [3, "Panna cotta", "Vainilla y coulis de frutos rojos.", 9900],
  [4, "Limonada con albahaca", "Limón fresco y albahaca, servida con hielo.", 6500],
  [4, "Espresso doble", "Café de tueste medio con notas de cacao.", 5500],
];
const sections = [
  { ...emptySection(id(40), "hero"), title: "Gusti al Piatto" },
  { ...emptySection(id(41), "catalog"), title: "A la carta" },
  { ...emptySection(id(42), "combos"), title: "Para compartir" },
  { ...emptySection(id(43), "promotions"), title: "Promociones" },
  emptySection(id(44), "contact"), emptySection(id(45), "footer"),
];
const layout = visualLayout.parse({
  style: {
    name: "Gusti al Piatto", description: "Cocina italiana. Pastas, pizza al horno y algo dulce para terminar.",
    logoId: "", coverId: id(70), primary: "#a84027", secondary: "#303d2c", background: "#f8f4e9",
    typography: "classic", icon: "utensils", headerStyle: "photo", fixedHeader: true, navigation: "horizontal",
    fixedNavigation: false, compactMobile: true, categoryNavigation: true, cartStyle: "panel", cartVisible: true,
    orderButton: "Abrir WhatsApp",
  },
  sections,
});

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const passwordHash = await hashPassword("Gusti-Demo-Local-2026");
const slug = name => name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
try {
  await prisma.$transaction(async tx => {
    const save = data => tx.content.upsert({ where: { id: data.id }, create: { published: true, ...data }, update: {} });
    const user = await tx.user.upsert({
      where: { email: "admin@gusti.test" },
      create: { id: id(80), email: "admin@gusti.test", name: "Administración demo", role: "ADMIN", passwordHash },
      update: {},
    });
    await tx.media.upsert({ where: { id: id(70) }, update: {}, create: {
      id: id(70), name: "Cocina italiana.webp", mime: "image/webp", mediaType: "IMAGE",
      size, path: photo,
    } });
    for (const [index, name] of categories.entries()) {
      await save({ id: id(1 + index), kind: "CATEGORY", name, slug: slug(name), position: index, options: {} });
    }
    for (const [index, [category, name, description, priceCents]] of dishes.entries()) {
      const groups = index === 2 ? [
        { name: "Tamaño", min: 1, max: 1, choices: [{ name: "Individual", cents: 0 }, { name: "Grande", cents: 4500 }] },
        { name: "Extras", min: 0, max: 1, choices: [{ name: "Parmesano extra", cents: 1800 }] },
      ] : [];
      await save({ id: id(10 + index), kind: "PRODUCT", name, slug: slug(name), description, priceCents,
        categoryId: id(1 + category), position: index, featured: [2, 5, 8].includes(index), options: { available: true, groups } });
    }
    await save({ id: id(30), kind: "COMBO", name: "Cena italiana para dos", description: "Una pizza, una pasta y dos limonadas.",
      priceCents: 44900, options: { available: true, priceMode: "fixed" } });
    await tx.comboItem.createMany({ data: [[15, 1], [12, 1], [20, 2]].map(([product, quantity]) =>
      ({ comboId: id(30), productId: id(product), quantity })), skipDuplicates: true });
    await save({ id: id(31), kind: "PROMOTION", name: "10% en pizzas", description: "Una muestra de descuento aplicado al carrito.",
      options: { method: "percent", amount: 10, targets: [id(3)] } });
    await save({ id: id(32), kind: "HOURS", name: "Horario del restaurante", options: { opens: "12:00", closes: "22:00", mode: "restaurant" } });
    await save({ id: id(33), kind: "TEMPLATE", name: "Carta italiana", options: {
      background: "#f8f4e9", foreground: "#303d2c", accent: "#a84027", format: "portrait", content: "menu",
    } });
    await save({ id: "contact", kind: "CONTACT", name: "Contacto y pedidos", options: {
      whatsapp: "12025550114", countryCode: "1", ordering: true, cartEnabled: true, respectHours: false,
      address: "Ciudad de México · Dirección ficticia", phone: "", instagram: "", facebook: "",
      timezone: "America/Mexico_City", logRequests: true, customerInstructions: "Demostración local con un número ficticio.",
    } });
    await save({ id: "currency", kind: "CURRENCY", name: "Monedas y precios", options: {
      base: "MXN", enabled: ["MXN", "USD"], rate: 18.25, direction: "mxn-per-usd",
    } });
    for (const key of ["visual:draft", "visual:published"]) {
      await tx.integrationState.upsert({ where: { key }, create: { key, value: layout }, update: {} });
    }
    await tx.audit.upsert({ where: { id: id(81) }, update: {}, create: {
      id: id(81), userId: user.id, action: "Inicializar demostración", target: "Catálogo y diseño de ejemplo",
    } });
    const line = {
      id: id(30), name: "Cena italiana para dos", quantity: 1, unit: 44900, baseUnit: 44900,
      subtotal: 44900, discount: 0, total: 44900, selections: [], note: "", labels: [], offers: [],
      components: ["1 × Margherita", "1 × Tagliatelle al ragù", "2 × Limonada con albahaca"],
    };
    const reference = "ORD-DEMO-GUSTI";
    await tx.orderRequest.upsert({ where: { id: id(82) }, update: {}, create: {
      id: id(82), reference, currencyCode: "MXN", baseCurrency: "MXN", exchangeRateSnapshot: "18.25",
      subtotalCents: 44900, discountCents: 0, totalCents: 44900, whatsappLinkGeneratedAt: new Date(),
      snapshot: {
        reference, currency: "MXN", baseCurrency: "MXN", subtotal: 44900, discount: 0, total: 44900,
        baseTotal: 44900, note: "", lines: [line],
        exchange: { rate: 18.25, direction: "mxn-per-usd", updatedAt: "", guaranteed: false },
      },
      items: { create: {
        itemType: "BUNDLE", itemId: line.id, itemNameSnapshot: line.name, quantity: line.quantity,
        unitPriceCents: line.unit, subtotalCents: line.subtotal, configurationSnapshot: line,
      } },
    } });
  });
  console.log("Demo disponible en gusti_demo. Acceso: admin@gusti.test");
} finally {
  await prisma.$disconnect();
}
