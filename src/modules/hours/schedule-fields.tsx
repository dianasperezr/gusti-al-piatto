"use client";

import { CalendarDays, CalendarX2, Clock3, Utensils } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { behaviorChoices, weekdays } from "../admin/config";
import type { Schedule } from "./rules";

type Rule = Omit<Schedule, "id" | "position">;
const week = [1, 2, 3, 4, 5, 6, 0];
const weekdayShort = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const types = [
  { value: "restaurant", title: "Horario general", Icon: Clock3 },
  { value: "menu", title: "Horario de menú", Icon: Utensils },
  { value: "closed", title: "Cierre o feriado", Icon: CalendarX2 },
] as const;

export function ScheduleFields({ initial, targets }: { initial: Rule; targets: { id: string; name: string }[] }) {
  const form = useForm({ defaultValues: {
    mode: initial.mode, date: initial.date, scope: initial.date ? "date" : "weekly",
    days: initial.days.length ? initial.days : week,
    allDay: initial.opens === initial.closes, opens: initial.opens, closes: initial.closes,
  } });
  const { control, register, setValue } = form;
  const [mode, scope, days, allDay] = useWatch({ control, name: ["mode", "scope", "days", "allDay"] });

  return <div className="schedule-fields">
    <fieldset>
      <legend>Tipo de regla</legend>
      <div className="schedule-modes">{types.map(({ value, title, Icon }) => <button type="button" className="button"
        key={value} aria-pressed={mode === value} onClick={() => {
          setValue("mode", value);
          if (value === "closed") setValue("allDay", true);
        }}><Icon size={18} aria-hidden="true" /> {title}</button>)}</div>
      <input type="hidden" name="mode" value={mode} />
    </fieldset>
    <fieldset>
      <legend><CalendarDays size={17} aria-hidden="true" /> Días de aplicación</legend>
      <div className="schedule-scopes">
        <label className="check"><input type="radio" value="weekly" {...register("scope")} /> Cada semana</label>
        <label className="check"><input type="radio" value="date" {...register("scope")} /> Una fecha específica</label>
      </div>
      {scope === "date" ? <label>Fecha<input type="date" required {...register("date")} /></label> : <>
        <div className="schedule-days" role="group" aria-label="Días de la semana">
          {week.map(day => <button type="button" className="button" key={day} title={weekdays[day]} aria-label={weekdays[day]}
            aria-pressed={days.includes(day)} onClick={() => {
              if (days.includes(day) && days.length === 1) return;
              setValue("days", days.includes(day) ? days.filter(current => current !== day) : [...days, day]);
            }}>{weekdayShort[day]}</button>)}
        </div>
        <div className="schedule-shortcuts">
          <button className="button small" type="button" onClick={() => setValue("days", week)}>Todos</button>
          <button className="button small" type="button" onClick={() => setValue("days", week.slice(0, 5))}>Lunes a viernes</button>
          <button className="button small" type="button" onClick={() => setValue("days", [6, 0])}>Fin de semana</button>
        </div>
        {days.length < 7 && days.map(day => <input key={day} type="hidden" name="days" value={day} />)}
      </>}
    </fieldset>
    <fieldset>
      <legend>Horario</legend>
      <label className="check"><input type="checkbox" {...register("allDay")} /> Todo el día</label>
      {allDay ? <>
        <input type="hidden" name="opens" value="00:00" />
        <input type="hidden" name="closes" value="00:00" />
      </> : <div className="field-grid">
        <label>Desde<input type="time" required {...register("opens")} /></label>
        <label>Hasta<input type="time" required {...register("closes")} /></label>
      </div>}
    </fieldset>
    {mode === "menu" && <fieldset>
      <legend>Aplicar al catálogo</legend>
      <label>Platillos, categorías, paquetes o promociones<select name="targets" multiple size={5} defaultValue={initial.targets}>
        {targets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
      </select></label>
      <div className="field-grid">
        <label>En horario<select name="inside" defaultValue={initial.inside}>
          {behaviorChoices.map(([key, title]) => <option key={key} value={key}>{title}</option>)}
        </select></label>
        <label>Fuera de horario<select name="outside" defaultValue={initial.outside}>
          {behaviorChoices.map(([key, title]) => <option key={key} value={key}>{title}</option>)}
        </select></label>
        <label>Prioridad<input name="priority" type="number" min={0} max={999} defaultValue={initial.priority} /></label>
      </div>
      <label className="check"><input type="checkbox" name="blockOutside" defaultChecked={initial.blockOutside} /> Bloquear pedidos fuera de horario</label>
    </fieldset>}
  </div>;
}
