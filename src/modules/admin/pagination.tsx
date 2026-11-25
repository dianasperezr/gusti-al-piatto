import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const pageSize = 24;

export function readPage(value?: string) {
  const parsed = Number(value ?? 1);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 1000 ? parsed : 1;
}

export function Pagination({ path, params, page, more }: {
  path: string; params?: Record<string, string | undefined>; page: number; more: boolean;
}) {
  if (page === 1 && !more) return null;
  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) if (key !== "pagina" && value) query.set(key, value);
    if (target > 1) query.set("pagina", String(target));
    return path + (query.size ? "?" + query : "");
  };
  return <nav className="pagination" aria-label="Paginación">
    {page > 1 && <Link className="button small" href={href(page - 1)}><ChevronLeft size={16} aria-hidden="true" />Anterior</Link>}
    <span>Página {page}</span>
    {more && page < 1000 && <Link className="button small" href={href(page + 1)}>Siguiente<ChevronRight size={16} aria-hidden="true" /></Link>}
  </nav>;
}
