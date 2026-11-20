import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
import { RosterPeople } from "@/components/roster-people";
import { Flash, PageHeader, ghostButton } from "@/components/ui";
import { TRAINER_POSITION_ORDER } from "@/lib/constants";
import { access, allows } from "@/lib/access";
import { getRosterPage } from "@/lib/data";
import { one } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Trainer roster" };

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const who = await access();
  if (!allows(who, "roster_import")) redirect("/");
  const roster = await getRosterPage();

  return (
    <div>
      <AdminNav current="/admin/roster" />
      <PageHeader
        kicker="Roster"
        title="Qualified trainers"
        description="The module dropdown lists qualified people for that restaurant only, in position order. Remove hides a trainer and keeps their history. Add people on the Development page."
        actions={
          <Link className={ghostButton} href="/development">
            Open Development
          </Link>
        }
      />
      <Flash
        error={one(params.error)}
        notice={one(params.saved) === "removed" ? "Trainer removed. Past weeks stay." : one(params.saved) === "person" ? "Trainer restored." : ""}
      />
      <p className="mb-4 text-sm text-ink/70">
        The weekly Development Report sync no longer changes this list. Position order is fixed in one setting:{" "}
        {TRAINER_POSITION_ORDER.join(", ")}. Names sort alphabetically inside each position.
      </p>
      <RosterPeople stores={roster.stores} />
      <p className="mt-6 text-sm">
        <Link href="/admin" className="font-semibold text-campus">
          Back to restaurants and people
        </Link>
      </p>
    </div>
  );
}
