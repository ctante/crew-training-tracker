import Link from "next/link";
import { Flag, PageHeader, ProgressBar } from "@/components/ui";
import { languageName, SECTION_TITLES } from "@/lib/constants";
import { getDashboard } from "@/lib/data";
import { formatMinutes, formatShortDate, one, storeLabel, withParams } from "@/lib/format";
import type { TraineeSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const storeNumber = one(params.store);
  const status = one(params.status) || "ACTIVE";
  const flag = one(params.flag);
  const query = one(params.q);
  const reset = one(params.reset);
  const data = await getDashboard({ storeNumber, status, flag, query });
  const current = { store: storeNumber, status: status === "ACTIVE" ? "" : status, flag, q: query };

  return (
    <div>
      <PageHeader
        kicker={formatShortDate(data.today)}
        title="Training board"
        description="Active crew on the 36-module path. Overdue sessions and stalled trainees rise to the top."
        actions={
          <Link href="/trainees/new" className="hidden min-h-11 items-center rounded-full bg-brick px-4 text-sm font-semibold text-white lg:inline-flex">
            Add trainee
          </Link>
        }
      />
      {reset ? (
        <p className="mb-4 rounded-2xl border border-amber-300 bg-sun/50 px-4 py-3 text-sm text-sun-deep">
          Sample trainees, restaurants, and the module path were restored.
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="On this view" value={String(data.stats.shown)} hint="trainees" />
        <Stat label="Average complete" value={`${data.stats.average}%`} hint="of 36 modules" />
        <Stat label="Overdue sessions" value={String(data.stats.overdueSessions)} hint="scheduled, still open" tone="brick" />
        <Stat label="Stalled" value={String(data.stats.stalled)} hint="no movement in 14 days" tone="sun" />
      </section>
      {data.stats.dueToday > 0 ? (
        <p className="mt-3 rounded-2xl bg-sun/70 px-4 py-3 text-sm font-semibold text-sun-deep">
          {data.stats.dueToday} trainee{data.stats.dueToday === 1 ? "" : "s"} have a session due today.
        </p>
      ) : null}

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        <Chip href={withParams("/", current, { store: null })} active={!storeNumber}>
          All restaurants
        </Chip>
        {data.stores.map((store) => (
          <Chip
            key={store.number}
            href={withParams("/", current, { store: store.number })}
            active={storeNumber === store.number}
          >
            {storeLabel(store.number)}
            <span className="ml-1 text-ink/50">{store.activeTrainees}</span>
          </Chip>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(
          [
            ["ACTIVE", "Active"],
            ["PAUSED", "Paused"],
            ["COMPLETED", "Completed"],
            ["all", "Everyone"],
          ] as const
        ).map(([value, label]) => (
          <Chip
            key={value}
            href={withParams("/", current, { status: value === "ACTIVE" ? null : value })}
            active={status === value}
          >
            {label}
          </Chip>
        ))}
        {(
          [
            ["", "Any flag"],
            ["overdue", "Overdue"],
            ["today", "Due today"],
            ["stalled", "Stalled"],
          ] as const
        ).map(([value, label]) => (
          <Chip key={label} href={withParams("/", current, { flag: value || null })} active={flag === value}>
            {label}
          </Chip>
        ))}
        <form action="/" className="ml-auto flex min-w-48 flex-1 gap-2 sm:max-w-xs">
          {storeNumber ? <input type="hidden" name="store" value={storeNumber} /> : null}
          {status !== "ACTIVE" ? <input type="hidden" name="status" value={status} /> : null}
          {flag ? <input type="hidden" name="flag" value={flag} /> : null}
          <input
            name="q"
            defaultValue={query}
            placeholder="Search name"
            className="min-h-11 w-full rounded-full border border-line bg-card px-4 text-sm"
            aria-label="Search trainees"
          />
        </form>
      </div>

      <div className="mt-5 space-y-3">
        {data.rows.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line bg-card px-5 py-10 text-center text-sm text-ink/70">
            No trainees match these filters.
          </p>
        ) : (
          data.rows.map((row) => <TraineeRow key={row.id} row={row} />)
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "ink",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "ink" | "brick" | "sun";
}) {
  const color = tone === "brick" ? "text-brick" : tone === "sun" ? "text-sun-deep" : "text-ink";
  return (
    <article className="rounded-3xl border border-line bg-card px-4 py-3 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink/50">{label}</p>
      <p className={`font-display text-4xl leading-none ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-ink/55">{hint}</p>
    </article>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-3 text-sm font-semibold ${
        active ? "border-bark bg-bark text-white" : "border-line bg-card text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function TraineeRow({ row }: { row: TraineeSummary }) {
  const section =
    row.progress.currentSection === "COMPLETE"
      ? "Complete"
      : SECTION_TITLES[row.language][row.progress.currentSection];
  return (
    <Link
      href={`/trainees/${row.id}`}
      className="block rounded-3xl border border-line bg-card p-4 shadow-sm transition hover:border-brick/40"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
            {storeLabel(row.storeNumber)}
            {row.position ? ` · ${row.position}` : ""} · {languageName(row.language)}
          </p>
          <h2 className="text-xl font-semibold">{row.name}</h2>
        </div>
        <div className="flex flex-wrap gap-1">
          {row.isSample ? <Flag kind="sample">Sample</Flag> : null}
          {row.status === "PAUSED" ? <Flag kind="paused">Paused</Flag> : null}
          {row.status === "COMPLETED" ? <Flag kind="done">Completed</Flag> : null}
          {row.progress.overdueCount > 0 ? (
            <Flag kind="overdue">{row.progress.overdueCount} overdue</Flag>
          ) : null}
          {row.progress.dueTodayCount > 0 ? <Flag kind="today">Due today</Flag> : null}
          {row.progress.stalled ? <Flag kind="stalled">Stalled</Flag> : null}
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr_1fr]">
        <div>
          <p className="font-display text-3xl leading-none">{row.progress.percent}%</p>
          <p className="text-xs text-ink/55">
            {row.progress.completed}/{row.progress.total} modules
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">Current section</p>
          <p className="font-semibold">{section}</p>
          <p className="text-sm text-ink/70">{row.progress.currentModuleName ?? "Path complete"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">Next session</p>
          {row.progress.nextSession ? (
            <>
              <p className="font-semibold">{formatShortDate(row.progress.nextSession.date)}</p>
              <p className="text-sm text-ink/70">
                {row.progress.nextSession.moduleName}
                {row.progress.nextSession.trainer ? ` · ${row.progress.nextSession.trainer}` : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-ink/70">Nothing upcoming</p>
          )}
        </div>
      </div>
      <div className="mt-3">
        <ProgressBar value={row.progress.percent} tone={row.progress.stalled ? "sun" : "brick"} />
        <p className="mt-1 text-xs text-ink/50">
          {formatMinutes(row.progress.minutesDone)} of {formatMinutes(row.progress.minutesTotal)} on the row times
        </p>
      </div>
    </Link>
  );
}
