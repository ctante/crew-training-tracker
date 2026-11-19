import { UserForm } from "@/components/user-form";
import { AdminNav } from "@/components/admin-nav";
import { Flash, PageHeader } from "@/components/ui";
import { redirect } from "next/navigation";
import { access, allows, loadRoleDefaults } from "@/lib/access";
import { listStoreChoices } from "@/lib/data";
import { formatDateTimeEt, one } from "@/lib/format";
import { ROLE_SUMMARIES, type UserRole } from "@/lib/permissions";
import { listAppUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

export const metadata = { title: "Users" };

const ROLE_TITLE: Record<UserRole, string> = {
  USER: "User",
  MANAGER: "Manager",
  SUPERVISOR: "Supervisor",
  ADMIN: "Admin",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const who = await access();
  if (!allows(who, "users") && who.role !== "admin") redirect("/");
  const params = await searchParams;
  const defaults = await loadRoleDefaults();
  const [users, stores] = await Promise.all([listAppUsers(who, defaults), listStoreChoices()]);
  const roles: UserRole[] = who.role === "admin" ? ["USER", "MANAGER", "SUPERVISOR", "ADMIN"] : ["USER", "MANAGER"];

  return (
    <div>
      <AdminNav current="/admin/users" />
      <PageHeader
        kicker="Admin"
        title="Users"
        description="Each person has a username and a password. Checkboxes start from the role. An Override mark means this person differs from that role. Reset to role defaults clears those marks."
      />
      <Flash error={one(params.error)} notice={one(params.saved) ? "User saved. A new password is not shown again." : ""} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {ROLE_SUMMARIES.map((item) => (
          <section key={item.role} className="rounded-3xl border border-line bg-card p-4">
            <h2 className="font-display text-2xl">{item.title}</h2>
            <p className="mt-1 text-sm text-ink/70">{item.text}</p>
          </section>
        ))}
      </div>
      <section className="rounded-3xl border border-line bg-card p-4">
        <h2 className="font-display text-2xl">Add user</h2>
        <div className="mt-3">
          <UserForm stores={stores} roles={roles} user={null} canGrant={who.role === "admin"} defaults={defaults} />
        </div>
      </section>
      <div className="mt-4 space-y-3">
        {users.map((user) => (
          <details key={user.id} className="rounded-3xl border border-line bg-card p-4" open={one(params.edit) === user.id}>
            <summary className="cursor-pointer">
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
            </summary>
            <div className="mt-4">
              <UserForm stores={stores} roles={roles.includes(user.role) ? roles : [user.role, ...roles]} user={user} canGrant={who.role === "admin"} defaults={defaults} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
