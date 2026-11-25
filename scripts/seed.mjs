import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { parseDatabaseUrl } from "../src/lib/database-url.ts";

if (process.env.NODE_ENV === "production" || process.env.GUSTI_SEED_TEST !== "1") {
  throw new Error("Usa una base de pruebas y ejecuta el comando con GUSTI_SEED_TEST=1.");
}

const connectionString = parseDatabaseUrl(process.env.DATABASE_URL ?? "");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const fixtureId = number => `745daa2d-1e68-409b-8d00-${String(number).padStart(12, "0")}`;

try {
  await prisma.$transaction(async tx => {
    const category = await tx.category.upsert({
      where: { id: fixtureId(1) },
      create: { id: fixtureId(1), name: "Pastas de prueba", slug: "demo-pastas" },
      update: {},
    });
    const dish = await tx.dish.upsert({
      where: { id: fixtureId(2) },
      create: {
        id: fixtureId(2), categoryId: category.id, name: "Pasta al pomodoro",
        slug: "demo-pomodoro", priceCents: 14500, isPublished: true,
        ingredients: ["Pasta", "Tomate"],
        variants: { create: { name: "Porción grande", priceAdjustmentCents: 3500 } },
        modifierGroups: { create: { name: "Extras", maxSelections: 1, modifiers: {
          create: { name: "Parmesano", priceAdjustmentCents: 1800 },
        } } },
      },
      update: {},
    });
    const bundle = await tx.bundle.upsert({
      where: { id: fixtureId(3) },
      create: {
        id: fixtureId(3), name: "Paquete para dos", slug: "demo-para-dos",
        pricingMode: "FIXED", priceCents: 26000, isPublished: true,
        items: { create: { dishId: dish.id, quantity: 2 } },
      },
      update: {},
    });
    for (const [currencyCode, exchangeRate] of [["MXN", "1"], ["USD", "0.057500000001"]]) {
      await tx.currencySettings.upsert({
        where: { currencyCode },
        create: { currencyCode, exchangeRate, isEnabled: true },
        update: {},
      });
    }
    const line = {
      id: bundle.id, name: bundle.name, quantity: 1, unit: 26000, baseUnit: 26000,
      subtotal: 26000, discount: 0, total: 26000, selections: [],
      note: "", labels: [], offers: [], components: ["2 × Pasta al pomodoro por paquete"],
    };
    const createdAt = new Date("2026-01-01T18:00:00Z");
    const reference = "ORD-DEMO-745DAA2D";
    await tx.orderRequest.upsert({
      where: { id: fixtureId(4) },
      create: {
        id: fixtureId(4), reference, currencyCode: "MXN", baseCurrency: "MXN",
        exchangeRateSnapshot: "1", subtotalCents: 26000, discountCents: 0, totalCents: 26000,
        createdAt, whatsappLinkGeneratedAt: createdAt,
        snapshot: {
          reference, currency: "MXN", baseCurrency: "MXN", subtotal: 26000,
          discount: 0, total: 26000, baseTotal: 26000, note: "", lines: [line],
          exchange: { rate: 1, direction: "mxn-per-usd", updatedAt: null, guaranteed: false },
        },
        items: { create: {
          itemType: "BUNDLE", itemId: line.id, itemNameSnapshot: line.name,
          quantity: line.quantity, unitPriceCents: line.unit, subtotalCents: line.subtotal,
          configurationSnapshot: line,
        } },
      },
      update: {},
    });
  });
  console.log("Datos de prueba disponibles en el esquema normalizado.");
} finally {
  await prisma.$disconnect();
}
