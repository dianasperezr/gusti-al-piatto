"use client";

import { useState } from "react";

export type MediaOption = { id: string; name: string; mime: string };

export function MediaPicker({ label, name, initial = [], selected = [], multiple = false, images = false, ordered = false, onChange }: {
  label: string;
  name?: string;
  initial?: MediaOption[];
  selected?: string[];
  multiple?: boolean;
  images?: boolean;
  ordered?: boolean;
  onChange?: (ids: string[], assets: MediaOption[]) => void;
}) {
  const [known, setKnown] = useState(initial);
  const [value, setValue] = useState(selected);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [results, setResults] = useState<MediaOption[]>([]);
  const [offset, setOffset] = useState(0);
  const [next, setNext] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  function change(ids: string[]) {
    const assets = ids.flatMap(id => [...results, ...known].find(asset => asset.id === id) ?? []);
    setKnown(assets);
    setValue(ids);
    onChange?.(ids, assets);
  }

  async function load(q: string, skip: number) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const params = new URLSearchParams({ q, images: images ? "1" : "0", offset: String(skip) });
      const response = await fetch("/api/admin/media?" + params);
      if (!response.ok) throw new Error();
      const data = await response.json() as { assets: MediaOption[]; next: number | null };
      setResults(data.assets);
      setNext(data.next);
      setOffset(skip);
      setSearched(q);
      setLoaded(true);
    } catch {
      setError("No se pudieron buscar los archivos.");
    } finally {
      setPending(false);
    }
  }

  const choices = [...known, ...results.filter(asset => !known.some(existing => existing.id === asset.id))];
  return <fieldset className="media-picker">
    <legend>{label}</legend>
    {name && <input type="hidden" name={name} value={multiple ? value.join(",") : value[0] ?? ""} />}
    {multiple ? <ul className="media-selection">{value.map((id, index) => <li key={id}>
      <span>{known.find(asset => asset.id === id)?.name ?? id}</span>
      {ordered && [-1, 1].map(offset => <button key={offset} type="button" className="button small" disabled={!value[index + offset]}
        aria-label={offset < 0 ? "Mover antes" : "Mover después"} onClick={() => {
          const next = [...value];
          [next[index], next[index + offset]] = [next[index + offset], next[index]];
          change(next);
        }}>{offset < 0 ? "↑" : "↓"}</button>)}
      <button type="button" className="button small" onClick={() => change(value.filter(existing => existing !== id))}>Quitar</button>
    </li>)}</ul> : <label><span className="sr-only">{label}</span>
      <select value={value[0] ?? ""} onChange={event => change(event.target.value ? [event.target.value] : [])}>
        <option value="">Sin archivo</option>
        {value[0] && !choices.some(asset => asset.id === value[0]) && <option value={value[0]}>{value[0]}</option>}
        {choices.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
      </select>
    </label>}
    <details>
      <summary>Buscar archivos</summary>
      <div className="media-search">
        <label><span className="sr-only">Nombre del archivo</span><input type="search" value={query} maxLength={150}
          placeholder="Nombre del archivo" onChange={event => setQuery(event.target.value)} onKeyDown={event => {
            if (event.key === "Enter") { event.preventDefault(); void load(query, 0); }
          }} /></label>
        <button type="button" className="button small" disabled={pending} onClick={() => void load(query, 0)}>{pending ? "Buscando…" : "Buscar"}</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loaded && results.length === 0 && <p className="muted" role="status">No se encontraron archivos.</p>}
      {multiple && results.length > 0 && <label>Agregar archivo<select value="" onChange={event => change([...value, event.target.value])}>
        <option value="" disabled>Selecciona un archivo</option>
        {results.filter(asset => !value.includes(asset.id)).map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
      </select></label>}
      {(offset > 0 || next !== null) && <div className="form-footer">
        <button type="button" className="button small" disabled={pending || offset === 0} onClick={() => void load(searched, offset - 24)}>Anterior</button>
        <button type="button" className="button small" disabled={pending || next === null} onClick={() => { if (next !== null) void load(searched, next); }}>Más archivos</button>
      </div>}
    </details>
  </fieldset>;
}
