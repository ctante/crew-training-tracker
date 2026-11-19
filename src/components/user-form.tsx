"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetUserPermissionsAction, saveUserAction } from "@/app/actions";
import { fieldClass, ghostButton, primaryButton } from "@/components/ui";
import { PERMISSIONS, roleDefaults, ROLE_SUMMARIES, type Permission, type PermissionMap, type RoleDefaultMap, type UserRole } from "@/lib/permissions";
import type { UserRecord } from "@/lib/users";

const ROLE_TITLE: Record<UserRole, string> = {
  USER: "User",
  MANAGER: "Manager",
  SUPERVISOR: "Supervisor",
  ADMIN: "Admin",
};

export function UserForm({
  stores,
  roles,
  user,
  canGrant,
  defaults,
}: {
  stores: { id: string; number: string }[];
  roles: UserRole[];
  user: UserRecord | null;
  canGrant: boolean;
  defaults: RoleDefaultMap;
}) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>(user?.role ?? roles[0] ?? "USER");
  const [storeIds, setStoreIds] = useState<string[]>(user?.storeIds ?? []);
  const [checks, setChecks] = useState<PermissionMap>(user?.permissions ?? roleDefaults(role, defaults));
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const baseline = roleDefaults(role, defaults);
  const manyStores = role !== "ADMIN" && checks.view_stores;

  function chooseRole(next: UserRole) {
    setRole(next);
    setChecks(user && user.role === next ? user.permissions : roleDefaults(next, defaults));
    if (next !== "ADMIN" && !roleDefaults(next, defaults).view_stores) setStoreIds((current) => current.slice(0, 1));
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError("");
        startTransition(async () => {
          const result = await saveUserAction({
            id: user?.id,
            name: String(form.get("name") || ""),
            login: String(form.get("login") || ""),
            password: String(form.get("password") || ""),
            confirm: String(form.get("confirm") || ""),
            role,
            storeIds: role === "ADMIN" ? [] : storeIds,
            active: form.get("active") === "yes",
            permissions: checks,
          });
          if (result && "error" in result && result.error) setError(result.error);
          else {
            router.refresh();
            router.push("/admin/users?saved=1");
          }
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Name
          <input className={`${fieldClass} mt-1`} name="name" defaultValue={user?.name ?? ""} required />
        </label>
        <label className="text-sm font-semibold">
          Username or email
          <input className={`${fieldClass} mt-1`} name="login" defaultValue={user?.login ?? ""} autoComplete="off" required />
        </label>
        <label className="text-sm font-semibold">
          {user ? "New password" : "Password"}
          <input className={`${fieldClass} mt-1`} type="password" name="password" autoComplete="new-password" required={!user} />
        </label>
        <label className="text-sm font-semibold">
          Type it again
          <input className={`${fieldClass} mt-1`} type="password" name="confirm" autoComplete="new-password" required={!user} />
        </label>
      </div>
      {user ? <p className="text-sm text-ink/60">Leave the password blank to keep the current one. It is never shown again. A new password signs this person out.</p> : null}
      {user?.sharedStore ? (
        <p className="text-sm text-ink/70">This is the shared login for restaurant {user.storeNumbers[0]}. Anyone there can sign in with that username, or leave the username blank and use the password.</p>
      ) : null}
      <label className="text-sm font-semibold">
        Role
        <select
          className={`${fieldClass} mt-1`}
          value={role}
          onChange={(event) => chooseRole(event.target.value as UserRole)}
        >
          {roles.map((item) => (
            <option key={item} value={item}>
              {ROLE_TITLE[item]}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-ink/70">{ROLE_SUMMARIES.find((item) => item.role === role)?.text}</p>
      {role === "ADMIN" ? (
        <p className="text-sm font-semibold">Restaurants: every restaurant.</p>
      ) : manyStores ? (
        <fieldset>
          <legend className="text-sm font-semibold">Restaurants</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {stores.map((store) => (
              <label key={store.id} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-paper px-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-brick"
                  checked={storeIds.includes(store.id)}
                  onChange={(event) => {
                    setStoreIds((current) =>
                      event.target.checked ? [...current, store.id] : current.filter((id) => id !== store.id),
                    );
                  }}
                />
                {store.number}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <label className="text-sm font-semibold">
          Restaurant
          <select
            className={`${fieldClass} mt-1`}
            value={storeIds[0] ?? ""}
            onChange={(event) => setStoreIds(event.target.value ? [event.target.value] : [])}
          >
            <option value="">Choose one</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.number}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="active" value="yes" defaultChecked={user?.active ?? true} className="h-5 w-5 accent-brick" />
        Active. An inactive person cannot sign in, and saving this signs them out.
      </label>
      <fieldset className="rounded-2xl border border-line p-3">
        <legend className="px-1 text-sm font-semibold">Permissions</legend>
        <p className="text-sm text-ink/60">Checked boxes start from the role. A box that differs from the role is marked Override.</p>
        <div className="mt-3 grid gap-2">
          {PERMISSIONS.map((item) => {
            const locked = item.adminGrant && !canGrant;
            const override = checks[item.key] !== baseline[item.key];
            return (
              <label key={item.key} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 accent-brick"
                  checked={checks[item.key]}
                  disabled={locked}
                  onChange={(event) => {
                    const allowed = event.target.checked;
                    setChecks((current) => ({ ...current, [item.key]: allowed }));
                    if (item.key === "view_stores" && !allowed) setStoreIds((current) => current.slice(0, 1));
                  }}
                />
                <span>
                  <span className="font-semibold">{item.label}</span>
                  {override ? <span className="ml-2 rounded-full bg-sun px-2 py-0.5 text-xs font-bold text-sun-deep">Override</span> : null}
                  {locked ? <span className="ml-2 text-xs text-ink/50">Only an Admin can change this</span> : null}
                  <span className="mt-0.5 block text-ink/60">{item.detail}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {error ? (
        <p className="text-sm text-brick-dark" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button className={primaryButton} type="submit" disabled={pending}>
          {pending ? "Saving" : user ? "Save user" : "Add user"}
        </button>
        {user && canGrant ? (
          <button
            className={ghostButton}
            type="button"
            disabled={pending}
            onClick={() => {
              setError("");
              startTransition(async () => {
                const result = await resetUserPermissionsAction(user.id);
                if (result && "error" in result && result.error) setError(result.error);
                else {
                  setChecks(roleDefaults(role, defaults));
                  router.refresh();
                  router.push("/admin/users?saved=1");
                }
              });
            }}
          >
            Reset to role defaults
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function permissionSummary(permissions: PermissionMap) {
  return PERMISSIONS.filter((item) => permissions[item.key]).map((item) => item.label);
}

export type { Permission };
