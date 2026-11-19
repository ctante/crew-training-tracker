import { redirect } from "next/navigation";
import { access, allows, canSeeManyStores, visibleStoreNumbers } from "./access";
import { toCsv } from "./csv";
import { SECTION_TITLES, type SectionId } from "./constants";
import { prisma } from "./db";
import { daysBetween, selectReportStores, sessionWindow, todayIso } from "./format";
import { summarize, trainingPaths, type TrainingPath } from "./progress";

export const REPORTS = ["completion", "overdue", "trainers", "time", "path", "modules"] as const;
export type ReportKind = (typeof REPORTS)[number];

export type CompletionRow = {
  storeNumber: string;
  trainees: number;
  average: number;
  completed: number;
  inProgress: number;
  overdueSessions: number;
};

export type CountRow = {
  storeNumber: string;
  label: string;
  count: number;
};

export type TimeRow = {
  storeNumber: string;
  traineeName: string;
  startDate: string;
  foundationDone: string;
  pathDone: string;
  daysToFoundation: number | null;
  daysToPath: number | null;
  kind: "trainee" | "store" | "total";
};

export type PathNeedRow = {
  storeNumber: string;
  traineeName: string;
  startDate: string;
  foundationPercent: number;
};

export type ModuleReportRow = {
  section: SectionId;
  sectionTitle: string;
  name: string;
  sortOrder: number;
  eligible: number;
  completed: number;
  notCompleted: number;
  scheduled: number;
  overdue: number;
  percent: number;
  completedNames: string[];
  openNames: string[];
};

type TraineeBundle = {
  id: string;
  name: string;
  startDate: string;
  status: string;
  language: string;
  path: string | null;
  secondPath: string | null;
  firstPathCompletedOn: string | null;
  storeNumber: string;
  paths: TrainingPath[];
  scheduleComplete: boolean;
  percent: number;
  foundationDone: string;
  foundationPercent: number;
  pathDone: string;
  overdue: { trainerName: string; date: string }[];
  completedInRange: { trainerName: string; date: string }[];
};

function asSection(value: string): SectionId {
  if (value === "ORIENTATION" || value === "SERVICE" || value === "PRODUCTION") return value;
  return "FOUNDATION";
}

function sectionOnPath(section: SectionId, paths: TrainingPath[]): boolean {
  if (section === "ORIENTATION" || section === "FOUNDATION") return true;
  return paths.includes(section as TrainingPath);
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export async function getReports(filters: {
  storeNumbers: string[];
  entireOrg: boolean;
  range?: string;
  from?: string;
  to?: string;
}) {
  const who = await access();
  if (!allows(who, "reports")) redirect("/");
  const today = todayIso();
  const window =
    !filters.range || filters.range === "all"
      ? { range: "all" as const, start: "1970-01-01", end: "2999-12-31" }
      : sessionWindow(today, filters.range, filters.from, filters.to);
  const allStores = await prisma.store.findMany({ orderBy: { number: "asc" } });
  const allowed = visibleStoreNumbers(who);
  const known = allStores.map((store) => store.number).filter((number) => !allowed || allowed.includes(number));
  const selected = selectReportStores({
    role: canSeeManyStores(who) ? "admin" : "store",
    ownStore: canSeeManyStores(who) ? undefined : visibleStoreNumbers(who)?.[0],
    requested: filters.storeNumbers,
    entireOrg: filters.entireOrg,
    known,
  });
  const trainees = await prisma.trainee.findMany({
    where: { store: { number: { in: selected } } },
    include: { store: true, modules: { include: { module: true } } },
    orderBy: [{ store: { number: "asc" } }, { name: "asc" }],
  });
  const bundles: TraineeBundle[] = trainees.map((trainee) => {
    const paths = trainingPaths(trainee.path, trainee.secondPath);
    const visible = trainee.modules.filter(
      (row) => row.module.language === trainee.language && !row.module.archived,
    );
    const snaps = visible.map((row) => ({
      sortOrder: row.module.sortOrder,
      section: asSection(row.module.section),
      name: row.module.name,
      timeMinutes: row.module.timeMinutes,
      completed: row.completed,
      completedDate: row.completedDate,
      scheduledDate: row.scheduledDate,
      trainerLabel: row.trainerLabel,
    }));
    const progress = summarize(snaps, { startDate: trainee.startDate, status: trainee.status, today, paths });
    const foundation = summarize(
      snaps.filter((row) => row.section === "FOUNDATION"),
      { startDate: trainee.startDate, status: trainee.status, today, paths: [] },
    );
    const foundationDates = snaps
      .filter((row) => row.section === "FOUNDATION" && row.completed && row.completedDate)
      .map((row) => row.completedDate as string)
      .sort();
    const foundationDone =
      foundation.total > 0 && foundation.completed === foundation.total ? foundationDates.at(-1) ?? "" : "";
    const scheduleComplete = paths.length > 0 && progress.total > 0 && progress.completed === progress.total;
    const pathDone = trainee.firstPathCompletedOn || (scheduleComplete ? progress.lastCompletedDate ?? "" : "");
    const onPath = (section: SectionId) => sectionOnPath(section, paths);
    return {
      id: trainee.id,
      name: trainee.name,
      startDate: trainee.startDate,
      status: trainee.status,
      language: trainee.language,
      path: trainee.path,
      secondPath: trainee.secondPath,
      firstPathCompletedOn: trainee.firstPathCompletedOn,
      storeNumber: trainee.store.number,
      paths,
      scheduleComplete,
      percent: progress.percent,
      foundationDone,
      foundationPercent: foundation.percent,
      pathDone,
      overdue: visible
        .filter(
          (row) =>
            onPath(asSection(row.module.section)) &&
            !row.completed &&
            row.scheduledDate &&
            row.scheduledDate < today,
        )
        .map((row) => ({ trainerName: row.trainerLabel || "No trainer", date: row.scheduledDate! })),
      completedInRange: visible
        .filter(
          (row) =>
            onPath(asSection(row.module.section)) &&
            row.completed &&
            row.completedDate &&
            row.completedDate >= window.start &&
            row.completedDate <= window.end,
        )
        .map((row) => ({ trainerName: row.trainerLabel || "No trainer", date: row.completedDate! })),
    };
  });

  const completion: CompletionRow[] = selected.map((storeNumber) => {
    const people = bundles.filter((row) => row.storeNumber === storeNumber);
    const overdueSessions = people.reduce((sum, row) => sum + row.overdue.length, 0);
    const completed = people.filter((row) => row.scheduleComplete).length;
    return {
      storeNumber,
      trainees: people.length,
      average: people.length ? Math.round(people.reduce((sum, row) => sum + row.percent, 0) / people.length) : 0,
      completed,
      inProgress: people.length - completed,
      overdueSessions,
    };
  });
  const completionTotal: CompletionRow = {
    storeNumber: !canSeeManyStores(who)
      ? "Total"
      : selected.length === known.length
        ? who.role === "admin"
          ? "Entire org"
          : "Your restaurants"
        : "Selected stores",
    trainees: completion.reduce((sum, row) => sum + row.trainees, 0),
    average: bundles.length ? Math.round(bundles.reduce((sum, row) => sum + row.percent, 0) / bundles.length) : 0,
    completed: completion.reduce((sum, row) => sum + row.completed, 0),
    inProgress: completion.reduce((sum, row) => sum + row.inProgress, 0),
    overdueSessions: completion.reduce((sum, row) => sum + row.overdueSessions, 0),
  };

  const overdueByStore: CountRow[] = completion.map((row) => ({
    storeNumber: row.storeNumber,
    label: "",
    count: row.overdueSessions,
  }));
  const trainerCounts = new Map<string, CountRow>();
  for (const person of bundles) {
    for (const session of person.overdue) {
      const key = `${person.storeNumber}|${session.trainerName}`;
      const current = trainerCounts.get(key) ?? {
        storeNumber: person.storeNumber,
        label: session.trainerName,
        count: 0,
      };
      current.count += 1;
      trainerCounts.set(key, current);
    }
  }
  const overdueByTrainer = [...trainerCounts.values()].sort(
    (a, b) => a.storeNumber.localeCompare(b.storeNumber) || b.count - a.count || a.label.localeCompare(b.label),
  );

  const activityCounts = new Map<string, CountRow>();
  for (const person of bundles) {
    for (const session of person.completedInRange) {
      const key = `${person.storeNumber}|${session.trainerName}`;
      const current = activityCounts.get(key) ?? {
        storeNumber: person.storeNumber,
        label: session.trainerName,
        count: 0,
      };
      current.count += 1;
      activityCounts.set(key, current);
    }
  }
  const trainerActivity = [...activityCounts.values()].sort(
    (a, b) => a.storeNumber.localeCompare(b.storeNumber) || b.count - a.count || a.label.localeCompare(b.label),
  );

  const timeRows: TimeRow[] = [];
  for (const storeNumber of selected) {
    const people = bundles.filter((row) => row.storeNumber === storeNumber);
    for (const person of people) {
      timeRows.push({
        storeNumber,
        traineeName: person.name,
        startDate: person.startDate,
        foundationDone: person.foundationDone,
        pathDone: person.pathDone,
        daysToFoundation: person.foundationDone ? daysBetween(person.startDate, person.foundationDone) : null,
        daysToPath: person.pathDone ? daysBetween(person.startDate, person.pathDone) : null,
        kind: "trainee",
      });
    }
    const foundationDays = people
      .map((person) => (person.foundationDone ? daysBetween(person.startDate, person.foundationDone) : null))
      .filter((value): value is number => value !== null);
    const pathDays = people
      .map((person) => (person.pathDone ? daysBetween(person.startDate, person.pathDone) : null))
      .filter((value): value is number => value !== null);
    timeRows.push({
      storeNumber,
      traineeName: "Store average",
      startDate: "",
      foundationDone: "",
      pathDone: "",
      daysToFoundation: average(foundationDays),
      daysToPath: average(pathDays),
      kind: "store",
    });
  }
  const allFoundation = timeRows
    .filter((row) => row.kind === "trainee" && row.daysToFoundation !== null)
    .map((row) => row.daysToFoundation as number);
  const allPath = timeRows
    .filter((row) => row.kind === "trainee" && row.daysToPath !== null)
    .map((row) => row.daysToPath as number);
  timeRows.push({
    storeNumber: completionTotal.storeNumber,
    traineeName: "Combined average",
    startDate: "",
    foundationDone: "",
    pathDone: "",
    daysToFoundation: average(allFoundation),
    daysToPath: average(allPath),
    kind: "total",
  });

  const catalog = await prisma.module.findMany({
    where: { archived: false },
    orderBy: [{ sortOrder: "asc" }, { language: "asc" }],
  });
  const moduleStats = new Map<string, ModuleReportRow>();
  for (const item of catalog) {
    const section = asSection(item.section);
    const key = `${section}:${item.sortOrder}`;
    const current = moduleStats.get(key);
    if (current && item.language !== "en") continue;
    moduleStats.set(key, {
      section,
      sectionTitle: SECTION_TITLES.en[section],
      name: item.name,
      sortOrder: item.sortOrder,
      eligible: 0,
      completed: 0,
      notCompleted: 0,
      scheduled: 0,
      overdue: 0,
      percent: 0,
      completedNames: [],
      openNames: [],
    });
  }
  for (const trainee of trainees) {
    const paths = trainingPaths(trainee.path, trainee.secondPath);
    for (const row of trainee.modules) {
      if (row.module.archived || row.module.language !== trainee.language) continue;
      const section = asSection(row.module.section);
      if (!sectionOnPath(section, paths)) continue;
      const stat = moduleStats.get(`${section}:${row.module.sortOrder}`);
      if (!stat) continue;
      const label = `${trainee.store.number} · ${trainee.name}`;
      stat.eligible += 1;
      if (row.completed) {
        stat.completed += 1;
        stat.completedNames.push(label);
      } else {
        stat.notCompleted += 1;
        stat.openNames.push(label);
        if (row.scheduledDate) stat.scheduled += 1;
        if (row.scheduledDate && row.scheduledDate < today) stat.overdue += 1;
      }
    }
  }
  const sectionOrder: SectionId[] = ["ORIENTATION", "FOUNDATION", "SERVICE", "PRODUCTION"];
  const moduleRows = [...moduleStats.values()]
    .map((row) => ({
      ...row,
      percent: row.eligible ? Math.round((row.completed / row.eligible) * 100) : 0,
      completedNames: row.completedNames.sort(),
      openNames: row.openNames.sort(),
    }))
    .sort((a, b) => sectionOrder.indexOf(a.section) - sectionOrder.indexOf(b.section) || a.sortOrder - b.sortOrder);

  const needingPath: PathNeedRow[] = bundles
    .filter((row) => row.paths.length === 0)
    .map((row) => ({
      storeNumber: row.storeNumber,
      traineeName: row.name,
      startDate: row.startDate,
      foundationPercent: row.foundationPercent,
    }));

  return {
    today,
    locked: !canSeeManyStores(who),
    entireOrg: canSeeManyStores(who) && selected.length === known.length,
    orgWide: who.role === "admin",
    stores: known,
    selected,
    range: window.range,
    start: window.start,
    end: window.end,
    completion,
    completionTotal,
    overdueByStore,
    overdueByTrainer,
    overdueTotal: overdueByStore.reduce((sum, row) => sum + row.count, 0),
    trainerActivity,
    trainerActivityTotal: trainerActivity.reduce((sum, row) => sum + row.count, 0),
    timeRows,
    needingPath,
    moduleRows,
  };
}

export type ReportData = Awaited<ReturnType<typeof getReports>>;

function dash(value: number | null): string {
  return value === null ? "" : String(value);
}

export function reportCsv(kind: ReportKind, data: ReportData): { filename: string; csv: string } {
  if (kind === "completion") {
    const rows = [
      ["Store", "Trainees", "Average percent", "Completed", "In progress", "Overdue sessions"],
      ...data.completion.map((row) => [
        row.storeNumber,
        String(row.trainees),
        String(row.average),
        String(row.completed),
        String(row.inProgress),
        String(row.overdueSessions),
      ]),
      [
        data.completionTotal.storeNumber,
        String(data.completionTotal.trainees),
        String(data.completionTotal.average),
        String(data.completionTotal.completed),
        String(data.completionTotal.inProgress),
        String(data.completionTotal.overdueSessions),
      ],
    ];
    return { filename: "completion-by-store.csv", csv: toCsv(rows) };
  }
  if (kind === "overdue") {
    const rows = [
      ["Group", "Store", "Trainer", "Overdue sessions"],
      ...data.overdueByStore.map((row) => ["Store", row.storeNumber, "", String(row.count)]),
      ["Store", data.completionTotal.storeNumber, "", String(data.overdueTotal)],
      ...data.overdueByTrainer.map((row) => ["Trainer", row.storeNumber, row.label, String(row.count)]),
      ["Trainer", data.completionTotal.storeNumber, "", String(data.overdueTotal)],
    ];
    return { filename: "overdue-sessions.csv", csv: toCsv(rows) };
  }
  if (kind === "trainers") {
    const rows = [
      ["Store", "Trainer", "Sessions completed"],
      ...data.trainerActivity.map((row) => [row.storeNumber, row.label, String(row.count)]),
      [data.completionTotal.storeNumber, "", String(data.trainerActivityTotal)],
    ];
    return { filename: "trainer-activity.csv", csv: toCsv(rows) };
  }
  if (kind === "time") {
    const rows = [
      ["Store", "Trainee", "Start date", "Foundation done", "Path done", "Days to Foundation", "Days to path"],
      ...data.timeRows.map((row) => [
        row.storeNumber,
        row.traineeName,
        row.startDate,
        row.foundationDone,
        row.pathDone,
        dash(row.daysToFoundation),
        dash(row.daysToPath),
      ]),
    ];
    return { filename: "time-to-complete.csv", csv: toCsv(rows) };
  }
  if (kind === "modules") {
    const rows = [
      ["Section", "Module", "Eligible", "Completed", "Not completed", "Percent", "Scheduled", "Overdue", "Completed names", "Not completed names"],
      ...data.moduleRows.map((row) => [
        row.sectionTitle,
        row.name,
        String(row.eligible),
        String(row.completed),
        String(row.notCompleted),
        String(row.percent),
        String(row.scheduled),
        String(row.overdue),
        row.completedNames.join("; "),
        row.openNames.join("; "),
      ]),
    ];
    return { filename: "completion-by-module.csv", csv: toCsv(rows) };
  }
  const rows = [
    ["Store", "Trainee", "Start date", "Foundation percent"],
    ...data.needingPath.map((row) => [row.storeNumber, row.traineeName, row.startDate, String(row.foundationPercent)]),
    [data.completionTotal.storeNumber, String(data.needingPath.length), "", ""],
  ];
  return { filename: "trainees-needing-a-path.csv", csv: toCsv(rows) };
}
