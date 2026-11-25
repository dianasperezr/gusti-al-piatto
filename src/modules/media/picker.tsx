"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Check, Image as ImageIcon, Search, Upload, Video, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { saveMedia } from "./actions";
import { isVideoUpload, mediaAccept, videoAccept } from "./upload-fields";
import "./picker.css";

export type MediaOption = { id: string; name: string; mime: string; hasThumbnail?: boolean };

function Thumbnail({ asset }: { asset?: MediaOption }) {
  const video = asset?.mime.startsWith("video/");
  const Icon = video ? Video : ImageIcon;
  return <span className="picker-thumbnail" aria-hidden="true">
    {asset && (!video || asset.hasThumbnail) ? <Image src={`/media/${asset.id}?thumbnail=1`} alt="" fill
      sizes="(max-width: 600px) 45vw, 180px" unoptimized /> : <Icon size={26} />}
    {video && asset?.hasThumbnail && <Video size={16} className="picker-video" />}
  </span>;
}

export function MediaPicker({
  label, name, initial = [], selected = [], multiple = false, images = false, videos = false, ordered = false, maxSelections = 100, onChange,
}: {
  label: string;
  name?: string;
  initial?: MediaOption[];
  selected?: string[];
  multiple?: boolean;
  images?: boolean;
  videos?: boolean;
  ordered?: boolean;
  maxSelections?: number;
  onChange?: (ids: string[], assets: MediaOption[]) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [known, setKnown] = useState(initial);
  const [value, setValue] = useState(selected);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [results, setResults] = useState<MediaOption[]>([]);
  const [offset, setOffset] = useState(0);
  const [next, setNext] = useState<number | null>(null);
  const [pending, setPending] = useState<"loading" | "uploading" | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  function change(ids: string[], uploaded?: MediaOption) {
    const available = [...(uploaded ? [uploaded] : []), ...results, ...known];
    const assets = ids.flatMap(id => available.find(asset => asset.id === id) ?? []);
    setKnown(assets);
    setValue(ids);
    onChange?.(ids, assets);
  }

  function select(asset: MediaOption, uploaded = false) {
    if (multiple) {
      if (value.includes(asset.id)) change(value.filter(id => id !== asset.id));
      else if (value.length < maxSelections) change([...value, asset.id], uploaded ? asset : undefined);
    } else {
      change([asset.id], uploaded ? asset : undefined);
      dialog.current?.close();
    }
  }

  async function load(q: string, skip: number) {
    if (pending) return;
    setPending("loading");
    setError("");
    try {
      const params = new URLSearchParams({ q, images: images ? "1" : "0", videos: videos ? "1" : "0", offset: String(skip) });
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
      setPending(null);
    }
  }

  async function upload(file: File) {
    if (pending || multiple && value.length >= maxSelections) return;
    if (images && !file.type.startsWith("image/") || videos && !isVideoUpload(file)) {
      setError(images ? "Selecciona una imagen." : "Selecciona un video.");
      return;
    }
    setError("");
    setPending("uploading");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await saveMedia(null, {}, form);
      if (!response.asset) throw new Error(response.error || "No se pudo subir el archivo.");
      const asset = response.asset;
      select(asset, true);
      setResults(previous => [asset, ...previous.filter(item => item.id !== asset.id)]);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo subir el archivo.");
    } finally {
      setPending(null);
    }
  }

  return <fieldset className="media-picker picker">
    <legend>{label}</legend>
    {name && <input type="hidden" name={name} value={multiple ? value.join(",") : value[0] ?? ""} />}
    {value.length > 0 && <ul className="picker-selection">{value.map((id, index) => {
      const asset = known.find(item => item.id === id);
      return <li key={id}>
        <Thumbnail asset={asset} />
        <span>{asset?.name ?? "Archivo seleccionado"}</span>
        {ordered && [-1, 1].map(direction => {
          const Icon = direction < 0 ? ArrowLeft : ArrowRight;
          return <button key={direction} type="button" className="button small" disabled={!value[index + direction]}
            aria-label={direction < 0 ? "Mover antes" : "Mover después"} onClick={() => {
              const reordered = [...value];
              [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
              change(reordered);
            }}><Icon size={15} aria-hidden="true" /></button>;
        })}
        <button type="button" className="button small" aria-label={`Quitar ${asset?.name ?? "archivo"}`}
          onClick={() => change(value.filter(existing => existing !== id))}><X size={15} aria-hidden="true" /></button>
      </li>;
    })}</ul>}
    <button className="button" type="button" onClick={() => {
      dialog.current?.showModal();
      setQuery("");
      void load("", 0);
    }}><ImageIcon size={17} aria-hidden="true" /> {value.length && !multiple ? "Cambiar archivo" : multiple ? "Seleccionar archivos" : "Seleccionar archivo"}</button>

    <dialog ref={dialog} className="picker-dialog" aria-labelledby={titleId} onCancel={event => {
      if (pending === "uploading") event.preventDefault();
    }}>
      <div className="picker-panel">
        <header className="picker-header">
          <h2 id={titleId}>{label}</h2>
          <button className="button" type="button" disabled={pending === "uploading"} aria-label="Cerrar biblioteca" onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="picker-controls">
          <label className="picker-search">
            <span className="sr-only">Nombre del archivo</span>
            <input type="search" value={query} maxLength={150} placeholder="Nombre del archivo" onChange={event => setQuery(event.target.value)} onKeyDown={event => {
              if (event.key === "Enter") {
                event.preventDefault();
                void load(query, 0);
              }
            }} />
          </label>
          <button type="button" className="button" disabled={!!pending} onClick={() => void load(query, 0)}>
            <Search size={17} aria-hidden="true" /> Buscar
          </button>
          <label className="button primary picker-upload" aria-disabled={!!pending || multiple && value.length >= maxSelections}>
            <Upload size={17} aria-hidden="true" /> {videos ? "Subir video" : images ? "Subir imagen" : "Subir archivo"}
            <input type="file" className="sr-only" accept={images ? "image/jpeg,image/png,image/webp,image/avif" : videos ? videoAccept : mediaAccept}
              disabled={!!pending || multiple && value.length >= maxSelections} onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(file);
              }} />
          </label>
        </div>
        <div className="picker-results" aria-busy={!!pending}>
          {pending && <p role="status">{pending === "uploading" ? "Subiendo y preparando el archivo…" : "Cargando biblioteca…"}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {!pending && loaded && results.length === 0 && <p className="muted">No se encontraron archivos.</p>}
          <div className="picker-grid">{results.map(asset => {
            const checked = value.includes(asset.id);
            return <button key={asset.id} type="button" className="picker-file" aria-pressed={checked}
              disabled={!!pending || multiple && value.length >= maxSelections && !checked} onClick={() => select(asset)}>
              <Thumbnail asset={asset} />
              <span className="picker-filename">{asset.name}</span>
              {checked && <Check className="picker-check" size={16} aria-hidden="true" />}
            </button>;
          })}</div>
        </div>
        <footer className="picker-footer">
          <div className="picker-pagination">
            {(offset > 0 || next !== null) && <>
              <button type="button" className="button small" disabled={!!pending || offset === 0} onClick={() => void load(searched, offset - 24)}>Anterior</button>
              <button type="button" className="button small" disabled={!!pending || next === null} onClick={() => { if (next !== null) void load(searched, next); }}>Más archivos</button>
            </>}
          </div>
          {multiple && <button type="button" className="button primary" disabled={pending === "uploading"} onClick={() => dialog.current?.close()}>
            Listo · {value.length} {value.length === 1 ? "archivo" : "archivos"}
          </button>}
        </footer>
      </div>
    </dialog>
  </fieldset>;
}
