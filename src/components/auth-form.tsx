"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import QrScanner from "@/components/qr-scanner";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrMode, setQrMode] = useState(false);
  const [qrToken, setQrToken] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState("");
  useEffect(() => { const token = new URLSearchParams(window.location.search).get("qr"); if (token) { setQrToken(token); setQrMode(true); } }, []);

  async function authenticate(tokenOverride?: string) {
    setError("");
    setLoading(true);
    const token = qrMode ? normalizeQrValue(tokenOverride ?? qrToken) : undefined;
    if (qrMode && !token) {
      setLoading(false);
      setError(t("qrScanError"));
      return;
    }
    const response = await fetch(qrMode ? "/api/auth/qr-login" : `/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(qrMode ? { token } : { name, email, password, acceptTerms, remember })
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "No se pudo completar la operación.");
      return;
    }
    window.location.href = isRegister || data.onboardingRequired ? "/onboarding" : "/dashboard";
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    await authenticate();
  }
  function handleScan(value: string) {
    const token = normalizeQrValue(value);
    if (token) {
      setQrToken(token);
      setShowScanner(false);
      setScannerError("");
      void authenticate(token);
    } else {
      setScannerError(t("qrScanError"));
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Link href="/" className="mb-5 text-sm font-semibold">TimeLock<span className="text-info">-v</span></Link>
          <CardTitle>{qrMode ? t("qrLoginAction") : isRegister ? "Crea tu cuenta" : "Inicia sesión"}</CardTitle>
          <p className="text-sm text-muted-foreground">{isRegister ? "Tus datos quedan aislados y protegidos." : "Continúa organizando tu tiempo."}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {qrMode ? <><label className="block text-sm font-medium">{t("qrToken")}<Input className="mt-2" value={qrToken} onChange={(e) => setQrToken(e.target.value)} required /></label><button type="button" className="w-full rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" onClick={() => { setScannerError(""); setShowScanner(true); }}>{t("qrScannerTitle")}</button></> : <><>{isRegister && <label className="block text-sm font-medium">Nombre<Input className="mt-2" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></label>}</><label className="block text-sm font-medium">Correo electrónico<Input className="mt-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label><label className="block text-sm font-medium">Contraseña<Input className="mt-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} autoComplete={isRegister ? "new-password" : "current-password"} /><span className="mt-1 block text-xs text-muted-foreground">Mínimo 12 caracteres.</span></label></>}
            {isRegister && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} required /><span>Acepto los términos y confirmo que soy mayor de 18 años.</span></label>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Recordar este dispositivo</label>
            {error && <p className="rounded-md border border-danger p-3 text-sm text-danger">{error}</p>}
            <Button className="w-full" disabled={loading}>{loading ? "Procesando..." : qrMode ? t("qrLoginAction") : isRegister ? "Crear cuenta" : "Entrar"}</Button>
          </form>
          {!qrMode && <p className="mt-5 text-center text-sm text-muted-foreground">{isRegister ? "¿Ya tienes cuenta? " : "¿Todavía no tienes cuenta? "}<Link className="font-medium text-foreground underline" href={isRegister ? "/login" : "/register"}>{isRegister ? "Inicia sesión" : "Regístrate"}</Link></p>}
          {mode === "login" && !qrMode && <button type="button" className="mt-4 w-full text-sm underline" onClick={() => setQrMode(true)}>{t("qrLoginAction")}</button>}
        </CardContent>
      </Card>
      {showScanner && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><Card className="w-full max-w-md"><CardHeader><CardTitle>{t("qrScannerTitle")}</CardTitle><p className="text-sm text-muted-foreground">{t("scanInstructions")}</p></CardHeader><CardContent className="space-y-4"><QrScanner onDetected={handleScan} onError={(kind) => setScannerError(kind === "camera" ? t("cameraPermission") : t("qrScanError"))} />{scannerError && <p className="rounded-md border border-danger p-3 text-sm text-danger">{scannerError}</p>}<Button variant="outline" className="w-full" onClick={() => setShowScanner(false)}>{t("cancel")}</Button></CardContent></Card></div>}
    </main>
  );
}

function normalizeQrValue(value: string) {
  const trimmed = value.trim();
  if (/^[A-Za-z0-9_-]{43}$/.test(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed, window.location.origin);
    const token = parsed.searchParams.get("qr")?.trim() ?? "";
    return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
  } catch {
    return null;
  }
}
