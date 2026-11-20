import Link from "next/link";
import { copyDevelopmentAction, importDevelopmentAction } from "@/app/actions";
import { DevelopmentBoard } from "@/components/development-board";
import { PrintButton } from "@/components/print-button";
import { Flash, PageHeader, fieldClass, ghostButton, primaryButton } from "@/components/ui";
import { TRAINER_POSITION_ORDER } from "@/lib/constants";
import { getDevelopment } from "@/lib/development";
import { one, withParams } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Development" };

export default async function DevelopmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const data = await getDevelopment({
    week: one(params.week),
    store: one(params.store),
    position: one(params.position),
  });
  const query = { week: data.weekStart, store: data.store, position: data.position };
  const csv = new URLSearchParams();
  csv.set("week", data.weekStart);
  if (data.store) csv.set("store", data.store);
  if (data.position) csv.set("position", data.position);

  return (
    <div>
      <PageHeader
        kicker="Development"
        title={data.label}
        description="Monday through Sunday. This view lists people who have hours, training needed, or comments. Edit shows the whole roster. Hours are chosen from a list."
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <PrintButton />
            <a className={ghostButton} href={`/api/development?${csv.toString()}`}>
              Download CSV
            </a>
          </div>
        }
      />
      <Flash
        error={one(params.error)}
        notice={one(params.saved) ? "Development week saved." : one(params.notice)}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Link className={ghostButton} href={withParams("/development", query, { week: data.previous })}>
          Previous week
        </Link>
        <Link className={ghostButton} href={withParams("/development", query, { week: data.current })}>
          This week
        </Link>
        <Link className={ghostButton} href={withParams("/development", query, { week: data.next })}>
          Next week
        </Link>
      </div>
      <form action="/development" className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
        <input type="hidden" name="week" value={data.weekStart} />
        {data.canChooseStores ? (
          <label className="text-sm font-semibold">
            Restaurant
            <select className={`${fieldClass} mt-1`} name="store" defaultValue={data.store || "all"}>
              <option value="all">All</option>
              {data.stores.map((number) => (
                <option key={number} value={number}>
                  {number}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="text-sm font-semibold">
          Position
          <select className={`${fieldClass} mt-1`} name="position" defaultValue={data.position || "all"}>
            <option value="all">All positions</option>
            {TRAINER_POSITION_ORDER.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
        </label>
        <button className={primaryButton} type="submit">
          Apply
        </button>
      </form>
      {data.canEdit ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
          <form action={copyDevelopmentAction}>
            <input type="hidden" name="week" value={data.weekStart} />
            <input type="hidden" name="store" value={data.store} />
            <input type="hidden" name="position" value={data.position} />
            <input type="hidden" name="stores" value={data.sections.map((store) => store.number).join(",")} />
            <button className={ghostButton} type="submit">
              Copy last week
            </button>
          </form>
          <p className="text-sm text-ink/60">Copy last week replaces this week’s hours, comments, and store notes.</p>
        </div>
      ) : (
        <p className="mb-4 text-sm text-ink/60 print:hidden">You can view this week. An admin edits hours and comments.</p>
      )}
      <DevelopmentBoard
        sections={data.sections}
        canEdit={data.canEdit}
        tasks={data.tasks}
        week={data.weekStart}
        store={data.store}
        position={data.position}
      />
      {data.canEdit ? (
        <details className="mt-6 rounded-3xl border border-line bg-card p-4 print:hidden">
          <summary className="cursor-pointer font-semibold">Import a development CSV</summary>
          <p className="mt-2 text-sm text-ink/70">
            Columns: Employee, Restaurant, Position, Training Hours Needed, Training Needed, Comments. This writes the week shown above.
            Names must already be on that restaurant’s roster. Use this when promoting a sheet onto the live site later.
          </p>
          <form action={importDevelopmentAction} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="week" value={data.weekStart} />
            <input type="hidden" name="store" value={data.store} />
            <input type="hidden" name="position" value={data.position} />
            <label className="text-sm font-semibold">
              CSV file
              <input className="mt-1 block text-sm" type="file" name="file" accept=".csv,text/csv" required />
            </label>
            <button className={primaryButton} type="submit">
              Import into this week
            </button>
          </form>
        </details>
      ) : null}
    </div>
  );
}
