import { z } from "zod";

export const cents = z.number().int().min(0).max(100_000_000);
export const uuidList = z.array(z.uuid()).max(100);
export const shortText = z.string().trim().min(1).max(120);
export const optionGroup = z.object({
  name: shortText,
  min: z.number().int().min(0).max(20),
  max: z.number().int().min(1).max(20),
  choices: z.array(z.object({ name: shortText, cents })).min(1).max(30),
}).refine(group => group.min <= group.max && group.max <= group.choices.length &&
  new Set(group.choices.map(choice => choice.name)).size === group.choices.length,
"Cada grupo requiere opciones únicas y límites válidos.");

export const optionGroups = z.array(optionGroup).max(12)
  .refine(groups => new Set(groups.map(group => group.name)).size === groups.length, "Usa nombres únicos para los grupos.")
  .refine(groups => groups.reduce((sum, group) => sum + [...group.choices].sort((a, b) => b.cents - a.cents)
    .slice(0, group.max).reduce((total, choice) => total + choice.cents, 0), 0) <= 100_000_000, "Reduce el importe máximo de complementos.");
export { selectionsSchema, type Selections } from "./selections.ts";
export type OptionGroup = z.infer<typeof optionGroup>;

export function parseGroups(value: string) {
  const groups = value.split("\n").filter(line => line.trim()).map(line => {
    const [name, min, max, ...choices] = line.split("|").map(field => field.trim());
    return {
      name, min: Number(min), max: Number(max),
      choices: choices.map(choice => {
        const [name, amount = "0"] = choice.split("=").map(field => field.trim());
        return { name, cents: decimalCents(amount) };
      }),
    };
  });
  return optionGroups.parse(groups);
}

export function formatGroups(groups: OptionGroup[]) {
  return groups.map(group => [group.name, group.min, group.max,
    ...group.choices.map(choice => `${choice.name}=${(choice.cents / 100).toFixed(2)}`),
  ].join(" | ")).join("\n");
}

export function decimalCents(value: string | number) {
  const text = String(value).trim();
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(text)) throw new Error("Revisa el importe. Usa hasta dos decimales.");
  return cents.parse(Math.round(Number(text) * 100));
}
