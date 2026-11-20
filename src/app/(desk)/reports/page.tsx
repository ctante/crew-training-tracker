import Link from "next/link";
import { CollapsibleSections } from "@/components/collapsible-sections";
import { InactiveToggle } from "@/components/inactive-toggle";
import { DateRangeFilters } from "@/components/date-range-filters";
import { StoreMultiSelect } from "@/components/store-multi-select";
import { PageHeader, ghostButton } from "@/components/ui";
import { formatShortDate, many, one, storeLabel, withParams } from "@/lib/format";
import { access } from "@/lib/access";
import { getReports, type ReportKind } from "@/lib/reports";

export const dynamic = "force-dynamic";

export const metadata = { title: "Reports" };

const TABS: { id: ReportKind; label: string }[] = [
  { id: "completion", label: "Completion" },
  { id: "overdue", label: "Overdue" },
  { id: "trainers", label: "Trainers" },
  { id: "time", label: "Time to Complete" },
  { id: "path", label: "Needs a Path" },
  { id: "modules", label: "By Module" },
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
  const who = await access();
  const showInactive = who.role === "admin" && one(params.inactive) === "1";
  const data = await getReports({
    storeNumbers: requested,
    entireOrg: entire,
    range,
    from: one(params.from),
    to: one(params.to),
    showInactive,
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
      <div className="mb-3">
        <InactiveToggle admin={who.role === "admin"} on={showInactive} path="/reports" query={query} />
      </div>
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
            allLabel={data.orgWide ? "Entire org" : "Your restaurants"}
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
  if (report === "modules") return "Each module, only for trainees whose path includes it. Open a module to see who is done and who is not.";
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
          <h2 className="font-display text-2xl">By Restaurant</h2>
          <Table
            headers={["Store", "Overdue Sessions"]}
            rows={[
              ...data.overdueByStore.map((row) => [storeLabel(row.storeNumber), row.count]),
              [data.completionTotal.storeNumber, data.overdueTotal],
            ]}
          />
        </section>
        <section>
          <h2 className="font-display text-2xl">By Trainer</h2>
          <Table
            headers={["Store", "Trainer", "Overdue Sessions"]}
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
  if (report === "modules") return <ModuleReport rows={data.moduleRows} />;
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

function ModuleReport({ rows }: { rows: Awaited<ReturnType<typeof getReports>>["moduleRows"] }) {
  const sections = ["ORIENTATION", "FOUNDATION", "SERVICE", "PRODUCTION"] as const;
  return (
    <CollapsibleSections
      sections={sections.map((section) => {
        const items = rows.filter((row) => row.section === section);
        const title = items[0]?.sectionTitle ?? section;
        return {
          id: section,
          title,
          count: `${items.length} module${items.length === 1 ? "" : "s"}`,
          body:
            items.length === 0 ? (
              <p className="text-sm text-ink/60">No modules in this section yet.</p>
            ) : (
              <div className="space-y-2">
                {items.map((row) => (
                  <details key={`${row.section}-${row.sortOrder}`} className="rounded-3xl border border-line bg-card p-4">
                    <summary className="cursor-pointer">
                      <span className="font-semibold">{row.name}</span>
                      <span className="mt-1 block text-sm text-ink/70">
                        {row.percent}% · {row.completed} completed · {row.notCompleted} not completed · {row.eligible} on this path · {row.scheduled} scheduled · {row.overdue} overdue
                      </span>
                    </summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <NameList title="Completed" names={row.completedNames} />
                      <NameList title="Not Completed" names={row.openNames} />
                    </div>
                  </details>
                ))}
              </div>
            ),
        };
      })}
    />
  );
}

function NameList({ title, names }: { title: string; names: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {names.length === 0 ? (
        <p className="mt-1 text-sm text-ink/60">None</p>
      ) : (
        <ul className="mt-1 space-y-1 text-sm">
          {names.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )}
    </div>
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
