import type { OptionGroup, Selections } from "./options.ts";

export function resolveSelections(groups: OptionGroup[], selections: Selections) {
  if (new Set(selections.map(selected => selected.group)).size !== selections.length ||
      selections.some(selected => !groups.some(group => group.name === selected.group))) return null;
  let extraCents = 0;
  const labels: string[] = [];
  for (const group of groups) {
    const picks = selections.find(selected => selected.group === group.name)?.choices ?? [];
    if (picks.length < group.min || picks.length > group.max || new Set(picks).size !== picks.length) return null;
    const chosen = group.choices.filter(choice => picks.includes(choice.name));
    if (chosen.length !== picks.length) return null;
    for (const choice of chosen) extraCents += choice.cents;
    if (picks.length) labels.push(`${group.name}: ${chosen.map(choice => choice.name).join(", ")}`);
  }
  return { extraCents, labels };
}
