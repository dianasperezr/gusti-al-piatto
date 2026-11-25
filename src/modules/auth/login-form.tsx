"use client";

import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "./actions";

const schema = z.object({
  email: z.email("Escribe un correo válido.").max(254),
  password: z.string().min(1, "Escribe tu contraseña.").max(256),
});

export function LoginForm() {
  const [error, submit, pending] = useActionState(signIn, "");
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  return <form action={submit} className="action-form" onSubmit={handleSubmit(values => {
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    startTransition(() => submit(form));
  })}>
    <label>Correo electrónico<input type="email" autoComplete="username" required {...register("email")} /></label>
    {errors.email?.message && <span className="form-error" role="alert">{errors.email.message}</span>}
    <label>Contraseña<input type="password" autoComplete="current-password" required {...register("password")} /></label>
    {errors.password?.message && <span className="form-error" role="alert">{errors.password.message}</span>}
    {error && <span className="form-error" role="alert">{error}</span>}
    <button className="button primary" disabled={pending}>{pending ? "Ingresando…" : "Iniciar sesión"}</button>
  </form>;
}
