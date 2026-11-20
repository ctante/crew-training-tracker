import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
import { PageHeader, ghostButton } from "@/components/ui";
import { TRAINER_POSITION_ORDER, groupByTrainerPosition } from "@/lib/constants";
import { access, allows } from "@/lib/access";
import { getRosterPage } from "@/lib/data";
import { storeLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Trainer roster" };

export default async function RosterPage() {
  const who = await access();
  if (!allows(who, "roster_import")) redirect("/");
  const roster = await getRosterPage();

  return (
    <div>
      <AdminNav current="/admin/roster" />
      <PageHeader
        kicker="Roster"
        title="Qualified trainers"
        description="The module dropdown lists qualified people for that restaurant only, in position order. Add, edit, or remove them on the Development page."
        actions={
          <Link className={ghostButton} href="/development">
            Open Development
          </Link>
        }
      />
      <p className="mb-4 text-sm text-ink/70">
        The weekly Development Report sync no longer changes this list. Position order is fixed in one setting:{" "}
        {TRAINER_POSITION_ORDER.join(", ")}. Names sort alphabetically inside each position.
      </p>
      <div className="space-y-5">
        {roster.stores.map((store) => (
          <section key={store.id} className="rounded-3xl border border-line bg-card p-4">
            <h2 className="font-display text-2xl">{storeLabel(store.number)}</h2>
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
