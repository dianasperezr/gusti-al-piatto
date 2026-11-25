"use client";

import { useLinkStatus } from "next/link";

export function NavigationProgress() {
  const { pending } = useLinkStatus();
  return pending ? <span className="loading-spinner nav-progress" role="status" aria-label="Cargando sección" /> : null;
}
