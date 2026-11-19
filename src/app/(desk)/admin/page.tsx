import Link from "next/link";
import { resetSampleAction } from "@/app/actions";
import { AdminNav } from "@/components/admin-nav";
import { Flash, PageHeader } from "@/components/ui";
import { one } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin" };

const tiles = [
  {
    href: "/admin/access",
    title: "Store passwords",
    text: "Set the password each restaurant uses to sign in.",
  },
  {
    href: "/admin/roster",
    title: "Trainer roster",
    text: "Qualified trainers come from the weekly Development Report.",
  },
  {
    href: "/admin/modules",
    title: "Modules",
    text: "Add, reorder, or archive modules on the training path.",
  },
  {
    href: "/admin/import",
    title: "Bulk progress",
    text: "Import a sheet of trainee progress or export the current file.",
  },
];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <div>
      <AdminNav current="/admin" />
      <PageHeader
        kicker="Desk setup"
        title="Admin"
        description="Trainers update from the Development Report. Pick a section below."
      />
      <Flash error={one(params.error)} notice="" />
      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((tile) => (
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

      <section className="mt-8 rounded-3xl border border-brick/30 bg-red-50 p-4">
        <h2 className="font-display text-2xl text-brick-dark">Restore sample data</h2>
        <p className="mt-1 max-w-2xl text-sm text-brick-dark/80">
          This deletes trainees, progress, module edits, and people, then loads the fictional Sample set again.
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
    </div>
  );
}
