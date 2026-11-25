import assert from "node:assert/strict";
import { test } from "node:test";
import { isRestaurantOpen } from "../src/modules/catalog/hours.ts";
import { inWindow, evaluateRules } from "../src/modules/hours/rules.ts";
import { unitCents, quoteCart } from "../src/modules/catalog/pricing.ts";
import { applyOffers } from "../src/modules/promotions/rules.ts";
import { parseGroupFields } from "../src/modules/products/options.ts";
import { productStatus, productStatuses, statusFor } from "../src/modules/admin/product-status.ts";

test("un turno nocturno de lunes sigue abierto hasta la hora final del martes", () => {
  const shift = [{ day: 1, opens: "19:00", closes: "01:30" }];
  assert.equal(isRestaurantOpen("2026-11-23T18:59:00", shift), false);
  assert.equal(isRestaurantOpen("2026-11-24T01:29:00", shift), true);
  assert.equal(inWindow("2026-11-24T01:29:00", { date: "2026-11-23", days: [1], ...shift[0] }), true);
  assert.equal(inWindow("2026-11-24T01:30:00", { date: "2026-11-23", days: [1], ...shift[0] }), false);
});

test("las reglas dentro del horario respetan prioridad y pueden bloquear pedidos sin ocultar", () => {
  const rule = { id: "schedule", mode: "menu", position: 0, opens: "07:00", closes: "12:00", days: [1], date: "", targets: ["product"], priority: 3, inside: "featured", outside: "last", blockOutside: true };
  assert.deepEqual(evaluateRules("2026-11-23T08:00:00", [rule], ["product"]), { behavior: "featured", orderable: true });
  assert.deepEqual(evaluateRules("2026-11-23T12:00:00", [rule], ["product"]), { behavior: "last", orderable: false });
});

test("la conversión usa un precio original, ambas direcciones y reglas exactas de redondeo", () => {
  assert.equal(unitCents({ priceCents: 19000 }, "MXN", 18), 19000);
  assert.equal(unitCents({ priceCents: 19000 }, "USD", 18), 1056);
  assert.equal(unitCents({ priceCents: 2015 }, "USD", 2), 1008);
  assert.equal(unitCents({ priceCents: 1100 }, "MXN", 18, "USD"), 19800);
  assert.equal(unitCents({ priceCents: 2015 }, "USD", 0.5, "MXN", { direction: "usd-per-mxn", rounding: "up", increment: 5 }), 1010);
  assert.equal(unitCents({ priceCents: 2015 }, "USD", 0.5, "MXN", { direction: "usd-per-mxn", rounding: "down", increment: 5 }), 1005);
});

test("una oferta por pares conserva la tarifa de la unidad sobrante y valida extras", () => {
  const offer = { id: "1", name: "Martes", method: "price", amount: 19900, minimum: 2, priority: 2, stacking: false, targets: [] };
  const extra = { ...offer, id: "2", method: "percent", amount: 10, minimum: 1, priority: 1, stacking: true };
  assert.deepEqual(applyOffers(12500, 3, [offer, extra]), { total: 32400, applied: ["Martes"] });
  const item = { id: "dish", priceCents: 12500, usdCents: null, offers: [offer], groups: [{ name: "Tamaño", min: 1, max: 1, choices: [{ name: "Doble", cents: 3500 }, { name: "Sencilla", cents: 0 }] }] };
  assert.equal(quoteCart([{ item, quantity: 2, selections: [] }], "MXN", 18, "MXN")[0], null);
  const quote = quoteCart([
    { item, quantity: 1, selections: [{ group: "Tamaño", choices: ["Doble"] }] },
    { item, quantity: 1, selections: [{ group: "Tamaño", choices: ["Sencilla"] }] },
  ], "MXN", 18, "MXN");
  assert.equal(quote[0].total + quote[1].total, 23400);
});

test("el formato usa símbolos personalizados y conserva el código cuando se configura", async () => {
  const { formatPrice } = await import("../src/modules/catalog/pricing.ts");
  assert.match(formatPrice(12800, "USD", { display: "both", usdSymbol: "US$", mxnSymbol: "" }), /US\$\s*128\.00 USD/);
  assert.match(formatPrice(12800, "MXN"), /MXN.*128\.00/);
});

test("las variantes de la lista conservan sus nombres y validan los límites y centavos", () => {
  const variant = { name: "Salsa | Picante", min: 1, max: 1, choices: [{ name: "Chile = 2", amount: "12.50" }] };
  assert.deepEqual(parseGroupFields(JSON.stringify([variant])), [
    { name: variant.name, min: 1, max: 1, choices: [{ name: "Chile = 2", cents: 1250 }] },
  ]);
  assert.throws(() => parseGroupFields(JSON.stringify([{ ...variant, max: 2 }])));
  assert.throws(() => parseGroupFields(JSON.stringify([{ ...variant, choices: [{ name: "Chile", amount: "1.005" }] }])));
});

test("el desplegable representa todas las combinaciones de estados de platillos existentes", () => {
  for (const [key, flags] of Object.entries(productStatuses)) {
    assert.equal(statusFor(flags), productStatus.parse(key));
  }
  assert.equal(productStatus.safeParse("__proto__").success, false);
});
