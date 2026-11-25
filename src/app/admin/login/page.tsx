import Link from "next/link";
import { Utensils } from "lucide-react";
import { redirect } from "next/navigation";
import { currentUser } from "@/modules/auth/session";
import { LoginForm } from "@/modules/auth/login-form";

export default async function LoginPage() {
  if (await currentUser()) redirect("/admin");
  return <main className="login-page"><div className="panel login-card">
    <Link href="/menu" className="restaurant-brand"><span className="brand-icon"><Utensils size={17} /></span>Gusti al piatto</Link>
    <h1>Acceso al panel</h1>
    <LoginForm />
  </div></main>;
}
