"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRoleDefaultsAction } from "@/app/actions";
import { primaryButton } from "@/components/ui";
import { PERMISSIONS, selectedKeys, type PermissionMap, type RoleDefaultMap, type UserRole } from "@/lib/permissions";

const TITLES: Record<Exclude<UserRole, "ADMIN">, string> = {
  USER: "User",
  MANAGER: "Manager",
  SUPERVISOR: "Supervisor",
};

export function RoleDefaultsForm({ defaults }: { defaults: RoleDefaultMap }) {
  const router = useRouter();
  const [maps, setMaps] = useState<Record<Exclude<UserRole, "ADMIN">, PermissionMap>>({
    USER: checked(defaults.USER),
    MANAGER: checked(defaults.MANAGER),
    SUPERVISOR: checked(defaults.SUPERVISOR),
  });
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      {(Object.keys(TITLES) as Exclude<UserRole, "ADMIN">[]).map((role) => (
        <form
          key={role}
          className="rounded-3xl border border-line bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            startTransition(async () => {
              const result = await saveRoleDefaultsAction({ role, permissions: selectedKeys(maps[role]) });
              if (result && "error" in result && result.error) setError(result.error);
              else {
                router.refresh();
                router.push("/admin/permissions?saved=1");
              }
            });
          }}
        >
          <h2 className="font-display text-2xl">{TITLES[role]}</h2>
          <div className="mt-3 grid gap-2">
            {PERMISSIONS.map((item) => (
              <label key={item.key} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 accent-brick"
                  checked={maps[role][item.key]}
                  onChange={(event) =>
                    setMaps((current) => ({
                      ...current,
                      [role]: { ...current[role], [item.key]: event.target.checked },
                    }))
                  }
                />
                <span>
                  <span className="font-semibold">{item.label}</span>
                  <span className="mt-0.5 block text-ink/60">{item.detail}</span>
                </span>
              </label>
            ))}
          </div>
          <button className={`${primaryButton} mt-3`} type="submit" disabled={pending}>
            Save {TITLES[role]} defaults
          </button>
        </form>
      ))}
      {error ? (
        <p className="text-sm text-brick-dark" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function checked(keys: string[]): PermissionMap {
  const map = Object.fromEntries(PERMISSIONS.map((item) => [item.key, keys.includes(item.key)])) as PermissionMap;
  return map;
}
