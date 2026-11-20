import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
import { RoleDefaultsForm } from "@/components/role-defaults-form";
import { Flash, PageHeader } from "@/components/ui";
import { access, loadRoleDefaults } from "@/lib/access";
import { one } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Role defaults" };

export default async function RoleDefaultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const who = await access();
  if (who.role !== "admin") redirect("/admin/users");
  const params = await searchParams;
  const defaults = await loadRoleDefaults();

  return (
    <div>
      <AdminNav current="/admin/permissions" />
      <PageHeader
        kicker="Admin"
        title="Role Defaults"
        description="These boxes are the starting permissions for a new person in that role. Admins always have every permission. Take one away on that person's account, not here. A person who already has an override keeps it."
      />
      <Flash error="" notice={one(params.saved) ? "Role defaults saved." : ""} />
      <RoleDefaultsForm defaults={defaults} />
    </div>
  );
}
