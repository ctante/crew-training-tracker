import { access, storeIdWhere } from "./access";
import { MAPPED_POSITIONS } from "./constants";
import { parseCsv } from "./csv";
import { prisma } from "./db";
import { normalizeStoreNumber } from "./format";

export function employeeNameKey(name: string) {
  return name.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
}

const NAME_PARTICLES = new Set(["de", "del", "la", "y"]);

function formatNameWord(word: string, isFirst: boolean): string {
  if (!word) return word;
  if (word.includes("-")) {
    return word
      .split("-")
      .map((part, index) => formatNameWord(part, isFirst && index === 0))
      .join("-");
  }
  const lower = word.toLowerCase().replace(/[’‘]/g, "'");
  if (/^(i{1,3}|iv|v|vi{0,3}|ix|x)$/.test(lower)) return lower.toUpperCase();
  if (lower === "jr" || lower === "jr.") return lower.endsWith(".") ? "Jr." : "Jr";
  if (lower === "sr" || lower === "sr.") return lower.endsWith(".") ? "Sr." : "Sr";
  if (!isFirst && NAME_PARTICLES.has(lower)) return lower;
  if (lower.startsWith("mc") && lower.length > 3) return "Mc" + lower.charAt(2).toUpperCase() + lower.slice(3);
  if (lower.startsWith("mac") && lower.length > 4 && lower !== "macias") {
    return "Mac" + lower.charAt(3).toUpperCase() + lower.slice(4);
  }
  if (lower.includes("'")) {
    return lower
      .split("'")
      .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
      .join("'");
  }
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function titleCasePersonName(raw: string) {
  const cleaned = raw.trim().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .map((word, index) => formatNameWord(word, index === 0))
    .join(" ")
    .slice(0, 80);
}

export function chooseDisplayName(rosterName: string, existing?: string) {
  const titled = titleCasePersonName(rosterName);
  const current = existing?.trim().replace(/\s+/g, " ") ?? "";
  const roster = rosterName.trim().replace(/\s+/g, " ");
  if (current && employeeNameKey(current) === employeeNameKey(roster) && current !== roster) return current.slice(0, 80);
  return titled;
}

const CREW_TITLES = new Set(["PRIMARY MAIN PERSON", "BACKUP MAINTENANCE PERSON"]);

export function mapJobTitle(raw: string) {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  const key = cleaned.toUpperCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (CREW_TITLES.has(key)) return "Crew Person";
  return cleaned
    .toLowerCase()
    .replace(/(^|[^a-z])([a-z])/g, (_, lead: string, letter: string) => lead + letter.toUpperCase())
    .replace(/\b(i{1,3}|iv|vi{0,3}|ix|x)\b/gi, (token) => token.toUpperCase());
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

export type NameShape = { loose: string; tokens: string[]; significant: string[] };

export function nameShape(name: string): NameShape {
  const loose = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = loose.split(" ").filter(Boolean);
  return { loose, tokens, significant: tokens.filter((token) => token.length > 1) };
}

export function namesMatch(leftName: string, rightName: string) {
  const left = nameShape(leftName);
  const right = nameShape(rightName);
  if (!left.loose || !right.loose) return false;
  if (left.loose === right.loose) return true;
  const shorter = left.significant.length <= right.significant.length ? left.significant : right.significant;
  const longer = shorter === left.significant ? right.significant : left.significant;
  if (shorter.length >= 2 && shorter.every((token) => longer.includes(token))) return true;
  const leftLast = left.significant.at(-1) ?? "";
  const rightLast = right.significant.at(-1) ?? "";
  if (leftLast && leftLast === rightLast) {
    const leftFirst = left.significant[0] ?? "";
    const rightFirst = right.significant[0] ?? "";
    const min = Math.min(leftFirst.length, rightFirst.length);
    if (min >= 3 && (leftFirst.startsWith(rightFirst) || rightFirst.startsWith(leftFirst))) return true;
    if (left.tokens[0]?.length === 1 && rightFirst.startsWith(left.tokens[0])) return true;
    if (right.tokens[0]?.length === 1 && leftFirst.startsWith(right.tokens[0])) return true;
  }
  if (left.significant.length === 1 && right.significant.length >= 1) {
    const short = left.significant[0];
    return short.length >= 3 && right.significant[0].startsWith(short);
  }
  if (right.significant.length === 1 && left.significant.length >= 1) {
    const short = right.significant[0];
    return short.length >= 3 && left.significant[0].startsWith(short);
  }
  return false;
}

export function uniqueNameMatches<T extends { name: string }, U extends { name: string }>(left: T[], right: U[]) {
  const hits = left.map((item) => ({ item, matches: right.filter((other) => namesMatch(item.name, other.name)) }));
  const rightCount = new Map<U, number>();
  for (const row of hits) {
    for (const match of row.matches) rightCount.set(match, (rightCount.get(match) ?? 0) + 1);
  }
  const pairs: { left: T; right: U }[] = [];
  const ambiguous: { name: string; candidates: string[] }[] = [];
  for (const row of hits) {
    if (row.matches.length === 1 && rightCount.get(row.matches[0]) === 1) {
      pairs.push({ left: row.item, right: row.matches[0] });
    } else if (row.matches.length > 0) {
      ambiguous.push({ name: row.item.name, candidates: [...new Set(row.matches.map((match) => match.name))] });
    }
  }
  return { pairs, ambiguous };
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
  let corrected = 0;
  const corrections: { store: string; kind: string; fromName: string; toName: string; position: string; note: string }[] = [];
  const ambiguous: { store: string; kind: string; name: string; candidates: string[] }[] = [];
  const pending: { storeId: string; storeNumber: string; name: string; position: string; externalId: string | null }[] = [];
  const seenByStore = new Map<string, Set<string>>();
  const cache = new Map<string, Awaited<ReturnType<typeof prisma.employee.findMany>>>();

  for (const row of rows) {
    const number = normalizeStoreNumber(row.store);
    const store = byNumber.get(number);
    const name = row.name.trim().replace(/\s+/g, " ");
    if (!store || name.length < 2) continue;
    const externalId = row.employeeId?.trim() || null;
    const position = mapJobTitle(row.position ?? "").slice(0, 80);
    const storedName = (current?: string) => chooseDisplayName(name, current);
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
          name: storedName(match.name),
          position,
          active: true,
          externalId: externalId ?? match.externalId,
          source: "qsrsoft",
          lastSyncedAt: now,
        },
      });
      const nextName = storedName(match.name);
      const renamed = employeeNameKey(match.name) !== employeeNameKey(name);
      if (renamed) {
        corrected += 1;
        corrections.push({ store: store.number, kind: "employee", fromName: match.name, toName: nextName, position, note: "" });
      } else if (match.active) updated += 1;
      else reactivated += 1;
      const seen = seenByStore.get(store.id) ?? new Set<string>();
      seen.add(match.id);
      seenByStore.set(store.id, seen);
      Object.assign(match, { name: storedName(match.name), externalId: externalId ?? match.externalId, active: true, source: "qsrsoft" });
    } else {
      pending.push({ storeId: store.id, storeNumber: store.number, name: name.slice(0, 80), position, externalId });
    }
  }

  const pendingByStore = new Map<string, typeof pending>();
  for (const row of pending) {
    pendingByStore.set(row.storeId, [...(pendingByStore.get(row.storeId) ?? []), row]);
  }
  for (const [storeId, rowsForStore] of pendingByStore) {
    const people = cache.get(storeId) ?? [];
    const seen = seenByStore.get(storeId) ?? new Set<string>();
    const manuals = people.filter((person) => person.source === "manual" && !seen.has(person.id));
    const paired = uniqueNameMatches(rowsForStore, manuals);
    const usedRows = new Set(paired.pairs.map((pair) => pair.left));
    for (const pair of paired.pairs) {
      const nextName = chooseDisplayName(pair.left.name, pair.right.name);
      await prisma.employee.update({
        where: { id: pair.right.id },
        data: {
          name: nextName,
          position: pair.left.position,
          active: true,
          externalId: pair.left.externalId ?? pair.right.externalId,
          source: "qsrsoft",
          lastSyncedAt: now,
        },
      });
      corrected += 1;
      corrections.push({
        store: pair.left.storeNumber,
        kind: "employee",
        fromName: pair.right.name,
        toName: nextName,
        position: pair.left.position,
        note: "",
      });
      seen.add(pair.right.id);
      Object.assign(pair.right, { name: nextName, active: true, source: "qsrsoft" });
    }
    for (const skip of paired.ambiguous) {
      ambiguous.push({ store: rowsForStore[0]?.storeNumber ?? "", kind: "employee", name: skip.name, candidates: skip.candidates });
    }
    const creating = rowsForStore.filter((row) => !usedRows.has(row));
    if (creating.length) {
      await prisma.employee.createMany({
        data: creating.map((row) => ({
          storeId,
          name: titleCasePersonName(row.name),
          position: row.position,
          active: true,
          externalId: row.externalId,
          source: "qsrsoft" as const,
          lastSyncedAt: now,
        })),
      });
      added += creating.length;
    }
    const refreshed = await prisma.employee.findMany({ where: { storeId } });
    const createdKeys = new Set(creating.map((row) => employeeNameKey(row.name)));
    for (const person of refreshed) {
      if (createdKeys.has(employeeNameKey(person.name))) seen.add(person.id);
    }
    seenByStore.set(storeId, seen);
    cache.set(storeId, refreshed);
  }

  for (const [storeId, seen] of seenByStore) {
    const retired = await prisma.employee.updateMany({
      where: { storeId, active: true, id: { notIn: [...seen] } },
      data: { active: false, lastSyncedAt: now },
    });
    deactivated += retired.count;
  }
  const linked = await correctRosterNames([...seenByStore.keys()]);
  corrected += linked.corrected;
  corrections.push(...linked.corrections);
  ambiguous.push(...linked.ambiguous);
  await linkEmployees();
  await refreshRosterPositions();
  if (corrections.length || ambiguous.length) {
    await prisma.rosterCorrection.createMany({
      data: [
        ...corrections.map((row) => ({
          storeNumber: row.store,
          kind: row.kind,
          fromName: row.fromName,
          toName: row.toName,
          position: row.position,
          note: "corrected",
        })),
        ...ambiguous.map((row) => ({
          storeNumber: row.store,
          kind: row.kind,
          fromName: row.name,
          toName: "",
          position: "",
          note: `ambiguous: ${row.candidates.join(", ")}`,
        })),
      ],
    });
  }
  const report = await rosterReport();
  return { added, updated, deactivated, reactivated, corrected, corrections, ambiguous, ...report };
}

async function rosterReport() {
  const [employees, trainees, trainers] = await Promise.all([
    prisma.employee.findMany({ include: { store: true } }),
    prisma.trainee.findMany({
      where: { employee: { is: { active: false } } },
      include: { store: true },
      orderBy: [{ store: { number: "asc" } }, { name: "asc" }],
    }),
    prisma.staff.findMany({
      where: { employee: { is: { active: false } } },
      include: { store: true },
      orderBy: [{ store: { number: "asc" } }, { name: "asc" }],
    }),
  ]);
  const byStore = new Map<string, { active: number; inactive: number }>();
  for (const person of employees) {
    const counts = byStore.get(person.store.number) ?? { active: 0, inactive: 0 };
    if (person.active) counts.active += 1;
    else counts.inactive += 1;
    byStore.set(person.store.number, counts);
  }
  return {
    byStore: [...byStore.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([store, counts]) => ({ store, ...counts })),
    hidden: [
      ...trainees.map((person) => ({ kind: "trainee", store: person.store.number, name: person.name })),
      ...trainers.map((person) => ({ kind: "trainer", store: person.store.number, name: person.name })),
    ],
  };
}

async function correctRosterNames(storeIds: string[]) {
  let corrected = 0;
  const corrections: { store: string; kind: string; fromName: string; toName: string; position: string; note: string }[] = [];
  const ambiguous: { store: string; kind: string; name: string; candidates: string[] }[] = [];
  if (!storeIds.length) return { corrected, corrections, ambiguous };
  const stores = await prisma.store.findMany({
    where: { id: { in: storeIds } },
    include: {
      employees: { where: { active: true } },
      trainees: { where: { employeeId: null } },
      staff: { where: { OR: [{ employeeId: null }, { rosterSource: "manual" }] } },
    },
  });
  for (const store of stores) {
    const traineePairs = uniqueNameMatches(store.trainees, store.employees);
    for (const pair of traineePairs.pairs) {
      await prisma.trainee.update({
        where: { id: pair.left.id },
        data: { employeeId: pair.right.id, name: pair.right.name, position: pair.right.position },
      });
      corrected += 1;
      corrections.push({ store: store.number, kind: "trainee", fromName: pair.left.name, toName: pair.right.name, position: pair.right.position, note: "" });
    }
    for (const skip of traineePairs.ambiguous) {
      ambiguous.push({ store: store.number, kind: "trainee", name: skip.name, candidates: skip.candidates });
    }
    const staffPairs = uniqueNameMatches(store.staff, store.employees);
    for (const pair of staffPairs.pairs) {
      const same = pair.left.employeeId === pair.right.id && pair.left.name === pair.right.name && pair.left.position === pair.right.position;
      if (same) continue;
      await prisma.staff.update({
        where: { id: pair.left.id },
        data: { employeeId: pair.right.id, name: pair.right.name, position: pair.right.position },
      });
      corrected += 1;
      corrections.push({ store: store.number, kind: "trainer", fromName: pair.left.name, toName: pair.right.name, position: pair.right.position, note: "" });
    }
    for (const skip of staffPairs.ambiguous) {
      ambiguous.push({ store: store.number, kind: "trainer", name: skip.name, candidates: skip.candidates });
    }
  }
  return { corrected, corrections, ambiguous };
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
    const display = (current?: string) => chooseDisplayName(name, current);
    const people = await prisma.employee.findMany({ where: { storeId: store.id } });
    const match = externalId
      ? people.find((person) => person.externalId === externalId)
      : people.find((person) => employeeNameKey(person.name) === employeeNameKey(name));
    if (match) {
      await prisma.employee.update({
        where: { id: match.id },
        data: {
          name: display(match.name),
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
          name: display(),
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

export async function positionChoices() {
  const rows = await prisma.employee.findMany({ distinct: ["position"], select: { position: true }, orderBy: { position: "asc" } });
  return [...new Set([...MAPPED_POSITIONS, ...rows.map((row) => row.position.trim()).filter(Boolean)])].sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" }),
  );
}

export async function refreshRosterPositions() {
  const examples: { kind: string; name: string; from: string; to: string }[] = [];
  const note = (kind: string, name: string, from: string, to: string) => {
    if (examples.length < 8) examples.push({ kind, name, from, to });
  };
  let employees = 0;
  let trainees = 0;
  let trainers = 0;
  for (const person of await prisma.employee.findMany()) {
    const next = mapJobTitle(person.position);
    if (!next || next === person.position) continue;
    await prisma.employee.update({ where: { id: person.id }, data: { position: next } });
    employees += 1;
    note("employee", person.name, person.position, next);
  }
  const traineeRows = await prisma.trainee.findMany({ where: { employeeId: { not: null } }, include: { employee: true } });
  for (const person of traineeRows) {
    const next = person.employee?.position ?? "";
    if (!next || next === person.position) continue;
    await prisma.trainee.update({ where: { id: person.id }, data: { position: next } });
    trainees += 1;
    note("trainee", person.name, person.position, next);
  }
  const trainerRows = await prisma.staff.findMany({ where: { employeeId: { not: null } }, include: { employee: true } });
  for (const person of trainerRows) {
    const next = person.employee?.position ?? "";
    if (!next || next === person.position) continue;
    await prisma.staff.update({ where: { id: person.id }, data: { position: next } });
    trainers += 1;
    note("trainer", person.name, person.position, next);
  }
  return { employees, trainees, trainers, changed: employees + trainees + trainers, examples };
}

export function linkedPosition(person: { position: string; employee?: { position: string } | null }) {
  return person.employee?.position?.trim() || person.position;
}

export async function recentRosterNotes() {
  const dismissal = await prisma.rosterCorrectionDismissal.findUnique({ where: { id: "roster" } });
  return prisma.rosterCorrection.findMany({
    where: dismissal ? { createdAt: { gt: dismissal.dismissedAt } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 40,
  });
}

export async function dismissRosterCorrections() {
  const who = await access();
  if (who.role !== "admin") throw new Error("Only an admin can dismiss roster corrections.");
  const dismissedAt = new Date();
  await prisma.rosterCorrectionDismissal.upsert({
    where: { id: "roster" },
    create: { id: "roster", dismissedAt },
    update: { dismissedAt },
  });
}

export async function normalizeStoredPersonNames() {
  const examples: { kind: string; from: string; to: string }[] = [];
  const note = (kind: string, from: string, to: string) => {
    if (examples.length < 15) examples.push({ kind, from, to });
  };
  let employees = 0;
  let trainees = 0;
  let trainers = 0;
  for (const person of await prisma.employee.findMany()) {
    const next = titleCasePersonName(person.name);
    if (!next || next === person.name) continue;
    await prisma.employee.update({ where: { id: person.id }, data: { name: next } });
    employees += 1;
    note("employee", person.name, next);
  }
  for (const person of await prisma.trainee.findMany()) {
    const next = titleCasePersonName(person.name);
    if (!next || next === person.name) continue;
    await prisma.trainee.update({ where: { id: person.id }, data: { name: next } });
    trainees += 1;
    note("trainee", person.name, next);
  }
  for (const person of await prisma.staff.findMany()) {
    const next = titleCasePersonName(person.name);
    if (!next || next === person.name) continue;
    await prisma.staff.update({ where: { id: person.id }, data: { name: next } });
    trainers += 1;
    note("trainer", person.name, next);
  }
  return { employees, trainees, trainers, examples };
}

export async function listEmployees() {
  const who = await access();
  if (who.role !== "admin") throw new Error("Only an admin can open the employee roster.");
  return prisma.employee.findMany({ include: { store: true }, orderBy: [{ store: { number: "asc" } }, { name: "asc" }] });
}
