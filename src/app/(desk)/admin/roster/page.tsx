import Link from "next/link";
import { RosterImport } from "@/components/roster-import";
import { PageHeader, ghostButton } from "@/components/ui";
import { TRAINER_POSITION_ORDER, groupByTrainerPosition } from "@/lib/constants";
import { getRosterPage } from "@/lib/data";
import { formatShortDate, storeLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Trainer roster" };

export default async function RosterPage() {
  const roster = await getRosterPage();

  return (
    <div>
      <PageHeader
        kicker="Development Report"
        title="Qualified trainers"
        description="The module dropdown lists qualified people for that restaurant only, in position order. Sample trainers stay labeled Sample until a real roster replaces a matching name."
        actions={
          <a className={ghostButton} href="/api/export/roster-template" download>
            Download CSV template
          </a>
        }
      />
      <p className="mb-4 text-sm text-ink/70">
        Position order is fixed in one setting: {TRAINER_POSITION_ORDER.join(", ")}. Names sort alphabetically inside
        each position. Columns: Name, Store, Position, Qualified. A file without Qualified treats every row as qualified.
        Restaurants named in the file replace earlier Development Report rows at those restaurants. Sample trainers are
        left in place.
      </p>
      {roster.lastSync ? (
        <p className="mb-4 rounded-2xl border border-line bg-card px-4 py-3 text-sm">
          Last {roster.lastSync.source} sync {formatShortDate(roster.lastSync.at.slice(0, 10))}: {roster.lastSync.createdCount}{" "}
          added, {roster.lastSync.updatedCount} updated, {roster.lastSync.skippedCount} skipped.
          {roster.lastSync.note ? ` ${roster.lastSync.note}` : ""}
        </p>
      ) : null}
      <RosterImport />
      <div className="mt-8 space-y-5">
        {roster.stores.map((store) => (
          <section key={store.id} className="rounded-3xl border border-line bg-card p-4">
            <h2 className="font-display text-2xl">{storeLabel(store.number, store.name)}</h2>
            <p className="text-sm text-ink/60">{store.trainers.length} qualified</p>
            {store.trainers.length === 0 ? (
              <p className="mt-2 text-sm text-ink/60">No qualified trainers yet.</p>
            ) : (
              groupByTrainerPosition(store.trainers).map((group) => (
                <div key={group.position} className="mt-3">
                  <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">{group.position}</h3>
                  <ul className="mt-1 text-sm">
                    {group.people.map((person) => (
                      <li key={person.id}>
                        {person.name}
                        {person.isGm ? " · GM" : ""}
                        {person.isSample ? " · Sample" : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>
        ))}
      </div>
      <p className="mt-6 text-sm">
        <Link href="/admin" className="font-semibold text-campus">
          Back to restaurants and people
        </Link>
      </p>
    </div>
  );
}
