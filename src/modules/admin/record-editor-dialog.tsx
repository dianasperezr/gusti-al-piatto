"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, type ReactNode } from "react";

export function RecordEditorDialog({ title, closeHref, children }: { title: string; closeHref: string; children: ReactNode }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  return <dialog ref={dialog} className="record-editor-dialog" aria-labelledby={heading} onClose={event => {
    if (event.target === event.currentTarget) router.replace(closeHref, { scroll: false });
  }}>
    <header className="record-editor-header">
      <h2 id={heading}>{title}</h2>
      <button type="button" className="button" aria-label="Cerrar editor" onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button>
    </header>
    <div className="record-editor-body">{children}</div>
  </dialog>;
}
