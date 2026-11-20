import { prisma } from "../src/lib/db";
import { importBundledDevelopmentSheet } from "../src/lib/development";
import { linkEmployees } from "../src/lib/employees";
import { seedCatalog, seedDatabase, seedSampleContent } from "../src/lib/seed-run";

async function main() {
  if (process.env.SEED_RESET === "true") {
    await seedDatabase(prisma);
    return;
  }
  await seedCatalog(prisma);
  if (process.env.SEED_SAMPLE_DATA === "true") {
    const trainees = await prisma.trainee.count();
    if (trainees === 0) {
      await seedSampleContent(prisma);
      console.log("Sample trainees and trainers added.");
    } else {
      console.log("Sample seed skipped because trainees already exist.");
    }
  } else {
    console.log("Sample trainees were not seeded. Set SEED_SAMPLE_DATA=true to add them to an empty database.");
  }
  if (process.env.VERCEL_GIT_COMMIT_REF === "beta") {
    await importBundledDevelopmentSheet();
  }
  const linked = await linkEmployees();
  console.log(
    `Employees linked: trainees ${linked.traineesLinked}, trainers ${linked.trainersLinked}, ambiguous trainees ${linked.traineesAmbiguous}, ambiguous trainers ${linked.trainersAmbiguous}.`,
  );
  const paths = await prisma.trainee.groupBy({ by: ["path"], _count: { _all: true } });
  const summary = paths.map((row) => `${row.path ?? "unset"}=${row._count._all}`).join(", ");
  console.log(`Training paths: ${summary || "none"}.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
