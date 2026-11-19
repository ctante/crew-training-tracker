import { formatShortDate, withParams } from "@/lib/format";

const CHOICES = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["tomorrow", "Tomorrow"],
  ["this-week", "This week"],
  ["last-week", "Last week"],
  ["next-week", "Next week"],
  ["this-month", "This month"],
  ["custom", "Custom"],
] as const;

export function DateRangeFilters({
  path,
  query,
  range,
  start,
  end,
  includeAll = false,
  preserve,
}: {
  path: string;
  query: Record<string, string>;
  range: string;
  start: string;
  end: string;
  includeAll?: boolean;
  preserve?: Record<string, string>;
}) {
  const choices = includeAll ? ([["all", "All dates"], ...CHOICES] as const) : CHOICES;
  const hidden = { ...query, ...preserve };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {choices.map(([value, label]) => (
          <a
            key={value}
            href={withParams(path, query, {
              range: value,
              from: value === "custom" ? start : null,
              to: value === "custom" ? end : null,
            })}
            className={`inline-flex min-h-10 items-center rounded-full border px-3 text-sm font-semibold ${
              range === value ? "border-bark bg-bark text-white" : "border-line bg-card text-ink"
            }`}
          >
            {label}
          </a>
        ))}
      </div>
      {range === "custom" ? (
        <form action={path} className="mt-3 flex flex-wrap items-end gap-2">
          {Object.entries(hidden)
            .filter(([key, value]) => value && key !== "from" && key !== "to" && key !== "range")
            .map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
          <input type="hidden" name="range" value="custom" />
          <label className="text-sm font-semibold">
            From
            <input className="mt-1 block min-h-11 rounded-2xl border border-line bg-card px-3" type="date" name="from" defaultValue={start} required />
          </label>
          <label className="text-sm font-semibold">
            To
            <input className="mt-1 block min-h-11 rounded-2xl border border-line bg-card px-3" type="date" name="to" defaultValue={end} required />
          </label>
          <button className="min-h-11 rounded-full bg-bark px-4 text-sm font-semibold text-white" type="submit">
            Apply
          </button>
        </form>
      ) : null}
      {range === "all" ? (
        <p className="mt-3 text-sm text-ink/60">All dates · Eastern Time</p>
      ) : (
        <p className="mt-3 text-sm text-ink/60">
          {formatShortDate(start)}
          {start === end ? "" : ` – ${formatShortDate(end)}`} · Eastern Time
        </p>
      )}
    </div>
  );
}
