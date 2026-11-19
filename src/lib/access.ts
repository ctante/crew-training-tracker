import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "./db";
import { SESSION_COOKIE, verifySessionToken, type SessionClaims } from "./session";

export type Access =
  | { role: "admin" }
  | { role: "store"; storeId: string; storeNumber: string };

function rethrowNavigation(error: unknown) {
  if (typeof error === "object" && error && "digest" in error) {
    const digest = String((error as { digest: unknown }).digest);
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")) throw error;
  }
}

export async function access(): Promise<Access> {
  let token: string | undefined;
  try {
    const jar = await cookies();
    token = jar.get(SESSION_COOKIE)?.value;
  } catch (error) {
    rethrowNavigation(error);
    return { role: "admin" };
  }
  const session = await verifySessionToken(token);
  if (!session) redirect("/login");
  return resolveSession(session);
}

export async function resolveSession(session: SessionClaims): Promise<Access> {
  if (session.role === "admin") return { role: "admin" };
  const store = await prisma.store.findUnique({ where: { id: session.storeId } });
  if (!store || !store.passwordHash || store.sessionVersion !== session.version) redirect("/login");
  return { role: "store", storeId: store.id, storeNumber: store.number };
}

export async function requireAdmin(scope?: Access) {
  const who = scope ?? (await access());
  if (who.role !== "admin") redirect("/");
  return who;
}

export function scopedStoreNumber(who: Access, requested?: string) {
  if (who.role === "store") {
    if (requested && requested !== who.storeNumber) notFound();
    return who.storeNumber;
  }
  return requested || undefined;
}

export async function ownsStore(storeId: string, scope?: Access) {
  const who = scope ?? (await access());
  if (who.role === "store" && who.storeId !== storeId) notFound();
  return who;
}
