"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Props = { name: string; timezone: string; language: string; operationMode: "SYNCHRONOUS" | "FREE" };

export default function Onboarding({ user }: { user: Props }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [timezone, setTimezone] = useState(user.timezone || "UTC");
  const [language, setLanguage] = useState(user.language || "es");
  const [operationMode, setOperationMode] = useState(user.operationMode || "SYNCHRONOUS");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || user.timezone || "UTC");
  }, [user.timezone]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "onboarding", name, timezone, language, operationMode })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "No se pudo guardar la configuración.");
      setSaving(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader><p className="text-sm font-semibold text-info">Paso inicial</p><CardTitle>Configura tu forma de organizarte</CardTitle><p className="text-sm text-muted-foreground">Puedes cambiar estas preferencias cuando quieras.</p></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6">
            <label className="block text-sm font-medium">¿Cómo quieres que te llamemos?<Input className="mt-2" value={name} onChange={(e) => setName(e.target.value)} required /></label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium">Zona horaria<Input className="mt-2" value={timezone} onChange={(e) => setTimezone(e.target.value)} required /></label>
              <label className="block text-sm font-medium">Idioma<select className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={language} onChange={(e) => setLanguage(e.target.value)}><option value="es">Español</option><option value="en">English</option></select></label>
            </div>
            <fieldset>
              <legend className="mb-3 text-sm font-medium">Modo de operación</legend>
              <div className="grid gap-3 md:grid-cols-2">
                <label className={`cursor-pointer rounded-lg border p-4 ${operationMode === "SYNCHRONOUS" ? "border-foreground bg-muted" : "border-border"}`}><input className="sr-only" type="radio" checked={operationMode === "SYNCHRONOUS"} onChange={() => setOperationMode("SYNCHRONOUS")} /><strong>Sincrónico</strong><p className="mt-1 text-sm text-muted-foreground">Bloques con hora exacta, temporizador regresivo y disciplina de agenda.</p></label>
                <label className={`cursor-pointer rounded-lg border p-4 ${operationMode === "FREE" ? "border-foreground bg-muted" : "border-border"}`}><input className="sr-only" type="radio" checked={operationMode === "FREE"} onChange={() => setOperationMode("FREE")} /><strong>Libre</strong><p className="mt-1 text-sm text-muted-foreground">Empieza cuando quieras y registra el tiempo sin penalización por horario.</p></label>
              </div>
            </fieldset>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button className="w-full" disabled={saving}>{saving ? "Guardando..." : "Ir a mi dashboard"}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
