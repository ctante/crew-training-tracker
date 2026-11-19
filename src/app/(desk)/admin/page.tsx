import Link from "next/link";
import { createStaffAction, resetSampleAction, saveStoreAction, updateStaffAction } from "@/app/actions";
import { Flash, PageHeader, fieldClass, ghostButton, primaryButton } from "@/components/ui";
import { SEEDED_NAMES, groupByTrainerPosition } from "@/lib/constants";
import { listDirectory } from "@/lib/data";
import { one, storeLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin" };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const stores = await listDirectory();
  const saved = one(params.saved);

  return (
    <div>
      <PageHeader
        kicker="Desk setup"
        title="Restaurants and people"
        description="Names for Nursery, Kenwood, and Emmorton are filled in. The other seven numbers had no name on the sheets. Qualified trainers come from the Development Report and are listed by position."
        actions={
          <>
            <Link href="/admin/roster" className={primaryButton}>
              Trainer roster
            </Link>
            <Link href="/admin/modules" className={ghostButton}>
              Edit modules
            </Link>
            <Link href="/admin/import" className={ghostButton}>
              Bulk progress
            </Link>
          </>
        }
      />
      <Flash
        error={one(params.error)}
        notice={saved === "store" ? "Restaurant name saved." : saved === "person" ? "Person saved." : ""}
      />

      <div className="space-y-5">
        {stores.map((store) => (
          <section key={store.id} id={`store-${store.id}`} className="scroll-mt-24 rounded-3xl border border-line bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">{store.number}</p>
                <h2 className="font-display text-2xl">{storeLabel(store.number, store.name)}</h2>
                {SEEDED_NAMES[store.number] ? (
                  <p className="text-xs text-ink/50">Sheet name: {SEEDED_NAMES[store.number]}</p>
                ) : (
                  <p className="text-xs text-ink/50">No name was on the sheet. Add one below.</p>
                )}
              </div>
              <form action={saveStoreAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={store.id} />
                <label className="text-sm font-semibold">
                  Restaurant name
                  <input className={`${fieldClass} mt-1`} name="name" defaultValue={store.name} placeholder="Name" />
                </label>
                <button className={ghostButton} type="submit">
                  Save name
                </button>
              </form>
            </div>

            <div className="mt-4 space-y-4">
              {groupByTrainerPosition(store.staff).map((group) => (
                <div key={group.position}>
                  <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">{group.position}</h3>
                  <ul className="mt-2 space-y-3">
                    {group.people.map((person) => (
                      <li key={person.id} className={person.active ? "" : "opacity-60"}>
                        <form action={updateStaffAction} className="grid gap-2 rounded-2xl bg-paper p-3 sm:grid-cols-[1fr_1fr_auto_auto_auto]">
                          <input type="hidden" name="id" value={person.id} />
                          <input type="hidden" name="storeId" value={store.id} />
                          <label className="text-xs font-semibold">
                            Name
                            <input className={`${fieldClass} mt-1`} name="name" defaultValue={person.name} />
                            {person.isSample ? <span className="mt-1 block font-normal text-ink/50">Sample trainer</span> : null}
                          </label>
                          <label className="text-xs font-semibold">
                            Position
                            <input className={`${fieldClass} mt-1`} name="position" defaultValue={person.position} />
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" name="isGm" defaultChecked={person.isGm} className="h-5 w-5 accent-brick" />
                            GM
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" name="qualified" defaultChecked={person.qualified} className="h-5 w-5 accent-brick" />
                            Qualified
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" name="active" defaultChecked={person.active} className="h-5 w-5 accent-brick" />
                            Active
                          </label>
                          <button className={`${ghostButton} sm:col-span-5`} type="submit">
                            Save person
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <form action={createStaffAction} className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-2">
              <input type="hidden" name="storeId" value={store.id} />
              <label className="text-sm font-semibold">
                Add a person
                <input className={`${fieldClass} mt-1`} name="name" placeholder="Name" />
              </label>
              <label className="text-sm font-semibold">
                Position
                <input className={`${fieldClass} mt-1`} name="position" placeholder="Shift Manager" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isGm" className="h-5 w-5 accent-brick" />
                General manager
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="qualified" defaultChecked className="h-5 w-5 accent-brick" />
                Qualified trainer
              </label>
              <button className={primaryButton} type="submit">
                Add to {store.number}
              </button>
            </form>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-3xl border border-brick/30 bg-red-50 p-4">
        <h2 className="font-display text-2xl text-brick-dark">Restore sample data</h2>
        <p className="mt-1 max-w-2xl text-sm text-brick-dark/80">
          This deletes trainees, progress, module edits, restaurant names, and people, then loads the fictional Sample
          set again.
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
