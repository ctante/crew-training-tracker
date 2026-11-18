export const SESSION_COOKIE = "crew_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type SessionPayload = { exp: number };

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) return null;
  return value;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function hmac(value: string, keyText: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(keyText),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export function safeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  const length = Math.max(a.length, b.length, 1);
  let diff = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return diff === 0;
}

export async function createSessionToken() {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET is not set.");
  const payload: SessionPayload = { exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 };
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmac(body, key);
  return `${body}.${signature}`;
}

export async function verifySessionToken(token: string | undefined | null) {
  const key = secret();
  if (!key || !token) return false;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) return false;
  const expected = await hmac(body, key);
  if (!safeEqual(signature, expected)) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))) as SessionPayload;
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) return "/";
  return value;
}
