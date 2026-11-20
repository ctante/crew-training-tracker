import assert from "node:assert/strict";
import { compareTrainers, trainerPositionRank } from "../src/lib/constants";
import { addCatalogModule, addSecondPath, commitImport, createTrainee, deleteTrainee, exportTraineeCsv, getDashboard, getScheduledSessions, getTrainee, markModuleLinkOk, matchLogin, updateProgress, moveCatalogModule, moveCatalogModuleToSection, previewImport, removeCatalogModule, setStorePassword, syncDevelopmentReport, updateModuleTemplate } from "../src/lib/data";
import { parseModuleLinks } from "../src/lib/drive";
import { spanishTextUpdate } from "../src/lib/translate";
import { getReports } from "../src/lib/reports";
import { linkEmployees, mapJobTitle, namesMatch, parseRosterCsv, syncEmployeeSnapshot, uniqueNameMatches } from "../src/lib/employees";
import { prisma } from "../src/lib/db";
import { daysBetween, formatLongDate, parseLooseDate, selectReportStores, sessionWindow } from "../src/lib/format";
import { addDevelopmentPerson, convertHours, deactivateDevelopmentPerson, developmentHours, formatHourTotal, importDevelopmentRows, mondayOf, parseWeekLabel, preferredWeek, restoreDevelopmentPerson, sortTaskLabels, updateDevelopmentPerson, weekLabel } from "../src/lib/development";
import { CODE_ROLE_DEFAULTS, effectivePermissions, overridesFor, roleDefaults } from "../src/lib/permissions";
import { saveAppUser } from "../src/lib/users";
import { loadModuleSeeds } from "../src/lib/module-csv";
import { inferPathChoice, summarize, trainingPaths } from "../src/lib/progress";
import { parseDevelopmentReport } from "../src/lib/roster/parse";
import { csvDevelopmentReportSource } from "../src/lib/roster/source";

async function main() {
  assert.equal(mapJobTitle("PRIMARY MAIN. PERSON"), "Crew Person");
  assert.equal(mapJobTitle("BACKUP MAINTENANCE PERSON"), "Crew Person");
  assert.equal(mapJobTitle("CERT. SWING MGR."), "Cert. Swing Mgr.");
  assert.equal(mapJobTitle("CREW PERSON"), "Crew Person");
  const feed = parseRosterCsv("Store,Name,Job Title\n5207,Alex Rivera,PRIMARY MAIN. PERSON\n");
  assert.equal(feed[0]?.position, "Crew Person");
  assert.equal(feed[0]?.store, "5207");
  assert.equal(namesMatch("José García", "Jose Garcia"), true);
  assert.equal(namesMatch("John Smith", "John Q Smith"), true);
  assert.equal(namesMatch("Jon Smith", "Jonathan Smith"), true);
  assert.equal(namesMatch("John Smith", "Jane Smith"), false);
  const paired = uniqueNameMatches(
    [{ name: "Jon Smith" }, { name: "Pat Lee" }],
    [{ name: "Jonathan Smith" }, { name: "Patrick Lee" }, { name: "Patricia Lee" }],
  );
  assert.equal(paired.pairs.length, 1);
  assert.equal(paired.pairs[0]?.right.name, "Jonathan Smith");
  assert.equal(paired.ambiguous.some((row) => row.name === "Pat Lee"), true);
  const driveFile = parseModuleLinks("https://drive.google.com/file/d/abc123/view");
  assert.equal(driveFile.files[0]?.embed, "https://drive.google.com/file/d/abc123/preview");
  assert.equal(driveFile.files[0]?.href, "https://drive.google.com/file/d/abc123/view");
  assert.equal(parseModuleLinks("https://drive.google.com/open?id=abc123").files[0]?.id, "abc123");
  assert.equal(parseModuleLinks("https://drive.google.com/uc?id=abc123&export=download").files[0]?.id, "abc123");
  assert.equal(parseModuleLinks("https://docs.google.com/file/d/abc123/edit").files[0]?.embed, "https://drive.google.com/file/d/abc123/preview");
  const folder = parseModuleLinks("https://drive.google.com/drive/folders/folder1");
  assert.equal(folder.files.length, 0);
  assert.equal(folder.folders[0]?.href, "https://drive.google.com/drive/folders/folder1");
  assert.equal(parseModuleLinks("https://drive.google.com/folderview?id=folder1").folders[0]?.id, "folder1");
  const campus = parseModuleLinks("https://campus.example/course");
  assert.equal(campus.files.length, 0);
  assert.equal(campus.other[0], "https://campus.example/course");
  const several = parseModuleLinks("https://drive.google.com/file/d/one/view\nhttps://drive.google.com/file/d/two/preview");
  assert.deepEqual(several.files.map((file) => file.id), ["one", "two"]);
  const keptSpanish = spanishTextUpdate({
    manual: true,
    force: false,
    english: { name: "Fries", videoTitles: "Salt", note: "", link: "https://campus.example/new" },
    spanish: { name: "Papas", videoTitles: "Sal", note: "", link: "https://campus.example/es" },
    previousEnglishLink: "https://campus.example/old",
    translated: { name: "Papas fritas", videoTitles: "Sal", note: "" },
  });
  assert.equal(keptSpanish.text.name, "Papas");
  assert.equal(keptSpanish.link, "https://campus.example/es");
  assert.equal(keptSpanish.manual, true);
  const copied = spanishTextUpdate({
    manual: false,
    force: false,
    english: { name: "Fries", videoTitles: "Salt", note: "Hot", link: "https://campus.example/new" },
    spanish: { name: "Papas", videoTitles: "", note: "", link: "https://campus.example/old" },
    previousEnglishLink: "https://campus.example/old",
    translated: { name: "Papas fritas", videoTitles: "Sal", note: "Caliente" },
  });
  assert.equal(copied.text.name, "Papas fritas");
  assert.equal(copied.link, "https://campus.example/new");
  assert.equal(copied.manual, false);
  const failed = spanishTextUpdate({
    manual: false,
    force: false,
    english: { name: "Fries", videoTitles: "", note: "", link: "" },
    spanish: { name: "", videoTitles: "", note: "", link: "" },
    previousEnglishLink: "",
    translated: null,
  });
  assert.equal(failed.text.name, "Fries");
  assert.match(failed.warning ?? "", /English text was kept/);

  const seeds = loadModuleSeeds();
  assert.equal(seeds.length, 72);
  assert.equal(seeds.filter((row) => row.language === "en" && row.link).length, 24);
  assert.equal(seeds.filter((row) => row.language === "es" && row.link).length, 23);
  assert.equal(seeds.filter((row) => row.needsReview).length, 2);
  assert.ok(seeds.filter((row) => row.link.includes("cours000000000020034")).every((row) => row.linkVerified && !row.needsReview));
  assert.ok(seeds.filter((row) => row.link.includes("cours000000000057227")).every((row) => !row.linkVerified && row.needsReview));
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
  assert.equal(flagged, 2);
  const verifiedLinks = await prisma.module.findMany({ where: { link: { contains: "cours000000000020034" } } });
  assert.equal(verifiedLinks.length, 2);
  assert.ok(verifiedLinks.every((row) => row.linkVerified && !row.needsReview));
  const grilling = await prisma.module.findFirstOrThrow({ where: { language: "en", name: "Grilling" } });
  assert.equal(grilling.needsReview, true);
  assert.equal(grilling.linkVerified, false);
  const mop = verifiedLinks.find((row) => row.language === "en");
  assert.ok(mop);
  await updateModuleTemplate(mop.id, {
    name: mop.name,
    timeLabel: mop.timeLabel,
    videoCount: mop.videoCount === null ? "" : String(mop.videoCount),
    credit: mop.credit ?? "",
    link: mop.link,
    videoTitles: mop.videoTitles,
    note: mop.note,
  });
  const mopAfter = await prisma.module.findUniqueOrThrow({ where: { id: mop.id } });
  assert.equal(mopAfter.linkVerified, true);
  assert.equal(mopAfter.needsReview, false);
  await markModuleLinkOk(grilling.id);
  const grillingMarked = await prisma.module.findUniqueOrThrow({ where: { id: grilling.id } });
  assert.equal(grillingMarked.linkVerified, true);
  assert.equal(grillingMarked.needsReview, false);
  await prisma.module.updateMany({
    where: { sortOrder: grilling.sortOrder, link: grilling.link },
    data: { linkVerified: false, needsReview: true },
  });
  assert.equal((await prisma.module.findUniqueOrThrow({ where: { id: grilling.id } })).needsReview, true);

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
    assert.equal(signedIn?.role, "user");
    if (signedIn?.role === "user") {
      const account = await prisma.appUser.findUnique({ where: { id: signedIn.userId }, include: { stores: true } });
      assert.equal(account?.role, "USER");
      assert.equal(account?.login, storeA.number);
      assert.equal(account?.stores[0]?.storeId, storeA.id);
    }
    await assert.rejects(() => setStorePassword(storeB.id, "restaurant-pass-1", "restaurant-pass-1"));
    await assert.rejects(() => setStorePassword(storeA.id, process.env.APP_PASSWORD ?? "", process.env.APP_PASSWORD ?? ""));
    await setStorePassword(storeA.id, "a", "a");
    const shortLogin = await matchLogin("a");
    assert.equal(shortLogin?.role, "user");
    await assert.rejects(() => setStorePassword(storeA.id, "", ""));
    await setStorePassword(storeA.id, "restaurant-pass-2", "restaurant-pass-2");
    const rotated = await prisma.store.findUniqueOrThrow({ where: { id: storeA.id } });
    assert.ok(rotated.sessionVersion > withPassword.sessionVersion);
    assert.equal(await matchLogin("restaurant-pass-1"), null);
    const adminLogin = await matchLogin(process.env.APP_PASSWORD ?? "");
    assert.equal(adminLogin?.role, "admin");
    assert.equal(roleDefaults("USER").sign_off, true);
    assert.equal(roleDefaults("USER").schedule, false);
    assert.equal(roleDefaults("MANAGER").schedule, true);
    assert.equal(roleDefaults("MANAGER").reports, true);
    assert.equal(roleDefaults("MANAGER").users, false);
    assert.equal(roleDefaults("SUPERVISOR").users, true);
    assert.equal(roleDefaults("SUPERVISOR").view_stores, true);
    assert.equal(roleDefaults("SUPERVISOR").modules, false);
    assert.equal(roleDefaults("ADMIN").store_logins, true);
    const granted = effectivePermissions("USER", { schedule: true });
    assert.equal(granted.schedule, true);
    assert.deepEqual(overridesFor("USER", granted), { schedule: true });
    const supervisor = {
      role: "supervisor" as const,
      userId: "supervisor-check",
      name: "Supervisor Check",
      storeIds: [storeA.id],
      storeNumbers: [storeA.number],
      permissions: roleDefaults("SUPERVISOR"),
    };
    const managerId = await saveAppUser(
      supervisor,
      {
        name: "Manager Check",
        login: "manager-check",
        password: "manager-pass-check",
        confirm: "manager-pass-check",
        role: "MANAGER",
        storeIds: [storeA.id],
        active: true,
        permissions: { ...roleDefaults("MANAGER"), users: true, modules: true },
      },
      CODE_ROLE_DEFAULTS,
    );
    const manager = await prisma.appUser.findUniqueOrThrow({ where: { id: managerId } });
    const managerPermissions = effectivePermissions("MANAGER", manager.permissionOverrides, CODE_ROLE_DEFAULTS);
    assert.equal(managerPermissions.users, false);
    assert.equal(managerPermissions.modules, false);
    assert.equal(managerPermissions.schedule, true);
    await assert.rejects(() =>
      saveAppUser(
        supervisor,
        {
          name: "Admin Check",
          login: "admin-check-user",
          password: "admin-pass-check",
          confirm: "admin-pass-check",
          role: "ADMIN",
          storeIds: [],
          active: true,
          permissions: roleDefaults("ADMIN"),
        },
        CODE_ROLE_DEFAULTS,
      ),
    );
    const onlyAdmin = await saveAppUser(
      { role: "admin", permissions: roleDefaults("ADMIN") },
      {
        name: "Only Admin",
        login: "only-admin-check",
        password: "only-admin-pass",
        confirm: "only-admin-pass",
        role: "ADMIN",
        storeIds: [],
        active: true,
        permissions: roleDefaults("ADMIN"),
      },
      CODE_ROLE_DEFAULTS,
    );
    await assert.rejects(() =>
      saveAppUser(
        { role: "admin", permissions: roleDefaults("ADMIN") },
        {
          id: onlyAdmin,
          name: "Only Admin",
          login: "only-admin-check",
          password: "",
          confirm: "",
          role: "USER",
          storeIds: [storeA.id],
          active: false,
          permissions: roleDefaults("USER"),
        },
        CODE_ROLE_DEFAULTS,
      ),
    );
    const row = await prisma.traineeModule.findFirst({ where: { traineeId: traineeB.id } });
    assert.ok(row);
    await assert.rejects(() =>
      updateProgress(
        {
          traineeModuleId: row.id,
          scheduledDate: row.scheduledDate === "2099-01-01" ? "2099-01-02" : "2099-01-01",
          trainerValue: "",
          completed: row.completed,
          completedDate: row.completedDate ?? "",
          notes: row.notes,
        },
        { role: "user", userId: "user-check", name: "User Check", storeId: storeB.id, storeNumber: storeB.number, permissions: roleDefaults("USER") },
      ),
    );
  } finally {
    await prisma.appUser.deleteMany({
      where: { login: { in: [storeA.number, storeB.number, "manager-check", "admin-check-user", "only-admin-check"] } },
    });
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

    const locked = await addCatalogModule({
      section: "ORIENTATION",
      nameEn: "Lock Check",
      nameEs: "Chequeo manual",
      timeLabel: "5 min",
      videoCount: "1",
      credit: "",
      link: "https://campus.example/a",
      videoTitles: "Intro",
      note: "",
    });
    await updateModuleTemplate(locked.esId, {
      name: "Chequeo a mano",
      timeLabel: "5 min",
      videoCount: "1",
      credit: "",
      link: "https://campus.example/es",
      videoTitles: "Inicio",
      note: "",
    });
    await updateModuleTemplate(locked.enId, {
      name: "Lock Check Updated",
      timeLabel: "12 min",
      videoCount: "2",
      credit: "Auto",
      link: "https://campus.example/b",
      videoTitles: "Intro revised",
      note: "Keep Spanish",
    });
    const lockedEs = await prisma.module.findUniqueOrThrow({ where: { id: locked.esId } });
    assert.equal(lockedEs.name, "Chequeo a mano");
    assert.equal(lockedEs.videoTitles, "Inicio");
    assert.equal(lockedEs.manualTranslation, true);
    assert.equal(lockedEs.timeLabel, "12 min");
    assert.equal(lockedEs.videoCount, 2);
    assert.equal(lockedEs.credit, "Auto");
    assert.equal(lockedEs.link, "https://campus.example/es");
    assert.equal(lockedEs.section, "ORIENTATION");

    const shared = await addCatalogModule({
      section: "ORIENTATION",
      nameEn: "Link Copy",
      nameEs: "Enlace copia",
      timeLabel: "5 min",
      videoCount: "",
      credit: "",
      link: "https://campus.example/shared",
      videoTitles: "",
      note: "",
    });
    await updateModuleTemplate(shared.enId, {
      name: "Link Copy",
      timeLabel: "5 min",
      videoCount: "",
      credit: "",
      link: "https://campus.example/shared-new",
      videoTitles: "",
      note: "",
    });
    const sharedEs = await prisma.module.findUniqueOrThrow({ where: { id: shared.esId } });
    assert.equal(sharedEs.link, "https://campus.example/shared-new");
    assert.equal(sharedEs.name, "Enlace copia");

    const sectionMove = await addCatalogModule({
      section: "FOUNDATION",
      nameEn: "Section Move",
      nameEs: "Mover seccion",
      timeLabel: "5 min",
      videoCount: "",
      credit: "",
      link: "",
      videoTitles: "",
      note: "",
    });
    const sectionStore = await prisma.store.findUniqueOrThrow({ where: { number: "05207" } });
    const serviceTraineeId = await createTrainee({
      name: "Section Service Check",
      storeId: sectionStore.id,
      startDate: "2026-11-01",
      language: "en",
      position: "",
      path: "SERVICE",
    });
    const productionTraineeId = await createTrainee({
      name: "Section Production Check",
      storeId: sectionStore.id,
      startDate: "2026-11-01",
      language: "en",
      position: "",
      path: "PRODUCTION",
    });
    const serviceRow = await prisma.traineeModule.findFirstOrThrow({
      where: { traineeId: serviceTraineeId, moduleId: sectionMove.enId },
    });
    await prisma.traineeModule.update({
      where: { id: serviceRow.id },
      data: { completed: true, completedDate: "2026-11-02" },
    });
    const productionBefore = await getTrainee(productionTraineeId);
    assert.equal(productionBefore?.modules.some((module) => module.name === "Section Move"), true);
    await moveCatalogModuleToSection(sectionMove.enId, "SERVICE");
    const movedEn = await prisma.module.findUniqueOrThrow({ where: { id: sectionMove.enId } });
    const movedEs = await prisma.module.findUniqueOrThrow({ where: { id: sectionMove.esId } });
    const serviceOrders = await prisma.module.findMany({ where: { language: "en", section: "SERVICE" }, select: { sortOrder: true } });
    assert.equal(movedEn.section, "SERVICE");
    assert.equal(movedEs.section, "SERVICE");
    assert.equal(movedEs.sectionLabel, "Servicio");
    assert.equal(movedEn.sortOrder, movedEs.sortOrder);
    assert.equal(movedEn.sortOrder, Math.max(...serviceOrders.map((row) => row.sortOrder)));
    const keptRow = await prisma.traineeModule.findUniqueOrThrow({ where: { id: serviceRow.id } });
    assert.equal(keptRow.completed, true);
    assert.equal(keptRow.completedDate, "2026-11-02");
    const serviceAfter = await getTrainee(serviceTraineeId);
    const productionAfter = await getTrainee(productionTraineeId);
    const serviceModule = serviceAfter?.modules.find((module) => module.name === "Section Move");
    assert.equal(serviceModule?.section, "SERVICE");
    assert.equal(serviceModule?.completed, true);
    assert.equal(productionAfter?.modules.some((module) => module.name === "Section Move"), false);
    assert.equal(productionAfter?.progress.total, (productionBefore?.progress.total ?? 0) - 1);
  } finally {
    await prisma.trainee.deleteMany({
      where: { name: { in: ["Section Service Check", "Section Production Check"] } },
    });
    await prisma.traineeModule.deleteMany({
      where: {
        module: {
          name: {
            in: [
              "Delete Check Module",
              "Modulo para borrar",
              "Archive Check Module",
              "Modulo para archivar",
              "Lock Check",
              "Lock Check Updated",
              "Chequeo manual",
              "Chequeo a mano",
              "Link Copy",
              "Enlace copia",
              "Section Move",
              "Mover seccion",
            ],
          },
        },
      },
    });
    await prisma.module.deleteMany({
      where: {
        name: {
          in: [
            "Delete Check Module",
            "Modulo para borrar",
            "Archive Check Module",
            "Modulo para archivar",
            "Lock Check",
            "Lock Check Updated",
            "Chequeo manual",
            "Chequeo a mano",
            "Link Copy",
            "Enlace copia",
            "Section Move",
            "Mover seccion",
          ],
        },
      },
    });
    for (const row of sortBefore) {
      await prisma.module.update({ where: { id: row.id }, data: { sortOrder: row.sortOrder + 100000 } });
    }
    for (const row of sortBefore) {
      await prisma.module.update({ where: { id: row.id }, data: { sortOrder: row.sortOrder } });
    }
  }

  assert.equal(mondayOf("2026-11-20"), "2026-11-16");
  assert.equal(weekLabel("2026-11-23"), "Week of 11/23-11/29");
  assert.equal(weekLabel("2026-11-30"), "Week of 11/30-12/06");
  assert.equal(parseWeekLabel("Week of 11/30-12/06"), "2026-11-30");
  assert.equal(convertHours("2+2").hours, "4");
  assert.equal(convertHours("2.0").hours, "2");
  assert.equal(convertHours("0.5").hours, "0.5");
  assert.equal(convertHours("11").converted, false);
  assert.equal(convertHours("Meet Rosa").converted, false);
  assert.equal(preferredWeek("2026-11-16", ["2026-11-30", "2026-11-23"]), "2026-11-23");
  assert.equal(preferredWeek("2026-11-23", ["2026-11-23", "2026-11-30"]), "2026-11-23");
  assert.equal(preferredWeek("2026-12-07", ["2026-11-23", "2026-11-30"]), "2026-11-30");
  assert.equal(preferredWeek("2026-11-16", []), "2026-11-16");
  assert.deepEqual(sortTaskLabels(["Verification by Supervisor", "inventory", "Cash Audit", "ITS Training"]), [
    "Cash Audit",
    "inventory",
    "ITS Training",
    "Verification by Supervisor",
  ]);
  assert.equal(developmentHours("2+2"), 4);
  assert.equal(developmentHours("3"), 3);
  assert.equal(formatHourTotal(4), "4");
  assert.equal(roleDefaults("USER").view_development, false);
  assert.equal(roleDefaults("MANAGER").view_development, true);
  assert.equal(roleDefaults("MANAGER").edit_development, false);
  assert.equal(roleDefaults("ADMIN").edit_development, true);
  const developmentStore = await prisma.store.findUniqueOrThrow({ where: { number: "05207" } });
  const developmentPerson = await prisma.staff.create({
    data: { storeId: developmentStore.id, name: "Development Check", position: "Shift Mgr", qualified: true, isTrainer: true },
  });
  try {
    const first = await importDevelopmentRows([
      { storeNumber: "05207", name: "Development Check", hours: "2+2", comments: "Inventory", weekStart: "2026-11-23" },
    ]);
    assert.equal(first.entries, 1);
    assert.equal(first.unmatched.length, 0);
    const again = await importDevelopmentRows([
      { storeNumber: "05207", name: "Development Check", hours: "2+2", comments: "Inventory", weekStart: "2026-11-23" },
    ]);
    assert.equal(again.entries, 1);
    assert.equal(await prisma.developmentEntry.count({ where: { staffId: developmentPerson.id } }), 1);
    const missed = await importDevelopmentRows([
      { storeNumber: "05207", name: "Nobody Development", hours: "1", comments: "Nope", weekStart: "2026-11-23" },
    ]);
    assert.equal(missed.entries, 0);
    assert.equal(missed.unmatched[0]?.name, "Nobody Development");
  } finally {
    await prisma.developmentEntry.deleteMany({ where: { staffId: developmentPerson.id } });
    await prisma.developmentWeek.deleteMany({ where: { storeId: developmentStore.id, weekStart: "2026-11-23" } });
    await prisma.staff.delete({ where: { id: developmentPerson.id } });
  }

  const rosterPerson = await addDevelopmentPerson({
    storeId: developmentStore.id,
    name: "Roster Added",
    position: "Gen Mgr",
  });
  try {
    assert.equal(rosterPerson.position, "General Manager");
    assert.equal(rosterPerson.isGm, true);
    assert.equal(rosterPerson.isTrainer, true);
    assert.equal(rosterPerson.qualified, true);
    await assert.rejects(() =>
      addDevelopmentPerson({ storeId: developmentStore.id, name: "  roster   added ", position: "Crew Trainer" }),
    );
    const otherStore = await prisma.store.findFirst({ where: { number: { not: "05207" } } });
    assert.ok(otherStore);
    const moved = await updateDevelopmentPerson(rosterPerson.id, {
      storeId: otherStore.id,
      name: "Roster Added",
      position: "Shift Mgr",
    });
    assert.equal(moved.storeId, otherStore.id);
    assert.equal(moved.isGm, false);
    await deactivateDevelopmentPerson(rosterPerson.id);
    assert.equal((await prisma.staff.findUniqueOrThrow({ where: { id: rosterPerson.id } })).active, false);
    assert.equal(await prisma.staff.count({ where: { id: rosterPerson.id } }), 1);
    await restoreDevelopmentPerson(rosterPerson.id);
    assert.equal((await prisma.staff.findUniqueOrThrow({ where: { id: rosterPerson.id } })).active, true);
  } finally {
    await prisma.staff.delete({ where: { id: rosterPerson.id } });
  }

  const syncStore = await prisma.store.findFirstOrThrow({ orderBy: { number: "asc" } });
  const firstSync = await syncEmployeeSnapshot([
    { store: syncStore.number, employeeId: "self-check-1", name: "Sync Person", position: "Crew" },
  ]);
  assert.equal(firstSync.added, 1);
  const secondSync = await syncEmployeeSnapshot([
    { store: syncStore.number, employeeId: "self-check-2", name: "Other Sync", position: "Crew" },
  ]);
  assert.equal(secondSync.added, 1);
  assert.equal(secondSync.deactivated, 1);
  const thirdSync = await syncEmployeeSnapshot([
    { store: syncStore.number, employeeId: "self-check-1", name: "Sync Person", position: "Crew" },
    { store: syncStore.number, employeeId: "self-check-2", name: "Other Sync", position: "Crew" },
  ]);
  assert.equal(thirdSync.reactivated, 1);
  const linkTrainee = await prisma.trainee.create({
    data: { storeId: syncStore.id, name: "Sync Person", startDate: "2026-11-01", language: "en", status: "ACTIVE" },
  });
  const linked = await linkEmployees();
  assert.equal(linked.traineesLinked >= 1, true);
  const linkedRow = await prisma.trainee.findUniqueOrThrow({ where: { id: linkTrainee.id } });
  assert.ok(linkedRow.employeeId);
  await prisma.employee.create({
    data: { storeId: syncStore.id, name: "Sync Person", position: "Crew", source: "manual" },
  });
  const ambiguous = await linkEmployees();
  assert.equal(ambiguous.traineesAmbiguous >= 1, true);
  await prisma.trainee.delete({ where: { id: linkTrainee.id } });
  await prisma.employee.deleteMany({ where: { storeId: syncStore.id, name: { in: ["Sync Person", "Other Sync"] } } });

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
