import { z } from "zod";

const shortText = z.string().trim().min(1).max(120);
export const selectionsSchema = z.array(z.object({
  group: shortText,
  choices: z.array(shortText).max(20),
})).max(12);
export const defaultSelections = selectionsSchema.default([]);
export type Selections = z.output<typeof selectionsSchema>;
