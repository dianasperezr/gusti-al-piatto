import Link from "next/link";
import { ArrowRight, History, Users } from "lucide-react";
import { AdminShell } from "@/modules/admin/shell";
import { requireUser } from "@/modules/auth/session";

const sections = [
  { href: "/admin/usuarios", title: "Usuarios y permisos", description: "Gestiona cuentas, roles y acceso al panel.", Icon: Users },
  { href: "/admin/auditoria", title: "Historial y auditoría", description: "Consulta los cambios realizados en el restaurante.", Icon: History },
];

export default async function SettingsPage() {
  const user = await requireUser(true);
  return <AdminShell section="configuracion" title="Configuración" user={user}>
    <div className="integration-grid">
      {sections.map(({ href, title, description, Icon }) => <Link className="panel settings-link" key={href} href={href}>
        <Icon size={20} aria-hidden="true" />
        <div><h2>{title}</h2><p className="muted">{description}</p></div>
        <ArrowRight size={18} aria-hidden="true" />
      </Link>)}
    </div>
  </AdminShell>;
}
