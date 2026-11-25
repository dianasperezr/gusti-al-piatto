import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { emptySection, visualLayout } from "../src/modules/appearance/layout-schema.ts";
import { monetarySettings } from "../src/modules/currencies/settings.ts";

test("el borrador permite componentes predefinidos y rechaza URLs con código", () => {
  const section = emptySection(randomUUID(), "banner");
  const style = {
    name: "Gusti", description: "", logoId: "", coverId: "", primary: "#a84027", secondary: "#303d2c", background: "#f8f4e9",
    typography: "classic", icon: "utensils", headerStyle: "photo", fixedHeader: true, navigation: "horizontal",
    fixedNavigation: false, compactMobile: true, categoryNavigation: true, cartStyle: "panel", cartVisible: true, orderButton: "Hacer pedido",
  };
  assert.equal(visualLayout.safeParse({ style, sections: [section] }).success, true);
  assert.equal(visualLayout.safeParse({ style, sections: [{ ...section, url: "javascript:alert(1)" }] }).success, false);
  assert.equal(visualLayout.safeParse({ style, sections: [section, section] }).success, false);
});

test("la moneda base permanece habilitada incluso cuando se desactivan las alternativas", () => {
  assert.deepEqual(monetarySettings.parse({ base: "USD", enabled: [] }).enabled, ["USD"]);
});
