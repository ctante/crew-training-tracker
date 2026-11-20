export const SECTIONS = ["ORIENTATION", "FOUNDATION", "SERVICE", "PRODUCTION"] as const;
export type SectionId = (typeof SECTIONS)[number];

export const SECTION_TITLES: Record<"en" | "es", Record<SectionId, string>> = {
  en: {
    ORIENTATION: "Orientation",
    FOUNDATION: "Foundation",
    SERVICE: "Service",
    PRODUCTION: "Production",
  },
  es: {
    ORIENTATION: "Orientación",
    FOUNDATION: "Fundación",
    SERVICE: "Servicio",
    PRODUCTION: "Producción",
  },
};

export const BLOCKS = [
  { from: 1, to: 10, hours: "3 hr 30 min", name: "Foundation" },
  { from: 11, to: 17, hours: "4 hr", name: "Beverages" },
  { from: 18, to: 22, hours: "4 hr", name: "Service and digital" },
  { from: 23, to: 26, hours: "6 hr 30 min", name: "Service assembly" },
  { from: 27, to: 30, hours: "4 hr", name: "Grill and fry" },
  { from: 31, to: 32, hours: "4 hr", name: "Regular menu" },
  { from: 33, to: 34, hours: "4 hr", name: "Breakfast cooking" },
  { from: 35, to: 36, hours: "4 hr", name: "Breakfast assembly" },
] as const;

export const CAMPUS_HOME = "https://fredatmcd.read.inkling.com/read/";

export const STALL_DAYS = 14;

// Change this list to reorder every trainer dropdown and roster.
export const TRAINER_POSITION_ORDER = [
  "Crew Trainer",
  "Area Manager",
  "Shift Manager",
  "Assistant Manager",
  "General Manager",
] as const;

const TRAINER_POSITION_ALIASES: Record<string, (typeof TRAINER_POSITION_ORDER)[number]> = {
  "crew trainer": "Crew Trainer",
  "area manager": "Area Manager",
  "area mgr": "Area Manager",
  "area leader": "Area Manager",
  "shift manager": "Shift Manager",
  "shift mgr": "Shift Manager",
  "assistant manager": "Assistant Manager",
  "asst manager": "Assistant Manager",
  "asst mgr": "Assistant Manager",
  "general manager": "General Manager",
  "gen mgr": "General Manager",
  "general mgr": "General Manager",
  gm: "General Manager",
};

export const DEVELOPMENT_POSITIONS = [
  { label: "Gen Mgr", es: "Gerente general", value: "General Manager" },
  { label: "Asst Mgr", es: "Gerente asistente", value: "Assistant Manager" },
  { label: "Shift Mgr", es: "Gerente de turno", value: "Shift Manager" },
  { label: "Area Mgr", es: "Gerente de área", value: "Area Manager" },
  { label: "Crew Trainer", es: "Entrenador de equipo", value: "Crew Trainer" },
] as const;

export const TRAINER_MANAGER_LABEL = {
  en: "Trainer / Manager",
  es: "Entrenador / Gerente",
} as const;

export function canonicalTrainerPosition(position: string): string {
  const key = position.trim().toLowerCase();
  if (!key) return "";
  return TRAINER_POSITION_ALIASES[key] ?? position.trim();
}

export function developmentPosition(position: string): (typeof DEVELOPMENT_POSITIONS)[number]["value"] | null {
  const canonical = canonicalTrainerPosition(position);
  const match = DEVELOPMENT_POSITIONS.find((item) => item.value === canonical);
  return match?.value ?? null;
}

export function trainerPositionRank(position: string): number {
  const canonical = canonicalTrainerPosition(position);
  const index = TRAINER_POSITION_ORDER.findIndex((item) => item === canonical);
  return index === -1 ? TRAINER_POSITION_ORDER.length : index;
}

export function compareTrainers<T extends { position: string; name: string }>(a: T, b: T): number {
  const byRank = trainerPositionRank(a.position) - trainerPositionRank(b.position);
  if (byRank !== 0) return byRank;
  const byLabel = canonicalTrainerPosition(a.position).localeCompare(canonicalTrainerPosition(b.position), "en", {
    sensitivity: "base",
  });
  if (byLabel !== 0) return byLabel;
  return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
}

export function groupByTrainerPosition<T extends { position: string; name: string }>(
  people: T[],
): { position: string; people: T[] }[] {
  const groups: { position: string; people: T[] }[] = [];
  for (const person of [...people].sort(compareTrainers)) {
    const position = canonicalTrainerPosition(person.position) || "Other";
    const last = groups.at(-1);
    if (last && last.position === position) last.people.push(person);
    else groups.push({ position, people: [person] });
  }
  return groups;
}

export function canonicalSection(label: string): SectionId {
  const value = label.trim().toLowerCase();
  if (value.startsWith("orient")) return "ORIENTATION";
  if (value.startsWith("found") || value.startsWith("fund")) return "FOUNDATION";
  if (value.startsWith("serv")) return "SERVICE";
  return "PRODUCTION";
}

export function blockFor(sortOrder: number) {
  return BLOCKS.find((block) => sortOrder >= block.from && sortOrder <= block.to) ?? null;
}

export function blockStart(sortOrder: number) {
  return BLOCKS.find((block) => block.from === sortOrder) ?? null;
}

export function moduleKind(input: {
  link: string;
  videoCount: number | null;
  credit: string | null;
}): "campus" | "floor" | "app" {
  if (input.link.trim() || (input.videoCount ?? 0) > 0) return "campus";
  if (input.credit) return "app";
  return "floor";
}

export function languageName(language: string): string {
  return language === "es" ? "Spanish" : "English";
}
