import { z } from "zod";
import { uuidList } from "../products/options.ts";
import { timing } from "../hours/rules.ts";

export const promotion = z.object({
  ...timing,
  method: z.enum(["notice", "percent", "fixed", "price"]).default("notice"),
  amount: z.coerce.number<string | number>().int().min(0).max(100_000_000).default(0),
  minimum: z.coerce.number<string | number>().int().min(1).max(20).default(1),
  priority: z.coerce.number<string | number>().int().min(0).max(999).default(0),
  targets: uuidList.default([]),
  stacking: z.boolean().default(false),
  banner: z.boolean().default(false),
  restrictions: z.string().trim().max(600).default(""),
}).refine(value => value.method !== "percent" || value.amount > 0 && value.amount <= 100,
"El porcentaje debe estar entre 1 y 100.");

export { applyOffers, type Offer } from "./offer-pricing.ts";
