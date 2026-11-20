import { redirect } from "next/navigation";
import sheet from "./development-sheet.json";
import { access, allows, assertPermission, seesStoreId, visibleStoreNumbers, type Access } from "./access";
import { canonicalTrainerPosition, compareTrainers } from "./constants";
import { parseCsv, toCsv } from "./csv";
import { prisma } from "./db";
import {
  convertHours,
  developmentHours,
  mondayOf,
  parseWeekLabel,
  weekLabel,
  type DevelopmentStoreWeek,
} from "./development-hours";
import { addDays, normalizeStoreNumber, todayIso } from "./format";

export {
  HOUR_CHOICES,
  convertHours,
  developmentHours,
  formatHourTotal,
  mondayOf,
  parseWeekLabel,
  weekLabel,
  type DevelopmentPerson,
  type DevelopmentStoreWeek,
} from "./development-hours";

export type SheetPerson = { name: string; position: string; hours: string; comments: string };
export type SheetStore = { store: string; week: string; notes: string; people: SheetPerson[] };

export function personKey(name: string): string {
  return name.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
}

function bundledSheet(): SheetStore[] {
  return sheet.stores;
}

export async function importDevelopmentRows(
  rows: { storeNumber: string; name: string; hours: string; comments: string; trainingNeeded?: string; weekStart: string; notes?: string }[],
) {
  const who = await access();
  assertPermission(who, "edit_development");
  const taskLabels = new Set((await prisma.developmentTask.findMany()).map((task) => task.label));
  const stores = await prisma.store.findMany({ include: { staff: { where: { active: true } } } });
  const byNumber = new Map(stores.map((store) => [store.number, store]));
  const unmatched: { storeNumber: string; name: string }[] = [];
  const missingStores = new Set<string>();
  let entries = 0;
  const notesByStore = new Map<string, { storeId: string; weekStart: string; notes: string }>();

  for (const row of rows) {
    const store = byNumber.get(row.storeNumber);
    if (!store) {
      missingStores.add(row.storeNumber);
      if (row.name) unmatched.push({ storeNumber: row.storeNumber, name: row.name });
      continue;
    }
    if (row.notes) {
      notesByStore.set(`${store.id}:${row.weekStart}`, { storeId: store.id, weekStart: row.weekStart, notes: row.notes });
    }
    if (!row.name || (!row.hours && !row.comments)) continue;
    const key = personKey(row.name);
    const matches = store.staff.filter((person) => personKey(person.name) === key);
    if (matches.length === 0) {
      unmatched.push({ storeNumber: store.number, name: row.name });
      continue;
    }
    const week = await prisma.developmentWeek.upsert({
      where: { storeId_weekStart: { storeId: store.id, weekStart: row.weekStart } },
      create: { storeId: store.id, weekStart: row.weekStart },
      update: {},
    });
    for (const person of matches) {
      await prisma.developmentEntry.upsert({
        where: { weekId_staffId: { weekId: week.id, staffId: person.id } },
        create: {
          weekId: week.id,
          staffId: person.id,
          hours: convertHours(row.hours).hours,
          trainingNeeded: taskLabels.has(row.trainingNeeded ?? "")
            ? (row.trainingNeeded ?? "")
            : taskLabels.has(row.comments.trim())
              ? row.comments.trim()
              : "",
          comments: row.comments,
        },
        update: {
          hours: convertHours(row.hours).hours,
          trainingNeeded: taskLabels.has(row.trainingNeeded ?? "")
            ? (row.trainingNeeded ?? "")
            : taskLabels.has(row.comments.trim())
              ? row.comments.trim()
              : "",
          comments: row.comments,
        },
      });
    }
    entries += 1;
  }

  let notes = 0;
  for (const note of notesByStore.values()) {
    await prisma.developmentWeek.upsert({
      where: { storeId_weekStart: { storeId: note.storeId, weekStart: note.weekStart } },
      create: { storeId: note.storeId, weekStart: note.weekStart, notes: note.notes },
      update: { notes: note.notes },
    });
    notes += 1;
  }
  return { entries, notes, unmatched, missingStores: [...missingStores] };
}

export function bundledDevelopmentRows(year = 2026) {
  const rows: { storeNumber: string; name: string; hours: string; comments: string; weekStart: string; notes?: string }[] = [];
  for (const store of bundledSheet()) {
    const weekStart = parseWeekLabel(store.week, year);
    if (!weekStart) continue;
    const storeNumber = normalizeStoreNumber(store.store);
    if (store.notes) {
      rows.push({ storeNumber, name: "", hours: "", comments: "", weekStart, notes: store.notes });
    }
    for (const person of store.people) {
      if (!person.hours && !person.comments) continue;
      rows.push({
        storeNumber,
        name: person.name,
        hours: person.hours,
        comments: person.comments,
        weekStart,
      });
    }
  }
  return rows;
}

export async function importBundledDevelopmentSheet() {
  const result = await importDevelopmentRows(bundledDevelopmentRows());
  const unmatched = result.unmatched.map((row) => `${row.storeNumber} ${row.name}`).join("; ");
  console.log(
    `Development sheet: ${result.entries} entries, ${result.notes} store notes, ${result.unmatched.length} unmatched.${unmatched ? ` Unmatched: ${unmatched}` : ""}`,
  );
  if (result.missingStores.length) console.log(`Development sheet missing restaurants: ${result.missingStores.join(", ")}.`);
  const normalized = await normalizeDevelopmentEntries();
  return { ...result, ...normalized };
}

export async function normalizeDevelopmentEntries() {
  const tasks = new Set((await prisma.developmentTask.findMany()).map((task) => task.label));
  const entries = await prisma.developmentEntry.findMany({ include: { staff: true, week: { include: { store: true } } } });
  const unconverted: string[] = [];
  let hoursChanged = 0;
  let trainingSet = 0;
  for (const entry of entries) {
    const hours = convertHours(entry.hours);
    const comment = entry.comments.trim();
    const trainingNeeded = entry.trainingNeeded || (tasks.has(comment) ? comment : "");
    if (!hours.converted) unconverted.push(`${entry.week.store.number} ${entry.staff.name}: ${entry.hours}`);
    const nextHours = hours.converted ? hours.hours : entry.hours;
    if (nextHours !== entry.hours || trainingNeeded !== entry.trainingNeeded) {
      await prisma.developmentEntry.update({
        where: { id: entry.id },
        data: { hours: nextHours, trainingNeeded },
      });
      if (nextHours !== entry.hours) hoursChanged += 1;
      if (trainingNeeded && trainingNeeded !== entry.trainingNeeded) trainingSet += 1;
    }
  }
  console.log(
    `Development hours converted: ${hoursChanged}. Unconverted: ${unconverted.length ? unconverted.join("; ") : "none"}.`,
  );
  console.log(`Development training needed set from comments: ${trainingSet}.`);
  return { hoursChanged, unconverted, trainingSet };
}

export function parseDevelopmentCsv(csv: string, weekStart: string) {
  const table = parseCsv(csv);
  if (table.length < 2) throw new Error("Add a header row and at least one person.");
  const headers = table[0].map((header) => header.trim().toLowerCase());
  const index = (names: string[]) => names.map((name) => headers.indexOf(name)).find((item) => item >= 0) ?? -1;
  const nameCol = index(["employee", "name"]);
  const storeCol = index(["restaurant", "store", "store number"]);
  const hoursCol = index(["training hours needed", "hours"]);
  const commentsCol = index(["comments", "work", "work/comments"]);
  const trainingCol = index(["training needed"]);
  if (nameCol < 0 || storeCol < 0) throw new Error("The header needs Employee and Restaurant columns.");
  return table.slice(1).flatMap((row) => {
    const name = (row[nameCol] ?? "").trim();
    const storeNumber = normalizeStoreNumber(row[storeCol] ?? "");
    if (!name || name === "(Store note)") return [];
    return [
      {
        storeNumber,
        name,
        hours: hoursCol >= 0 ? (row[hoursCol] ?? "").trim() : "",
        comments: commentsCol >= 0 ? (row[commentsCol] ?? "").trim() : "",
        trainingNeeded: trainingCol >= 0 ? (row[trainingCol] ?? "").trim() : "",
        weekStart,
      },
    ];
  });
}

async function scopedStores(who: Access, requested?: string) {
  const visible = visibleStoreNumbers(who);
  const stores = await prisma.store.findMany({
    where: visible ? { number: { in: visible } } : undefined,
    orderBy: { number: "asc" },
  });
  if (!requested || requested === "all") return stores;
  const store = stores.find((item) => item.number === requested);
  if (!store || !seesStoreId(who, store.id)) redirect("/development");
  return [store];
}

export async function getDevelopment(filters: { week?: string; store?: string; position?: string }) {
  const who = await access();
  if (!allows(who, "view_development")) redirect("/");
  const weekStart = mondayOf(filters.week && /^\d{4}-\d{2}-\d{2}$/.test(filters.week) ? filters.week : todayIso());
  const choices = await scopedStores(who);
  const stores = await scopedStores(who, filters.store);
  const position = filters.position && filters.position !== "all" ? canonicalTrainerPosition(filters.position) : "";
  const staff = await prisma.staff.findMany({
    where: { active: true, storeId: { in: stores.map((store) => store.id) } },
  });
  const weeks = await prisma.developmentWeek.findMany({
    where: { weekStart, storeId: { in: stores.map((store) => store.id) } },
    include: { entries: true },
  });
  const weekByStore = new Map(weeks.map((week) => [week.storeId, week]));
  const sections: DevelopmentStoreWeek[] = stores.map((store) => {
    const week = weekByStore.get(store.id);
    const entryByStaff = new Map(week?.entries.map((entry) => [entry.staffId, entry]) ?? []);
    const people = staff
      .filter((person) => person.storeId === store.id)
      .filter((person) => !position || canonicalTrainerPosition(person.position) === position)
      .map((person) => ({
        id: person.id,
        name: person.name,
        position: canonicalTrainerPosition(person.position) || person.position,
        hours: entryByStaff.get(person.id)?.hours ?? "",
        trainingNeeded: entryByStaff.get(person.id)?.trainingNeeded ?? "",
        comments: entryByStaff.get(person.id)?.comments ?? "",
      }))
      .sort(compareTrainers);
    return {
      id: store.id,
      number: store.number,
      notes: week?.notes ?? "",
      hoursTotal: people.reduce((sum, person) => sum + developmentHours(person.hours), 0),
      people,
    };
  });
  return {
    weekStart,
    weekEnd: addDays(weekStart, 6),
    label: weekLabel(weekStart),
    previous: addDays(weekStart, -7),
    next: addDays(weekStart, 7),
    current: mondayOf(todayIso()),
    store: filters.store && filters.store !== "all" ? filters.store : "",
    position,
    canEdit: allows(who, "edit_development"),
    tasks: (await prisma.developmentTask.findMany({ orderBy: { sortOrder: "asc" } })).map((task) => task.label),
    canChooseStores: choices.length > 1,
    stores: choices.map((store) => store.number),
    sections,
  };
}

export async function saveDevelopmentWeek(weekStart: string, formData: FormData) {
  const who = await access();
  assertPermission(who, "edit_development");
  const start = mondayOf(weekStart);
  const taskLabels = new Set((await prisma.developmentTask.findMany()).map((task) => task.label));
  const sections = new Map<string, { notes: string; people: { id: string; hours: string; trainingNeeded: string; comments: string }[] }>();
  for (const [key, value] of formData.entries()) {
    const text = String(value);
    if (key.startsWith("notes:")) {
      const storeId = key.slice("notes:".length);
      const current = sections.get(storeId) ?? { notes: "", people: [] };
      current.notes = text.slice(0, 2000);
      sections.set(storeId, current);
    } else if (key.startsWith("hours:") || key.startsWith("training:") || key.startsWith("comments:")) {
      const [kind, staffId] = key.split(":");
      const staff = await prisma.staff.findUnique({ where: { id: staffId } });
      if (!staff || !seesStoreId(who, staff.storeId)) continue;
      const current = sections.get(staff.storeId) ?? { notes: "", people: [] };
      let person = current.people.find((item) => item.id === staff.id);
      if (!person) {
        person = { id: staff.id, hours: "", trainingNeeded: "", comments: "" };
        current.people.push(person);
      }
      if (kind === "hours") {
        const converted = convertHours(text);
        person.hours = converted.converted ? converted.hours : "";
      }
      else if (kind === "training") person.trainingNeeded = taskLabels.has(text) ? text : "";
      else person.comments = text.slice(0, 2000);
      sections.set(staff.storeId, current);
    }
  }
  for (const [storeId, section] of sections) {
    if (!seesStoreId(who, storeId)) continue;
    const week = await prisma.developmentWeek.upsert({
      where: { storeId_weekStart: { storeId, weekStart: start } },
      create: { storeId, weekStart: start, notes: section.notes },
      update: { notes: section.notes },
    });
    for (const person of section.people) {
      if (!person.hours && !person.trainingNeeded && !person.comments) {
        await prisma.developmentEntry.deleteMany({ where: { weekId: week.id, staffId: person.id } });
        continue;
      }
      await prisma.developmentEntry.upsert({
        where: { weekId_staffId: { weekId: week.id, staffId: person.id } },
        create: {
          weekId: week.id,
          staffId: person.id,
          hours: person.hours,
          trainingNeeded: person.trainingNeeded,
          comments: person.comments,
        },
        update: { hours: person.hours, trainingNeeded: person.trainingNeeded, comments: person.comments },
      });
    }
  }
}

export async function copyDevelopmentWeek(weekStart: string, storeNumbers: string[]) {
  const who = await access();
  assertPermission(who, "edit_development");
  const start = mondayOf(weekStart);
  const previous = addDays(start, -7);
  const stores = await prisma.store.findMany({ where: { number: { in: storeNumbers } } });
  for (const store of stores) {
    if (!seesStoreId(who, store.id)) continue;
    const source = await prisma.developmentWeek.findUnique({
      where: { storeId_weekStart: { storeId: store.id, weekStart: previous } },
      include: { entries: true },
    });
    const week = await prisma.developmentWeek.upsert({
      where: { storeId_weekStart: { storeId: store.id, weekStart: start } },
      create: { storeId: store.id, weekStart: start, notes: source?.notes ?? "" },
      update: { notes: source?.notes ?? "" },
    });
    await prisma.developmentEntry.deleteMany({ where: { weekId: week.id } });
    if (source?.entries.length) {
      await prisma.developmentEntry.createMany({
        data: source.entries.map((entry) => ({
          weekId: week.id,
          staffId: entry.staffId,
          hours: entry.hours,
          trainingNeeded: entry.trainingNeeded,
          comments: entry.comments,
        })),
      });
    }
  }
}

export async function listDevelopmentTasks() {
  const who = await access();
  if (who.role !== "admin") redirect("/");
  return prisma.developmentTask.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function addDevelopmentTask(label: string) {
  const who = await access();
  if (who.role !== "admin") throw new Error("Only an admin can change training needed options.");
  const name = label.trim();
  if (!name) throw new Error("Enter a name.");
  const last = await prisma.developmentTask.findFirst({ orderBy: { sortOrder: "desc" } });
  await prisma.developmentTask.create({ data: { label: name.slice(0, 80), sortOrder: (last?.sortOrder ?? 0) + 1 } });
}

export async function renameDevelopmentTask(id: string, label: string) {
  const who = await access();
  if (who.role !== "admin") throw new Error("Only an admin can change training needed options.");
  const name = label.trim();
  if (!name) throw new Error("Enter a name.");
  const current = await prisma.developmentTask.findUnique({ where: { id } });
  if (!current) throw new Error("That option is no longer on the list.");
  if (current.label === name) return;
  await prisma.developmentTask.update({ where: { id }, data: { label: name.slice(0, 80) } });
  await prisma.developmentEntry.updateMany({ where: { trainingNeeded: current.label }, data: { trainingNeeded: name.slice(0, 80) } });
}

export async function removeDevelopmentTask(id: string) {
  const who = await access();
  if (who.role !== "admin") throw new Error("Only an admin can change training needed options.");
  await prisma.developmentTask.delete({ where: { id } });
}

export async function developmentCsv(filters: { week?: string; store?: string; position?: string }) {
  const data = await getDevelopment(filters);
  const rows = [["Employee", "Restaurant", "Position", "Training Hours Needed", "Training Needed", "Comments"]];
  for (const store of data.sections) {
    for (const person of store.people) {
      if (!person.hours && !person.trainingNeeded && !person.comments) continue;
      rows.push([person.name, store.number, person.position, person.hours, person.trainingNeeded, person.comments]);
    }
    if (store.notes) rows.push(["(Store note)", store.number, "", "", "", store.notes]);
  }
  const span = data.store || "all-stores";
  return { filename: `development-${span}-${data.weekStart}.csv`, csv: toCsv(rows) };
}
