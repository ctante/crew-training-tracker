import type { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { access, ownsStore, requireAdmin, scopedStoreNumber, type Access } from "./access";
import { blockStart, canonicalTrainerPosition, compareTrainers, moduleKind, type SectionId } from "./constants";
import { parseCsv, toCsv } from "./csv";
import { prisma } from "./db";
import { hashPassword, verifyPassword } from "./passwords";
import { safeEqual } from "./session";
import {
  currentMonthKey,
  formatLongDate,
  normalizeStoreNumber,
  parseCompletedFlag,
  parseLooseDate,
  parseTimeMinutes,
  sessionWindow,
  splitTitles,
  todayIso,
} from "./format";
import {
  hasProgressMark,
  inferPathChoice,
  onTrainingPath,
  parseTrainingPath,
  summarize,
  type ModuleSnap,
  type TrainingPath,
} from "./progress";
import type { DevelopmentReportSource, RosterEntry } from "./roster/source";
import { parseDevelopmentReport } from "./roster/parse";
import { sectionTitle, type EditorModule, type ModuleTemplate, type ScheduleSession, type ScheduledSessionRow, type StaffMember, type StoreOption, type TraineeDetail, type TraineeSummary, type TrainerOption } from "./types";

const ITS_HEADER = ["Module", "Time", "Videos", "Credit", "Date", "Trainer", "Completed"];
const BULK_HEADER = [
  "Store Number",
  "Store Name",
  "Trainee",
  "Language",
  "Position",
  "Start Date",
  "Status",
  "Section",
  "Module",
  "Time",
  "Videos",
  "Credit",
  "Date",
  "Trainer",
  "Completed",
  "Completed Date",
  "Notes",
];

type TraineeRecord = {
  id: string;
  name: string;
  storeId: string;
  startDate: string;
  language: string;
  position: string;
  path: string | null;
  status: string;
  isSample: boolean;
  store: { id: string; number: string; name: string };
  modules: {
    id: string;
    scheduledDate: string | null;
    trainerId: string | null;
    trainerLabel: string;
    completed: boolean;
    completedDate: string | null;
    notes: string;
    trainer: { id: string; name: string; isGm: boolean } | null;
    module: {
      id: string;
      language: string;
      section: string;
      sortOrder: number;
      name: string;
      timeLabel: string;
      timeMinutes: number | null;
      videoCount: number | null;
      credit: string | null;
      link: string;
      videoTitles: string;
      needsReview: boolean;
      kind: string;
      note: string;
      archived: boolean;
    };
  }[];
};

const traineeInclude = {
  store: true,
  modules: { include: { module: true, trainer: true } },
} as const;

function asSection(value: string): SectionId {
  if (value === "SERVICE" || value === "PRODUCTION") return value;
  return "FOUNDATION";
}

function asLanguage(value: string): "en" | "es" {
  return value === "es" ? "es" : "en";
}

function snaps(trainee: TraineeRecord): ModuleSnap[] {
  return trainee.modules.map((row) => ({
    sortOrder: row.module.sortOrder,
    section: asSection(row.module.section),
    name: row.module.name,
    timeMinutes: row.module.timeMinutes,
    completed: row.completed,
    completedDate: row.completedDate,
    scheduledDate: row.scheduledDate,
    trainerLabel: row.trainerLabel,
    archived: row.module.archived,
  }));
}

function traineePath(trainee: { path: string | null }): TrainingPath | null {
  return parseTrainingPath(trainee.path);
}

function rowIsVisible(
  trainee: { path: string | null; language: string },
  module: { section: string; archived: boolean; language: string },
) {
  return module.language === trainee.language && onTrainingPath(asSection(module.section), traineePath(trainee), module.archived);
}

function toSummary(trainee: TraineeRecord, today: string): TraineeSummary {
  return {
    id: trainee.id,
    name: trainee.name,
    storeId: trainee.storeId,
    storeNumber: trainee.store.number,
    storeName: trainee.store.name,
    language: asLanguage(trainee.language),
    position: trainee.position,
    path: traineePath(trainee),
    startDate: trainee.startDate,
    status: trainee.status,
    isSample: trainee.isSample,
    progress: summarize(snaps(trainee), {
      startDate: trainee.startDate,
      status: trainee.status,
      today,
      path: traineePath(trainee),
    }),
  };
}

function trainerValue(row: { trainerId: string | null; trainerLabel: string }): string {
  if (row.trainerId) return `staff:${row.trainerId}`;
  if (row.trainerLabel === "Orientation") return "orientation";
  if (row.trainerLabel) return `label:${row.trainerLabel}`;
  return "";
}

function toEditor(trainee: TraineeRecord): EditorModule[] {
  return [...trainee.modules]
    .filter((row) => rowIsVisible(trainee, row.module))
    .sort((a, b) => a.module.sortOrder - b.module.sortOrder)
    .map((row) => {
      const block = blockStart(row.module.sortOrder);
      return {
        id: row.id,
        sortOrder: row.module.sortOrder,
        section: asSection(row.module.section),
        sectionTitle: sectionTitle(trainee.language, asSection(row.module.section)),
        name: row.module.name,
        timeLabel: row.module.timeLabel,
        videoCount: row.module.videoCount,
        credit: row.module.credit,
        link: row.module.link,
        videoTitles: splitTitles(row.module.videoTitles),
        needsReview: row.module.needsReview,
        kind: row.module.kind,
        note: row.module.note,
        blockName: block?.name ?? null,
        blockHours: block?.hours ?? null,
        scheduledDate: row.scheduledDate ?? "",
        trainerValue: trainerValue(row),
        trainerLabel: row.trainerLabel,
        completed: row.completed,
        completedDate: row.completedDate ?? "",
        notes: row.notes,
      };
    });
}

async function syncStatus(traineeId: string) {
  const trainee = await prisma.trainee.findUnique({
    where: { id: traineeId },
    include: { modules: { include: { module: true } } },
  });
  if (!trainee || trainee.modules.length === 0) return;
  const path = traineePath(trainee);
  if (!path) {
    const foundationOpen = trainee.modules.some(
      (row) => rowIsVisible(trainee, row.module) && !row.completed,
    );
    if (foundationOpen && trainee.status === "COMPLETED") {
      await prisma.trainee.update({ where: { id: traineeId }, data: { status: "ACTIVE" } });
    }
    return;
  }
  const visible = trainee.modules.filter((row) => rowIsVisible(trainee, row.module));
  if (visible.length === 0) return;
  const allDone = visible.every((row) => row.completed);
  if (allDone && trainee.status !== "COMPLETED") {
    await prisma.trainee.update({ where: { id: traineeId }, data: { status: "COMPLETED" } });
  } else if (!allDone && trainee.status === "COMPLETED") {
    await prisma.trainee.update({ where: { id: traineeId }, data: { status: "ACTIVE" } });
  }
}

export async function countSampleTrainees() {
  const who = await access();
  return prisma.trainee.count({
    where: { isSample: true, ...(who.role === "store" ? { storeId: who.storeId } : {}) },
  });
}

export async function getDashboard(filters: {
  storeNumber?: string;
  status?: string;
  flag?: string;
  query?: string;
}) {
  const who = await access();
  const storeNumber = scopedStoreNumber(who, filters.storeNumber);
  const today = todayIso();
  const [stores, trainees] = await Promise.all([
    prisma.store.findMany({
      where: storeNumber ? { number: storeNumber } : undefined,
      orderBy: { number: "asc" },
      include: {
        staff: { where: { isGm: true, active: true }, orderBy: { name: "asc" } },
      },
    }),
    prisma.trainee.findMany({
      where: storeNumber ? { store: { number: storeNumber } } : undefined,
      include: traineeInclude,
    }),
  ]);
  const summaries = trainees.map((trainee) => toSummary(trainee as TraineeRecord, today));
  const status = filters.status || "ACTIVE";
  const byStatus = status === "all" ? summaries : summaries.filter((row) => row.status === status);
  const activeCounts = new Map<string, number>();
  for (const row of summaries) {
    if (row.status === "ACTIVE") {
      activeCounts.set(row.storeNumber, (activeCounts.get(row.storeNumber) ?? 0) + 1);
    }
  }
  const scoped = filters.storeNumber
    ? byStatus.filter((row) => row.storeNumber === filters.storeNumber)
    : byStatus;
  const query = (filters.query ?? "").trim().toLowerCase();
  let rows = query
    ? scoped.filter(
        (row) =>
          row.name.toLowerCase().includes(query) ||
          row.position.toLowerCase().includes(query),
      )
    : scoped;
  if (filters.flag === "overdue") rows = rows.filter((row) => row.progress.overdueCount > 0);
  if (filters.flag === "stalled") rows = rows.filter((row) => row.progress.stalled);
  if (filters.flag === "today") rows = rows.filter((row) => row.progress.dueTodayCount > 0);
  if (filters.flag === "path") rows = rows.filter((row) => !row.path);
  rows.sort((a, b) => {
    const rank = (row: TraineeSummary) => {
      if (row.progress.overdueCount > 0) return 0;
      if (row.progress.dueTodayCount > 0) return 1;
      if (row.progress.stalled) return 2;
      return 3;
    };
    return (
      rank(a) - rank(b) ||
      a.storeNumber.localeCompare(b.storeNumber) ||
      a.name.localeCompare(b.name)
    );
  });
  const average = scoped.length
    ? Math.round(scoped.reduce((sum, row) => sum + row.progress.percent, 0) / scoped.length)
    : 0;
  const storeOptions: StoreOption[] = stores.map((store) => ({
    id: store.id,
    number: store.number,
    name: store.name,
    activeTrainees: activeCounts.get(store.number) ?? 0,
    gmNames: store.staff.map((person) => person.name),
  }));
  return {
    today,
    stores: storeOptions,
    stats: {
      shown: scoped.length,
      average,
      overdueSessions: scoped.reduce((sum, row) => sum + row.progress.overdueCount, 0),
      stalled: scoped.filter((row) => row.progress.stalled).length,
      dueToday: scoped.filter((row) => row.progress.dueTodayCount > 0).length,
      needsPath: summaries.filter((row) => row.status === "ACTIVE" && !row.path).length,
    },
    rows,
    locked: who.role === "store",
  };
}

export async function listStoreChoices() {
  const who = await access();
  const stores = await prisma.store.findMany({
    where: who.role === "store" ? { id: who.storeId } : undefined,
    orderBy: { number: "asc" },
  });
  return stores.map((store) => ({ id: store.id, number: store.number, name: store.name }));
}

export async function getTrainee(id: string, scope?: Access): Promise<TraineeDetail | null> {
  const who = scope ?? (await access());
  const today = todayIso();
  const [trainee, stores, trainers] = await Promise.all([
    prisma.trainee.findUnique({ where: { id }, include: traineeInclude }),
    prisma.store.findMany({
      where: who.role === "store" ? { id: who.storeId } : undefined,
      orderBy: { number: "asc" },
    }),
    prisma.staff.findMany({
      where: { active: true, qualified: true, ...(who.role === "store" ? { storeId: who.storeId } : {}) },
    }),
  ]);
  if (!trainee) return null;
  if (who.role === "store" && trainee.storeId !== who.storeId) return null;
  const record = trainee as TraineeRecord;
  const options: TrainerOption[] = trainers
    .filter((person) => person.storeId === record.storeId)
    .map((person) => ({
      id: person.id,
      name: person.name,
      position: person.position,
      isGm: person.isGm,
    }))
    .sort(compareTrainers);
  return {
    ...toSummary(record, today),
    progress: summarize(snaps(record), {
      startDate: record.startDate,
      status: record.status,
      today,
      path: traineePath(record),
    }),
    trainers: options,
    modules: toEditor(record),
    stores: stores.map((store) => ({ id: store.id, number: store.number, name: store.name })),
  };
}

export async function createTrainee(input: {
  name: string;
  storeId: string;
  startDate: string;
  language: string;
  position: string;
  path: string;
}) {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Enter the trainee name.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new Error("Choose a start date.");
  const language = input.language === "es" ? "es" : input.language === "en" ? "en" : "";
  if (!language) throw new Error("Choose English or Spanish.");
  const path = parseTrainingPath(input.path);
  if (!path) throw new Error("Choose Service or Production.");
  await ownsStore(input.storeId);
  const store = await prisma.store.findUnique({ where: { id: input.storeId } });
  if (!store) throw new Error("Choose a restaurant.");
  const modules = await prisma.module.findMany({
    where: { language, archived: false },
    orderBy: { sortOrder: "asc" },
  });
  if (modules.length === 0) throw new Error("The training path is missing modules.");
  const trainee = await prisma.trainee.create({
    data: {
      name,
      storeId: store.id,
      startDate: input.startDate,
      language,
      path,
      position: input.position.trim(),
      status: "ACTIVE",
      isSample: false,
      modules: { create: modules.map((module) => ({ moduleId: module.id })) },
    },
  });
  return trainee.id;
}

export async function updateTrainee(
  id: string,
  input: { name: string; storeId: string; startDate: string; position: string; status: string; path: string },
) {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Enter the trainee name.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new Error("Choose a start date.");
  if (!["ACTIVE", "PAUSED", "COMPLETED"].includes(input.status)) throw new Error("Unknown status.");
  const path = parseTrainingPath(input.path);
  if (!path) throw new Error("Choose Service or Production.");
  const current = await prisma.trainee.findUnique({ where: { id } });
  if (!current) throw new Error("Trainee not found.");
  await ownsStore(current.storeId);
  await ownsStore(input.storeId);
  const store = await prisma.store.findUnique({ where: { id: input.storeId } });
  if (!store) throw new Error("Choose a restaurant.");
  if (input.status === "COMPLETED") {
    const open = await prisma.traineeModule.count({
      where: {
        traineeId: id,
        completed: false,
        module: {
          archived: false,
          language: current.language,
          section: { in: path === "SERVICE" ? ["FOUNDATION", "SERVICE"] : ["FOUNDATION", "PRODUCTION"] },
        },
      },
    });
    if (open > 0) {
      throw new Error("Open modules are still on this path. Pause the trainee, or check the remaining modules.");
    }
  }
  await prisma.trainee.update({
    where: { id },
    data: {
      name,
      storeId: store.id,
      startDate: input.startDate,
      position: input.position.trim(),
      status: input.status,
      path,
    },
  });
  if (current.storeId !== store.id) {
    const foreign = await prisma.traineeModule.findMany({
      where: { traineeId: id, trainerId: { not: null } },
      include: { trainer: true },
    });
    const ids = foreign.filter((row) => row.trainer && row.trainer.storeId !== store.id).map((row) => row.id);
    if (ids.length) {
      await prisma.traineeModule.updateMany({
        where: { id: { in: ids } },
        data: { trainerId: null },
      });
    }
  }
  await syncStatus(id);
}

export async function setTraineePath(id: string, path: string) {
  const parsed = parseTrainingPath(path);
  if (!parsed) throw new Error("Choose Service or Production.");
  const current = await prisma.trainee.findUnique({ where: { id } });
  if (!current) throw new Error("Trainee not found.");
  await ownsStore(current.storeId);
  await prisma.trainee.update({ where: { id }, data: { path: parsed } });
  await syncStatus(id);
}

export async function deleteTrainee(id: string, scope?: Access) {
  const trainee = await prisma.trainee.findUnique({ where: { id } });
  if (!trainee) throw new Error("Trainee not found.");
  await ownsStore(trainee.storeId, scope);
  await prisma.trainee.delete({ where: { id } });
}

export async function setTraineeLanguage(id: string, language: "en" | "es") {
  const trainee = await prisma.trainee.findUnique({
    where: { id },
    include: { modules: { include: { module: true } } },
  });
  if (!trainee) throw new Error("Trainee not found.");
  await ownsStore(trainee.storeId);
  if (trainee.language === language) return;
  const nextModules = await prisma.module.findMany({
    where: { language },
    orderBy: { sortOrder: "asc" },
  });
  const current = [...trainee.modules].sort((a, b) => a.module.sortOrder - b.module.sortOrder);
  await prisma.$transaction(async (tx) => {
    const byOrder = new Map(nextModules.map((module) => [module.sortOrder, module]));
    for (const row of current) {
      const twin = byOrder.get(row.module.sortOrder);
      if (!twin || twin.id === row.moduleId) continue;
      const taken = await tx.traineeModule.findFirst({
        where: { traineeId: id, moduleId: twin.id, NOT: { id: row.id } },
      });
      if (taken) continue;
      await tx.traineeModule.update({ where: { id: row.id }, data: { moduleId: twin.id } });
    }
    const existing = new Set(
      (await tx.traineeModule.findMany({ where: { traineeId: id }, select: { moduleId: true } })).map((row) => row.moduleId),
    );
    const missing = nextModules.filter((module) => !module.archived && !existing.has(module.id));
    if (missing.length) {
      await tx.traineeModule.createMany({
        data: missing.map((module) => ({ traineeId: id, moduleId: module.id })),
      });
    }
    await tx.trainee.update({ where: { id }, data: { language } });
  });
}

export async function updateProgress(input: {
  traineeModuleId: string;
  scheduledDate: string;
  trainerValue: string;
  completed: boolean;
  completedDate: string;
  notes: string;
}) {
  const row = await prisma.traineeModule.findUnique({
    where: { id: input.traineeModuleId },
    include: { trainee: true },
  });
  if (!row) throw new Error("That module is no longer on the path.");
  await ownsStore(row.trainee.storeId);
  const today = todayIso();
  const scheduledDate = input.scheduledDate.trim();
  if (scheduledDate && !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) throw new Error("Choose a valid date.");
  let completedDate = input.completedDate.trim();
  if (completedDate && !/^\d{4}-\d{2}-\d{2}$/.test(completedDate)) throw new Error("Choose a valid completed date.");
  if (!input.completed) completedDate = "";
  else if (!completedDate) completedDate = scheduledDate && scheduledDate <= today ? scheduledDate : today;

  let trainerId: string | null = null;
  let trainerLabel = "";
  if (input.trainerValue === "orientation") {
    trainerLabel = "Orientation";
  } else if (input.trainerValue.startsWith("staff:")) {
    const staffId = input.trainerValue.slice("staff:".length);
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, storeId: row.trainee.storeId, active: true },
    });
    if (!staff || (!staff.qualified && staff.id !== row.trainerId)) {
      throw new Error("Choose a qualified trainer from this restaurant.");
    }
    trainerId = staff.id;
    trainerLabel = staff.name;
  } else if (input.trainerValue.startsWith("label:")) {
    trainerLabel = input.trainerValue.slice("label:".length).trim().slice(0, 80);
  }

  await prisma.traineeModule.update({
    where: { id: row.id },
    data: {
      scheduledDate: scheduledDate || null,
      trainerId,
      trainerLabel,
      completed: input.completed,
      completedDate: completedDate || null,
      notes: input.notes.slice(0, 500),
    },
  });
  await syncStatus(row.traineeId);
}

export async function getSchedule(filters: { storeNumber?: string; trainerId?: string; month?: string }) {
  const who = await access();
  const storeNumber = scopedStoreNumber(who, filters.storeNumber);
  const today = todayIso();
  const month = filters.month && /^\d{4}-\d{2}$/.test(filters.month) ? filters.month : currentMonthKey();
  const [stores, people, rows] = await Promise.all([
    prisma.store.findMany({
      where: storeNumber ? { number: storeNumber } : undefined,
      orderBy: { number: "asc" },
      include: { staff: { where: { isGm: true, active: true } } },
    }),
    prisma.staff.findMany({
      where: {
        active: true,
        qualified: true,
        ...(storeNumber ? { store: { number: storeNumber } } : {}),
      },
      include: { store: true },
    }),
    prisma.traineeModule.findMany({
      where: {
        completed: false,
        scheduledDate: { not: null },
        trainee: {
          status: { in: ["ACTIVE", "PAUSED"] },
          ...(storeNumber ? { store: { number: storeNumber } } : {}),
        },
        ...(filters.trainerId ? { trainerId: filters.trainerId } : {}),
      },
      include: {
        trainee: { include: { store: true } },
        module: true,
        trainer: true,
      },
    }),
  ]);
  const sessions: ScheduleSession[] = rows
    .filter((row) => row.scheduledDate && rowIsVisible(row.trainee, row.module))
    .map((row) => {
      const language = asLanguage(row.trainee.language);
      const section = asSection(row.module.section);
      const date = row.scheduledDate!;
      return {
        id: row.id,
        date,
        traineeId: row.traineeId,
        traineeName: row.trainee.name,
        storeNumber: row.trainee.store.number,
        storeName: row.trainee.store.name,
        moduleName: row.module.name,
        sortOrder: row.module.sortOrder,
        section,
        sectionTitle: sectionTitle(language, section),
        timeLabel: row.module.timeLabel,
        kind: row.module.kind,
        trainerName: row.trainerLabel,
        trainerIsGm: Boolean(row.trainer?.isGm),
        overdue: date < today,
        dueToday: date === today,
        traineeStatus: row.trainee.status,
      };
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.storeNumber.localeCompare(b.storeNumber) ||
        a.traineeName.localeCompare(b.traineeName),
    );
  if (filters.trainerId && !people.some((person) => person.id === filters.trainerId)) notFound();
  return {
    today,
    month,
    sessions,
    locked: who.role === "store",
    stores: stores.map((store) => ({
      id: store.id,
      number: store.number,
      name: store.name,
      gmNames: store.staff.map((person) => person.name),
    })),
    trainers: people
      .map((person) => ({
        id: person.id,
        name: person.name,
        position: person.position,
        isGm: person.isGm,
        storeNumber: person.store.number,
        storeName: person.store.name,
      }))
      .sort(compareTrainers),
  };
}

export async function getScheduledSessions(filters: {
  storeNumber?: string;
  range?: string;
  from?: string;
  to?: string;
}) {
  const who = await access();
  const storeNumber = scopedStoreNumber(who, filters.storeNumber);
  const today = todayIso();
  const window = sessionWindow(today, filters.range, filters.from, filters.to);
  const [stores, rows] = await Promise.all([
    prisma.store.findMany({
      where: storeNumber ? { number: storeNumber } : undefined,
      orderBy: { number: "asc" },
    }),
    prisma.traineeModule.findMany({
      where: {
        scheduledDate: { gte: window.start, lte: window.end },
        ...(storeNumber ? { trainee: { store: { number: storeNumber } } } : {}),
      },
      include: {
        trainee: { include: { store: true } },
        module: true,
      },
    }),
  ]);
  const sessions: ScheduledSessionRow[] = rows
    .filter((row) => row.scheduledDate && rowIsVisible(row.trainee, row.module))
    .map((row) => ({
      id: row.id,
      date: row.scheduledDate!,
      traineeId: row.traineeId,
      traineeName: row.trainee.name,
      storeNumber: row.trainee.store.number,
      moduleName: row.module.name,
      trainerName: row.trainerLabel,
      completed: row.completed,
      timeLabel: row.module.timeLabel,
    }))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.storeNumber.localeCompare(b.storeNumber) ||
        a.traineeName.localeCompare(b.traineeName) ||
        a.moduleName.localeCompare(b.moduleName),
    );
  return {
    today,
    range: window.range,
    start: window.start,
    end: window.end,
    locked: who.role === "store",
    stores: stores.map((store) => ({ id: store.id, number: store.number, name: store.name })),
    rows: sessions,
  };
}

export async function listDirectory() {
  await requireAdmin();
  const stores = await prisma.store.findMany({
    orderBy: { number: "asc" },
    include: { staff: { orderBy: [{ active: "desc" }, { isGm: "desc" }, { name: "asc" }] } },
  });
  return stores.map((store) => ({
    id: store.id,
    number: store.number,
    name: store.name,
    staff: store.staff.map(
      (person): StaffMember => ({
        id: person.id,
        storeId: store.id,
        storeNumber: store.number,
        storeName: store.name,
        name: person.name,
        position: person.position,
        isGm: person.isGm,
        isTrainer: person.isTrainer,
        qualified: person.qualified,
        rosterSource: person.rosterSource,
        active: person.active,
        isSample: person.isSample,
      }),
    ).sort(compareTrainers),
  }));
}

export async function updateStoreName(id: string, name: string) {
  await prisma.store.update({ where: { id }, data: { name: name.trim().slice(0, 80) } });
}

export async function createStaff(input: {
  storeId: string;
  name: string;
  position: string;
  isGm: boolean;
  qualified: boolean;
}) {
  await ownsStore(input.storeId);
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Enter a name.");
  const store = await prisma.store.findUnique({ where: { id: input.storeId } });
  if (!store) throw new Error("Choose a restaurant.");
  await prisma.staff.create({
    data: {
      storeId: store.id,
      name: name.slice(0, 80),
      position: input.position.trim().slice(0, 80),
      isGm: input.isGm,
      isTrainer: input.qualified,
      qualified: input.qualified,
      rosterSource: "manual",
      active: true,
      isSample: false,
    },
  });
}

export async function updateStaff(
  id: string,
  input: { name: string; position: string; isGm: boolean; qualified: boolean; active: boolean },
) {
  const current = await prisma.staff.findUnique({ where: { id } });
  if (!current) throw new Error("That person is not on the roster.");
  await ownsStore(current.storeId);
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Enter a name.");
  await prisma.staff.update({
    where: { id },
    data: {
      name: name.slice(0, 80),
      position: input.position.trim().slice(0, 80),
      isGm: input.isGm,
      isTrainer: input.qualified,
      qualified: input.qualified,
      active: input.active,
    },
  });
}

export async function listModules(language: "en" | "es"): Promise<ModuleTemplate[]> {
  const modules = await prisma.module.findMany({
    where: { language },
    orderBy: { sortOrder: "asc" },
  });
  return modules.map((module) => ({
    id: module.id,
    language: asLanguage(module.language),
    section: asSection(module.section),
    sectionTitle: sectionTitle(module.language, asSection(module.section)),
    sortOrder: module.sortOrder,
    name: module.name,
    timeLabel: module.timeLabel,
    timeMinutes: module.timeMinutes,
    videoCount: module.videoCount,
    credit: module.credit,
    link: module.link,
    videoTitles: module.videoTitles,
    needsReview: module.needsReview,
    kind: module.kind,
    note: module.note,
    archived: module.archived,
  }));
}

export async function updateModuleTemplate(
  id: string,
  input: {
    name: string;
    timeLabel: string;
    videoCount: string;
    credit: string;
    link: string;
    videoTitles: string;
    note: string;
  },
) {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) throw new Error("Enter a module name.");
  const videoCount = input.videoCount.trim() === "" ? null : Number(input.videoCount);
  if (videoCount !== null && (!Number.isInteger(videoCount) || videoCount < 0 || videoCount > 99)) {
    throw new Error("Video count needs to be a whole number.");
  }
  const credit = input.credit === "Auto" || input.credit === "Manual" ? input.credit : null;
  const link = input.link.trim();
  await prisma.module.update({
    where: { id },
    data: {
      name: name.slice(0, 160),
      timeLabel: input.timeLabel.trim().slice(0, 40),
      timeMinutes: parseTimeMinutes(input.timeLabel),
      videoCount,
      credit,
      link,
      videoTitles: input.videoTitles.trim(),
      note: input.note.trim().slice(0, 400),
      needsReview: /regId=/i.test(link),
      kind: moduleKind({ link, videoCount, credit }),
    },
  });
}

function catalogSection(value: string): SectionId {
  if (value === "FOUNDATION" || value === "SERVICE" || value === "PRODUCTION") return value;
  throw new Error("Choose Foundation, Service, or Production.");
}

function catalogWrite(language: "en" | "es", section: SectionId, input: {
  name: string;
  timeLabel: string;
  videoCount: string;
  credit: string;
  link: string;
  videoTitles: string;
  note: string;
}) {
  const name = input.name.trim();
  if (!name) throw new Error(language === "es" ? "Enter the Spanish name." : "Enter the English name.");
  const videoCount = input.videoCount.trim() === "" ? null : Number(input.videoCount);
  if (videoCount !== null && (!Number.isInteger(videoCount) || videoCount < 0 || videoCount > 99)) {
    throw new Error("Video count needs to be a whole number.");
  }
  const credit = input.credit === "Auto" || input.credit === "Manual" ? input.credit : null;
  const link = input.link.trim();
  return {
    language,
    section,
    sectionLabel: sectionTitle(language, section),
    name: name.slice(0, 160),
    timeLabel: input.timeLabel.trim().slice(0, 40),
    timeMinutes: parseTimeMinutes(input.timeLabel),
    videoCount,
    credit,
    link,
    videoTitles: input.videoTitles.trim(),
    note: input.note.trim().slice(0, 400),
    needsReview: /regId=/i.test(link),
    kind: moduleKind({ link, videoCount, credit }),
    archived: false,
  };
}

async function shiftSortOrders(tx: Prisma.TransactionClient, language: string, from: number) {
  const rows = await tx.module.findMany({
    where: { language, sortOrder: { gte: from } },
    orderBy: { sortOrder: "desc" },
  });
  for (const row of rows) {
    await tx.module.update({ where: { id: row.id }, data: { sortOrder: row.sortOrder + 100000 } });
  }
  for (const row of rows) {
    await tx.module.update({ where: { id: row.id }, data: { sortOrder: row.sortOrder + 1 } });
  }
}

export async function addCatalogModule(input: {
  section: string;
  nameEn: string;
  nameEs: string;
  timeLabel: string;
  videoCount: string;
  credit: string;
  link: string;
  videoTitles: string;
  note: string;
}) {
  await requireAdmin();
  const section = catalogSection(input.section);
  const english = catalogWrite("en", section, { ...input, name: input.nameEn });
  const spanish = catalogWrite("es", section, { ...input, name: input.nameEs });
  return prisma.$transaction(async (tx) => {
    const inSection = await tx.module.findMany({ where: { language: "en", section } });
    const insertAt = inSection.length ? Math.max(...inSection.map((row) => row.sortOrder)) + 1 : 1;
    await shiftSortOrders(tx, "en", insertAt);
    await shiftSortOrders(tx, "es", insertAt);
    const en = await tx.module.create({ data: { ...english, sortOrder: insertAt } });
    const es = await tx.module.create({ data: { ...spanish, sortOrder: insertAt } });
    for (const created of [en, es]) {
      const trainees = await tx.trainee.findMany({ where: { language: created.language }, select: { id: true } });
      if (trainees.length) {
        await tx.traineeModule.createMany({
          data: trainees.map((trainee) => ({ traineeId: trainee.id, moduleId: created.id })),
          skipDuplicates: true,
        });
      }
    }
    return { enId: en.id, esId: es.id };
  });
}

function markedProgress(rows: { completed: boolean; scheduledDate: string | null; completedDate: string | null; trainerId: string | null; trainerLabel: string; notes: string }[]) {
  return rows.some(
    (row) => hasProgressMark(row) || Boolean(row.trainerId) || Boolean(row.trainerLabel.trim()) || Boolean(row.notes.trim()),
  );
}

export async function removeCatalogModule(id: string) {
  await requireAdmin();
  const current = await prisma.module.findUnique({ where: { id }, include: { progress: true } });
  if (!current) throw new Error("That module is not in the catalog.");
  const twin = await prisma.module.findFirst({
    where: {
      language: current.language === "en" ? "es" : "en",
      sortOrder: current.sortOrder,
      section: current.section,
    },
    include: { progress: true },
  });
  const ids = [current.id, ...(twin ? [twin.id] : [])];
  const history = markedProgress(current.progress) || (twin ? markedProgress(twin.progress) : false);
  if (history) {
    await prisma.module.updateMany({ where: { id: { in: ids } }, data: { archived: true } });
    return "archived" as const;
  }
  await prisma.$transaction(async (tx) => {
    await tx.traineeModule.deleteMany({ where: { moduleId: { in: ids } } });
    await tx.module.deleteMany({ where: { id: { in: ids } } });
  });
  return "deleted" as const;
}

export async function restoreCatalogModule(id: string) {
  await requireAdmin();
  const current = await prisma.module.findUnique({ where: { id } });
  if (!current) throw new Error("That module is not in the catalog.");
  await prisma.module.updateMany({
    where: { sortOrder: current.sortOrder, section: current.section, language: { in: ["en", "es"] } },
    data: { archived: false },
  });
  const modules = await prisma.module.findMany({
    where: { sortOrder: current.sortOrder, section: current.section, archived: false },
  });
  for (const item of modules) {
    const trainees = await prisma.trainee.findMany({ where: { language: item.language }, select: { id: true } });
    if (!trainees.length) continue;
    await prisma.traineeModule.createMany({
      data: trainees.map((trainee) => ({ traineeId: trainee.id, moduleId: item.id })),
      skipDuplicates: true,
    });
  }
}

export async function moveCatalogModule(id: string, direction: "up" | "down") {
  await requireAdmin();
  const current = await prisma.module.findUnique({ where: { id } });
  if (!current || current.archived) throw new Error("That module is not in the catalog.");
  const siblings = await prisma.module.findMany({
    where: { language: current.language, section: current.section, archived: false },
    orderBy: { sortOrder: "asc" },
  });
  const index = siblings.findIndex((row) => row.id === current.id);
  const neighbor = siblings[index + (direction === "up" ? -1 : 1)];
  if (!neighbor) return;
  await prisma.$transaction(async (tx) => {
    for (const language of ["en", "es"]) {
      const left = await tx.module.findUnique({
        where: { language_sortOrder: { language, sortOrder: current.sortOrder } },
      });
      const right = await tx.module.findUnique({
        where: { language_sortOrder: { language, sortOrder: neighbor.sortOrder } },
      });
      if (!left || !right || left.section !== current.section || right.section !== current.section) continue;
      await tx.module.update({ where: { id: left.id }, data: { sortOrder: -1_000_000 - current.sortOrder } });
      await tx.module.update({ where: { id: right.id }, data: { sortOrder: current.sortOrder } });
      await tx.module.update({ where: { id: left.id }, data: { sortOrder: neighbor.sortOrder } });
    }
  });
}

function moduleCells(module: {
  name: string;
  timeLabel: string;
  videoCount: number | null;
  credit: string | null;
  scheduledDate: string;
  trainerLabel: string;
  completed: boolean;
}) {
  return [
    module.name,
    module.timeLabel,
    module.videoCount === null ? "" : String(module.videoCount),
    module.credit ?? "",
    module.scheduledDate ? formatLongDate(module.scheduledDate) : "",
    module.trainerLabel,
    module.completed ? "TRUE" : "FALSE",
  ];
}

export async function exportTraineeCsv(id: string) {
  const trainee = await getTrainee(id);
  if (!trainee) return null;
  const rows = [ITS_HEADER, ...trainee.modules.map((module) => moduleCells(module))];
  const slug = trainee.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return {
    filename: `its-${trainee.storeNumber}-${slug}.csv`,
    csv: toCsv(rows),
  };
}

export async function exportAllCsv() {
  const who = await access();
  const trainees = await prisma.trainee.findMany({
    where: who.role === "store" ? { storeId: who.storeId } : undefined,
    include: traineeInclude,
    orderBy: [{ store: { number: "asc" } }, { name: "asc" }],
  });
  const rows = [BULK_HEADER];
  for (const trainee of trainees as TraineeRecord[]) {
    const modules = [...trainee.modules].sort((a, b) => a.module.sortOrder - b.module.sortOrder);
    for (const row of modules) {
      rows.push([
        trainee.store.number,
        trainee.store.name,
        trainee.name,
        trainee.language,
        trainee.position,
        trainee.startDate,
        trainee.status,
        sectionTitle(trainee.language, asSection(row.module.section)),
        row.module.name,
        row.module.timeLabel,
        row.module.videoCount === null ? "" : String(row.module.videoCount),
        row.module.credit ?? "",
        row.scheduledDate ? formatLongDate(row.scheduledDate) : "",
        row.trainerLabel,
        row.completed ? "TRUE" : "FALSE",
        row.completedDate ? formatLongDate(row.completedDate) : "",
        row.notes,
      ]);
    }
  }
  return { filename: "crew-training-progress.csv", csv: toCsv(rows) };
}

export async function exportTemplateCsv(language: "en" | "es") {
  const modules = (await listModules(language)).filter((module) => !module.archived);
  const rows = [
    ITS_HEADER,
    ...modules.map((module) =>
      moduleCells({
        name: module.name,
        timeLabel: module.timeLabel,
        videoCount: module.videoCount,
        credit: module.credit,
        scheduledDate: "",
        trainerLabel: "",
        completed: false,
      }),
    ),
  ];
  return {
    filename: language === "es" ? "its-template-espanol.csv" : "its-template-english.csv",
    csv: toCsv(rows),
  };
}

export type ImportIssue = { row: number; message: string };
export type ImportPreview = {
  mode: "bulk" | "single";
  readRows: number;
  trainees: number;
  applicable: number;
  unmatched: number;
  issues: ImportIssue[];
  sample: { trainee: string; module: string; date: string; trainer: string; completed: string }[];
};

export type SingleContext = {
  storeNumber: string;
  trainee: string;
  language: string;
  startDate: string;
  position: string;
};

type Plan = {
  rowNumber: number;
  issue?: string;
  storeId: string;
  storeNumber: string;
  traineeName: string;
  language: "en" | "es";
  position: string;
  startDate: string;
  status: string;
  moduleId: string;
  moduleName: string;
  scheduledDate: string | null;
  completed: boolean;
  completedDate: string | null;
  trainerId: string | null;
  trainerLabel: string;
  notes: string;
};

function columnIndex(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const index = headers.indexOf(alias);
    if (index >= 0) return index;
  }
  return -1;
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function timeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function normalizeLanguage(value: string): "en" | "es" | "" {
  const text = value.trim().toLowerCase();
  if (["en", "english", "ingles", "inglés"].includes(text)) return "en";
  if (["es", "spanish", "espanol", "español", "es-mx"].includes(text)) return "es";
  return "";
}

async function buildPlans(csv: string, single: SingleContext | null): Promise<{ mode: "bulk" | "single"; plans: Plan[] }> {
  if (csv.length > 2_000_000) throw new Error("That file is too large for this prototype.");
  const table = parseCsv(csv);
  if (table.length < 2) throw new Error("Add a header row and at least one module row.");
  const headers = table[0].map((header) => header.trim().toLowerCase());
  const moduleCol = columnIndex(headers, ["module"]);
  if (moduleCol < 0) throw new Error("The header row needs a Module column.");
  const mode: "bulk" | "single" =
    columnIndex(headers, ["trainee", "employee", "employee name", "store", "store number", "restaurant", "restaurant #", "restaurant number"]) >= 0
      ? "bulk"
      : "single";
  const cols = {
    store: columnIndex(headers, ["store number", "store", "restaurant", "restaurant #", "restaurant number"]),
    trainee: columnIndex(headers, ["trainee", "employee", "employee name", "name"]),
    language: columnIndex(headers, ["language", "lang"]),
    position: columnIndex(headers, ["position"]),
    start: columnIndex(headers, ["start date"]),
    status: columnIndex(headers, ["status"]),
    time: columnIndex(headers, ["time"]),
    date: columnIndex(headers, ["date", "training date"]),
    trainer: columnIndex(headers, ["trainer"]),
    completed: columnIndex(headers, ["completed"]),
    completedDate: columnIndex(headers, ["completed date"]),
    notes: columnIndex(headers, ["notes", "note"]),
  };
  const cell = (row: string[], index: number) => (index >= 0 ? (row[index] ?? "").trim() : "");
  const [stores, modules, people, existingTrainees] = await Promise.all([
    prisma.store.findMany(),
    prisma.module.findMany(),
    prisma.staff.findMany(),
    prisma.trainee.findMany(),
  ]);
  const storeByNumber = new Map(stores.map((store) => [store.number, store]));
  const traineeByKey = new Map(
    existingTrainees.map((trainee) => [`${trainee.storeId}|${normalizeLabel(trainee.name)}`, trainee]),
  );
  const used = new Map<string, Set<string>>();
  const languageLock = new Map<string, "en" | "es">();
  for (const trainee of existingTrainees) {
    languageLock.set(`${trainee.storeId}|${normalizeLabel(trainee.name)}`, asLanguage(trainee.language));
  }

  if (mode === "single") {
    if (!single?.trainee.trim() || !single.storeNumber.trim() || !single.startDate) {
      return {
        mode,
        plans: table.slice(1).map((row, index) => ({
          rowNumber: index + 2,
          issue: "Choose the restaurant, trainee, language, and start date before importing one ITS sheet.",
          storeId: "",
          storeNumber: "",
          traineeName: single?.trainee.trim() || "",
          language: "en",
          position: "",
          startDate: "",
          status: "",
          moduleId: "",
          moduleName: cell(row, moduleCol),
          scheduledDate: null,
          completed: false,
          completedDate: null,
          trainerId: null,
          trainerLabel: "",
          notes: "",
        })),
      };
    }
  }

  const plans: Plan[] = [];
  table.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const moduleName = cell(row, moduleCol);
    const base = {
      rowNumber,
      storeId: "",
      storeNumber: "",
      traineeName: "",
      language: "en" as const,
      position: "",
      startDate: "",
      status: "",
      moduleId: "",
      moduleName,
      scheduledDate: null as string | null,
      completed: false,
      completedDate: null as string | null,
      trainerId: null as string | null,
      trainerLabel: "",
      notes: "",
    };
    if (!moduleName) {
      plans.push({ ...base, issue: "Module name is empty." });
      return;
    }
    const storeNumber =
      mode === "single"
        ? normalizeStoreNumber(single!.storeNumber)
        : normalizeStoreNumber(cell(row, cols.store));
    const store = storeByNumber.get(storeNumber);
    if (!store) {
      plans.push({ ...base, storeNumber, issue: `Restaurant ${storeNumber || "(blank)"} is not in the tracker.` });
      return;
    }
    const traineeName = (mode === "single" ? single!.trainee : cell(row, cols.trainee)).replace(/\s+/g, " ").trim();
    if (traineeName.length < 2) {
      plans.push({ ...base, storeId: store.id, storeNumber, issue: "Trainee name is missing." });
      return;
    }
    const key = `${store.id}|${normalizeLabel(traineeName)}`;
    const explicitLanguage = normalizeLanguage(
      mode === "single" ? single!.language : cell(row, cols.language),
    );
    const time = cell(row, cols.time);
    const locked = languageLock.get(key);
    if (explicitLanguage && locked && explicitLanguage !== locked) {
      plans.push({
        ...base,
        storeId: store.id,
        storeNumber,
        traineeName,
        issue: `${traineeName} is already on the ${locked === "es" ? "Spanish" : "English"} path.`,
      });
      return;
    }
    const language = explicitLanguage || locked || "";
    const find = (lang: "en" | "es") => {
      const taken = used.get(`${key}|${lang}`) ?? new Set<string>();
      const pool = modules
        .filter(
          (module) =>
            module.language === lang &&
            !taken.has(module.id) &&
            normalizeLabel(module.name) === normalizeLabel(moduleName),
        )
        .sort((a, b) => a.sortOrder - b.sortOrder);
      if (time) return pool.find((module) => timeKey(module.timeLabel) === timeKey(time)) ?? null;
      return pool[0] ?? null;
    };
    let matchedLanguage: "en" | "es" | "" = language;
    let matched = language ? find(language) : null;
    if (!language) {
      const english = find("en");
      const spanish = find("es");
      if (english && spanish) {
        plans.push({
          ...base,
          storeId: store.id,
          storeNumber,
          traineeName,
          issue: `${moduleName} exists in both languages. Add a Language column.`,
        });
        return;
      }
      if (english) {
        matched = english;
        matchedLanguage = "en";
      } else if (spanish) {
        matched = spanish;
        matchedLanguage = "es";
      }
    }
    if (!matched || !matchedLanguage) {
      plans.push({
        ...base,
        storeId: store.id,
        storeNumber,
        traineeName,
        language: matchedLanguage || "en",
        issue: `No ${language === "es" ? "Spanish" : language === "en" ? "English" : ""} module matches ${moduleName}${time ? ` (${time})` : ""}.`.replace("  ", " "),
      });
      return;
    }
    languageLock.set(key, matchedLanguage);
    const taken = used.get(`${key}|${matchedLanguage}`) ?? new Set<string>();
    taken.add(matched.id);
    used.set(`${key}|${matchedLanguage}`, taken);

    const dateRaw = cell(row, cols.date);
    let scheduledDate: string | null = null;
    if (dateRaw) {
      scheduledDate = parseLooseDate(dateRaw);
      if (!scheduledDate) {
        plans.push({
          ...base,
          storeId: store.id,
          storeNumber,
          traineeName,
          issue: `Could not read the date "${dateRaw}".`,
        });
        return;
      }
    }
    const completed = parseCompletedFlag(cell(row, cols.completed));
    const completedRaw = cell(row, cols.completedDate);
    let completedDate: string | null = null;
    if (completed) {
      if (completedRaw) {
        completedDate = parseLooseDate(completedRaw);
        if (!completedDate) {
          plans.push({
            ...base,
            storeId: store.id,
            storeNumber,
            traineeName,
            issue: `Could not read the completed date "${completedRaw}".`,
          });
          return;
        }
      } else {
        completedDate = scheduledDate;
      }
    }
    const trainerName = cell(row, cols.trainer);
    let trainerId: string | null = null;
    let trainerLabel = trainerName;
    if (/^orientation$/i.test(trainerName)) {
      trainerLabel = "Orientation";
    } else if (trainerName) {
      const staff = people.find(
        (person) =>
          person.storeId === store.id &&
          person.active &&
          normalizeLabel(person.name) === normalizeLabel(trainerName),
      );
      if (staff) {
        trainerId = staff.id;
        trainerLabel = staff.name;
      }
    }
    const existing = traineeByKey.get(key);
    const startRaw = mode === "single" ? single!.startDate : cell(row, cols.start);
    const startDate = parseLooseDate(startRaw) || existing?.startDate || todayIso();
    const statusRaw = cell(row, cols.status).toUpperCase();
    const status = ["ACTIVE", "PAUSED", "COMPLETED"].includes(statusRaw) ? statusRaw : "";
    plans.push({
      rowNumber,
      storeId: store.id,
      storeNumber,
      traineeName,
      language: matchedLanguage,
      position: (mode === "single" ? single!.position : cell(row, cols.position)) || existing?.position || "",
      startDate,
      status,
      moduleId: matched.id,
      moduleName: matched.name,
      scheduledDate,
      completed,
      completedDate,
      trainerId,
      trainerLabel,
      notes: cell(row, cols.notes).slice(0, 500),
    });
  });
  return { mode, plans };
}

function previewFrom(mode: "bulk" | "single", plans: Plan[]): ImportPreview {
  const good = plans.filter((plan) => !plan.issue && plan.moduleId);
  const unmatched = plans.filter((plan) => plan.issue);
  const trainees = new Set(good.map((plan) => `${plan.storeId}|${normalizeLabel(plan.traineeName)}`));
  return {
    mode,
    readRows: plans.length,
    trainees: trainees.size,
    applicable: good.length,
    unmatched: unmatched.length,
    issues: unmatched.slice(0, 40).map((plan) => ({ row: plan.rowNumber, message: plan.issue! })),
    sample: good.slice(0, 8).map((plan) => ({
      trainee: plan.traineeName,
      module: plan.moduleName,
      date: plan.scheduledDate ?? "",
      trainer: plan.trainerLabel,
      completed: plan.completed ? "TRUE" : "FALSE",
    })),
  };
}

export async function previewImport(csv: string, single: SingleContext | null) {
  await requireAdmin();
  const { mode, plans } = await buildPlans(csv, single);
  return previewFrom(mode, plans);
}

export async function commitImport(csv: string, single: SingleContext | null) {
  await requireAdmin();
  const { mode, plans } = await buildPlans(csv, single);
  const preview = previewFrom(mode, plans);
  const good = plans.filter((plan) => !plan.issue && plan.moduleId);
  const created: string[] = [];
  const updated: string[] = [];
  const groups = new Map<string, Plan[]>();
  for (const plan of good) {
    const key = `${plan.storeId}|${normalizeLabel(plan.traineeName)}`;
    groups.set(key, [...(groups.get(key) ?? []), plan]);
  }
  await prisma.$transaction(
    async (tx) => {
      for (const group of groups.values()) {
        const first = group[0];
        const inStore = await tx.trainee.findMany({ where: { storeId: first.storeId } });
        let trainee =
          inStore.find((item) => normalizeLabel(item.name) === normalizeLabel(first.traineeName)) ?? null;
        if (!trainee) {
          const modules = await tx.module.findMany({ where: { language: first.language, archived: false } });
          trainee = await tx.trainee.create({
            data: {
              storeId: first.storeId,
              name: first.traineeName,
              startDate: first.startDate,
              language: first.language,
              position: first.position,
              status: "ACTIVE",
              isSample: false,
              modules: { create: modules.map((module) => ({ moduleId: module.id })) },
            },
          });
          created.push(`${first.storeNumber} ${first.traineeName}`);
        } else {
          await tx.trainee.update({
            where: { id: trainee.id },
            data: {
              startDate: first.startDate,
              ...(first.position ? { position: first.position } : {}),
            },
          });
          updated.push(`${first.storeNumber} ${trainee.name}`);
        }
        for (const plan of group) {
          await tx.traineeModule.updateMany({
            where: { traineeId: trainee.id, moduleId: plan.moduleId },
            data: {
              scheduledDate: plan.scheduledDate,
              trainerId: plan.trainerId,
              trainerLabel: plan.trainerLabel,
              completed: plan.completed,
              completedDate: plan.completedDate,
              notes: plan.notes,
            },
          });
        }
        const rows = await tx.traineeModule.findMany({
          where: { traineeId: trainee.id },
          include: { module: true },
        });
        let path = traineePath(trainee);
        if (!path) {
          const serviceRows = rows.filter((row) => row.module.section === "SERVICE" && hasProgressMark(row)).length;
          const productionRows = rows.filter((row) => row.module.section === "PRODUCTION" && hasProgressMark(row)).length;
          path = inferPathChoice(serviceRows, productionRows);
          if (path) await tx.trainee.update({ where: { id: trainee.id }, data: { path } });
        }
        const visible = rows.filter((row) => rowIsVisible({ ...trainee, path }, row.module));
        const allDone = Boolean(path) && visible.length > 0 && visible.every((row) => row.completed);
        const requested = group.find((plan) => plan.status)?.status;
        let status = trainee.status;
        if (allDone) status = "COMPLETED";
        else if (requested === "PAUSED") status = "PAUSED";
        else if (requested === "ACTIVE" || status === "COMPLETED") status = "ACTIVE";
        if (status !== trainee.status) {
          await tx.trainee.update({ where: { id: trainee.id }, data: { status } });
        }
      }
    },
    { timeout: 30000 },
  );
  return { ...preview, created, updated };
}

const REPORT_SOURCES = ["csv", "google-sheets"];

export async function previewDevelopmentReport(csv: string) {
  await requireAdmin();
  const parsed = parseDevelopmentReport(csv);
  const stores = await prisma.store.findMany();
  const known = new Set(stores.map((store) => store.number));
  const rows = parsed.entries.filter((entry) => known.has(entry.storeNumber));
  const issues = [
    ...parsed.issues,
    ...parsed.entries
      .filter((entry) => !known.has(entry.storeNumber))
      .map((entry) => ({
        row: entry.rowNumber,
        message: `Restaurant ${entry.storeNumber} is not in the tracker.`,
      })),
  ];
  return { qualifiedColumn: parsed.qualifiedColumn, rows, issues };
}

export async function syncDevelopmentReport(source: DevelopmentReportSource) {
  await requireAdmin();
  const entries = await source.pull();
  return applyDevelopmentReport(entries, source.id);
}

export async function applyDevelopmentReport(entries: RosterEntry[], sourceId: "csv" | "google-sheets") {
  await requireAdmin();
  const stores = await prisma.store.findMany();
  const byNumber = new Map(stores.map((store) => [store.number, store]));
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const issues: { row: number; message: string }[] = [];
  const seen = new Set<string>();
  const touched = new Set<string>();

  await prisma.$transaction(
    async (tx) => {
      for (const entry of entries) {
        const store = byNumber.get(entry.storeNumber);
        if (!store) {
          skippedCount += 1;
          issues.push({
            row: entry.rowNumber,
            message: `Restaurant ${entry.storeNumber} is not in the tracker.`,
          });
          continue;
        }
        touched.add(store.id);
        const people = await tx.staff.findMany({ where: { storeId: store.id } });
        const existing = people.find(
          (person) => normalizeLabel(person.name) === normalizeLabel(entry.name),
        );
        const isGm = entry.position
          ? canonicalTrainerPosition(entry.position) === "General Manager"
          : Boolean(existing?.isGm);
        if (existing) {
          await tx.staff.update({
            where: { id: existing.id },
            data: {
              name: entry.name,
              position: entry.position || existing.position,
              qualified: entry.qualified,
              isTrainer: entry.qualified,
              isGm,
              active: true,
              isSample: false,
              rosterSource: sourceId,
            },
          });
          seen.add(existing.id);
          updatedCount += 1;
        } else {
          const created = await tx.staff.create({
            data: {
              storeId: store.id,
              name: entry.name,
              position: entry.position,
              qualified: entry.qualified,
              isTrainer: entry.qualified,
              isGm,
              active: true,
              isSample: false,
              rosterSource: sourceId,
            },
          });
          seen.add(created.id);
          createdCount += 1;
        }
      }
      if (seen.size > 0 && touched.size > 0) {
        await tx.staff.updateMany({
          where: {
            storeId: { in: [...touched] },
            rosterSource: { in: REPORT_SOURCES },
            id: { notIn: [...seen] },
            qualified: true,
          },
          data: { qualified: false, isTrainer: false },
        });
      }
      await tx.rosterSync.create({
        data: {
          source: sourceId,
          rowsRead: entries.length,
          createdCount,
          updatedCount,
          skippedCount,
          note: issues
            .slice(0, 5)
            .map((issue) => `Row ${issue.row}: ${issue.message}`)
            .join(" "),
        },
      });
    },
    { timeout: 20000 },
  );

  return { rowsRead: entries.length, createdCount, updatedCount, skippedCount, issues };
}

export async function getRosterPage() {
  await requireAdmin();
  const [stores, sync] = await Promise.all([
    prisma.store.findMany({ orderBy: { number: "asc" }, include: { staff: true } }),
    prisma.rosterSync.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);
  return {
    stores: stores.map((store) => ({
      id: store.id,
      number: store.number,
      name: store.name,
      trainers: store.staff
        .filter((person) => person.active && person.qualified)
        .map((person) => ({
          id: person.id,
          name: person.name,
          position: person.position,
          isGm: person.isGm,
          isSample: person.isSample,
        }))
        .sort(compareTrainers),
    })),
    lastSync: sync
      ? {
          source: sync.source,
          at: sync.createdAt.toISOString(),
          rowsRead: sync.rowsRead,
          createdCount: sync.createdCount,
          updatedCount: sync.updatedCount,
          skippedCount: sync.skippedCount,
          note: sync.note,
        }
      : null,
  };
}

export async function listStoreAccess() {
  await requireAdmin();
  const stores = await prisma.store.findMany({ orderBy: { number: "asc" } });
  return stores.map((store) => ({
    id: store.id,
    number: store.number,
    hasPassword: Boolean(store.passwordHash),
  }));
}

export async function matchLogin(password: string) {
  const adminPassword = process.env.APP_PASSWORD;
  const stores = await prisma.store.findMany({ where: { passwordHash: { not: null } } });
  let storeMatch: { id: string; version: number } | null = null;
  for (const store of stores) {
    if (store.passwordHash && (await verifyPassword(password, store.passwordHash))) {
      storeMatch = { id: store.id, version: store.sessionVersion };
    }
  }
  if (adminPassword && safeEqual(password, adminPassword)) return { role: "admin" as const };
  if (storeMatch) return { role: "store" as const, storeId: storeMatch.id, version: storeMatch.version };
  return null;
}

export async function setStorePassword(storeId: string, password: string, confirm: string) {
  await requireAdmin();
  if (password.length < 8) throw new Error("Use at least 8 characters.");
  if (password !== confirm) throw new Error("Type the same password in both fields.");
  const adminPassword = process.env.APP_PASSWORD;
  if (adminPassword && safeEqual(password, adminPassword)) {
    throw new Error("Choose a password that is different from the admin password.");
  }
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new Error("That restaurant is not in the tracker.");
  const others = await prisma.store.findMany({
    where: { passwordHash: { not: null }, id: { not: storeId } },
  });
  for (const other of others) {
    if (other.passwordHash && (await verifyPassword(password, other.passwordHash))) {
      throw new Error("Choose a password that is different from every other restaurant.");
    }
  }
  await prisma.store.update({
    where: { id: storeId },
    data: { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 } },
  });
}
