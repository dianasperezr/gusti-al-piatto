import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeNumber } from "../src/modules/orders/settings.ts";
import { orderBody, whatsappMessage } from "../src/modules/orders/checkout.ts";
import { cartIdentity, parseCart } from "../src/modules/orders/cart.ts";

const id = "58c4e858-06d8-4674-9979-69b4eca168ba";

test("el número internacional queda normalizado y el indicativo opcional debe coincidir", () => {
  assert.deepEqual(normalizeNumber("+52 (55) 1234-5678", "+52"), { whatsapp: "525512345678", countryCode: "52" });
  assert.equal(normalizeNumber("00525512345678", "").whatsapp, "525512345678");
  assert.throws(() => normalizeNumber("+1 555 010 0100", "52"), /número internacional/);
});

test("el checkout rechaza importes persistidos por el cliente y cantidades inválidas", () => {
  const body = { currency: "MXN", lines: [{ id, quantity: 2 }] };
  assert.equal(orderBody.safeParse(body).success, true);
  assert.equal(orderBody.safeParse({ ...body, total: 1 }).success, false);
  assert.equal(orderBody.safeParse({ ...body, lines: [{ id, quantity: -2 }] }).success, false);
});

test("se conserva el carrito antiguo y las selecciones equivalentes se consideran iguales", () => {
  assert.equal(parseCart(JSON.stringify({ [id]: 2 }))[id].quantity, 2);
  const left = [{ group: "Extras", choices: ["Queso", "Tocino"] }];
  const right = [{ group: "Extras", choices: ["Tocino", "Queso"] }];
  assert.equal(cartIdentity(id, left, " Sin cebolla "), cartIdentity(id, right, "Sin cebolla"));
  assert.notEqual(cartIdentity(id, left), cartIdentity(id, right, "Sin cebolla"));
});

test("la lectura local descarta líneas dañadas y conserva las variantes válidas", () => {
  const valid = { id, quantity: 2, selections: [{ group: " Tamaño ", choices: [" Grande "] }], observedBaseUnit: 12000 };
  const cart = parseCart(JSON.stringify({
    valid,
    quantity: { ...valid, quantity: 21 },
    choice: { ...valid, selections: [{ group: "Tamaño", choices: [false] }] },
    price: { ...valid, observedBaseUnit: 1.5 },
    note: { ...valid, note: "x".repeat(161) },
  }));
  assert.deepEqual(cart, { valid: { ...valid, selections: [{ group: "Tamaño", choices: ["Grande"] }], note: "" } });
});

test("el mensaje de WhatsApp incluye moneda, referencia y notas de cada línea", () => {
  const message = whatsappMessage({
    reference: "ORD-TEST", lines: [{ id, name: "Hamburguesa", quantity: 2, selections: [], note: "Sin cebolla",
      unit: 1100, baseUnit: 22000, subtotal: 2200, discount: 200, total: 2000, labels: ["Tamaño: Grande"],
      offers: ["Martes"], components: [] }],
    currency: "USD", baseCurrency: "MXN", baseTotal: 40000, subtotal: 2200, discount: 200, total: 2000,
    name: "", note: "Sin cubiertos", exchange: { rate: 20, direction: "mxn-per-usd", updatedAt: "", guaranteed: false },
  }, "Hola", "MXN");
  assert.match(message, /SOLICITUD DE MENÚ DIGITAL · USD/);
  assert.match(message, /Nota del platillo: Sin cebolla/);
  assert.match(message, /Tamaño: Grande/);
  assert.match(message, /Notas generales: Sin cubiertos/);
  assert.match(message, /1 USD = 20 MXN/);
  assert.match(message, /Referencia: ORD-TEST/);
  assert.doesNotMatch(message, /Nombre:/);
});
