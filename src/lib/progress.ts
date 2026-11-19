import { STALL_DAYS, type SectionId } from "./constants";
import { addDays } from "./format";

export type TrainingPath = "SERVICE" | "PRODUCTION";

export type ModuleSnap = {
  sortOrder: number;
  section: SectionId;
  name: string;
  timeMinutes: number | null;
  completed: boolean;
  completedDate: string | null;
  scheduledDate: string | null;
  trainerLabel: string;
  archived?: boolean;
};

export type SectionProgress = {
  section: SectionId;
  completed: number;
  total: number;
  minutesDone: number;
  minutesTotal: number;
};

export type NextSession = {
  date: string;
  moduleName: string;
  trainer: string;
  sortOrder: number;
};

export type ProgressSummary = {
  completed: number;
  total: number;
  percent: number;
  currentSection: SectionId | "COMPLETE";
  currentModuleName: string | null;
  currentSortOrder: number | null;
  nextSession: NextSession | null;
  overdueCount: number;
  dueTodayCount: number;
  stalled: boolean;
  lastCompletedDate: string | null;
  sections: SectionProgress[];
  minutesDone: number;
  minutesTotal: number;
};

export function parseTrainingPath(value: string | null | undefined): TrainingPath | null {
  if (value === "SERVICE" || value === "PRODUCTION") return value;
  return null;
}

export function onTrainingPath(
  section: SectionId,
  path: TrainingPath | null,
  archived = false,
): boolean {
  if (archived) return false;
  if (section === "FOUNDATION") return true;
  return section === path;
}

export function inferPathChoice(serviceRows: number, productionRows: number): TrainingPath | null {
  if (serviceRows > productionRows) return "SERVICE";
  if (productionRows > serviceRows) return "PRODUCTION";
  return null;
}

export function hasProgressMark(row: {
  completed: boolean;
  scheduledDate: string | null;
  completedDate: string | null;
}): boolean {
  return row.completed || Boolean(row.scheduledDate) || Boolean(row.completedDate);
}

export function summarize(
  modules: ModuleSnap[],
  input: { startDate: string; status: string; today: string; path?: TrainingPath | null },
): ProgressSummary {
  const path = input.path === undefined ? null : input.path;
  const ordered = modules
    .filter((module) => onTrainingPath(module.section, path, module.archived))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const visibleSections: SectionId[] =
    path === "SERVICE"
      ? ["FOUNDATION", "SERVICE"]
      : path === "PRODUCTION"
        ? ["FOUNDATION", "PRODUCTION"]
        : ["FOUNDATION"];
  const total = ordered.length;
  const completed = ordered.filter((module) => module.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const nextIncomplete = ordered.find((module) => !module.completed) ?? null;
  const upcoming = ordered
    .filter(
      (module) =>
        !module.completed && module.scheduledDate && module.scheduledDate >= input.today,
    )
    .sort((a, b) => a.scheduledDate!.localeCompare(b.scheduledDate!));
  const next = upcoming[0];
  const overdue = ordered.filter(
    (module) => !module.completed && module.scheduledDate && module.scheduledDate < input.today,
  );
  const dueToday = ordered.filter(
    (module) => !module.completed && module.scheduledDate === input.today,
  );
  const lastCompletedDate =
    ordered
      .map((module) => module.completedDate)
      .filter((date): date is string => Boolean(date))
      .sort()
      .at(-1) ?? null;
  const stallCutoff = addDays(input.today, -STALL_DAYS);
  const stalled =
    input.status === "ACTIVE" &&
    total > 0 &&
    completed < total &&
    input.startDate <= stallCutoff &&
    (lastCompletedDate === null || lastCompletedDate <= stallCutoff) &&
    !next;

  const sections = visibleSections.map((section) => {
    const rows = ordered.filter((module) => module.section === section);
    return {
      section,
      completed: rows.filter((module) => module.completed).length,
      total: rows.length,
      minutesDone: rows
        .filter((module) => module.completed)
        .reduce((sum, module) => sum + (module.timeMinutes ?? 0), 0),
      minutesTotal: rows.reduce((sum, module) => sum + (module.timeMinutes ?? 0), 0),
    };
  });

  return {
    completed,
    total,
    percent,
    currentSection: nextIncomplete ? nextIncomplete.section : "COMPLETE",
    currentModuleName: nextIncomplete?.name ?? null,
    currentSortOrder: nextIncomplete?.sortOrder ?? null,
    nextSession: next
      ? {
          date: next.scheduledDate!,
          moduleName: next.name,
          trainer: next.trainerLabel,
          sortOrder: next.sortOrder,
        }
      : null,
    overdueCount: overdue.length,
    dueTodayCount: dueToday.length,
    stalled,
    lastCompletedDate,
    sections,
    minutesDone: sections.reduce((sum, section) => sum + section.minutesDone, 0),
    minutesTotal: sections.reduce((sum, section) => sum + section.minutesTotal, 0),
  };
}
