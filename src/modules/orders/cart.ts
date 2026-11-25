import type { Selections } from "../products/selections.ts";

export type CartLine = { id: string; quantity: number; selections: Selections; observedBaseUnit?: number; note: string };
export type Cart = Record<string, CartLine>;

const uuid = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;

function record(input: unknown): Record<string, unknown> | null {
  return input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : null;
}

function label(input: unknown) {
  const value = typeof input === "string" ? input.trim() : "";
  return value.length > 0 && value.length <= 120 ? value : null;
}

function readSelections(input: unknown): Selections | null {
  if (!Array.isArray(input) || input.length > 12) return null;
  const selected: Selections = [];
  for (const entry of input) {
    const item = record(entry);
    const group = label(item?.group);
    if (!group || !Array.isArray(item?.choices) || item.choices.length > 20) return null;
    const choices: string[] = [];
    for (const rawChoice of item.choices) {
      const choice = label(rawChoice);
      if (!choice) return null;
      choices.push(choice);
    }
    selected.push({ group, choices });
  }
  return selected;
}

function readLine(key: string, input: unknown): CartLine | null {
  const value: Record<string, unknown> | null = typeof input === "number"
    ? { id: key, quantity: input, selections: [] }
    : record(input);
  if (!value) return null;
  const { id, quantity, note = "", observedBaseUnit } = value;
  if (typeof id !== "string" || !uuid.test(id) || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 20 ||
    typeof note !== "string" || note.length > 160 ||
    (observedBaseUnit !== undefined && (typeof observedBaseUnit !== "number" || !Number.isSafeInteger(observedBaseUnit) || observedBaseUnit < 0))) return null;
  const selections = readSelections(value.selections);
  return selections ? { id, quantity, selections, note, observedBaseUnit } : null;
}

export function parseCart(value: string): Cart {
  try {
    const parsed = record(JSON.parse(value));
    if (!parsed) return {};
    return Object.fromEntries(Object.entries(parsed).slice(0, 25).flatMap(([key, entry]) => {
      const line = readLine(key, entry);
      return line ? [[key, line]] : [];
    }));
  } catch {
    return {};
  }
}

export const cartIdentity = (id: string, selections: Selections, note = "") => JSON.stringify([
  id, selections.filter(group => group.choices.length).map(group => [group.group, [...group.choices].sort()])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]))), note.trim(),
]);
