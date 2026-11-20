import Link from "next/link";
import { Suspense } from "react";
import { TraineeSearch } from "@/components/trainee-search";
import { CollapsibleSections } from "@/components/collapsible-sections";
import { Flag, PageHeader } from "@/components/ui";
import { languageName } from "@/lib/constants";
import { getDashboard } from "@/lib/data";
import { one, storeLabel, withParams } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Trainees" };

export default async function TraineesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const list = one(params.list) || "progress";
  const query = one(params.q);
  const data = await getDashboard({ status: "all", query });
  const rows = data.rows.filter((row) => {
    if (list === "all") return true;
    if (list === "done") return row.scheduleComplete;
    return !row.scheduleComplete;
  });
  const groups = data.stores.map((store) => ({
    store,
    rows: rows.filter((row) => row.storeNumber === store.number),
  }));
  const counts = {
    progress: data.rows.filter((row) => !row.scheduleComplete).length,
    done: data.rows.filter((row) => row.scheduleComplete).length,
    all: data.rows.length,
  };

  return (
    <div>
      <PageHeader
        kicker="Roster"
        title="Trainees"
        description="In progress is anyone who has not finished Foundation plus every path they have. Completed means those sections are all done."
        actions={
          data.canManageTrainees ? (
            <Link href="/trainees/new" className="inline-flex min-h-11 items-center rounded-full bg-brick px-4 text-sm font-semibold text-white">
              Add trainee
            </Link>
          ) : null
        }
      />
      <div className="mb-4 max-w-xs">
        <Suspense fallback={null}>
          <TraineeSearch />
        </Suspense>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["progress", `In progress ${counts.progress}`],
            ["done", `Completed ${counts.done}`],
            ["all", `All ${counts.all}`],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={withParams("/trainees", { q: query }, { list: value === "progress" ? null : value })}
            className={`inline-flex min-h-10 items-center rounded-full border px-3 text-sm font-semibold ${
              list === value ? "border-bark bg-bark text-white" : "border-line bg-card"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
      <CollapsibleSections
        sections={groups.map(({ store, rows }) => ({
          id: store.id,
          title: storeLabel(store.number),
          count: `${rows.length} trainee${rows.length === 1 ? "" : "s"}`,
          body: (
            <>
              {store.gmNames.length > 0 ? (
                <p className="mb-2 text-sm text-ink/60">GM {store.gmNames.join(", ")}</p>
              ) : (
                <p className="mb-2 text-sm text-ink/60">No GM listed yet.</p>
              )}
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {rows.length === 0 ? (
                <li className="px-4 py-3 text-sm text-ink/60">No trainees at this restaurant.</li>
              ) : (
                rows.map((row) => (
                  <li key={row.id}>
                    <Link href={`/trainees/${row.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-sun/20">
                      <span>
                        <span className="font-semibold">{row.name}</span>
                        <span className="ml-2 text-sm text-ink/60">
                          {languageName(row.language)} · {row.pathLabel}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-sm">
                        {row.status === "PAUSED" ? <Flag kind="paused">Paused</Flag> : null}
                        {row.status === "COMPLETED" ? <Flag kind="done">Done</Flag> : null}
                        {row.progress.percent}%
                      </span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
            </>
          ),
        }))}
      />
    </div>
  );
}
