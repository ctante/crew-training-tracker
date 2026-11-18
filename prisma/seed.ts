import { prisma } from "../src/lib/db";
import { seedDatabase } from "../src/lib/seed-run";

seedDatabase(prisma)
  .then(async () => {
    const [stores, modules, trainees, flagged] = await Promise.all([
      prisma.store.count(),
      prisma.module.count(),
      prisma.trainee.count(),
      prisma.module.count({ where: { needsReview: true } }),
    ]);
    console.log(
      `Seeded ${stores} stores, ${modules} modules, ${trainees} sample trainees, ${flagged} links needing review.`,
    );
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
