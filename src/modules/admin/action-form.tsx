"use client";

import { startTransition, useActionState, useRef, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { FormStatus } from "./content-actions";

export function ActionForm({ action, children, label = "Guardar cambios", confirm }: {
  action: (state: FormStatus, form: FormData) => Promise<FormStatus>;
  children?: ReactNode;
  label?: string;
  confirm?: string;
}) {
  const [state, submit, pending] = useActionState(action, {});
  const dialog = useRef<HTMLDialogElement>(null);
  const confirmation = useRef<FormData>(null);
  return (
    <><form action={submit} className="action-form" aria-busy={pending} onSubmit={event => {
      event.preventDefault();
      if (pending) return;
      const values = new FormData(event.currentTarget);
      if (confirm && dialog.current) {
        confirmation.current = values;
        dialog.current.showModal();
        return;
      }
      startTransition(() => submit(values));
    }}>
      {children}
      <div className="form-footer">
        <button className={confirm ? "button danger" : "button primary"} disabled={pending}>
          {pending && <span className="loading-spinner" aria-hidden="true" />}{pending ? "Procesando…" : label}
        </button>
        {state.error && <span role="alert" className="form-error">{state.error}</span>}
        {state.success && <span role="status" className="form-success">{state.success}</span>}
      </div>
    </form>
    {confirm && <ConfirmDialog dialog={dialog} title={confirm} label={label} onConfirm={() => {
      const values = confirmation.current;
      confirmation.current = null;
      if (values) startTransition(() => submit(values));
    }} />}</>
  );
}
