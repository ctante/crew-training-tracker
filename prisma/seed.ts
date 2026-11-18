import { prisma } from "../src/lib/db";
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
