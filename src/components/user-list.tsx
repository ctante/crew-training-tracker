"use client";

import { useState } from "react";
import { UserForm } from "@/components/user-form";
import { ghostButton } from "@/components/ui";
import { formatDateTimeEt } from "@/lib/format";
import type { RoleDefaultMap, UserRole } from "@/lib/permissions";
import type { UserRecord } from "@/lib/users";

const ROLE_TITLE: Record<UserRole, string> = {
  USER: "User",
  MANAGER: "Manager",
  SUPERVISOR: "Supervisor",
  ADMIN: "Admin",
};

export function UserList({
  users,
  stores,
  roles,
  canGrant,
  defaults,
  editId,
}: {
  users: UserRecord[];
  stores: { id: string; number: string }[];
  roles: UserRole[];
  canGrant: boolean;
  defaults: RoleDefaultMap;
  editId?: string;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => (editId ? { [editId]: true } : {}));

  return (
    <div className="mt-4">
      {users.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2 print:hidden">
          <button className={ghostButton} type="button" onClick={() => setOpen(Object.fromEntries(users.map((user) => [user.id, true])))}>
            Expand all
          </button>
          <button className={ghostButton} type="button" onClick={() => setOpen(Object.fromEntries(users.map((user) => [user.id, false])))}>
            Collapse all
          </button>
        </div>
      ) : null}
      <div className="space-y-3">
        {users.map((user) => {
          const expanded = open[user.id] === true;
          return (
            <section key={user.id} className="rounded-3xl border border-line bg-card">
              <button
                type="button"
                className="w-full px-4 py-3 text-left"
                aria-expanded={expanded}
                onClick={() => setOpen((current) => ({ ...current, [user.id]: !expanded }))}
              >
                <span className="font-semibold">{user.name}</span>
                <span className="ml-2 text-sm text-ink/60">
                  {user.login} · {ROLE_TITLE[user.role]} · {user.storeNumbers.length ? user.storeNumbers.join(", ") : "All restaurants"}
                </span>
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${user.active ? "bg-moss/15 text-moss" : "bg-sun text-sun-deep"}`}>
                  {user.active ? "Active" : "Inactive"}
                </span>
                {Object.keys(user.overrides).length > 0 ? (
                  <span className="ml-2 rounded-full bg-sun px-2 py-0.5 text-xs font-bold text-sun-deep">Override</span>
                ) : null}
                <span className="mt-1 block text-sm text-ink/60">
                  Last sign-in: {user.lastSignedInAt ? formatDateTimeEt(user.lastSignedInAt) : "Never"}
                </span>
              </button>
              {expanded ? (
                <div className="px-4 pb-4">
                  <UserForm
                    stores={stores}
                    roles={roles.includes(user.role) ? roles : [user.role, ...roles]}
                    user={user}
                    canGrant={canGrant}
                    defaults={defaults}
                  />
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
