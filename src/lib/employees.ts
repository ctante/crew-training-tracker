import { access, storeIdWhere } from "./access";
import { parseCsv } from "./csv";
import { prisma } from "./db";
import { normalizeStoreNumber } from "./format";

export function employeeNameKey(name: string) {
  return name.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
}

const CREW_TITLES = new Set(["PRIMARY MAIN PERSON", "BACKUP MAINTENANCE PERSON"]);

export function mapJobTitle(raw: string) {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  const key = cleaned.toUpperCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (CREW_TITLES.has(key)) return "Crew Person";
  return cleaned.toLowerCase().replace(/(^|[^a-z])([a-z])/g, (_, lead: string, letter: string) => lead + letter.toUpperCase());
}

export function parseRosterCsv(text: string): SnapshotPerson[] {
  const table = parseCsv(text);
  if (table.length < 2) throw new Error("The roster file needs a header and at least one person.");
  const headers = table[0].map((header) => header.trim().toLowerCase());
  const index = (names: string[]) => names.map((name) => headers.indexOf(name)).find((item) => item >= 0) ?? -1;
  const storeCol = index(["store", "restaurant", "store number"]);
  const nameCol = index(["name", "employee"]);
  const jobCol = index(["job title", "position"]);
  if (storeCol < 0 || nameCol < 0 || jobCol < 0) {
    throw new Error("The header needs Store, Name, and Job Title.");
  }
  return table.slice(1).flatMap((row) => {
    const store = (row[storeCol] ?? "").trim();
    const name = (row[nameCol] ?? "").trim();
    if (!store || !name) return [];
    return [{ store, name, position: mapJobTitle(row[jobCol] ?? "") }];
  });
}

export function rosterCsvBody(text: string, contentType: string) {
  const type = contentType.toLowerCase();
  if (type.includes("csv")) return true;
  const first = text.replace(/^\uFEFF/, "").trimStart().split(/\r?\n/, 1)[0]?.toLowerCase() ?? "";
  return first.startsWith("store,") && first.includes("name") && (first.includes("job title") || first.includes("position"));
}

export function visibleLinkedWhere(showInactive: boolean) {
  if (showInactive) return {};
  return { OR: [{ employeeId: null }, { employee: { is: { active: true } } }] };
}

export async function showInactiveEmployees(requested: boolean) {
  if (!requested) return false;
  const who = await access();
  return who.role === "admin";
}

type SnapshotPerson = { store: string; employeeId?: string; name: string; position?: string };

export async function syncEmployeeSnapshot(rows: SnapshotPerson[]) {
  const stores = await prisma.store.findMany();
  const byNumber = new Map(stores.map((store) => [store.number, store]));
  const now = new Date();
  let added = 0;
  let updated = 0;
  let deactivated = 0;
  let reactivated = 0;
  const seenByStore = new Map<string, Set<string>>();
  const cache = new Map<string, Awaited<ReturnType<typeof prisma.employee.findMany>>>();

  for (const row of rows) {
    const number = normalizeStoreNumber(row.store);
    const store = byNumber.get(number);
    const name = row.name.trim().replace(/\s+/g, " ");
    if (!store || name.length < 2) continue;
    const externalId = row.employeeId?.trim() || null;
    const position = mapJobTitle(row.position ?? "").slice(0, 80);
    const people = cache.get(store.id) ?? (await prisma.employee.findMany({ where: { storeId: store.id } }));
    cache.set(store.id, people);
    const match = externalId
      ? people.find((person) => person.externalId === externalId) ??
        people.find((person) => !person.externalId && employeeNameKey(person.name) === employeeNameKey(name))
      : people.find((person) => employeeNameKey(person.name) === employeeNameKey(name));
    if (match) {
      await prisma.employee.update({
        where: { id: match.id },
        data: {
          name: name.slice(0, 80),
          position,
          active: true,
          externalId: externalId ?? match.externalId,
          source: "qsrsoft",
          lastSyncedAt: now,
        },
      });
      if (match.active) updated += 1;
      else reactivated += 1;
      const seen = seenByStore.get(store.id) ?? new Set<string>();
      seen.add(match.id);
      seenByStore.set(store.id, seen);
      Object.assign(match, { name: name.slice(0, 80), externalId: externalId ?? match.externalId, active: true });
    } else {
      const created = await prisma.employee.create({
        data: {
          storeId: store.id,
          name: name.slice(0, 80),
          position,
          active: true,
          externalId,
          source: "qsrsoft",
          lastSyncedAt: now,
        },
      });
      added += 1;
      people.push(created);
      const seen = seenByStore.get(store.id) ?? new Set<string>();
      seen.add(created.id);
      seenByStore.set(store.id, seen);
    }
  }

  for (const [storeId, seen] of seenByStore) {
    const retired = await prisma.employee.updateMany({
      where: { storeId, active: true, id: { notIn: [...seen] } },
      data: { active: false, lastSyncedAt: now },
    });
    deactivated += retired.count;
  }
  await linkEmployees();
  return { added, updated, deactivated, reactivated };
}

export async function linkEmployees() {
  const stores = await prisma.store.findMany({
    include: { employees: true, trainees: true, staff: true },
  });
  let traineesLinked = 0;
  let trainersLinked = 0;
  let traineesAmbiguous = 0;
  let trainersAmbiguous = 0;
  for (const store of stores) {
    const groups = new Map<string, typeof store.employees>();
    for (const person of store.employees) {
      const key = employeeNameKey(person.name);
      if (!key) continue;
      groups.set(key, [...(groups.get(key) ?? []), person]);
    }
    for (const trainee of store.trainees) {
      const matches = groups.get(employeeNameKey(trainee.name)) ?? [];
      if (matches.length !== 1) {
        if (matches.length > 1) traineesAmbiguous += 1;
        continue;
      }
      if (trainee.employeeId === matches[0].id) continue;
      await prisma.trainee.update({ where: { id: trainee.id }, data: { employeeId: matches[0].id } });
      traineesLinked += 1;
    }
    for (const trainer of store.staff) {
      const matches = groups.get(employeeNameKey(trainer.name)) ?? [];
      if (matches.length !== 1) {
        if (matches.length > 1) trainersAmbiguous += 1;
        continue;
      }
      if (trainer.employeeId === matches[0].id) continue;
      await prisma.staff.update({ where: { id: trainer.id }, data: { employeeId: matches[0].id } });
      trainersLinked += 1;
    }
  }
  return { traineesLinked, trainersLinked, traineesAmbiguous, trainersAmbiguous };
}

export async function suggestEmployees(query: string, storeId?: string) {
  const who = await access();
  const needle = employeeNameKey(query);
  if (needle.length < 1) return [];
  const scope = storeIdWhere(who);
  const people = await prisma.employee.findMany({
    where: {
      active: true,
      ...(storeId ? { storeId } : {}),
      ...(scope ? { store: scope } : {}),
    },
    include: { store: true },
    orderBy: { name: "asc" },
    take: 40,
  });
  return people
    .filter((person) => employeeNameKey(person.name).includes(needle))
    .slice(0, 8)
    .map((person) => ({
      id: person.id,
      name: person.name,
      position: person.position,
      storeId: person.storeId,
      storeNumber: person.store.number,
    }));
}

function activeFlag(value: string | undefined) {
  if (!value) return true;
  const text = value.trim().toLowerCase();
  if (["no", "false", "0", "inactive"].includes(text)) return false;
  return true;
}

export async function importEmployeeCsv(csv: string) {
  const who = await access();
  if (who.role !== "admin") throw new Error("Only an admin can import employees.");
  const table = parseCsv(csv);
  if (table.length < 2) throw new Error("Add a header row and at least one person.");
  const headers = table[0].map((header) => header.trim().toLowerCase());
  const index = (names: string[]) => names.map((name) => headers.indexOf(name)).find((item) => item >= 0) ?? -1;
  const storeCol = index(["store", "restaurant", "store number"]);
  const nameCol = index(["name", "employee"]);
  const positionCol = index(["position", "job title"]);
  const idCol = index(["employee_id", "employee id", "external id"]);
  const activeCol = index(["active"]);
  if (storeCol < 0 || nameCol < 0) throw new Error("The header needs store and name columns.");
  const snapshot = table.slice(1).map((row) => ({
    store: row[storeCol] ?? "",
    name: row[nameCol] ?? "",
    position: mapJobTitle(positionCol >= 0 ? row[positionCol] ?? "" : ""),
    employeeId: idCol >= 0 ? row[idCol] ?? "" : "",
    active: activeCol >= 0 ? activeFlag(row[activeCol]) : true,
  }));
  return saveEmployeeRows(snapshot, "manual");
}

async function saveEmployeeRows(
  rows: { store: string; name: string; position: string; employeeId: string; active: boolean }[],
  source: "manual" | "qsrsoft",
) {
  const stores = await prisma.store.findMany();
  const byNumber = new Map(stores.map((store) => [store.number, store]));
  let added = 0;
  let updated = 0;
  for (const row of rows) {
    const store = byNumber.get(normalizeStoreNumber(row.store));
    const name = row.name.trim().replace(/\s+/g, " ");
    if (!store || name.length < 2) continue;
    const externalId = row.employeeId.trim() || null;
    const people = await prisma.employee.findMany({ where: { storeId: store.id } });
    const match = externalId
      ? people.find((person) => person.externalId === externalId)
      : people.find((person) => employeeNameKey(person.name) === employeeNameKey(name));
    if (match) {
      await prisma.employee.update({
        where: { id: match.id },
        data: {
          name: name.slice(0, 80),
          position: row.position.trim().slice(0, 80),
          active: row.active,
          externalId: externalId ?? match.externalId,
          source,
        },
      });
      updated += 1;
    } else {
      await prisma.employee.create({
        data: {
          storeId: store.id,
          name: name.slice(0, 80),
          position: row.position.trim().slice(0, 80),
          active: row.active,
          externalId,
          source,
        },
      });
      added += 1;
    }
  }
  const linked = await linkEmployees();
  return { added, updated, ...linked };
}

export async function addEmployee(input: { storeId: string; name: string; position: string }) {
  const who = await access();
  if (who.role !== "admin") throw new Error("Only an admin can change the employee roster.");
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2) throw new Error("Enter a name.");
  const store = await prisma.store.findUnique({ where: { id: input.storeId } });
  if (!store) throw new Error("Choose a restaurant.");
  const people = await prisma.employee.findMany({ where: { storeId: store.id } });
  if (people.some((person) => employeeNameKey(person.name) === employeeNameKey(name))) {
    throw new Error(`${name} is already at ${store.number}.`);
  }
  await prisma.employee.create({
    data: { storeId: store.id, name: name.slice(0, 80), position: input.position.trim().slice(0, 80), source: "manual", active: true },
  });
  return linkEmployees();
}

export async function updateEmployee(id: string, input: { name: string; position: string; storeId: string }) {
  const who = await access();
  if (who.role !== "admin") throw new Error("Only an admin can change the employee roster.");
  const current = await prisma.employee.findUnique({ where: { id } });
  if (!current) throw new Error("That employee is not on the roster.");
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2) throw new Error("Enter a name.");
  const store = await prisma.store.findUnique({ where: { id: input.storeId } });
  if (!store) throw new Error("Choose a restaurant.");
  const people = await prisma.employee.findMany({ where: { storeId: store.id } });
  if (people.some((person) => person.id !== current.id && employeeNameKey(person.name) === employeeNameKey(name))) {
    throw new Error(`${name} is already at ${store.number}.`);
  }
  await prisma.employee.update({
    where: { id },
    data: { name: name.slice(0, 80), position: input.position.trim().slice(0, 80), storeId: store.id },
  });
  return linkEmployees();
}

export async function setEmployeeActive(id: string, active: boolean) {
  const who = await access();
  if (who.role !== "admin") throw new Error("Only an admin can change the employee roster.");
  await prisma.employee.update({ where: { id }, data: { active } });
}

export async function listEmployees() {
  const who = await access();
  if (who.role !== "admin") throw new Error("Only an admin can open the employee roster.");
  return prisma.employee.findMany({ include: { store: true }, orderBy: [{ store: { number: "asc" } }, { name: "asc" }] });
}
