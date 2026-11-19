import { prisma } from "./db";
import { hashPassword, verifyPassword } from "./passwords";
import { safeEqual } from "./session";
import { allows, preserveAdminGrants, seesStoreId, type Access } from "./access";
import {
  effectivePermissions,
  isUserRole,
  overridesFor,
  type Permission,
  type PermissionMap,
  type RoleDefaultMap,
  type UserRole,
} from "./permissions";

export type UserRecord = {
  id: string;
  name: string;
  login: string;
  role: UserRole;
  active: boolean;
  lastSignedInAt: string | null;
  storeIds: string[];
  storeNumbers: string[];
  sharedStore: boolean;
  permissions: PermissionMap;
  overrides: Partial<PermissionMap>;
};

export type UserDraft = {
  id?: string;
  name: string;
  login: string;
  password: string;
  confirm: string;
  role: string;
  storeIds: string[];
  active: boolean;
  permissions: PermissionMap;
};

const LOGIN_PATTERN = /^[a-z0-9._@+-]+$/;

export function normalizeLogin(value: string) {
  return value.trim().toLowerCase();
}

function actorStoreIds(actor: Access): string[] | null {
  if (actor.role === "admin") return null;
  if (actor.role === "supervisor") return actor.storeIds;
  return [actor.storeId];
}

export function userVisibleTo(actor: Access, user: { role: UserRole; storeIds: string[] }) {
  if (actor.role !== "admin" && !allows(actor, "users")) return false;
  if (actor.role === "admin") return true;
  if (user.role !== "USER" && user.role !== "MANAGER") return false;
  const mine = actorStoreIds(actor) ?? [];
  return user.storeIds.length > 0 && user.storeIds.every((id) => mine.includes(id));
}

export function normalizeAssignment(role: UserRole, storeIds: string[], permissions: PermissionMap) {
  const unique = [...new Set(storeIds)];
  if (role === "ADMIN") return { allStores: true, storeIds: [] as string[] };
  if (permissions.view_stores) {
    if (unique.length === 0) throw new Error("Choose at least one restaurant.");
    return { allStores: false, storeIds: unique };
  }
  if (unique.length !== 1) throw new Error("Choose one restaurant, or grant View other stores.");
  return { allStores: false, storeIds: unique };
}

function assertActorCanSave(actor: Access, role: UserRole, storeIds: string[]) {
  if (!allows(actor, "users") && actor.role !== "admin") throw new Error("You cannot change user accounts.");
  if (actor.role === "admin") return;
  if (role !== "USER" && role !== "MANAGER") {
    throw new Error("You can add Managers and Users for your restaurants. Only an Admin can add Supervisors or Admins.");
  }
  if (storeIds.some((id) => !seesStoreId(actor, id))) throw new Error("Choose restaurants you are assigned to.");
}

async function rejectSharedPasswords(password: string, ignoreStoreId?: string) {
  const adminPassword = process.env.APP_PASSWORD;
  if (adminPassword && safeEqual(password, adminPassword)) {
    throw new Error("Choose a password that is different from the admin password.");
  }
  const stores = await prisma.store.findMany({ where: { passwordHash: { not: null } } });
  for (const store of stores) {
    if (store.id === ignoreStoreId) continue;
    if (store.passwordHash && (await verifyPassword(password, store.passwordHash))) {
      throw new Error("Choose a password that is different from every restaurant password.");
    }
  }
}

function isSharedStoreLogin(login: string, role: string, storeNumbers: string[]) {
  return role === "USER" && storeNumbers.length === 1 && storeNumbers[0] === login;
}

export async function listAppUsers(actor: Access, defaults: RoleDefaultMap): Promise<UserRecord[]> {
  const rows = await prisma.appUser.findMany({
    include: { stores: { include: { store: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return rows.flatMap((row) => {
    if (!isUserRole(row.role)) return [];
    const stores = [...row.stores].sort((left, right) => left.store.number.localeCompare(right.store.number));
    const storeIds = stores.map((link) => link.storeId);
    const storeNumbers = stores.map((link) => link.store.number);
    if (!userVisibleTo(actor, { role: row.role, storeIds })) return [];
    const permissions = effectivePermissions(row.role, row.permissionOverrides, defaults);
    return [
      {
        id: row.id,
        name: row.name,
        login: row.login,
        role: row.role,
        active: row.active,
        lastSignedInAt: row.lastSignedInAt ? row.lastSignedInAt.toISOString() : null,
        storeIds,
        storeNumbers,
        sharedStore: isSharedStoreLogin(row.login, row.role, storeNumbers),
        permissions,
        overrides: overridesFor(row.role, permissions, defaults),
      },
    ];
  });
}

async function assertLastAdmin(existing: { id: string; role: string; active: boolean } | null, next: { role: UserRole; active: boolean; permissions: PermissionMap }) {
  if (!existing || existing.role !== "ADMIN" || !existing.active) return;
  const keepsAdmin = next.role === "ADMIN" && next.active && next.permissions.users;
  if (keepsAdmin) return;
  const others = await prisma.appUser.count({ where: { role: "ADMIN", active: true, id: { not: existing.id } } });
  if (others === 0) {
    throw new Error("This is the last Admin. Add another Admin before changing this account.");
  }
}

async function syncRestaurantPassword(userId: string, previousHash: string | null) {
  const user = await prisma.appUser.findUnique({
    where: { id: userId },
    include: { stores: { include: { store: true } } },
  });
  if (!user) return;
  const store = user.stores.length === 1 ? user.stores[0].store : null;
  const shared = Boolean(store && user.active && isSharedStoreLogin(user.login, user.role, [store.number]));
  if (shared && store && store.passwordHash !== user.passwordHash) {
    await prisma.store.update({
      where: { id: store.id },
      data: { passwordHash: user.passwordHash, sessionVersion: { increment: 1 } },
    });
  }
  const stale = [previousHash, shared ? null : user.passwordHash].filter((hash): hash is string => Boolean(hash));
  if (stale.length === 0) return;
  const holders = await prisma.store.findMany({ where: { passwordHash: { in: stale } } });
  for (const holder of holders) {
    if (shared && store && holder.id === store.id) continue;
    await prisma.store.update({
      where: { id: holder.id },
      data: { passwordHash: null, sessionVersion: { increment: 1 } },
    });
  }
}

export async function saveAppUser(actor: Access, draft: UserDraft, defaults: RoleDefaultMap) {
  const name = draft.name.trim();
  if (name.length < 1) throw new Error("Enter the person's name.");
  const login = normalizeLogin(draft.login);
  if (!login || !LOGIN_PATTERN.test(login)) {
    throw new Error("Use a username or email made of letters, numbers, and . _ @ + -.");
  }
  const role = draft.role;
  if (!isUserRole(role)) throw new Error("Choose a role.");
  const existing = draft.id
    ? await prisma.appUser.findUnique({ where: { id: draft.id }, include: { stores: { include: { store: true } } } })
    : null;
  if (draft.id && !existing) throw new Error("That user is no longer on the list.");
  const existingRole = existing && isUserRole(existing.role) ? existing.role : null;
  if (existing && !existingRole) throw new Error("That user is no longer on the list.");
  if (existingRole && existing && !userVisibleTo(actor, { role: existingRole, storeIds: existing.stores.map((link) => link.storeId) })) {
    throw new Error("That user is outside the restaurants you can manage.");
  }
  const previous = existingRole
    ? effectivePermissions(existingRole, existing?.permissionOverrides, defaults)
    : effectivePermissions(role, {}, defaults);
  const permissions = preserveAdminGrants(actor, previous, draft.permissions);
  const assignment = normalizeAssignment(role, draft.storeIds, permissions);
  assertActorCanSave(actor, role, assignment.storeIds);
  await assertLastAdmin(existing, { role: role, active: draft.active, permissions });
  const password = draft.password;
  if (!existing && password.length < 1) throw new Error("Enter a password.");
  const ignoreStoreId = existing && assignment.storeIds.length === 1 && role === "USER" ? assignment.storeIds[0] : undefined;
  if (password.length > 0) {
    if (password !== draft.confirm) throw new Error("Type the same password in both fields.");
    await rejectSharedPasswords(password, ignoreStoreId);
  }
  const taken = await prisma.appUser.findUnique({ where: { login } });
  if (taken && taken.id !== existing?.id) throw new Error("That username is already in use.");
  if (assignment.storeIds.length) {
    const found = await prisma.store.findMany({ where: { id: { in: assignment.storeIds } } });
    if (found.length !== assignment.storeIds.length) throw new Error("Choose a restaurant from the list.");
  }
  const endSession = Boolean(existing && (password.length > 0 || (existing.active && !draft.active)));
  const previousHash = existing?.passwordHash ?? null;
  const overrides = overridesFor(role, permissions, defaults);
  const passwordHash = password.length > 0 ? await hashPassword(password) : existing?.passwordHash;
  if (!passwordHash) throw new Error("Enter a password.");
  const saved = existing
    ? await prisma.appUser.update({
        where: { id: existing.id },
        data: {
          name,
          login,
          role: role,
          allStores: assignment.allStores,
          active: draft.active,
          permissionOverrides: overrides,
          ...(password.length > 0 ? { passwordHash } : {}),
          ...(endSession ? { sessionVersion: { increment: 1 } } : {}),
        },
      })
    : await prisma.appUser.create({
        data: {
          name,
          login,
          role: role,
          allStores: assignment.allStores,
          active: draft.active,
          passwordHash,
          permissionOverrides: overrides,
        },
      });
  await prisma.appUserStore.deleteMany({ where: { userId: saved.id } });
  if (assignment.storeIds.length) {
    await prisma.appUserStore.createMany({
      data: assignment.storeIds.map((storeId) => ({ userId: saved.id, storeId })),
    });
  }
  const storesChanged =
    existing &&
    existing.stores
      .map((link) => link.storeId)
      .sort()
      .join() !== [...assignment.storeIds].sort().join();
  if (!existing || password.length > 0 || existing.active !== draft.active || existing.role !== role || existing.login !== login || storesChanged) {
    await syncRestaurantPassword(saved.id, previousHash);
  }
  return saved.id;
}

export async function resetUserPermissions(actor: Access, userId: string) {
  if (actor.role !== "admin") throw new Error("Only an Admin can reset permissions to the role defaults.");
  const existing = await prisma.appUser.findUnique({ where: { id: userId } });
  if (!existing || !isUserRole(existing.role)) throw new Error("That user is no longer on the list.");
  await prisma.appUser.update({ where: { id: userId }, data: { permissionOverrides: {} } });
}

export async function saveRoleDefaults(actor: Access, role: UserRole, keys: Permission[]) {
  if (actor.role !== "admin") throw new Error("Only an Admin can change role defaults.");
  if (role === "ADMIN") throw new Error("Admins always keep every permission. Change an Admin on that person's account.");
  const clean = [...new Set(keys)];
  await prisma.roleDefault.upsert({
    where: { role },
    create: { role, permissions: clean },
    update: { permissions: clean },
  });
}

export async function upsertSharedStoreUser(store: { id: string; number: string; passwordHash: string }) {
  const existing = await prisma.appUser.findUnique({ where: { login: store.number } });
  if (existing && existing.role !== "USER") {
    throw new Error("That restaurant number is already a username for a different role.");
  }
  const saved = existing
    ? await prisma.appUser.update({
        where: { id: existing.id },
        data: {
          name: existing.name || store.number,
          passwordHash: store.passwordHash,
          role: "USER",
          allStores: false,
          active: true,
          sessionVersion: { increment: 1 },
        },
      })
    : await prisma.appUser.create({
        data: {
          name: store.number,
          login: store.number,
          passwordHash: store.passwordHash,
          role: "USER",
          allStores: false,
          active: true,
        },
      });
  await prisma.appUserStore.deleteMany({ where: { userId: saved.id } });
  await prisma.appUserStore.create({ data: { userId: saved.id, storeId: store.id } });
  return saved;
}

export async function migrateSharedStoreUsers(db: {
  store: typeof prisma.store;
  appUser: typeof prisma.appUser;
  appUserStore: typeof prisma.appUserStore;
}) {
  const stores = await db.store.findMany({ where: { passwordHash: { not: null } } });
  let created = 0;
  for (const store of stores) {
    if (!store.passwordHash) continue;
    const existing = await db.appUser.findUnique({ where: { login: store.number } });
    if (existing) continue;
    const user = await db.appUser.create({
      data: {
        name: store.number,
        login: store.number,
        passwordHash: store.passwordHash,
        role: "USER",
        allStores: false,
        active: true,
      },
    });
    await db.appUserStore.create({ data: { userId: user.id, storeId: store.id } });
    created += 1;
  }
  if (created > 0) console.log(`Shared restaurant logins created: ${created}.`);
}

export async function matchUserLogin(login: string, password: string) {
  const user = await prisma.appUser.findUnique({ where: { login: normalizeLogin(login) } });
  if (!user || !user.active || !isUserRole(user.role)) return null;
  if (!(await verifyPassword(password, user.passwordHash))) return null;
  const stamped = await prisma.appUser.update({
    where: { id: user.id },
    data: { lastSignedInAt: new Date() },
  });
  return { role: "user" as const, userId: stamped.id, version: stamped.sessionVersion, userRole: user.role };
}

export async function matchSharedStorePassword(password: string) {
  const stores = await prisma.store.findMany({ where: { passwordHash: { not: null } } });
  for (const store of stores) {
    if (!store.passwordHash || !(await verifyPassword(password, store.passwordHash))) continue;
    const account = await prisma.appUser.findUnique({ where: { login: store.number } });
    if (!account || !account.active || account.role !== "USER") return null;
    if (!(await verifyPassword(password, account.passwordHash))) return null;
    const stamped = await prisma.appUser.update({
      where: { id: account.id },
      data: { lastSignedInAt: new Date() },
    });
    return { role: "user" as const, userId: stamped.id, version: stamped.sessionVersion, storeId: store.id };
  }
  return null;
}
