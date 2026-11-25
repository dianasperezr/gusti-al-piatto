"use client";

import { useState, type FormEvent } from "react";
import { convertCents, formatPrice, type CatalogItem, type Currency } from "./pricing";
import type { MonetarySettings } from "../currencies/settings";
import type { Selections } from "../products/options";

export function ItemOptions({ item, currency, base, rate, money, onAdd, initial = [], submitLabel = "Agregar al carrito" }: {
  item: CatalogItem; currency: Currency; base: Currency; rate: number; money: MonetarySettings; initial?: Selections; submitLabel?: string; onAdd: (selections: Selections) => void;
}) {
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selected = item.groups.map(group => ({
      group: group.name,
      choices: group.choices.filter(choice => form.getAll(group.name).includes(choice.name)).map(choice => choice.name),
    }));
    const invalid = item.groups.find((group, index) => selected[index].choices.length < group.min || selected[index].choices.length > group.max);
    if (invalid) {
      setError("Selecciona entre " + invalid.min + " y " + invalid.max + " opciones en " + invalid.name + ".");
      return;
    }
    setError("");
    onAdd(selected.filter(group => group.choices.length > 0));
  }
  return <form className="action-form item-options" onSubmit={submit}>
    {item.groups.map(group => <fieldset key={group.name}><legend>{group.name} · {group.min === 0 ? "Opcional" : "Obligatorio"}</legend>
      {group.choices.map(choice => <label className="check" key={choice.name}>
        <input type={group.max === 1 ? "radio" : "checkbox"} name={group.name} value={choice.name} defaultChecked={initial.some(pick => pick.group === group.name && pick.choices.includes(choice.name))} required={group.max === 1 && group.min === 1} />
        {choice.name}{choice.cents ? " (+" + formatPrice(convertCents(choice.cents, base, currency, rate, money), currency, money) + ")" : ""}
      </label>)}
      {group.min === 0 && group.max === 1 && <label className="check"><input type="radio" name={group.name} value="" defaultChecked={!initial.some(pick => pick.group === group.name && pick.choices.length)} /> Sin complemento</label>}
      <small>Selección de {group.min} a {group.max}.</small>
    </fieldset>)}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button primary">{submitLabel}</button>
  </form>;
}
