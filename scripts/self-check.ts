import assert from "node:assert/strict";
import { compareTrainers, trainerPositionRank } from "../src/lib/constants";
import { addCatalogModule, addSecondPath, commitImport, createTrainee, deleteTrainee, exportTraineeCsv, getDashboard, getScheduledSessions, getTrainee, matchLogin, moveCatalogModule, previewImport, removeCatalogModule, setStorePassword, syncDevelopmentReport } from "../src/lib/data";
import { getReports } from "../src/lib/reports";
import { prisma } from "../src/lib/db";
import { daysBetween, formatLongDate, parseLooseDate, selectReportStores, sessionWindow } from "../src/lib/format";
import { loadModuleSeeds } from "../src/lib/module-csv";
import { inferPathChoice, summarize, trainingPaths } from "../src/lib/progress";
import { parseDevelopmentReport } from "../src/lib/roster/parse";
import { csvDevelopmentReportSource } from "../src/lib/roster/source";

async function main() {
  const seeds = loadModuleSeeds();
  assert.equal(seeds.length, 72);
  assert.equal(seeds.filter((row) => row.language === "en" && row.link).length, 24);
  assert.equal(seeds.filter((row) => row.language === "es" && row.link).length, 23);
  assert.equal(seeds.filter((row) => row.needsReview).length, 4);
  assert.equal(parseLooseDate("Wednesday, November 4, 2026"), "2026-11-04");
  assert.equal(formatLongDate("2026-11-04"), "Wednesday, November 4, 2026");

  const stalled = summarize(
    [
      {
        sortOrder: 1,
        section: "FOUNDATION",
        name: "One",
        timeMinutes: 60,
        completed: true,
        completedDate: "2026-10-01",
        scheduledDate: "2026-10-01",
        trainerLabel: "Orientation",
      },
      {
        sortOrder: 2,
        section: "FOUNDATION",
        name: "Two",
        timeMinutes: 30,
        completed: false,
        completedDate: null,
        scheduledDate: null,
        trainerLabel: "",
      },
    ],
    { startDate: "2026-09-01", status: "ACTIVE", today: "2026-11-18" },
  );
  assert.equal(stalled.stalled, true);
  assert.equal(stalled.overdueCount, 0);
  assert.equal(inferPathChoice(4, 1), "SERVICE");
  assert.equal(inferPathChoice(1, 4), "PRODUCTION");
  assert.equal(inferPathChoice(2, 2), null);
  assert.equal(inferPathChoice(0, 0), null);
  assert.deepEqual(trainingPaths("SERVICE", "PRODUCTION"), ["SERVICE", "PRODUCTION"]);
  assert.deepEqual(trainingPaths("SERVICE", "SERVICE"), ["SERVICE"]);
  assert.deepEqual(selectReportStores({ role: "store", ownStore: "05207", requested: ["07276"], entireOrg: true, known: ["05207", "07276"] }), ["05207"]);
  assert.deepEqual(selectReportStores({ role: "admin", requested: [], entireOrg: false, known: ["05207", "07276"] }), ["05207", "07276"]);
  assert.deepEqual(selectReportStores({ role: "admin", requested: ["07276"], entireOrg: false, known: ["05207", "07276"] }), ["07276"]);
  assert.equal(daysBetween("2026-11-01", "2026-11-15"), 14);
  const both = summarize(
    [
      { sortOrder: 1, section: "FOUNDATION", name: "Foundation", timeMinutes: 10, completed: true, completedDate: "2026-11-01", scheduledDate: null, trainerLabel: "" },
      { sortOrder: 11, section: "SERVICE", name: "Service", timeMinutes: 10, completed: true, completedDate: "2026-11-02", scheduledDate: null, trainerLabel: "" },
      { sortOrder: 27, section: "PRODUCTION", name: "Production", timeMinutes: 10, completed: false, completedDate: null, scheduledDate: "2026-11-01", trainerLabel: "" },
    ],
    { startDate: "2026-11-01", status: "ACTIVE", today: "2026-11-19", paths: ["SERVICE", "PRODUCTION"] },
  );
  assert.equal(both.total, 3);
  assert.equal(both.completed, 2);
  assert.equal(both.overdueCount, 1);
  const wednesday = sessionWindow("2026-11-19", "this-week");
  assert.equal(wednesday.start, "2026-11-16");
  assert.equal(wednesday.end, "2026-11-22");
  assert.equal(sessionWindow("2026-11-16", "this-week").start, "2026-11-16");
  assert.equal(sessionWindow("2026-11-22", "this-week").end, "2026-11-22");
  assert.equal(sessionWindow("2026-11-19", "last-week").start, "2026-11-09");
  assert.equal(sessionWindow("2026-11-19", "next-week").end, "2026-11-29");
  assert.deepEqual(sessionWindow("2026-11-19", "this-month"), {
    range: "this-month",
    start: "2026-11-01",
    end: "2026-11-30",
  });
  const scoped = summarize(
    [
      {
        sortOrder: 1,
        section: "FOUNDATION",
        name: "Foundation",
        timeMinutes: 10,
        completed: true,
        completedDate: "2026-11-01",
        scheduledDate: null,
        trainerLabel: "",
      },
      {
        sortOrder: 11,
        section: "SERVICE",
        name: "Service",
        timeMinutes: 10,
        completed: false,
        completedDate: null,
        scheduledDate: null,
        trainerLabel: "",
      },
      {
        sortOrder: 27,
        section: "PRODUCTION",
        name: "Production",
        timeMinutes: 10,
        completed: false,
        completedDate: null,
        scheduledDate: "2026-11-01",
        trainerLabel: "",
      },
    ],
    { startDate: "2026-11-01", status: "ACTIVE", today: "2026-11-19", path: "SERVICE" },
  );
  assert.equal(scoped.total, 2);
  assert.equal(scoped.completed, 1);
  assert.equal(scoped.percent, 50);
  assert.equal(scoped.overdueCount, 0);
  assert.equal(scoped.sections.map((section) => section.section).join(","), "ORIENTATION,FOUNDATION,SERVICE");
  assert.equal(scoped.sections.find((section) => section.section === "ORIENTATION")?.total, 0);
  assert.equal(scoped.percent, 50);
  const unset = summarize(
    [
      {
        sortOrder: 1,
        section: "FOUNDATION",
        name: "Foundation",
        timeMinutes: 10,
        completed: false,
        completedDate: null,
        scheduledDate: null,
        trainerLabel: "",
      },
      {
        sortOrder: 11,
        section: "SERVICE",
        name: "Service",
        timeMinutes: 10,
        completed: true,
        completedDate: "2026-11-01",
        scheduledDate: null,
        trainerLabel: "",
      },
    ],
    { startDate: "2026-11-01", status: "ACTIVE", today: "2026-11-19", path: null },
  );
  assert.equal(unset.total, 1);
  assert.equal(unset.completed, 0);

  const [stores, modules, trainees, flagged] = await Promise.all([
    prisma.store.count(),
    prisma.module.count(),
    prisma.trainee.count(),
    prisma.module.count({ where: { needsReview: true } }),
  ]);
  assert.equal(stores, 10);
  assert.equal(modules, 72);
  assert.equal(trainees, 24);
  assert.equal(flagged, 4);

  const board = await getDashboard({ status: "ACTIVE" });
  assert.ok(board.rows.some((row) => row.progress.overdueCount > 0));
  assert.ok(board.rows.some((row) => row.progress.stalled));
  assert.ok(board.stats.dueToday > 0);

  const riley = board.rows.find((row) => row.name === "Riley Sample");
  assert.ok(riley);
  const rileyDetail = await getTrainee(riley.id);
  assert.ok(rileyDetail);
  assert.equal(rileyDetail.path, "SERVICE");
  assert.equal(
    rileyDetail.modules.some((module) => module.section === "PRODUCTION"),
    false,
  );
  const file = await exportTraineeCsv(riley.id);
  assert.ok(file);
  assert.ok(file.csv.includes("Module,Time,Videos,Credit,Date,Trainer,Completed"));
  const preview = await previewImport(file.csv, {
    storeNumber: "05207",
    trainee: "Riley Sample",
    language: "en",
    startDate: "2026-10-27",
    position: "Crew",
  });
  assert.equal(preview.applicable, rileyDetail.modules.length, JSON.stringify(preview.issues));
  assert.equal(preview.issues.length, 0);

  const memberships = await prisma.trainee.findMany({ select: { storeId: true } });
  const perStore = new Map<string, number>();
  for (const membership of memberships) {
    perStore.set(membership.storeId, (perStore.get(membership.storeId) ?? 0) + 1);
  }
  assert.equal(perStore.size, 10);
  for (const count of perStore.values()) {
    assert.ok(count >= 2 && count <= 3);
  }
  const ordered = [
    { position: "General Manager", name: "Zoe" },
    { position: "Crew Trainer", name: "Zoe" },
    { position: "Area Manager", name: "Amy" },
    { position: "Shift Manager", name: "Amy" },
    { position: "Assistant Manager", name: "Amy" },
    { position: "Gen Mgr", name: "Amy" },
    { position: "Crew Trainer", name: "Amy" },
  ].sort(compareTrainers);
  assert.deepEqual(
    ordered.map((person) => `${person.position}:${person.name}`),
    [
      "Crew Trainer:Amy",
      "Crew Trainer:Zoe",
      "Area Manager:Amy",
      "Shift Manager:Amy",
      "Assistant Manager:Amy",
      "Gen Mgr:Amy",
      "General Manager:Zoe",
    ],
  );
  assert.ok(trainerPositionRank("Area Mgr") < trainerPositionRank("Shift Mgr"));

  const parsed = parseDevelopmentReport("Name,Store,Position,Qualified\nPat Example,5207,Crew Trainer,Yes\n");
  assert.equal(parsed.entries[0]?.storeNumber, "05207");
  assert.equal(parsed.entries[0]?.qualified, true);

  const rosterNames = ["Aaa Qualified", "Zed Unqualified", "Keeper Qualified"];
  try {
    await syncDevelopmentReport(
      csvDevelopmentReportSource(`Name,Store,Position,Qualified
Aaa Qualified,05207,Crew Trainer,Yes
Zed Unqualified,05207,Shift Manager,No
`),
    );
    const during = await getTrainee(riley.id);
    assert.ok(during);
    assert.ok(during.trainers.some((trainer) => trainer.name === "Aaa Qualified"));
    assert.equal(
      during.trainers.some((trainer) => trainer.name === "Zed Unqualified"),
      false,
    );
    const crewIndex = during.trainers.findIndex((trainer) => trainer.position === "Crew Trainer");
    const gmIndex = during.trainers.findIndex((trainer) => trainer.position === "General Manager");
    assert.ok(crewIndex >= 0 && gmIndex > crewIndex);
    await syncDevelopmentReport(
      csvDevelopmentReportSource("Name,Store,Position,Qualified\nKeeper Qualified,5207,Area Manager,Yes\n"),
    );
    const after = await getTrainee(riley.id);
    assert.ok(after);
    assert.equal(
      after.trainers.some((trainer) => trainer.name === "Aaa Qualified"),
      false,
    );
    assert.ok(after.trainers.some((trainer) => trainer.name === "Keeper Qualified"));
    const crewNames = after.trainers.filter((trainer) => trainer.position === "Crew Trainer").map((trainer) => trainer.name);
    assert.deepEqual(crewNames, [...crewNames].sort((a, b) => a.localeCompare(b, "en")));
  } finally {
    await prisma.staff.deleteMany({ where: { name: { in: rosterNames } } });
    await prisma.rosterSync.deleteMany();
  }

  const sheet = `Store Number,Trainee,Language,Start Date,Section,Module,Time,Date,Trainer,Completed
05207,Sheet Check Person,EN,2026-10-01,Foundation,Fries,10 min,2026-10-02,Nobody Known,TRUE
05207,Sheet Check Person,EN,2026-10-01,Foundation,  fries ,2 hr,2026-10-03,Nobody Known,FALSE
05207,Sheet Check Person,EN,2026-10-01,Foundation,Not A Real Module,10 min,,Nobody Known,FALSE
`;
  try {
    const preview = await previewImport(sheet, null);
    assert.equal(preview.mode, "bulk");
    assert.equal(preview.trainees, 1);
    assert.equal(preview.applicable, 2);
    assert.equal(preview.unmatched, 1);
    assert.ok(preview.issues.some((issue) => issue.message.includes("Not A Real Module")));
    const first = await commitImport(sheet, null);
    assert.equal(first.created.length, 1);
    const person = await prisma.trainee.findFirst({
      where: { name: "Sheet Check Person" },
      include: { modules: { include: { module: true } } },
    });
    assert.ok(person);
    assert.equal(person.startDate, "2026-10-01");
    const video = person.modules.find((row) => row.module.name === "Fries" && row.module.timeLabel === "10 min");
    const floor = person.modules.find((row) => row.module.name === "Fries" && row.module.timeLabel === "2 hr");
    assert.equal(video?.completed, true);
    assert.equal(video?.scheduledDate, "2026-10-02");
    assert.equal(video?.trainerLabel, "Nobody Known");
    assert.equal(video?.trainerId, null);
    assert.equal(floor?.completed, false);
    assert.equal(floor?.scheduledDate, "2026-10-03");
    const second = await commitImport(sheet, null);
    assert.equal(second.created.length, 0);
    assert.equal(second.updated.length, 1);
    assert.equal(await prisma.trainee.count({ where: { name: "Sheet Check Person" } }), 1);
  } finally {
    await prisma.trainee.deleteMany({ where: { name: "Sheet Check Person" } });
  }

  const rosterCsv = "Name,Store,Position,Qualified\nIdem Trainer,05207,Crew Trainer,Yes\n";
  const staffBefore = await prisma.staff.findMany({
    where: { store: { number: "05207" } },
    select: { id: true, active: true, qualified: true, isTrainer: true },
  });
  try {
    await syncDevelopmentReport(csvDevelopmentReportSource(rosterCsv));
    await syncDevelopmentReport(csvDevelopmentReportSource(rosterCsv));
    assert.equal(await prisma.staff.count({ where: { name: "Idem Trainer" } }), 1);
    const gone = await syncDevelopmentReport(csvDevelopmentReportSource("Name,Store,Position,Qualified\nOther Trainer,05207,Crew Trainer,Yes\n"));
    assert.ok(gone.deactivatedCount >= 1);
    const retired = await prisma.staff.findFirstOrThrow({ where: { name: "Idem Trainer" } });
    assert.equal(retired.active, false);
    assert.equal(retired.qualified, false);
    const report = await getReports({ storeNumbers: ["05207"], entireOrg: false, range: "all" });
    assert.deepEqual(report.selected, ["05207"]);
    assert.equal(report.completion.length, 1);
    assert.equal(report.completionTotal.trainees, report.completion[0].trainees);
    assert.equal(report.moduleRows.filter((row) => row.section === "ORIENTATION").length, 0);
    assert.ok(report.moduleRows.some((row) => row.section === "FOUNDATION" && row.eligible > 0));
    const storeOnly = await prisma.store.findUniqueOrThrow({ where: { number: "05207" } });
    const createdId = await createTrainee({
      name: "Second Path Check",
      storeId: storeOnly.id,
      startDate: "2026-11-01",
      language: "en",
      position: "",
      path: "SERVICE",
    });
    await assert.rejects(() => addSecondPath(createdId));
    await prisma.traineeModule.updateMany({
      where: { traineeId: createdId, module: { section: { in: ["FOUNDATION", "SERVICE"] } } },
      data: { completed: true, completedDate: "2026-11-02" },
    });
    await addSecondPath(createdId);
    const after = await getTrainee(createdId);
    assert.equal(after?.secondPath, "PRODUCTION");
    assert.equal(after?.scheduleComplete, false);
    assert.ok(after?.firstPathCompletedOn);
    assert.equal(after?.modules.some((module) => module.section === "PRODUCTION"), true);
  } finally {
    await prisma.trainee.deleteMany({ where: { name: "Second Path Check" } });
    await prisma.staff.deleteMany({ where: { name: { in: ["Idem Trainer", "Other Trainer"] } } });
    for (const person of staffBefore) {
      await prisma.staff.update({
        where: { id: person.id },
        data: { active: person.active, qualified: person.qualified, isTrainer: person.isTrainer },
      });
    }
    await prisma.rosterSync.deleteMany();
  }

  const storeA = await prisma.store.findUniqueOrThrow({ where: { number: "05207" } });
  const storeB = await prisma.store.findUniqueOrThrow({ where: { number: "07276" } });
  const traineeB = await prisma.trainee.findFirstOrThrow({ where: { storeId: storeB.id } });
  try {
    const hidden = await getTrainee(traineeB.id, { role: "store", storeId: storeA.id, storeNumber: "05207" });
    assert.equal(hidden, null);
    const shown = await getTrainee(traineeB.id, { role: "store", storeId: storeB.id, storeNumber: "07276" });
    assert.equal(shown?.id, traineeB.id);
    await assert.rejects(() => deleteTrainee(traineeB.id, { role: "store", storeId: storeA.id, storeNumber: "05207" }));
    assert.ok(await prisma.trainee.findUnique({ where: { id: traineeB.id } }));
    const versionBefore = storeA.sessionVersion;
    await setStorePassword(storeA.id, "restaurant-pass-1", "restaurant-pass-1");
    const withPassword = await prisma.store.findUniqueOrThrow({ where: { id: storeA.id } });
    assert.ok(withPassword.passwordHash);
    assert.equal(withPassword.passwordHash?.includes("restaurant-pass-1"), false);
    assert.ok(withPassword.sessionVersion > versionBefore);
    const signedIn = await matchLogin("restaurant-pass-1");
    assert.equal(signedIn?.role, "store");
    if (signedIn?.role === "store") assert.equal(signedIn.storeId, storeA.id);
    await assert.rejects(() => setStorePassword(storeB.id, "restaurant-pass-1", "restaurant-pass-1"));
    await assert.rejects(() => setStorePassword(storeA.id, process.env.APP_PASSWORD ?? "", process.env.APP_PASSWORD ?? ""));
    await setStorePassword(storeA.id, "a", "a");
    const shortLogin = await matchLogin("a");
    assert.equal(shortLogin?.role, "store");
    await assert.rejects(() => setStorePassword(storeA.id, "", ""));
    await setStorePassword(storeA.id, "restaurant-pass-2", "restaurant-pass-2");
    const rotated = await prisma.store.findUniqueOrThrow({ where: { id: storeA.id } });
    assert.ok(rotated.sessionVersion > withPassword.sessionVersion);
    assert.equal(await matchLogin("restaurant-pass-1"), null);
    const adminLogin = await matchLogin(process.env.APP_PASSWORD ?? "");
    assert.equal(adminLogin?.role, "admin");
  } finally {
    await prisma.store.update({ where: { id: storeA.id }, data: { passwordHash: null } });
    await prisma.store.update({ where: { id: storeB.id }, data: { passwordHash: null } });
  }

  const todaySessions = await getScheduledSessions({ range: "today" });
  assert.ok(todaySessions.rows.every((row) => row.date === todaySessions.today));
  assert.ok(board.stats.needsPath > 0);

  const sortBefore = await prisma.module.findMany({ select: { id: true, sortOrder: true } });
  const foundation = await prisma.module.findMany({
    where: { language: "en", section: "FOUNDATION", archived: false },
    orderBy: { sortOrder: "asc" },
  });
  const moved = foundation[1];
  try {
    await moveCatalogModule(moved.id, "up");
    assert.equal((await prisma.module.findUniqueOrThrow({ where: { id: moved.id } })).sortOrder, foundation[0].sortOrder);
    await moveCatalogModule(moved.id, "down");
    assert.equal((await prisma.module.findUniqueOrThrow({ where: { id: moved.id } })).sortOrder, moved.sortOrder);

    const fresh = await addCatalogModule({
      section: "SERVICE",
      nameEn: "Delete Check Module",
      nameEs: "Modulo para borrar",
      timeLabel: "5 min",
      videoCount: "",
      credit: "",
      link: "",
      videoTitles: "",
      note: "",
    });
    const enTrainees = await prisma.trainee.count({ where: { language: "en" } });
    assert.equal(await prisma.traineeModule.count({ where: { moduleId: fresh.enId } }), enTrainees);
    assert.equal(await removeCatalogModule(fresh.enId), "deleted");
    assert.equal(await prisma.module.count({ where: { id: { in: [fresh.enId, fresh.esId] } } }), 0);

    const kept = await addCatalogModule({
      section: "PRODUCTION",
      nameEn: "Archive Check Module",
      nameEs: "Modulo para archivar",
      timeLabel: "5 min",
      videoCount: "",
      credit: "",
      link: "",
      videoTitles: "",
      note: "",
    });
    const history = await prisma.traineeModule.findFirstOrThrow({ where: { moduleId: kept.enId } });
    await prisma.traineeModule.update({
      where: { id: history.id },
      data: { completed: true, completedDate: "2026-11-01" },
    });
    assert.equal(await removeCatalogModule(kept.enId), "archived");
    assert.equal((await prisma.module.findUniqueOrThrow({ where: { id: kept.enId } })).archived, true);
    assert.ok(await prisma.traineeModule.findUnique({ where: { id: history.id } }));
    const hidden = await getTrainee(history.traineeId);
    assert.equal(hidden?.modules.some((module) => module.name === "Archive Check Module"), false);
  } finally {
    await prisma.traineeModule.deleteMany({
      where: { module: { name: { in: ["Delete Check Module", "Modulo para borrar", "Archive Check Module", "Modulo para archivar"] } } },
    });
    await prisma.module.deleteMany({
      where: { name: { in: ["Delete Check Module", "Modulo para borrar", "Archive Check Module", "Modulo para archivar"] } },
    });
    for (const row of sortBefore) {
      await prisma.module.update({ where: { id: row.id }, data: { sortOrder: row.sortOrder + 100000 } });
    }
    for (const row of sortBefore) {
      await prisma.module.update({ where: { id: row.id }, data: { sortOrder: row.sortOrder } });
    }
  }

  const paths = await prisma.trainee.groupBy({ by: ["path"], _count: { _all: true } });
  console.log("Local path counts:", paths.map((row) => `${row.path ?? "unset"}=${row._count._all}`).join(", "));
  console.log("Self-check passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
