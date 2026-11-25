"use client";

import { useId, type RefObject } from "react";
import { TriangleAlert } from "lucide-react";

export function ConfirmDialog({ dialog, title, label, onConfirm }: {
  dialog: RefObject<HTMLDialogElement | null>;
  title: string;
  label: string;
  onConfirm: () => void;
}) {
  const titleId = useId();
  return <dialog ref={dialog} className="confirm-dialog" aria-labelledby={titleId}>
    <div className="confirmation-heading">
      <TriangleAlert size={21} aria-hidden="true" />
      <h2 id={titleId}>{title}</h2>
    </div>
    <div className="form-footer confirmation-actions">
      <button type="button" className="button" autoFocus onClick={() => dialog.current?.close()}>Cancelar</button>
      <button type="button" className="button danger" onClick={() => {
        dialog.current?.close();
        onConfirm();
      }}>{label}</button>
    </div>
  </dialog>;
}
