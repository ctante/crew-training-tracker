import { UserForm } from "@/components/user-form";
import { UserList } from "@/components/user-list";
import { AdminNav } from "@/components/admin-nav";
import { Flash, PageHeader } from "@/components/ui";
import { redirect } from "next/navigation";
import { access, allows, loadRoleDefaults } from "@/lib/access";
import { listStoreChoices } from "@/lib/data";
import { one } from "@/lib/format";
import { ROLE_SUMMARIES, type UserRole } from "@/lib/permissions";
import { listAppUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

export const metadata = { title: "Users" };

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
        <h2 className="font-display text-2xl">Add User</h2>
        <div className="mt-3">
          <UserForm stores={stores} roles={roles} user={null} canGrant={who.role === "admin"} defaults={defaults} />
        </div>
      </section>
      <UserList
        users={users}
        stores={stores}
        roles={roles}
        canGrant={who.role === "admin"}
        defaults={defaults}
        editId={one(params.edit)}
      />
    </div>
  );
}
