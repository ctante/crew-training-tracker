import Link from "next/link";
import { resetSampleAction } from "@/app/actions";
import { AdminNav } from "@/components/admin-nav";
import { Flash, PageHeader } from "@/components/ui";
import { access, allows } from "@/lib/access";
import { one } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin" };

const tiles = [
  {
    href: "/admin/users",
    title: "Users",
    text: "Accounts, roles, and the permissions each person has.",
    show: "users" as const,
  },
  {
    href: "/admin/permissions",
    title: "Role Defaults",
    text: "The permissions a role starts with. Overrides live on each person.",
    show: "admin" as const,
  },
  {
    href: "/admin/access",
    title: "Store Passwords",
    text: "The shared User login for a restaurant. The username is the restaurant number.",
    show: "store_logins" as const,
  },
  {
    href: "/admin/roster",
    title: "Trainer / Manager",
    text: "Add a trainer or manager, and remove or restore people already on the roster.",
    show: "roster_import" as const,
  },
  {
    href: "/admin/employees",
    title: "Employee Roster",
    text: "The full restaurant roster. Inactive people stay saved and drop out of the daily pages.",
    show: "admin" as const,
  },
  {
    href: "/admin/modules",
    title: "Modules",
    text: "Add, reorder, or archive modules on the training path.",
    show: "modules" as const,
  },
  {
    href: "/admin/import",
    title: "Bulk Progress",
    text: "Import a sheet of trainee progress or export the current file.",
    show: "roster_import" as const,
  },
  {
    href: "/admin/development",
    title: "Development Activity",
    text: "The dropdown of development work, such as Inventory or ITS Training. Actividad de desarrollo.",
    show: "admin" as const,
  },
];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const who = await access();
  const visible = tiles.filter((tile) => (tile.show === "admin" ? who.role === "admin" : allows(who, tile.show)));

  return (
    <div>
      <AdminNav current="/admin" />
      <PageHeader
        kicker="Desk setup"
        title="Admin"
        description="People on the roster are added from Development. Pick a section below."
      />
      <Flash error={one(params.error)} notice="" />
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="flex min-h-36 flex-col justify-between rounded-3xl border border-line bg-card p-5 shadow-sm transition hover:border-brick/40"
          >
            <h2 className="font-display text-3xl">{tile.title}</h2>
            <p className="mt-3 text-sm text-ink/70">{tile.text}</p>
          </Link>
        ))}
      </div>

      {who.role === "admin" ? (
      <section className="mt-8 rounded-3xl border border-brick/30 bg-red-50 p-4">
        <h2 className="font-display text-2xl text-brick-dark">Restore Sample Data</h2>
        <p className="mt-1 max-w-2xl text-sm text-brick-dark/80">
          This deletes trainees, progress, module edits, people, and user accounts, then loads the fictional Sample set again.
        </p>
        <form action={resetSampleAction} className="mt-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirm" value="yes" className="h-5 w-5 accent-brick" />
            Replace the tracker with the sample set.
          </label>
          <button className="mt-3 rounded-full bg-brick px-4 py-2 text-sm font-semibold text-white" type="submit">
            Restore sample data
          </button>
        </form>
      </section>
      ) : null}
    </div>
  );
}
