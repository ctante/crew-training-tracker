import Link from "next/link";
import { Suspense } from "react";
import { CollapsibleSections } from "@/components/collapsible-sections";
import { DateRangeFilters } from "@/components/date-range-filters";
import { FilterSelect } from "@/components/filter-select";
import { TraineeSearch } from "@/components/trainee-search";
import { Flag, PageHeader, ProgressBar } from "@/components/ui";
import { languageName, SECTION_TITLES } from "@/lib/constants";
import { getDashboard, getScheduledSessions } from "@/lib/data";
import { formatMinutes, formatShortDate, one, storeLabel, withParams } from "@/lib/format";
import { sessionSurface } from "@/lib/session-tone";
import type { ScheduledSessionRow } from "@/lib/types";
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
  const view = one(params.view) === "sessions" ? "sessions" : "board";
  const range = one(params.range) || "today";
  const from = one(params.from);
  const to = one(params.to);
  const sessionTab = one(params.tab) || "scheduled";
  const data = await getDashboard({ storeNumber, status, flag, query });
  const sessions = view === "sessions" ? await getScheduledSessions({ storeNumber, range, from, to, query }) : null;
  const current = { store: storeNumber, status: status === "ACTIVE" ? "" : status, flag, q: query };
  const sessionQuery = {
    view: "sessions",
    store: storeNumber,
    tab: sessionTab,
    q: query,
    range: sessions?.range || range,
    from: sessions?.range === "custom" ? sessions.start : "",
    to: sessions?.range === "custom" ? sessions.end : "",
  };

  return (
    <div>
      <PageHeader
        kicker={formatShortDate(data.today)}
        title="Training board"
        description="Foundation plus Service or Production. Overdue sessions and stalled trainees rise to the top."
        actions={
          data.canManageTrainees ? (
            <Link href="/trainees/new" className="hidden min-h-11 items-center rounded-full bg-brick px-4 text-sm font-semibold text-white lg:inline-flex">
              Add trainee
            </Link>
          ) : null
        }
      />
      {reset ? (
        <p className="mb-4 rounded-2xl border border-amber-300 bg-sun/50 px-4 py-3 text-sm text-sun-deep">
          Sample trainees, restaurants, and the module path were restored.
        </p>
      ) : null}

      <div className="mb-4 flex gap-2">
        <Chip href={withParams("/", { store: storeNumber, q: query }, { view: null })} active={view === "board"}>
          Trainees
        </Chip>
        <Chip href={withParams("/", { store: storeNumber, q: query }, { view: "sessions" })} active={view === "sessions"}>
          Scheduled sessions
        </Chip>
      </div>

      {sessions ? (
        <SessionsPanel sessions={sessions} storeNumber={storeNumber} sessionQuery={sessionQuery} tab={sessionTab} />
      ) : (
        <TraineeBoard data={data} storeNumber={storeNumber} status={status} flag={flag} current={current} />
      )}
    </div>
  );
}

function TraineeBoard({
  data,
  storeNumber,
  status,
  flag,
  current,
}: {
  data: Awaited<ReturnType<typeof getDashboard>>;
  storeNumber: string;
  status: string;
  flag: string;
  current: Record<string, string>;
}) {
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="On this view" value={String(data.stats.shown)} hint="trainees" />
        <Stat label="Average complete" value={`${data.stats.average}%`} hint="Foundation plus their path" />
        <Stat label="Overdue sessions" value={String(data.stats.overdueSessions)} hint="scheduled, still open" tone="brick" />
        <Stat label="Stalled" value={String(data.stats.stalled)} hint="no movement in 14 days" tone="sun" />
      </section>
      {data.stats.needsPath > 0 ? (
        <p className="mt-3 rounded-2xl border border-amber-300 bg-sun/50 px-4 py-3 text-sm font-semibold text-sun-deep">
          {data.stats.needsPath} trainee{data.stats.needsPath === 1 ? "" : "s"} still need a path.{" "}
          <Link href={withParams("/", current, { flag: "path" })} className="underline">
            Show them
          </Link>
        </p>
      ) : null}
      {data.stats.dueToday > 0 ? (
        <p className="mt-3 rounded-2xl bg-sun/70 px-4 py-3 text-sm font-semibold text-sun-deep">
          {data.stats.dueToday} trainee{data.stats.dueToday === 1 ? "" : "s"} have a session due today.
        </p>
      ) : null}

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {data.locked ? null : (
          <Chip href={withParams("/", current, { store: null })} active={!storeNumber}>
            All restaurants
          </Chip>
        )}
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
            ["path", "Choose path"],
          ] as const
        ).map(([value, label]) => (
          <Chip key={label} href={withParams("/", current, { flag: value || null })} active={flag === value}>
            {label}
          </Chip>
        ))}
        <div className="ml-auto min-w-48 flex-1 sm:max-w-xs">
          <Suspense fallback={null}>
            <TraineeSearch />
          </Suspense>
        </div>
      </div>

      <div className="mt-5">
        {data.rows.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line bg-card px-5 py-10 text-center text-sm text-ink/70">
            No trainees match these filters.
          </p>
        ) : (
          <CollapsibleSections
            sections={data.stores
              .map((store) => ({
                store,
                rows: data.rows.filter((row) => row.storeNumber === store.number),
              }))
              .filter((group) => group.rows.length > 0)
              .map(({ store, rows }) => ({
                id: store.id,
                title: storeLabel(store.number),
                count: `${rows.length} trainee${rows.length === 1 ? "" : "s"}`,
                body: (
                  <div className="space-y-3">
                    {rows.map((row) => (
                      <TraineeRow key={row.id} row={row} />
                    ))}
                  </div>
                ),
              }))}
          />
        )}
      </div>
    </>
  );
}

function SessionsPanel({
  sessions,
  storeNumber,
  sessionQuery,
  tab,
}: {
  sessions: Awaited<ReturnType<typeof getScheduledSessions>>;
  storeNumber: string;
  sessionQuery: Record<string, string>;
  tab: string;
}) {
  const mode = tab === "overdue" || tab === "done" || tab === "all" ? tab : "scheduled";
  const shown =
    mode === "overdue"
      ? sessions.overdue
      : mode === "done"
        ? sessions.rows.filter((row) => row.completed)
        : mode === "all"
          ? sessions.rows
          : sessions.rows.filter((row) => !row.completed);
  const groups = groupByTrainee(shown);
  const tabs = [
    ["scheduled", `Scheduled ${sessions.counts.scheduled}`],
    ["overdue", `Overdue ${sessions.counts.overdue}`],
    ["done", `Done ${sessions.counts.done}`],
    ["all", `All ${sessions.counts.all}`],
  ] as const;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sessions.locked ? null : (
          <FilterSelect
            label="Restaurant"
            name="store"
            value={storeNumber}
            basePath="/"
            query={sessionQuery}
            options={[{ value: "", label: "All restaurants" }, ...sessions.stores.map((store) => ({ value: store.number, label: storeLabel(store.number) }))]}
          />
        )}
        <DateRangeFilters path="/" query={sessionQuery} range={sessions.range} start={sessions.start} end={sessions.end} />
        <FilterSelect
          label="List"
          name="tab"
          value={mode}
          basePath="/"
          query={sessionQuery}
          options={tabs.map(([value, label]) => ({ value, label }))}
        />
      </div>
      <div className="mt-3 max-w-xs">
        <Suspense fallback={null}>
          <TraineeSearch />
        </Suspense>
      </div>
      {mode === "overdue" ? (
        <p className="mt-3 text-sm text-ink/60">Dated before today and not done. The date range above does not change this list.</p>
      ) : (
        <p className="mt-3 text-sm text-ink/60">
          {shown.length} session{shown.length === 1 ? "" : "s"} in this list.
        </p>
      )}
      <div className="mt-4">
        {groups.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line bg-card px-5 py-10 text-center text-sm text-ink/70">
            No sessions in this list.
          </p>
        ) : (
          <CollapsibleSections
            sections={groups.map((group) => ({
              id: group.traineeId,
              title: group.traineeName,
              count: `${storeLabel(group.storeNumber)} · ${group.sessions.length} session${group.sessions.length === 1 ? "" : "s"}`,
              body: <TraineeSessions group={group} today={sessions.today} />,
            }))}
          />
        )}
      </div>
    </>
  );
}

function groupByTrainee(rows: ScheduledSessionRow[]) {
  const map = new Map<string, { traineeId: string; traineeName: string; storeNumber: string; pathLabel: string; sessions: ScheduledSessionRow[] }>();
  for (const row of rows) {
    const current = map.get(row.traineeId) ?? {
      traineeId: row.traineeId,
      traineeName: row.traineeName,
      storeNumber: row.storeNumber,
      pathLabel: row.pathLabel,
      sessions: [],
    };
    current.sessions.push(row);
    map.set(row.traineeId, current);
  }
  return [...map.values()]
    .map((group) => ({
      ...group,
      sessions: [...group.sessions].sort((a, b) => a.date.localeCompare(b.date) || a.moduleName.localeCompare(b.moduleName)),
    }))
    .sort((a, b) => a.storeNumber.localeCompare(b.storeNumber) || a.traineeName.localeCompare(b.traineeName));
}

function TraineeSessions({
  group,
  today,
}: {
  group: { traineeId: string; traineeName: string; storeNumber: string; pathLabel: string; sessions: ScheduledSessionRow[] };
  today: string;
}) {
  return (
    <div>
      <p className="mb-2 text-sm text-ink/60">
        <Link href={`/trainees/${group.traineeId}`} className="font-semibold text-campus">
          Open schedule
        </Link>
        {" · "}
        {group.pathLabel}
      </p>
      <ul className="divide-y divide-line">
        {group.sessions.map((row) => (
          <li
            key={row.id}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl px-2 py-2 text-sm ${sessionSurface({
              overdue: !row.completed && row.date < today,
              dueToday: !row.completed && row.date === today,
            })}`}
          >
            <span>
              <span className="font-semibold">{row.moduleName}</span>
              <span className="text-ink/60">
                {" "}
                · {formatShortDate(row.date)} · {row.trainerName || "No trainer"}
              </span>
            </span>
            <Flag kind={row.completed ? "done" : "today"}>{row.completed ? "Done" : "Not done"}</Flag>
          </li>
        ))}
      </ul>
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
      className={`block rounded-3xl border p-4 shadow-sm ${sessionSurface({
        overdue: row.progress.overdueCount > 0,
        stalled: row.progress.stalled,
        dueToday: row.progress.dueTodayCount > 0 && row.progress.overdueCount === 0 && !row.progress.stalled,
      })}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
            {storeLabel(row.storeNumber)} · {languageName(row.language)} · {row.pathLabel}
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
          {!row.path ? <Flag kind="review">Choose path</Flag> : null}
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
