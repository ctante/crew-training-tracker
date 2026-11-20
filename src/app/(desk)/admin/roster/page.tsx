import Link from "next/link";
import { redirect } from "next/navigation";
import { addDevelopmentPersonAction } from "@/app/actions";
import { AdminNav } from "@/components/admin-nav";
import { RosterPeople } from "@/components/roster-people";
import { Flash, PageHeader, fieldClass, ghostButton, primaryButton } from "@/components/ui";
import { DEVELOPMENT_POSITIONS, TRAINER_POSITION_ORDER } from "@/lib/constants";
import { access, allows, seesStoreId } from "@/lib/access";
import { getRosterPage } from "@/lib/data";
import { one } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Add Trainer / Manager" };

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const who = await access();
  if (!allows(who, "roster_import")) redirect("/");
  const roster = await getRosterPage();
  const canManage = allows(who, "edit_development") && allows(who, "roster_import");
  const storeChoices = roster.stores.filter((store) => seesStoreId(who, store.id));

  return (
    <div>
      <AdminNav current="/admin/roster" />
      <PageHeader
        kicker="Admin"
        title="Add Trainer / Manager"
        description="Add a person to a restaurant roster. They become a qualified trainer and show on Development. Remove hides them and keeps past weeks."
        actions={
          <Link className={ghostButton} href="/development">
            Open Development
          </Link>
        }
      />
      <Flash
        error={one(params.error)}
        notice={
          one(params.saved) === "added"
            ? "Trainer added."
            : one(params.saved) === "removed"
              ? "Trainer removed. Past weeks stay."
              : one(params.saved) === "restored"
                ? "Trainer restored."
                : ""
        }
      />
      {canManage ? (
        <form action={addDevelopmentPersonAction} className="mb-6 rounded-3xl border border-line bg-card p-4">
          <p className="text-sm text-ink/70">Store, name, and position. This does not assign hours.</p>
          <input type="hidden" name="returnTo" value="roster" />
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm font-semibold">
              Store
              <select className={`${fieldClass} mt-1`} name="storeId" defaultValue={storeChoices[0]?.id ?? ""} required>
                {storeChoices.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.number}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Name
              <input className={`${fieldClass} mt-1`} name="name" required autoComplete="off" />
            </label>
            <label className="text-sm font-semibold">
              Position
              <select className={`${fieldClass} mt-1`} name="position" defaultValue="Crew Trainer" required>
                {DEVELOPMENT_POSITIONS.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>
            <button className={primaryButton} type="submit">
              Save person
            </button>
          </div>
        </form>
      ) : null}
      <p className="mb-4 text-sm text-ink/70">
        Position order is fixed in one setting: {TRAINER_POSITION_ORDER.join(", ")}. Names sort alphabetically inside each position.
      </p>
      <RosterPeople stores={roster.stores} canManage={canManage} />
      <p className="mt-6 text-sm">
        <Link href="/admin" className="font-semibold text-campus">
          Back to restaurants and people
        </Link>
      </p>
    </div>
  );
}
