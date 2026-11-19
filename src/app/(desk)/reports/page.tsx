import Link from "next/link";
import { DateRangeFilters } from "@/components/date-range-filters";
import { StoreMultiSelect } from "@/components/store-multi-select";
import { PageHeader, ghostButton } from "@/components/ui";
import { formatShortDate, many, one, storeLabel, withParams } from "@/lib/format";
import { getReports, type ReportKind } from "@/lib/reports";

export const dynamic = "force-dynamic";

export const metadata = { title: "Reports" };

const TABS: { id: ReportKind; label: string }[] = [
  { id: "completion", label: "Completion" },
  { id: "overdue", label: "Overdue" },
  { id: "trainers", label: "Trainers" },
  { id: "time", label: "Time to complete" },
  { id: "path", label: "Needs a path" },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const report = (TABS.some((tab) => tab.id === one(params.report)) ? one(params.report) : "completion") as ReportKind;
  const requested = many(params.store);
  const entire = one(params.org) === "1" || requested.length === 0;
  const range = one(params.range) || "all";
  const data = await getReports({
    storeNumbers: requested,
    entireOrg: entire,
    range,
    from: one(params.from),
    to: one(params.to),
  });
  const query = {
    report,
    range: data.range,
    from: data.range === "custom" ? data.start : "",
    to: data.range === "custom" ? data.end : "",
    org: data.entireOrg ? "1" : "",
    store: data.entireOrg || data.locked ? "" : data.selected.join(","),
  };
  const csv = new URLSearchParams();
  csv.set("report", report);
  if (data.entireOrg) csv.set("org", "1");
  else data.selected.forEach((number) => csv.append("store", number));
  if (data.range !== "all") csv.set("range", data.range);
  if (data.range === "custom") {
    csv.set("from", data.start);
    csv.set("to", data.end);
  }

  return (
    <div>
      <PageHeader
        kicker="Reports"
        title={TABS.find((tab) => tab.id === report)?.label ?? "Reports"}
        description={description(report)}
        actions={
          <a className={ghostButton} href={`/api/reports?${csv.toString()}`}>
            Download CSV
          </a>
        }
      />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={withParams("/reports", query, { report: tab.id })}
            className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-3 text-sm font-semibold ${
              report === tab.id ? "border-bark bg-bark text-white" : "border-line bg-card"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {data.locked ? (
        <p className="mb-4 text-sm text-ink/70">Showing {storeLabel(data.selected[0] ?? "")} only.</p>
      ) : (
        <div className="mb-4">
          <StoreMultiSelect
            stores={data.stores}
            selected={data.selected}
            entireOrg={data.entireOrg}
            hidden={{ report, range: data.range === "all" ? "" : data.range, from: query.from, to: query.to }}
          />
        </div>
      )}
      {report === "trainers" || report === "time" ? (
        <DateRangeFilters path="/reports" query={query} range={data.range} start={data.start} end={data.end} includeAll />
      ) : (
        <p className="text-sm text-ink/60">Current snapshot. This report does not use the date range.</p>
      )}
      <div className="mt-5">{renderReport(report, data)}</div>
    </div>
  );
}

function description(report: ReportKind) {
  if (report === "completion") return "Trainees, average percent complete, how many finished, how many are still in progress, and overdue sessions.";
  if (report === "overdue") return "Sessions dated before today that are not done, by restaurant and by trainer.";
  if (report === "trainers") return "Sessions marked done in the selected dates, counted for each trainer.";
  if (report === "time") return "Days from the start date to Foundation done, and to the first path done.";
  return "Trainees who still need a Service or Production path.";
}

function renderReport(report: ReportKind, data: Awaited<ReturnType<typeof getReports>>) {
  if (report === "completion") {
    return (
      <Table
        headers={["Store", "Trainees", "Avg %", "Completed", "In progress", "Overdue sessions"]}
        rows={[
          ...data.completion.map((row) => [
            storeLabel(row.storeNumber),
            row.trainees,
            `${row.average}%`,
            row.completed,
            row.inProgress,
            row.overdueSessions,
          ]),
          [
            data.completionTotal.storeNumber,
            data.completionTotal.trainees,
            `${data.completionTotal.average}%`,
            data.completionTotal.completed,
            data.completionTotal.inProgress,
            data.completionTotal.overdueSessions,
          ],
        ]}
      />
    );
  }
  if (report === "overdue") {
    return (
      <div className="space-y-6">
        <section>
          <h2 className="font-display text-2xl">By restaurant</h2>
          <Table
            headers={["Store", "Overdue sessions"]}
            rows={[
              ...data.overdueByStore.map((row) => [storeLabel(row.storeNumber), row.count]),
              [data.completionTotal.storeNumber, data.overdueTotal],
            ]}
          />
        </section>
        <section>
          <h2 className="font-display text-2xl">By trainer</h2>
          <Table
            headers={["Store", "Trainer", "Overdue sessions"]}
            rows={[
              ...data.overdueByTrainer.map((row) => [storeLabel(row.storeNumber), row.label, row.count]),
              [data.completionTotal.storeNumber, "Total", data.overdueTotal],
            ]}
          />
        </section>
      </div>
    );
  }
  if (report === "trainers") {
    return (
      <Table
        headers={["Store", "Trainer", "Sessions completed"]}
        rows={[
          ...data.trainerActivity.map((row) => [storeLabel(row.storeNumber), row.label, row.count]),
          [data.completionTotal.storeNumber, "Total", data.trainerActivityTotal],
        ]}
      />
    );
  }
  if (report === "time") {
    return (
      <Table
        headers={["Store", "Trainee", "Start", "Foundation done", "Path done", "Days to Foundation", "Days to path"]}
        rows={data.timeRows.map((row) => [
          row.kind === "trainee" ? storeLabel(row.storeNumber) : row.storeNumber,
          row.traineeName,
          row.startDate ? formatShortDate(row.startDate) : "",
          row.foundationDone ? formatShortDate(row.foundationDone) : "",
          row.pathDone ? formatShortDate(row.pathDone) : "",
          row.daysToFoundation ?? "—",
          row.daysToPath ?? "—",
        ])}
      />
    );
  }
  return (
    <Table
      headers={["Store", "Trainee", "Start", "Foundation %"]}
      rows={[
        ...data.needingPath.map((row) => [
          storeLabel(row.storeNumber),
          row.traineeName,
          formatShortDate(row.startDate),
          `${row.foundationPercent}%`,
        ]),
        [data.completionTotal.storeNumber, `${data.needingPath.length} trainees`, "", ""],
      ]}
    />
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-line bg-card">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-ink/50">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-3 font-bold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-ink/60" colSpan={headers.length}>
                Nothing in this selection.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={`${row.join("-")}-${index}`} className={index === rows.length - 1 ? "border-t border-line font-semibold" : "border-t border-line/70"}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
