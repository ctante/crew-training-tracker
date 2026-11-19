import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "./db";
import {
  effectivePermissions,
  isAdminGrant,
  isPermission,
  isUserRole,
  permissionLabel,
  roleDefaults,
  selectedKeys,
  type Permission,
  type PermissionMap,
  type RoleDefaultMap,
  type UserRole,
} from "./permissions";
import { SESSION_COOKIE, verifySessionToken, type SessionClaims } from "./session";

export type { Permission, PermissionMap, UserRole };
export { isUserRole };

export type Access =
  | { role: "admin"; userId?: string; name?: string; permissions?: PermissionMap }
  | {
      role: "supervisor";
      userId: string;
      name: string;
      storeIds: string[];
      storeNumbers: string[];
      permissions?: PermissionMap;
    }
  | {
      role: "manager" | "user";
      userId: string;
      name: string;
      storeId: string;
      storeNumber: string;
      storeIds?: string[];
      storeNumbers?: string[];
      permissions?: PermissionMap;
    }
  | { role: "store"; storeId: string; storeNumber: string; permissions?: PermissionMap };

const ADMIN_KEYS: Permission[] = ["users", "modules", "roster_import", "store_logins"];

function rethrowNavigation(error: unknown) {
  if (typeof error === "object" && error && "digest" in error) {
    const digest = String((error as { digest: unknown }).digest);
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")) throw error;
  }
}

function roleKey(who: Access): UserRole {
  if (who.role === "admin") return "ADMIN";
  if (who.role === "supervisor") return "SUPERVISOR";
  if (who.role === "manager") return "MANAGER";
  return "USER";
}

export function allows(who: Access, key: Permission) {
  if (who.permissions && key in who.permissions) return who.permissions[key];
  return roleDefaults(roleKey(who))[key];
}

export function canSeeManyStores(who: Access) {
  if (!allows(who, "view_stores")) return false;
  if (who.role === "admin") return true;
  if (who.role === "supervisor") return who.storeNumbers.length > 1;
  if (who.role === "store") return false;
  return (who.storeIds?.length ?? 0) > 1;
}

export function canOpenAdmin(who: Access) {
  return ADMIN_KEYS.some((key) => allows(who, key));
}

export function seesStoreId(who: Access, storeId: string) {
  if (who.role === "admin") return true;
  if (who.role === "supervisor") return who.storeIds.includes(storeId);
  if (who.role === "manager" || who.role === "user") {
    return allows(who, "view_stores") ? (who.storeIds ?? [who.storeId]).includes(storeId) : who.storeId === storeId;
  }
  return who.storeId === storeId;
}

export function assignedStoreNumbers(who: Access): string[] | null {
  if (who.role === "admin") return null;
  if (who.role === "supervisor") return [...who.storeNumbers];
  if ((who.role === "manager" || who.role === "user") && who.storeNumbers?.length) return [...who.storeNumbers];
  return [who.storeNumber];
}

export function visibleStoreNumbers(who: Access): string[] | null {
  const assigned = assignedStoreNumbers(who);
  if (who.role === "admin") return null;
  if (!assigned) return null;
  if (!allows(who, "view_stores")) return assigned.slice(0, 1);
  return assigned;
}

export function storeIdWhere(who: Access): { id: string } | { id: { in: string[] } } | undefined {
  if (who.role === "admin") return undefined;
  if (who.role === "supervisor") {
    const ids = allows(who, "view_stores") ? who.storeIds : who.storeIds.slice(0, 1);
    return { id: { in: ids } };
  }
  if ((who.role === "manager" || who.role === "user") && allows(who, "view_stores") && (who.storeIds?.length ?? 0) > 1) {
    return { id: { in: who.storeIds ?? [who.storeId] } };
  }
  return { id: who.storeId };
}

export function storeNumberWhere(
  who: Access,
  requested?: string,
): { number: string } | { number: { in: string[] } } | undefined {
  const visible = visibleStoreNumbers(who);
  if (!visible) {
    if (requested) return { number: requested };
    return undefined;
  }
  if (!canSeeManyStores(who)) {
    const only = visible[0];
    if (!only || (requested && requested !== only)) notFound();
    return only ? { number: only } : { number: { in: [] } };
  }
  if (requested) {
    if (!visible.includes(requested)) notFound();
    return { number: requested };
  }
  return { number: { in: visible } };
}

export function signedInLabel(who: Access) {
  if (who.role === "store") return `${who.storeNumber} · User`;
  if (who.role === "admin") return who.name ? `${who.name} · Admin` : "All restaurants";
  if (who.role === "supervisor") return `${who.name} · Supervisor · ${who.storeNumbers.join(", ")}`;
  const title = who.role === "manager" ? "Manager" : "User";
  return `${who.name} · ${title} · ${who.storeNumbers?.join(", ") || who.storeNumber}`;
}

export function assertPermission(who: Access, key: Permission) {
  if (!allows(who, key)) {
    throw new Error(`You do not have permission to ${permissionLabel(key).toLowerCase()}.`);
  }
  return who;
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

export async function loadRoleDefaults(): Promise<RoleDefaultMap> {
  const rows = await prisma.roleDefault.findMany();
  const map: RoleDefaultMap = {
    USER: selectedKeys(roleDefaults("USER")),
    MANAGER: selectedKeys(roleDefaults("MANAGER")),
    SUPERVISOR: selectedKeys(roleDefaults("SUPERVISOR")),
    ADMIN: selectedKeys(roleDefaults("ADMIN")),
  };
  for (const row of rows) {
    if (!isUserRole(row.role) || row.role === "ADMIN" || !Array.isArray(row.permissions)) continue;
    const role: Exclude<UserRole, "ADMIN"> = row.role;
    map[role] = row.permissions.filter((item: unknown): item is Permission => typeof item === "string" && isPermission(item));
  }
  return map;
}

export async function resolveSession(session: SessionClaims): Promise<Access> {
  if (session.role === "admin") return { role: "admin", permissions: roleDefaults("ADMIN") };
  if (session.role === "user") return resolveUserSession(session.userId, session.version);
  const store = await prisma.store.findUnique({ where: { id: session.storeId } });
  if (!store || !store.passwordHash || store.sessionVersion !== session.version) redirect("/login");
  const shared = await prisma.appUser.findUnique({ where: { login: store.number } });
  if (shared?.active && shared.role === "USER") {
    const defaults = await loadRoleDefaults();
    return {
      role: "user",
      userId: shared.id,
      name: shared.name,
      storeId: store.id,
      storeNumber: store.number,
      permissions: effectivePermissions("USER", shared.permissionOverrides, defaults),
    };
  }
  return { role: "store", storeId: store.id, storeNumber: store.number, permissions: roleDefaults("USER") };
}

async function resolveUserSession(userId: string, version: number): Promise<Access> {
  const user = await prisma.appUser.findUnique({
    where: { id: userId },
    include: { stores: { include: { store: true } } },
  });
  if (!user || !user.active || user.sessionVersion !== version || !isUserRole(user.role)) redirect("/login");
  const defaults = await loadRoleDefaults();
  const permissions = effectivePermissions(user.role, user.permissionOverrides, defaults);
  const stores = [...user.stores].sort((left, right) => left.store.number.localeCompare(right.store.number));
  if (user.role === "ADMIN") return { role: "admin", userId: user.id, name: user.name, permissions };
  if (user.role === "SUPERVISOR") {
    if (stores.length === 0) redirect("/login");
    return {
      role: "supervisor",
      userId: user.id,
      name: user.name,
      storeIds: stores.map((row) => row.storeId),
      storeNumbers: stores.map((row) => row.store.number),
      permissions,
    };
  }
  if (stores.length === 0) redirect("/login");
  if (!permissions.view_stores && stores.length !== 1) redirect("/login");
  const primary = stores[0].store;
  return {
    role: user.role === "MANAGER" ? "manager" : "user",
    userId: user.id,
    name: user.name,
    storeId: primary.id,
    storeNumber: primary.number,
    storeIds: stores.map((row) => row.storeId),
    storeNumbers: stores.map((row) => row.store.number),
    permissions,
  };
}

export async function requireAdmin(scope?: Access) {
  const who = scope ?? (await access());
  if (who.role !== "admin") redirect("/");
  return who;
}

export async function requirePermission(key: Permission, scope?: Access) {
  const who = scope ?? (await access());
  if (!allows(who, key)) redirect("/");
  return who;
}

export async function requireTraineeEditor(scope?: Access) {
  const who = scope ?? (await access());
  assertPermission(who, "trainees_edit");
  return who;
}

export function scopedStoreNumber(who: Access, requested?: string) {
  const where = storeNumberWhere(who, requested);
  if (!where) return requested || undefined;
  if (typeof where.number === "string") return where.number;
  return undefined;
}

export async function ownsStore(storeId: string, scope?: Access) {
  const who = scope ?? (await access());
  if (!seesStoreId(who, storeId)) notFound();
  return who;
}

export function preserveAdminGrants(actor: Access, previous: PermissionMap, next: PermissionMap) {
  if (actor.role === "admin") return next;
  const kept = { ...next };
  for (const key of Object.keys(kept) as Permission[]) {
    if (isAdminGrant(key)) kept[key] = previous[key];
  }
  return kept;
}
