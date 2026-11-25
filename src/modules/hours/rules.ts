import { z } from "zod";
import { uuidList } from "../products/options.ts";

export const behaviors = ["normal", "featured", "last", "hidden", "unavailable"] as const;
export type Behavior = typeof behaviors[number];
export const daysOfWeek = z.array(z.number().int().min(0).max(6)).max(7);
export const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const localDateTime = z.union([z.literal(""), z.iso.datetime({ local: true }).refine(value => !value.endsWith("Z"))]);

export const timing = {
  starts: localDateTime.default(""),
  ends: localDateTime.default(""),
  days: daysOfWeek.default([]),
  opens: z.union([z.literal(""), clock]).default(""),
  closes: z.union([z.literal(""), clock]).default(""),
};

export const schedule = z.object({
  day: z.coerce.number<string | number>().int().min(0).max(6).default(0),
  days: daysOfWeek.default([]),
  opens: clock,
  closes: clock,
  date: z.union([z.literal(""), z.iso.date()]).default(""),
  mode: z.enum(["restaurant", "menu", "closed"]).default("restaurant"),
  targets: uuidList.default([]),
  priority: z.coerce.number<string | number>().int().min(0).max(999).default(0),
  inside: z.enum(behaviors).default("normal"),
  outside: z.enum(behaviors).default("unavailable"),
  blockOutside: z.boolean().default(true),
});

export type Schedule = z.infer<typeof schedule> & { id: string; position: number };

export function localDateTimeAt(date: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

function calendar(now: string) {
  const date = now.slice(0, 10);
  const today = new Date(date + "T12:00:00Z");
  const weekday = today.getUTCDay();
  today.setUTCDate(today.getUTCDate() - 1);
  return { date, weekday, previousDate: today.toISOString().slice(0, 10), previousDay: (weekday + 6) % 7, time: now.slice(11, 16) };
}

export function inWindow(now: string, { starts = "", ends = "", days = [], opens = "", closes = "", date = "" }: {
  starts?: string; ends?: string; days?: number[]; opens?: string; closes?: string; date?: string;
}) {
  const normalize = (value: string) => value.length === 16 ? value + ":00" : value;
  if ((starts && now < normalize(starts)) || (ends && now >= normalize(ends))) return false;
  const { time, weekday, previousDate, previousDay, date: today } = calendar(now);
  const matchesDay = (day: number, value: string) => (!date || date === value) && (!days.length || days.includes(day));
  if (!opens || !closes || opens === closes) return matchesDay(weekday, today);
  if (opens < closes) return matchesDay(weekday, today) && opens <= time && time < closes;
  return (matchesDay(weekday, today) && time >= opens) || (matchesDay(previousDay, previousDate) && time < closes);
}

export function evaluateRules(now: string, schedules: Schedule[], targets: string[]) {
  const { date, previousDate } = calendar(now);
  const relevant = schedules.filter(rule => rule.mode === "menu" &&
    (!rule.date || rule.date === date || (rule.date === previousDate && rule.opens > rule.closes && now.slice(11, 16) < rule.closes)) &&
    (rule.targets.some(id => targets.includes(id)) || targets.includes(rule.id)))
    .sort((a, b) => b.priority - a.priority || a.position - b.position || a.id.localeCompare(b.id));
  const active = relevant.find(rule => inWindow(now, rule));
  const fallback = relevant[0];
  const behavior = active?.inside ?? fallback?.outside ?? "normal";
  const orderable = behavior !== "hidden" && behavior !== "unavailable" && (Boolean(active) || !fallback?.blockOutside);
  return { behavior, orderable };
}
