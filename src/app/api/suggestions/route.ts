import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildSuggestionsUserPrompt, SUGGESTIONS_SYSTEM_PROMPT } from "@/lib/ai/prompts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({
  action: z.enum(["generate", "regenerate"]).default("generate")
});

const suggestionSchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(60),
  duration: z.coerce.number().int().min(5).max(240),
  reason: z.string().trim().min(1).max(500),
  points: z.coerce.number().int().min(0).max(1000),
  time: z.union([z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), z.null()]).optional()
});

type Suggestion = z.infer<typeof suggestionSchema>;
type Provider = "OPENAI" | "OPENROUTER" | "NVIDIA_NIM" | "CUSTOM" | "ANTHROPIC" | "GOOGLE_GEMINI" | "OLLAMA";

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function checkRateLimit(userId: string) {
  const now = Date.now();
  const current = rateLimit.get(userId);
  if (!current || current.resetAt <= now) {
    rateLimit.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
  }
  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}

function asProvider(value: string | null | undefined): Provider | null {
  return value && ["OPENAI", "OPENROUTER", "NVIDIA_NIM", "CUSTOM", "ANTHROPIC", "GOOGLE_GEMINI", "OLLAMA"].includes(value)
    ? value as Provider
    : null;
}

function providerFromEnv(): Provider | null {
  return asProvider(process.env.AI_PROVIDER);
}

function defaultModel(provider: Provider) {
  const models: Record<Provider, string> = {
    OPENAI: "gpt-4o-mini",
    OPENROUTER: "openai/gpt-4o-mini",
    NVIDIA_NIM: "meta/llama-3.1-8b-instruct",
    CUSTOM: "gpt-4o-mini",
    ANTHROPIC: "claude-3-5-haiku-latest",
    GOOGLE_GEMINI: "gemini-1.5-flash",
    OLLAMA: "llama3.2"
  };
  return models[provider];
}

function apiKeyFor(provider: Provider) {
  const keys: Record<Provider, string | undefined> = {
    OPENAI: process.env.OPENAI_API_KEY,
    OPENROUTER: process.env.OPENROUTER_API_KEY,
    NVIDIA_NIM: process.env.NVIDIA_API_KEY ?? process.env.NVIDIA_NIM_API_KEY,
    CUSTOM: process.env.CUSTOM_AI_API_KEY ?? process.env.AI_API_KEY,
    ANTHROPIC: process.env.ANTHROPIC_API_KEY,
    GOOGLE_GEMINI: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY,
    OLLAMA: process.env.OLLAMA_API_KEY
  };
  return keys[provider];
}

function openAiUrl(provider: Provider, baseUrl?: string | null) {
  const defaults: Record<Exclude<Provider, "ANTHROPIC" | "GOOGLE_GEMINI" | "OLLAMA">, string> = {
    OPENAI: "https://api.openai.com/v1/chat/completions",
    OPENROUTER: "https://openrouter.ai/api/v1/chat/completions",
    NVIDIA_NIM: "https://integrate.api.nvidia.com/v1/chat/completions",
    CUSTOM: process.env.CUSTOM_AI_BASE_URL ?? "http://127.0.0.1:11434/v1/chat/completions"
  };
  const value = baseUrl || defaults[provider as Exclude<Provider, "ANTHROPIC" | "GOOGLE_GEMINI" | "OLLAMA">];
  if (!value) return value;
  return value.endsWith("/chat/completions") ? value : `${value.replace(/\/$/, "")}/chat/completions`;
}

function cleanJson(text: string): unknown {
  const withoutFence = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    const arrayStart = withoutFence.indexOf("[");
    const arrayEnd = withoutFence.lastIndexOf("]");
    if (arrayStart >= 0 && arrayEnd > arrayStart) return JSON.parse(withoutFence.slice(arrayStart, arrayEnd + 1));
    const objectStart = withoutFence.indexOf("{");
    const objectEnd = withoutFence.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) return JSON.parse(withoutFence.slice(objectStart, objectEnd + 1));
    throw new Error("AI response was not JSON");
  }
}

function parseSuggestions(text: string) {
  const parsed = cleanJson(text);
  const raw = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === "object" && "suggestions" in parsed
    ? (parsed as { suggestions?: unknown }).suggestions
    : null);
  if (!Array.isArray(raw)) throw new Error("AI response did not contain suggestions");
  const values = raw.map((item) => {
    if (!item || typeof item !== "object") return null;
    const value = item as Record<string, unknown>;
    return {
      title: value.title ?? value.name,
      category: value.category,
      duration: value.duration ?? value.durationMinutes,
      reason: value.reason,
      points: value.points ?? value.estimatedPoints,
      time: value.time ?? value.suggestedTime ?? null
    };
  }).map((item) => suggestionSchema.safeParse(item)).filter((result): result is { success: true; data: Suggestion } => result.success).map((result) => result.data);
  if (values.length < 3 || values.length > 5) throw new Error("AI returned an invalid number of suggestions");
  return values;
}

function valueArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function fallbackSuggestions(user: Record<string, any>, history: Array<{ title: string }>) {
  const recent = new Set(history.map((item) => item.title.toLowerCase()));
  const preferredTypes = valueArray(user.preferredActivityTypes);
  const interests = [
    ...valueArray(user.hobbies),
    ...valueArray(user.learningInterests),
    ...valueArray(user.sports),
    ...valueArray(user.creativeActivities)
  ];
  const sports = valueArray(user.sports);
  const learningInterests = valueArray(user.learningInterests);
  const creativeActivities = valueArray(user.creativeActivities);
  const duration = user.preferredDuration && /^\d+$/.test(user.preferredDuration)
    ? Number(user.preferredDuration)
    : Math.min(60, Math.max(15, Number(user.dailyAvailableMinutes) || 30));
  const templates = [
    { title: interests[0] ? `Practica ${interests[0]}` : "Bloque de enfoque profundo", category: preferredTypes[0] ?? "Productiva", reason: "Aprovecha tus intereses y un bloque breve de tiempo protegido." },
    { title: sports[0] ? `Sesión de ${sports[0]}` : "Movimiento consciente", category: "Física", reason: "Un poco de movimiento ayuda a sostener tu energía durante el día." },
    { title: learningInterests[0] ? `Aprende sobre ${learningInterests[0]}` : "Lectura sin distracciones", category: "Mental", reason: "Convierte un espacio disponible en progreso personal medible." },
    { title: creativeActivities[0] ? `Crea algo: ${creativeActivities[0]}` : "Pausa creativa", category: "Creativa", reason: "Una actividad creativa ofrece variedad sin exigir demasiados recursos." },
    { title: "Revisión y planificación de mañana", category: "Productiva", reason: "Cerrar el día con claridad facilita mantener tu cadena." }
  ];
  const selected = templates.filter((item) => !recent.has(item.title.toLowerCase())).slice(0, 5);
  const values = (selected.length >= 3 ? selected : templates).slice(0, 5);
  return values.map((item, index) => ({
    ...item,
    duration: Math.max(5, duration - (index % 2) * 15),
    points: Math.max(5, Math.round(duration / 10)),
    time: null
  }));
}

async function callProvider(provider: Provider, model: string, baseUrl: string | null, apiKey: string | undefined, userPrompt: string, temperature: number, maxTokens: number) {
  const headers = { "Content-Type": "application/json" };
  if (provider === "ANTHROPIC") {
    if (!apiKey) throw new Error("Missing Anthropic API key");
    const response = await fetch(baseUrl || "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { ...headers, "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: maxTokens, temperature, system: SUGGESTIONS_SYSTEM_PROMPT, messages: [{ role: "user", content: userPrompt }] })
    });
    if (!response.ok) throw new Error(`Anthropic request failed (${response.status})`);
    const data = await response.json() as { content?: Array<{ text?: string }> };
    return data.content?.map((part) => part.text ?? "").join("") ?? "";
  }
  if (provider === "GOOGLE_GEMINI") {
    if (!apiKey) throw new Error("Missing Gemini API key");
    const endpoint = baseUrl || `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const separator = endpoint.includes("?") ? "&" : "?";
    const response = await fetch(`${endpoint}${separator}key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SUGGESTIONS_SYSTEM_PROMPT }] }, contents: [{ role: "user", parts: [{ text: userPrompt }] }], generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: "application/json" } })
    });
    if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  }
  if (provider === "OLLAMA") {
    const endpoint = baseUrl || "http://127.0.0.1:11434/api/chat";
    const response = await fetch(endpoint.endsWith("/api/chat") ? endpoint : `${endpoint.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: apiKey ? { ...headers, Authorization: `Bearer ${apiKey}` } : headers,
      body: JSON.stringify({ model, stream: false, format: "json", options: { temperature, num_predict: maxTokens }, messages: [{ role: "system", content: SUGGESTIONS_SYSTEM_PROMPT }, { role: "user", content: userPrompt }] })
    });
    if (!response.ok) throw new Error(`Ollama request failed (${response.status})`);
    const data = await response.json() as { message?: { content?: string } };
    return data.message?.content ?? "";
  }
  if (!apiKey) throw new Error(`Missing ${provider} API key`);
  const response = await fetch(openAiUrl(provider, baseUrl), {
    method: "POST",
    headers: apiKey ? { ...headers, Authorization: `Bearer ${apiKey}` } : headers,
    body: JSON.stringify({ model, temperature, max_tokens: maxTokens, response_format: { type: "json_object" }, messages: [{ role: "system", content: SUGGESTIONS_SYSTEM_PROMPT }, { role: "user", content: userPrompt }] })
  });
  if (!response.ok) throw new Error(`OpenAI-compatible request failed (${response.status})`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }> };
  const content = data.choices?.[0]?.message?.content;
  return Array.isArray(content) ? content.map((part) => part.text ?? "").join("") : content ?? "";
}

function safeProfile(user: Record<string, any>) {
  const { passwordHash: _passwordHash, ...profile } = user;
  return profile;
}

async function persistSuggestions(userId: string, values: Suggestion[], source: "ai" | "rule") {
  const generationId = crypto.randomUUID();
  try {
    await prisma.suggestion.createMany({
      data: values.map((value) => ({
        userId,
        generationId,
        title: value.title,
        category: value.category,
        duration: value.duration,
        reason: value.reason,
        points: value.points,
        suggestedTime: value.time ?? null,
        source
      }))
    });
    return prisma.suggestion.findMany({ where: { userId, generationId }, orderBy: { createdAt: "asc" } });
  } catch (error) {
    console.error("Could not persist suggestions:", error);
    return values.map((value, index) => ({ ...value, id: `transient-${generationId}-${index}`, generationId, source }));
  }
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }
  const limit = checkRateLimit(user.id);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Has alcanzado el límite temporal de regeneraciones. Inténtalo más tarde.", retryAfter: limit.retryAfter }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }
  const body = await request.json().catch(() => ({}));
  const parsedRequest = requestSchema.safeParse(body);
  if (!parsedRequest.success) return NextResponse.json({ error: "Solicitud de sugerencias no válida." }, { status: 400 });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const history = await prisma.activity.findMany({
    where: { userId: user.id, startAt: { gte: sevenDaysAgo, lte: now } },
    include: { category: true },
    orderBy: { startAt: "desc" },
    take: 100
  });
  const historyJson = history.map((activity) => ({
    title: activity.title,
    category: activity.category?.name ?? null,
    status: activity.status,
    startAt: activity.startAt.toISOString(),
    endAt: activity.endAt.toISOString(),
    points: activity.points
  }));
  const profile = safeProfile(user);
  const provider = asProvider(user.aiProvider) ?? providerFromEnv();
  const model = user.aiModel || (provider ? defaultModel(provider) : "");
  const baseUrl = user.aiBaseUrl || process.env.AI_BASE_URL || null;
  const english = user.language === "en";
  let values: Suggestion[];
  let source: "ai" | "rule" = "rule";
  let warning: string | undefined;
  if (provider && model) {
    try {
      const response = await callProvider(
        provider,
        model,
        baseUrl,
        apiKeyFor(provider),
        buildSuggestionsUserPrompt({ profile, history: historyJson, currentStreak: user.currentStreak, points: user.points, today: new Date().toISOString().slice(0, 10) }),
        Math.min(2, Math.max(0, user.aiTemperature ?? 0.7)),
        Math.min(8192, Math.max(1, user.aiMaxTokens ?? 500))
      );
      values = parseSuggestions(response);
      source = "ai";
    } catch (error) {
      console.warn("AI suggestions failed; using rule-based fallback:", error);
      warning = english
        ? "The configured provider failed, so local suggestions are shown."
        : "No se pudo usar el proveedor configurado; mostramos sugerencias locales.";
      values = fallbackSuggestions(user, history);
    }
  } else {
    warning = english
      ? "Configure a provider and its key in the server environment to enable AI."
      : "Configura un proveedor y su clave en el entorno seguro del servidor para activar IA.";
    values = fallbackSuggestions(user, history);
  }
  const suggestions = await persistSuggestions(user.id, values, source);
  return NextResponse.json({ suggestions, source, provider: source === "ai" ? provider : null, warning, action: parsedRequest.data.action });
}

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }
  const suggestions = await prisma.suggestion.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 5
  });
  return NextResponse.json({ suggestions, source: suggestions[0]?.source ?? "rule" });
}
