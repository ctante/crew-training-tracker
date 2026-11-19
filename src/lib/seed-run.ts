import type { PrismaClient } from "@prisma/client";
import { migrateSharedStoreUsers } from "./users";
import { TRAINER_POSITION_ORDER } from "./constants";
import { loadModuleSeeds, seedLinkVerified } from "./module-csv";
import {
  SAMPLE_PROFILES,
  SAMPLE_STORES,
  STAFF_FIRST_NAMES,
  STAFF_ROLES,
} from "./sample-data";

function spreadDates(start: string, end: string, count: number): string[] {
  if (count <= 0) return [];
  if (count === 1) return [start];
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const at = startMs + ((endMs - startMs) * index) / (count - 1);
    return new Date(at).toISOString().slice(0, 10);
  });
}

export async function seedCatalog(prisma: PrismaClient) {
  const seeds = loadModuleSeeds();
  const englishName = new Map(
    seeds.filter((seed) => seed.language === "en").map((seed) => [seed.sortOrder, seed.name.trim()]),
  );
  for (const store of SAMPLE_STORES) {
    await prisma.store.upsert({
      where: { number: store.number },
      create: { number: store.number, name: "" },
      update: { name: "" },
    });
  }
  for (const seed of seeds) {
    const existing = await prisma.module.findUnique({
      where: { language_sortOrder: { language: seed.language, sortOrder: seed.sortOrder } },
    });
    if (!existing) {
      const curatedSpanish =
        seed.language === "es" && seed.name.trim() !== "" && seed.name.trim() !== (englishName.get(seed.sortOrder) ?? "");
      await prisma.module.create({ data: { ...seed, manualTranslation: curatedSpanish } });
    } else if (seedLinkVerified(existing.link) && (!existing.linkVerified || existing.needsReview)) {
      await prisma.module.update({
        where: { id: existing.id },
        data: { linkVerified: true, needsReview: false },
      });
    }
  }
  await migrateSharedStoreUsers(prisma);
  console.log(
    `Catalog ready: ${SAMPLE_STORES.length} restaurants, ${seeds.length} modules. Position order: ${TRAINER_POSITION_ORDER.join(", ")}.`,
  );
}

export async function seedSampleContent(prisma: PrismaClient) {
  const counts = new Map<string, number>();
  for (const profile of SAMPLE_PROFILES) {
    counts.set(profile.store, (counts.get(profile.store) ?? 0) + 1);
  }
  for (const store of SAMPLE_STORES) {
    const count = counts.get(store.number) ?? 0;
    if (count < 2 || count > 3) {
      throw new Error(`Store ${store.number} has ${count} sample trainees`);
    }
  }
  if (STAFF_FIRST_NAMES.length < SAMPLE_STORES.length * STAFF_ROLES.length) {
    throw new Error("Not enough sample staff names");
  }

  const existingStores = await prisma.store.findMany();
  const stores = new Map(existingStores.map((store) => [store.number, { id: store.id }]));
  for (const store of SAMPLE_STORES) {
    if (!stores.has(store.number)) throw new Error(`Restaurant ${store.number} is missing from the catalog.`);
  }

  const staffByStore = new Map<string, { id: string; name: string }[]>();
  let nameIndex = 0;
  for (const store of SAMPLE_STORES) {
    const people: { id: string; name: string }[] = [];
    for (const role of STAFF_ROLES) {
      const name = `${STAFF_FIRST_NAMES[nameIndex]} Sample`;
      nameIndex += 1;
      const created = await prisma.staff.create({
        data: {
          storeId: stores.get(store.number)!.id,
          name,
          position: role.position,
          isGm: role.isGm,
          isTrainer: role.isTrainer,
          qualified: true,
          rosterSource: "sample",
          active: true,
          isSample: true,
        },
      });
      people.push({ id: created.id, name });
    }
    staffByStore.set(store.number, people);
  }

  const modules = await prisma.module.findMany();
  if (modules.length < 72) throw new Error("The module catalog is incomplete.");
  const moduleId = new Map(modules.map((module) => [`${module.language}:${module.sortOrder}`, module.id]));

  for (const profile of SAMPLE_PROFILES) {
    const store = stores.get(profile.store);
    if (!store) throw new Error(`Missing store ${profile.store}`);
    const staff = staffByStore.get(profile.store) ?? [];
    const blank = new Set(profile.blankMeta ?? []);
    const datedOrders = Array.from({ length: profile.completedThrough }, (_, index) => index + 1).filter(
      (order) => !blank.has(order),
    );
    const dates = spreadDates(profile.startDate, profile.lastActivity, datedOrders.length);
    const dateByOrder = new Map(datedOrders.map((order, index) => [order, dates[index]]));
    const scheduleByOrder = new Map((profile.schedules ?? []).map((item) => [item.order, item]));
    const noteByOrder = new Map((profile.notes ?? []).map((item) => [item.order, item.text]));
    const trainee = await prisma.trainee.create({
      data: {
        storeId: store.id,
        name: profile.name,
        startDate: profile.startDate,
        language: profile.language,
        position: profile.position,
        status: profile.completedThrough >= 36 ? "COMPLETED" : profile.status,
        isSample: true,
      },
    });

    const rows = [];
    for (let order = 1; order <= 36; order += 1) {
      const done = order <= profile.completedThrough;
      const schedule = scheduleByOrder.get(order);
      const hideMeta = done && blank.has(order);
      let trainerId: string | null = null;
      let trainerLabel = "";
      let scheduledDate: string | null = null;
      if (!hideMeta && done) {
        scheduledDate = dateByOrder.get(order) ?? profile.startDate;
        if (order === 1) {
          trainerLabel = "Orientation";
        } else {
          const person = staff[order % staff.length];
          trainerId = person.id;
          trainerLabel = person.name;
        }
      } else if (!done && schedule) {
        scheduledDate = schedule.date;
        if (schedule.trainer === "orientation") {
          trainerLabel = "Orientation";
        } else {
          const person = staff[schedule.trainer];
          trainerId = person.id;
          trainerLabel = person.name;
        }
      }
      rows.push({
        traineeId: trainee.id,
        moduleId: moduleId.get(`${profile.language}:${order}`)!,
        scheduledDate,
        trainerId,
        trainerLabel,
        completed: done,
        completedDate: done && !hideMeta ? scheduledDate : null,
        notes: noteByOrder.get(order) ?? "",
      });
    }
    await prisma.traineeModule.createMany({ data: rows });
  }
}

export async function seedDatabase(prisma: PrismaClient) {
  await prisma.appUser.deleteMany();
  await prisma.traineeModule.deleteMany();
  await prisma.trainee.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.rosterSync.deleteMany();
  await prisma.module.deleteMany();
  await prisma.store.deleteMany();
  await seedCatalog(prisma);
  await seedSampleContent(prisma);
}
