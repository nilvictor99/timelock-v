import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

const providerSchema = z.enum([
  "NVIDIA_NIM",
  "OPENROUTER",
  "OPENAI",
  "ANTHROPIC",
  "GOOGLE_GEMINI",
  "OLLAMA",
  "CUSTOM",
]);

const requestSchema = z.object({
  provider: providerSchema,
  model: z.string().trim().max(160).optional(),
  baseUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  apiKey: z.string().min(1).max(1000),
});

function compatibleUrl(provider: z.infer<typeof providerSchema>, baseUrl?: string) {
  const defaults: Record<string, string> = {
    OPENAI: "https://api.openai.com/v1/chat/completions",
    OPENROUTER: "https://openrouter.ai/api/v1/chat/completions",
    NVIDIA_NIM: "https://integrate.api.nvidia.com/v1/chat/completions",
    CUSTOM: process.env.CUSTOM_AI_BASE_URL || "http://127.0.0.1:11434/v1/chat/completions",
  };
  const url = baseUrl || defaults[provider];
  return url?.endsWith("/chat/completions") ? url : `${url?.replace(/\/$/, "")}/chat/completions`;
}

export async function POST(request: Request) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Proveedor, modelo y API key son obligatorios." }, { status: 400 });
  }

  const { provider, model, baseUrl, apiKey } = parsed.data;
  try {
    let response: Response;
    if (provider === "OLLAMA") {
      const endpoint = baseUrl || "http://127.0.0.1:11434/api/tags";
      response = await fetch(endpoint.endsWith("/api/tags") ? endpoint : `${endpoint.replace(/\/$/, "")}/api/tags`, {
        headers: { ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
        signal: AbortSignal.timeout(10_000),
      });
    } else if (provider === "ANTHROPIC") {
      response = await fetch(baseUrl || "https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: model || "claude-3-5-haiku-latest", max_tokens: 1, messages: [{ role: "user", content: "Reply with OK." }] }),
        signal: AbortSignal.timeout(10_000),
      });
    } else if (provider === "GOOGLE_GEMINI") {
      const endpoint = baseUrl || `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || "gemini-1.5-flash")}:generateContent`;
      const separator = endpoint.includes("?") ? "&" : "?";
      response = await fetch(`${endpoint}${separator}key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Reply with OK." }] }], generationConfig: { maxOutputTokens: 1 } }),
        signal: AbortSignal.timeout(10_000),
      });
    } else {
      response = await fetch(compatibleUrl(provider, baseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: model || "gpt-4o-mini", max_tokens: 1, messages: [{ role: "user", content: "Reply with OK." }] }),
        signal: AbortSignal.timeout(10_000),
      });
    }
    if (!response.ok) {
      return NextResponse.json({ error: `El proveedor respondió con HTTP ${response.status}.` }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con el proveedor. Revisa la URL, el modelo y la API key." }, { status: 502 });
  }
}
