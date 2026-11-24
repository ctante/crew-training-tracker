import { prisma } from "../../src/lib/db";
import { hashPassword } from "../../src/lib/passwords";
import { seedCatalog } from "../../src/lib/seed-run";

const STORES = [
  { number: "90001", name: "North Demo" },
  { number: "90002", name: "East Demo" },
  { number: "90003", name: "West Demo" },
];

const PASSWORD = "help-demo";

async function main() {
  await seedCatalog(prisma);
  await prisma.appUser.deleteMany();
  await prisma.store.deleteMany();
  const stores = [];
  for (const store of STORES) {
    stores.push(await prisma.store.create({ data: store }));
  }
  const byNumber = new Map(stores.map((store) => [store.number, store]));
  const modules = await prisma.module.findMany({ where: { language: "en", archived: false }, orderBy: { sortOrder: "asc" } });
  const people = [
    { name: "Alex Rivera", store: "90001", path: "SERVICE", through: 4 },
    { name: "Jordan Lee", store: "90002", path: "PRODUCTION", through: 2 },
    { name: "Sam Ortiz", store: "90003", path: "SERVICE", through: 1 },
  ];
  for (const person of people) {
    const store = byNumber.get(person.store)!;
    await prisma.trainee.create({
      data: {
        name: person.name,
        storeId: store.id,
        startDate: "2026-11-02",
        language: "en",
        path: person.path,
        position: "Crew Person",
        status: "ACTIVE",
        modules: {
          create: modules.map((item) => ({
            moduleId: item.id,
            completed: item.sortOrder <= person.through,
            completedDate: item.sortOrder <= person.through ? "2026-11-20" : null,
            scheduledDate: item.sortOrder === person.through + 1 ? "2026-11-24" : item.sortOrder === person.through + 2 ? "2026-11-25" : null,
          })),
        },
      },
    });
    const trainerName = person.name === "Alex Rivera" ? "Casey Nguyen" : "Riley Brooks";
    await prisma.staff.create({
      data: { storeId: store.id, name: trainerName, position: "Crew Trainer", isTrainer: true, qualified: true, active: true },
    });
    await prisma.employee.createMany({
      data: [
        { storeId: store.id, name: person.name, position: "Crew Person", source: "manual", active: true },
        { storeId: store.id, name: trainerName, position: "Crew Trainer", source: "manual", active: true },
      ],
    });
  }
  const passwordHash = await hashPassword(PASSWORD);
  const accounts = [
    { name: "North User", login: "north.user", role: "USER", stores: ["90001"] },
    { name: "North Manager", login: "north.manager", role: "MANAGER", stores: ["90001"] },
    { name: "Area Supervisor", login: "area.supervisor", role: "SUPERVISOR", stores: ["90001", "90002", "90003"] },
  ];
  for (const account of accounts) {
    await prisma.appUser.create({
      data: {
        name: account.name,
        login: account.login,
        passwordHash,
        role: account.role,
        allStores: false,
        active: true,
        stores: { create: account.stores.map((number) => ({ storeId: byNumber.get(number)!.id })) },
      },
    });
  }
  console.log("Help demo ready. Stores 90001, 90002, 90003. Password help-demo.");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
