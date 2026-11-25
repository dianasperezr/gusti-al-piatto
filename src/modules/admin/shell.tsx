import Link from "next/link";
import {
  ArrowUpRight, AudioLines, CalendarClock, ChevronDown, CircleDollarSign, FileImage, Grid2x2,
  Images, LayoutDashboard, LogOut, BookOpen, Palette, Sandwich, Settings, Sheet, ShoppingBag, Sparkles, Utensils,
} from "lucide-react";
import type { ReactNode } from "react";
import { signOut } from "@/modules/auth/actions";
import { NavigationProgress } from "./navigation-progress";

const groups = [
  { name: "", items: [
    ["inicio", "/admin", "Inicio", LayoutDashboard], ["menu", "/menu", "Menú", BookOpen],
  ] },
  { name: "Catálogo", items: [
    ["platillos", "/admin/platillos", "Platillos", Utensils], ["categorias", "/admin/categorias", "Categorías", Grid2x2],
    ["paquetes", "/admin/paquetes", "Paquetes", Sandwich], ["promociones", "/admin/promociones", "Promociones", Sparkles],
    ["horarios", "/admin/horarios", "Horarios", CalendarClock],
  ] },
  { name: "Operación", items: [
    ["multimedia", "/admin/multimedia", "Multimedia", Images], ["diseno", "/admin/diseno", "Diseño del sitio", Palette],
    ["pedidos", "/admin/pedidos", "Pedidos y WhatsApp", ShoppingBag, true],
    ["monedas", "/admin/monedas", "Monedas y precios", CircleDollarSign, true],
    ["plantillas", "/admin/plantillas", "Exportaciones", FileImage],
  ] },
  { name: "Integraciones y ajustes", items: [
    ["sheets", "/admin/sheets", "Google Sheets", Sheet, true], ["canva", "/admin/canva", "Canva", AudioLines, true],
    ["configuracion", "/admin/configuracion", "Configuración", Settings, true],
  ] },
] as const;

const parent: Record<string, string> = { secciones: "diseno", solicitudes: "pedidos", usuarios: "configuracion", auditoria: "configuracion" };

export function AdminShell({ section, title, user, children }: {
  section: string;
  title: string;
  user: { name: string; role: "ADMIN" | "EDITOR" };
  children: ReactNode;
}) {
  const active = parent[section] ?? (section || "inicio");
  const navigation = groups.map(group => {
    const items = group.items.filter(item => user.role === "ADMIN" || !item[4]);
    return items.length > 0 && <div className="nav-group" key={group.name}>
      {group.name && <p>{group.name}</p>}
      {items.map(([slug, href, label, Icon]) => <Link key={slug} href={href} aria-current={active === slug ? "page" : undefined}>
        <Icon size={17} aria-hidden="true" />{label}<NavigationProgress />
      </Link>)}
    </div>;
  });

  return <div className="admin-layout">
    <aside className="admin-sidebar">
      <Link href="/admin" className="restaurant-brand"><span className="brand-icon"><Utensils size={17} aria-hidden="true" /></span>Gusti al Piatto</Link>
      <nav className="desktop-nav" aria-label="Administración">{navigation}</nav>
      <details className="mobile-nav"><summary>Secciones <ChevronDown size={16} aria-hidden="true" /></summary><nav aria-label="Administración móvil">{navigation}</nav></details>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar">
        <div className="admin-account"><span className="admin-avatar" aria-hidden="true">{user.name.charAt(0).toLocaleUpperCase("es")}</span>
          <span><strong>{user.name}</strong><small>{user.role === "ADMIN" ? "Administración" : "Edición"}</small></span>
        </div>
        <div><Link className="button small" href="/admin/preview" target="_blank" rel="noopener noreferrer">Vista previa <ArrowUpRight size={15} aria-hidden="true" /></Link>
          <form action={signOut}><button className="button small" aria-label="Cerrar sesión"><LogOut size={16} aria-hidden="true" /><span>Salir</span></button></form></div>
      </header>
      <div className="admin-content">
        <div className="admin-title"><h1>{title}</h1></div>
        {children}
      </div>
    </main>
  </div>;
}
