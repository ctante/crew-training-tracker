import Link from "next/link";
import { Suspense } from "react";
import { FilterSelect } from "@/components/filter-select";
import { ScheduleGroups } from "@/components/schedule-groups";
import { TraineeSearch } from "@/components/trainee-search";
import { InactiveToggle } from "@/components/inactive-toggle";
import { PageHeader } from "@/components/ui";
import { groupByTrainerPosition } from "@/lib/constants";
import { access } from "@/lib/access";
import { getSchedule } from "@/lib/data";
import { formatMonth, formatShortDate, monthGrid, one, sessionWindow, shiftMonth, storeLabel, withParams } from "@/lib/format";

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
  const tab = one(params.tab) || "scheduled";
  const query = one(params.q);
  const range = one(params.range) || "today";
  const who = await access();
  const showInactive = who.role === "admin" && one(params.inactive) === "1";
  const data = await getSchedule({
    storeNumber,
    trainerId,
    month: one(params.month),
    query,
    showInactive,
  });
  const window = sessionWindow(data.today, range, one(params.from), one(params.to));
  const inWindow = (date: string) => date >= window.start && date <= window.end;
  const current = {
    inactive: showInactive ? "1" : "",
    store: storeNumber,
    trainer: trainerId,
    month: data.month,
    date: selected,
    tab,
    q: query,
    range: window.range,
    from: window.range === "custom" ? window.start : "",
    to: window.range === "custom" ? window.end : "",
  };
  const monthSessions = data.sessions.filter((session) => session.date.startsWith(data.month));
  const overdue = data.sessions.filter((session) => session.overdue);
  const upcoming = data.sessions.filter((session) => inWindow(session.date));
  const doneInRange = data.done.filter((session) => inWindow(session.date));
  const peopleByDay = new Map<string, Set<string>>();
  for (const session of monthSessions) {
    const people = peopleByDay.get(session.date) ?? new Set<string>();
    people.add(session.traineeId);
    peopleByDay.set(session.date, people);
  }
  const counts = new Map([...peopleByDay].map(([date, people]) => [date, people.size]));
  const cells = monthGrid(data.month);
  const store = data.locked ? data.stores[0] : data.stores.find((item) => item.number === storeNumber);

  return (
    <div>
      <PageHeader
        kicker="Agenda"
        title={store ? storeLabel(store.number) : "All Restaurants"}
        description={
          store
            ? `GM ${store.gmNames.join(", ") || "not listed"}. Sessions are a date and a trainer, the same way the ITS sheet records them.`
            : "Upcoming training dates that are scheduled and still open."
        }
      />
      <div className="mb-3">
        <InactiveToggle admin={who.role === "admin"} on={showInactive} path="/schedule" query={current} />
      </div>

      <div className="mb-4 max-w-xs">
        <Suspense fallback={null}>
          <TraineeSearch />
        </Suspense>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect
          label="Dates"
          name="range"
          value={window.range}
          basePath="/schedule"
          query={current}
          clear={["date"]}
          options={[
            { value: "today", label: "Today" },
            { value: "yesterday", label: "Yesterday" },
            { value: "tomorrow", label: "Tomorrow" },
            { value: "this-week", label: "This week" },
            { value: "last-week", label: "Last week" },
            { value: "next-week", label: "Next week" },
            { value: "this-month", label: "This month" },
            { value: "custom", label: "Custom" },
          ]}
        />
        {data.locked ? null : (
          <FilterSelect
            label="Restaurant"
            name="store"
            value={storeNumber}
            basePath="/schedule"
            query={current}
            clear={["trainer"]}
            options={[{ value: "", label: "All restaurants" }, ...data.stores.map((item) => ({ value: item.number, label: storeLabel(item.number) }))]}
          />
        )}
        <FilterSelect
          label="Trainer"
          name="trainer"
          value={trainerId}
          basePath="/schedule"
          query={current}
          options={[
            { value: "", label: "All qualified trainers" },
            ...groupByTrainerPosition(data.trainers).flatMap((group) =>
              group.people.map((trainer) => ({
                value: trainer.id,
                label: `${group.position} · ${storeNumber ? trainer.name : `${trainer.storeNumber} · ${trainer.name}`}`,
              })),
            ),
          ]}
        />
        <FilterSelect
          label="List"
          name="tab"
          value={tab === "overdue" || tab === "done" ? tab : "scheduled"}
          basePath="/schedule"
          query={current}
          options={[
            { value: "scheduled", label: `Scheduled ${upcoming.length}` },
            { value: "overdue", label: `Overdue ${overdue.length}` },
            { value: "done", label: `Done ${doneInRange.length}` },
          ]}
        />
      </div>
      {window.range === "custom" ? (
        <form action="/schedule" className="mt-3 flex flex-wrap items-end gap-2">
          {storeNumber ? <input type="hidden" name="store" value={storeNumber} /> : null}
          {trainerId ? <input type="hidden" name="trainer" value={trainerId} /> : null}
          {query ? <input type="hidden" name="q" value={query} /> : null}
          <input type="hidden" name="tab" value={tab} />
          <input type="hidden" name="range" value="custom" />
          <label className="text-sm font-semibold">
            From
            <input className="mt-1 block min-h-11 rounded-2xl border border-line bg-white px-3" type="date" name="from" defaultValue={window.start} required />
          </label>
          <label className="text-sm font-semibold">
            To
            <input className="mt-1 block min-h-11 rounded-2xl border border-line bg-white px-3" type="date" name="to" defaultValue={window.end} required />
          </label>
          <button className="min-h-11 rounded-full bg-bark px-4 text-sm font-semibold text-white" type="submit">
            Apply
          </button>
        </form>
      ) : null}

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
              href={withParams("/schedule", current, { date: iso, range: "custom", from: iso, to: iso })}
              className={`flex min-h-14 flex-col items-center justify-center rounded-2xl border text-sm ${
                isSelected ? "border-bark bg-bark text-white" : isToday ? "border-green-300 bg-green-100" : dayOverdue ? "border-red-300 bg-red-100" : "border-line bg-card"
              }`}
            >
              <span className="font-semibold">{Number(iso.slice(-2))}</span>
              {count > 0 ? <span className={`text-[11px] ${isSelected ? "text-sun" : "text-ink/60"}`}>{count}</span> : null}
            </Link>
          );
        })}
      </div>

      <section className="mt-6">
        {tab === "overdue" ? (
          <p className="text-sm text-ink/60">Dated before today and not done. The date menu does not change this list.</p>
        ) : (
          <p className="text-sm text-ink/60">
            {formatShortDate(window.start)}
            {window.start === window.end ? "" : ` – ${formatShortDate(window.end)}`} · Eastern Time
          </p>
        )}
        <h2 className="mt-4 font-display text-2xl">
          {tab === "overdue" ? "Overdue" : tab === "done" ? "Done" : "Scheduled"}
        </h2>
        <ScheduleGroups
          sessions={tab === "overdue" ? overdue : tab === "done" ? doneInRange : upcoming}
          empty={tab === "overdue" ? "No overdue sessions." : tab === "done" ? "No completed sessions in these dates." : "No open sessions in these dates."}
        />
      </section>
    </div>
  );
}

