import Link from "next/link";
import { ArrowRight, Check, Clock3, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const user = await getCurrentUser();
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="text-xl font-bold tracking-tight">TimeLock<span className="text-info">-v</span></div>
        <div className="flex items-center gap-2">{user ? <Link href="/dashboard"><Button variant="outline">Ir al dashboard</Button></Link> : <><Link href="/login"><Button variant="ghost">Iniciar sesión</Button></Link><Link href="/register"><Button>Crear cuenta</Button></Link></>}</div>
      </header>
      <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
        <div><p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm text-muted-foreground"><Sparkles size={15} /> Productividad adulta, sin ruido</p><h1 className="max-w-3xl text-5xl font-bold tracking-tight md:text-6xl">Domina tu tiempo. Elimina el desperdicio.</h1><p className="mt-6 max-w-2xl text-lg text-muted-foreground">Planifica actividades, mide tu enfoque y construye una rutina que se adapte a tu vida, con tus datos protegidos.</p><div className="mt-8 flex flex-wrap gap-3"><Link href={user ? "/dashboard" : "/register"}><Button size="lg">Empieza gratis <ArrowRight size={17} /></Button></Link><Link href="/login"><Button variant="outline" size="lg">Ya tengo una cuenta</Button></Link></div></div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><span className="text-sm font-medium">Tu día, bajo control</span><span className="rounded-full bg-muted px-3 py-1 text-xs">Privado</span></div><div className="space-y-3"><div className="rounded-lg bg-muted p-4"><div className="flex items-center justify-between text-sm"><span className="font-medium">Trabajo profundo</span><span className="text-muted-foreground">09:00 – 11:00</span></div><div className="mt-3 h-2 rounded-full bg-info/20"><div className="h-2 w-3/4 rounded-full bg-info" /></div></div>{["Entrenamiento", "Lectura y revisión"].map((item) => <div key={item} className="flex items-center gap-3 rounded-lg border border-border p-4 text-sm"><Check size={16} className="text-success" />{item}<span className="ml-auto text-muted-foreground">Listo</span></div>)}</div></div>
      </section>
      <section className="border-y border-border bg-muted/30 px-6 py-16"><div className="mx-auto max-w-6xl"><h2 className="text-3xl font-bold">Una estructura que trabaja contigo</h2><div className="mt-8 grid gap-4 md:grid-cols-3">{[{ icon: Clock3, title: "Sincrónico o libre", text: "Elige horarios estrictos o registra tu tiempo con flexibilidad." }, { icon: ShieldCheck, title: "Tus datos son tuyos", text: "Autenticación local y sesiones protegidas con cookies HttpOnly." }, { icon: Sparkles, title: "Progreso visible", text: "Puntos, cadenas y recompensas para convertir constancia en resultados." }].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-xl border border-border bg-card p-5"><Icon className="mb-4 text-info" /><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{text}</p></div>)}</div></div></section>
      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-6 py-8 text-sm text-muted-foreground"><span>TimeLock-v · Diseñada para mayores de 18 años.</span><span>Términos y privacidad próximamente.</span></footer>
    </main>
  );
}
