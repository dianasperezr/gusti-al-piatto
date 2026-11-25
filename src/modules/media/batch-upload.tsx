"use client";

import { Upload, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { saveMedia } from "./actions";
import { isVideoUpload, mediaAccept, UploadFolder } from "./upload-fields";

type Entry = { id: number; file: File; status: "queued" | "uploading" | "done" | "failed"; message?: string };

export function BatchUpload({ maxMegabytes, maxSeconds }: { maxMegabytes: number; maxSeconds: number }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const sequence = useRef(0);
  const queue = entries.filter(entry => entry.status === "queued" || entry.status === "failed");

  function add(files: FileList) {
    const next = [...files].map((file): Entry => {
      const validType = accepts(file);
      const validSize = file.size > 0 && file.size <= maxMegabytes * 1024 * 1024;
      return { id: sequence.current++, file, status: validType && validSize ? "queued" : "failed",
        message: !validType ? "Formato no compatible." : !validSize ? "Tamaño fuera del límite." : undefined };
    });
    setEntries(previous => [...previous, ...next]);
  }

  function accepts(file: File) {
    return mediaAccept.split(",").includes(file.type) || isVideoUpload(file);
  }
  const ready = queue.filter(({ file }) => file.size > 0 && file.size <= maxMegabytes * 1024 * 1024 && accepts(file));

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || ready.length === 0) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    try {
      for (const { id, file } of ready) {
        fields.set("file", file);
        setEntries(previous => previous.map(entry => entry.id === id ? { ...entry, status: "uploading" } : entry));
        const result = await saveMedia(null, {}, fields).catch(() => ({ error: "No se pudo completar la carga. Inténtalo de nuevo." }));
        setEntries(previous => previous.map(entry => entry.id === id ? {
          ...entry, status: result.error ? "failed" : "done", message: result.error,
        } : entry));
      }
    } finally {
      setBusy(false);
    }
  }

  return <form className="action-form" onSubmit={upload} aria-busy={busy}>
    <label className="upload-drop" data-dragging={dragging} onDragOver={event => {
      event.preventDefault();
      if (!busy) setDragging(true);
    }} onDragLeave={() => setDragging(false)} onDrop={event => {
      event.preventDefault();
      setDragging(false);
      if (!busy) add(event.dataTransfer.files);
    }}>
      <Upload size={23} aria-hidden="true" />
      <strong>Arrastra archivos o selecciónalos</strong>
      <span className="muted">Hasta {maxMegabytes} MB por archivo. Videos de hasta {maxSeconds} segundos.</span>
      <input type="file" multiple accept={mediaAccept} disabled={busy} onChange={event => {
        if (event.target.files) add(event.target.files);
        event.target.value = "";
      }} />
    </label>
    <fieldset className="upload-options" disabled={busy}><legend className="sr-only">Opciones de carga</legend><UploadFolder /></fieldset>
    {entries.length > 0 && <ul className="upload-queue" aria-live="polite">{entries.map(entry => <li key={entry.id}>
      <div><strong>{entry.file.name}</strong>
        <span className={entry.status === "failed" ? "form-error" : entry.status === "done" ? "form-success" : "muted"}>
          {entry.status === "queued" ? "En cola" : entry.status === "uploading" ? "Subiendo…" : entry.status === "done" ? "Cargado" : entry.message}
        </span>
      </div>
      <button type="button" disabled={busy} className="button small" aria-label={`Quitar ${entry.file.name} de la lista`}
        onClick={() => setEntries(previous => previous.filter(item => item.id !== entry.id))}><X size={16} /></button>
    </li>)}</ul>}
    <div className="form-footer"><button className="button primary" disabled={busy || ready.length === 0}>
      {busy && <span className="loading-spinner" aria-hidden="true" />}{busy ? "Subiendo archivos…" : `Subir archivos${ready.length ? ` (${ready.length})` : ""}`}
    </button></div>
  </form>;
}
