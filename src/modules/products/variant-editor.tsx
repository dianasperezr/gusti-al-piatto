"use client";

import { Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { useId } from "react";
import { useFieldArray, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import type { OptionGroup } from "./options";

type Variant = { name: string; min: number; max: number; choices: { name: string; amount: string }[] };
type Fields = { groups: Variant[] };
const presets = ["Tamaño", "Presentación", "Masa", "Término", "Salsa", "Complementos", "Extras"];
const newChoice = { name: "", amount: "0" };

function VariantFields({ form, index, presetsId, onRemove }: {
  form: UseFormReturn<Fields>;
  index: number;
  presetsId: string;
  onRemove: () => void;
}) {
  const name = `groups.${index}` as const;
  const { fields, append, remove } = useFieldArray({ control: form.control, name: `${name}.choices` });
  const number = { valueAsNumber: true };
  return <fieldset className="variant-group">
    <legend>Variante {index + 1}</legend>
    <div className="variant-fields">
      <label>Nombre del grupo<input required maxLength={120} list={presetsId} placeholder="Ej. Tamaño" {...form.register(`${name}.name`)} /></label>
      <label>Mínimo<input required type="number" min={0} max={20} {...form.register(`${name}.min`, number)} /></label>
      <label>Máximo<input required type="number" min={1} max={20} {...form.register(`${name}.max`, number)} /></label>
    </div>
    <ul className="variant-choices">{fields.map((choice, row) => <li key={choice.id}>
      <label>Opción {row + 1}<input required maxLength={120} placeholder="Ej. Individual" {...form.register(`${name}.choices.${row}.name`)} /></label>
      <label>Importe adicional<input required type="number" min={0} max={1_000_000} step="0.01" {...form.register(`${name}.choices.${row}.amount`)} /></label>
      <button className="button small" type="button" aria-label={`Quitar opción ${row + 1}`} disabled={fields.length === 1} onClick={() => remove(row)}><Trash2 size={16} aria-hidden="true" /></button>
    </li>)}</ul>
    <div className="variant-actions">
      <button className="button small" type="button" disabled={fields.length === 30} onClick={() => append(newChoice)}><Plus size={16} aria-hidden="true" /> Agregar opción</button>
      <button className="button small danger" type="button" onClick={onRemove}><Trash2 size={16} aria-hidden="true" /> Quitar variante</button>
    </div>
  </fieldset>;
}

export function VariantEditor({ initial }: { initial: OptionGroup[] }) {
  const form = useForm<Fields>({ defaultValues: { groups: initial.map(group => ({
    ...group, choices: group.choices.map(({ name, cents }) => ({ name, amount: (cents / 100).toFixed(2) })),
  })) } });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "groups" });
  const groups = useWatch({ control: form.control, name: "groups" });
  const presetsId = useId();
  return <section className="variant-editor">
    <h3><SlidersHorizontal size={18} aria-hidden="true" /> Variantes y complementos</h3>
    <input type="hidden" name="groupsJson" value={JSON.stringify(groups)} />
    <datalist id={presetsId}>{presets.map(preset => <option key={preset} value={preset} />)}</datalist>
    {fields.length > 0 && <p className="muted">Usa mínimo 0 para complementos opcionales. Los importes se suman en la moneda base.</p>}
    {fields.map((group, index) => <VariantFields key={`${group.id}-${index}`} form={form} index={index} presetsId={presetsId} onRemove={() => remove(index)} />)}
    <button className="button" type="button" disabled={fields.length === 12} onClick={() =>
      append({ name: "", min: 1, max: 1, choices: [newChoice] })}><Plus size={18} aria-hidden="true" /> Agregar variante</button>
  </section>;
}
