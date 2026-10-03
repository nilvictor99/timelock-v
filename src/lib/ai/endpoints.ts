import { lookup } from "node:dns/promises";

const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "host.docker.internal",
]);

const PROVIDER_HOSTS: Record<string, ReadonlySet<string>> = {
  OPENAI: new Set(["api.openai.com"]),
  OPENROUTER: new Set(["openrouter.ai"]),
  NVIDIA_NIM: new Set(["integrate.api.nvidia.com"]),
  ANTHROPIC: new Set(["api.anthropic.com"]),
  GOOGLE_GEMINI: new Set(["generativelanguage.googleapis.com"]),
  OPENCODE: new Set(["opencode.ai"]),
};

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}

function isPrivateIp(address: string) {
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    return isPrivateIp(normalized.slice("::ffff:".length));
  }
  const ipv4 = normalized.split(".").map((part) => Number(part));
  if (ipv4.length === 4 && ipv4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [first, second] = ipv4;
    return first === 0 ||
      first === 10 ||
      first === 127 ||
      first === 255 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19)) ||
      (first === 198 && second === 51 && ipv4[2] === 100) ||
      (first === 203 && second === 0 && ipv4[2] === 113);
  }

  return normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb");
}

async function assertPublicResolution(hostname: string) {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new Error("El endpoint de IA no puede apuntar a una red privada.");
  }
}

export async function validateAiEndpoint(provider: string, rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("La URL del proveedor no es válida.");
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("El endpoint de IA debe usar HTTP(S) sin credenciales en la URL.");
  }

  const hostname = normalizeHostname(url.hostname);
  if (LOCAL_HOSTNAMES.has(hostname)) {
    if (provider !== "CUSTOM" && provider !== "OLLAMA") {
      throw new Error("Este proveedor solo admite endpoints locales para CUSTOM u OLLAMA.");
    }
    return url;
  }

  const allowedHosts = PROVIDER_HOSTS[provider];
  if (!allowedHosts?.has(hostname) || url.protocol !== "https:") {
    throw new Error("El endpoint de IA debe usar el host autorizado y HTTPS.");
  }

  await assertPublicResolution(hostname);
  return url;
}
