import { z } from "zod";

const currencies = z.enum(["MXN", "USD"]);
export type Currency = z.infer<typeof currencies>;

export const monetarySettings = z.object({
  base: currencies.default("MXN"),
  enabled: z.array(currencies).max(2).default(["MXN", "USD"]),
  rate: z.coerce.number<string | number>().min(0.0001).max(9999).refine(
    value => Math.abs(value * 1000000 - Math.round(value * 1000000)) < 0.00001,
    "El tipo de cambio admite hasta seis decimales.",
  ).default(18),
  direction: z.enum(["mxn-per-usd", "usd-per-mxn"]).default("mxn-per-usd"),
  rounding: z.enum(["nearest", "up", "down"]).default("nearest"),
  increment: z.coerce.number<string | number>().pipe(z.union([z.literal(1), z.literal(5), z.literal(100)])).default(1),
  display: z.enum(["code", "symbol", "both"]).default("code"),
  mxnSymbol: z.string().trim().max(8).default(""),
  usdSymbol: z.string().trim().max(8).default(""),
  updatedAt: z.union([z.iso.datetime(), z.literal("")]).default(""),
  guaranteed: z.boolean().default(false),
}).transform(value => ({ ...value, enabled: [...new Set([value.base, ...value.enabled])] }));

export type MonetarySettings = z.output<typeof monetarySettings>;
export const defaultMoney = monetarySettings.parse({});
