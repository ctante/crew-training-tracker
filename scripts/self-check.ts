import assert from "node:assert/strict";
import { compareTrainers, trainerPositionRank } from "../src/lib/constants";
import { exportTraineeCsv, getDashboard, getTrainee, previewImport, syncDevelopmentReport } from "../src/lib/data";
import { prisma } from "../src/lib/db";
import { formatLongDate, parseLooseDate } from "../src/lib/format";
import { loadModuleSeeds } from "../src/lib/module-csv";
import { summarize } from "../src/lib/progress";
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
  assert.equal(preview.applicable, 36, JSON.stringify(preview.issues));
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
