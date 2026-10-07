import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE = "jarvis_session";
const TTL = 7 * 24 * 60 * 60 * 1000;
const buckets = globalThis.__jarvisBuckets || new Map();
globalThis.__jarvisBuckets = buckets;

function secret() { return process.env.JARVIS_ACCESS_TOKEN?.trim() || ""; }
function digest(value) { return createHash("sha256").update(String(value ?? "")).digest(); }

export function safeEqualStrings(a, b) {
  return timingSafeEqual(digest(a), digest(b));
}

function sign(payload) {
  const key = secret();
  if (!key) throw new Error("JARVIS_ACCESS_TOKEN is not configured.");
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function issueSessionCookie() {
  const payload = Date.now() + "." + randomBytes(18).toString("base64url");
  return payload + "." + sign(payload);
}

export function verifySessionCookie(value) {
  if (typeof value !== "string") return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const issued = Number(parts[0]);
  if (!Number.isFinite(issued) || issued > Date.now() + 60000 || Date.now() - issued > TTL) return false;
  try { return safeEqualStrings(parts[2], sign(parts[0] + "." + parts[1])); } catch { return false; }
}

export function getCookie(request, name = COOKIE) {
  const raw = request.headers.get("cookie") || "";
  for (const entry of raw.split(";")) {
    const [key, ...rest] = entry.trim().split("=");
    if (key === name) {
      try { return decodeURIComponent(rest.join("=")); } catch { return null; }
    }
  }
  return null;
}

export function isAuthenticated(request) { return verifySessionCookie(getCookie(request)); }

export function enforceSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    if (origin !== new URL(request.url).origin) return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
    return null;
  } catch { return Response.json({ error: "Invalid request URL." }, { status: 400 }); }
}

export function requireSession(request) {
  if (!secret()) return Response.json({ error: "Authentication is not configured." }, { status: 503 });
  if (!isAuthenticated(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  return null;
}

export function setSessionCookie(response, value) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.set("Set-Cookie", COOKIE + "=" + encodeURIComponent(value) + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + Math.floor(TTL / 1000) + secure);
  return response;
}

export function clearSessionCookie(response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.set("Set-Cookie", COOKIE + "=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" + secure);
  return response;
}

function clientKey(request) {
  return request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export function rateLimit(request, bucket, limit, windowMs) {
  const now = Date.now();
  const key = bucket + ":" + clientKey(request);
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1 });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  if (current.count <= limit) return { allowed: true, retryAfter: 0 };
  return { allowed: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - current.startedAt)) / 1000)) };
}

export function rateLimitResponse(seconds) {
  const response = Response.json({ error: "Too many requests." }, { status: 429 });
  response.headers.set("Retry-After", String(seconds));
  return response;
}

export async function readJsonBody(request, maxBytes) {
  const length = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(length) && length > maxBytes) throw Object.assign(new Error("Request body too large."), { status: 413 });
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw Object.assign(new Error("Request body too large."), { status: 413 });
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes) || "{}"); }
  catch { throw Object.assign(new Error("Invalid JSON body."), { status: 400 }); }
}
