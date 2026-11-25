import Link from "next/link";
import { CalendarClock, Images, Layers, Utensils } from "lucide-react";
import { db } from "@/lib/db";
import { AdminShell } from "@/modules/admin/shell";
import { requireUser } from "@/modules/auth/session";

export default async function AdminPage() {
  const user = await requireUser();
  const [products, categories, media, hours] = await db().$transaction([
    db().content.count({ where: { kind: "PRODUCT", published: true } }),
    db().content.count({ where: { kind: "CATEGORY", published: true } }),
    db().media.count(),
    db().content.count({ where: { kind: "HOURS", published: true } }),
  ]);
  const stats = [
    [products, "Platillos publicados", "platillos", Utensils],
    [categories, "Categorías publicadas", "categorias", Layers],
    [media, "Archivos multimedia", "multimedia", Images],
    [hours, "Turnos publicados", "horarios", CalendarClock],
  ] as const;
  return <AdminShell section="" title="Inicio" user={user}>
    <div className="dashboard-stats">{stats.map(([count, label, path, Icon]) => <Link href={`/admin/${path}`} className="panel stat" key={path}>
      <Icon size={22} /><strong>{count}</strong><span>{label}</span>
    </Link>)}</div>
    <section className="panel dashboard-start">
      <h2>Gestiona tu carta</h2>
      <p>Organiza tus platillos y define lo que tus clientes podrán ver en el menú.</p>
      <div className="export-links"><Link className="button primary" href="/admin/platillos">Gestionar platillos</Link><Link className="button" href="/admin/diseno">Editar diseño</Link></div>
    </section>
  </AdminShell>;
}
