import Link from "next/link";
import { Flag, PageHeader } from "@/components/ui";
import { groupByTrainerPosition } from "@/lib/constants";
import { getSchedule } from "@/lib/data";
import { formatMonth, formatShortDate, monthGrid, one, shiftMonth, storeLabel, withParams } from "@/lib/format";
import type { ScheduleSession } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Schedule" };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const storeNumber = one(params.store);
  const trainerId = one(params.trainer);
  const selected = one(params.date);
  const data = await getSchedule({
    storeNumber,
    trainerId,
    month: one(params.month),
  });
  const current = { store: storeNumber, trainer: trainerId, month: data.month };
  const monthSessions = data.sessions.filter((session) => session.date.startsWith(data.month));
  const overdue = data.sessions.filter((session) => session.overdue);
  const upcoming = monthSessions.filter((session) => session.date >= data.today);
  const counts = new Map<string, number>();
  for (const session of monthSessions) counts.set(session.date, (counts.get(session.date) ?? 0) + 1);
  const cells = monthGrid(data.month);
  const focus = selected && selected.startsWith(data.month) ? upcoming.filter((session) => session.date === selected).concat(
    monthSessions.filter((session) => session.date === selected && session.overdue),
  ) : null;
  const store = data.stores.find((item) => item.number === storeNumber);
  const grouped = groupByDate(focus ?? upcoming);

  return (
    <div>
      <PageHeader
        kicker="Agenda"
        title={store ? storeLabel(store.number) : "All restaurants"}
        description={
          store
            ? `GM ${store.gmNames.join(", ") || "not listed"}. Sessions are a date and a trainer, the same way the ITS sheet records them.`
            : "Upcoming training dates that are scheduled and still open."
        }
      />

      <div className="flex gap-2 overflow-x-auto pb-2">
        <Filter href={withParams("/schedule", current, { store: null, trainer: null })} active={!storeNumber}>
          All
        </Filter>
        {data.stores.map((item) => (
          <Filter
            key={item.number}
            href={withParams("/schedule", current, { store: item.number, trainer: null })}
            active={storeNumber === item.number}
          >
            {storeLabel(item.number)}
          </Filter>
        ))}
      </div>

      <form className="mt-3 flex flex-wrap items-end gap-3" action="/schedule">
        {storeNumber ? <input type="hidden" name="store" value={storeNumber} /> : null}
        <input type="hidden" name="month" value={data.month} />
        <label className="text-sm font-semibold">
          Trainer
          <select className="mt-1 min-h-11 max-w-full rounded-full border border-line bg-card px-3 text-sm" name="trainer" defaultValue={trainerId}>
            <option value="">All qualified trainers</option>
            {groupByTrainerPosition(data.trainers).map((group) => (
              <optgroup key={group.position} label={group.position}>
                {group.people.map((trainer) => (
                  <option key={trainer.id} value={trainer.id}>
                    {storeNumber ? trainer.name : `${trainer.storeNumber} · ${trainer.name}`}
                    {trainer.isGm ? " · GM" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <button className="min-h-11 rounded-full bg-bark px-4 text-sm font-semibold text-white" type="submit">
          Apply
        </button>
      </form>

      <div className="mt-5 flex items-center justify-between">
        <h2 className="font-display text-3xl">{formatMonth(data.month)}</h2>
        <div className="flex gap-2">
          <Link className="rounded-full border border-line bg-card px-3 py-2 text-sm font-semibold" href={withParams("/schedule", current, { month: shiftMonth(data.month, -1), date: null })}>
            Previous
          </Link>
          <Link className="rounded-full border border-line bg-card px-3 py-2 text-sm font-semibold" href={withParams("/schedule", current, { month: shiftMonth(data.month, 1), date: null })}>
            Next
          </Link>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink/50">
        {WEEKDAYS.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((iso, index) => {
          if (!iso) return <div key={`empty-${index}`} className="min-h-14" />;
          const count = counts.get(iso) ?? 0;
          const isToday = iso === data.today;
          const isSelected = iso === selected;
          const dayOverdue = monthSessions.some((session) => session.date === iso && session.overdue);
          return (
            <Link
              key={iso}
              href={withParams("/schedule", current, { date: iso })}
              className={`flex min-h-14 flex-col items-center justify-center rounded-2xl border text-sm ${
                isSelected ? "border-bark bg-bark text-white" : dayOverdue ? "border-brick/40 bg-red-50" : "border-line bg-card"
              } ${isToday && !isSelected ? "ring-2 ring-sun" : ""}`}
            >
              <span className="font-semibold">{Number(iso.slice(-2))}</span>
              {count > 0 ? <span className={`text-[11px] ${isSelected ? "text-sun" : "text-ink/60"}`}>{count}</span> : null}
            </Link>
          );
        })}
      </div>

      {overdue.length > 0 ? (
        <section className="mt-6">
          <h2 className="font-display text-2xl text-brick">Still open from earlier dates</h2>
          <div className="mt-2 space-y-2">
            {overdue.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="font-display text-2xl">{selected ? formatShortDate(selected) : "Coming up this month"}</h2>
        {grouped.length === 0 ? (
          <p className="mt-2 rounded-3xl border border-dashed border-line bg-card px-4 py-8 text-center text-sm text-ink/70">
            No open sessions on this view. Set a training date from a trainee page.
          </p>
        ) : (
          grouped.map(([date, sessions]) => (
            <div key={date} className="mt-3">
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-ink/50">{formatShortDate(date)}</h3>
              <div className="mt-2 space-y-2">
                {sessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function groupByDate(sessions: ScheduleSession[]) {
  const map = new Map<string, ScheduleSession[]>();
  for (const session of sessions) {
    map.set(session.date, [...(map.get(session.date) ?? []), session]);
  }
  return [...map.entries()];
}

function Filter({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-3 text-sm font-semibold ${
        active ? "border-bark bg-bark text-white" : "border-line bg-card"
      }`}
    >
      {children}
    </Link>
  );
}

function SessionCard({ session }: { session: ScheduleSession }) {
  return (
    <Link
      href={`/trainees/${session.traineeId}#module-${session.sortOrder}`}
      className={`block rounded-3xl border bg-card px-4 py-3 shadow-sm ${session.overdue ? "border-brick/40" : session.dueToday ? "border-sun" : "border-line"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
            {storeLabel(session.storeNumber)} · {session.sectionTitle}
            {session.timeLabel ? ` · ${session.timeLabel}` : ""}
          </p>
          <p className="font-semibold">{session.traineeName}</p>
          <p className="text-sm text-ink/75">{session.moduleName}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {session.overdue ? <Flag kind="overdue">Overdue</Flag> : null}
          {session.dueToday ? <Flag kind="today">Due today</Flag> : null}
          {session.traineeStatus === "PAUSED" ? <Flag kind="paused">Paused</Flag> : null}
          <Flag kind={session.kind === "campus" ? "campus" : session.kind === "app" ? "app" : "floor"}>
            {session.kind === "campus" ? "Campus" : session.kind === "app" ? "App" : "Floor"}
          </Flag>
        </div>
      </div>
      <p className="mt-1 text-sm text-ink/70">
        {session.trainerName ? session.trainerName : "Trainer not assigned"}
        {session.trainerIsGm ? " · GM" : ""}
      </p>
    </Link>
  );
}
