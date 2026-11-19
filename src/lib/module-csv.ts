import { readFileSync } from "node:fs";
import path from "node:path";
import { parseCsv } from "./csv";
import { canonicalSection, moduleKind, type SectionId } from "./constants";
import { parseTimeMinutes } from "./format";

export type ModuleSeed = {
  language: "en" | "es";
  section: SectionId;
  sectionLabel: string;
  sortOrder: number;
  name: string;
  timeLabel: string;
  timeMinutes: number | null;
  videoCount: number | null;
  credit: string | null;
  link: string;
  videoTitles: string;
  needsReview: boolean;
  linkVerified: boolean;
  kind: "campus" | "floor" | "app";
  note: string;
};

export function moduleNeedsReview(link: string, linkVerified = false): boolean {
  return /regId=/i.test(link) && !linkVerified;
}

export function seedLinkVerified(link: string): boolean {
  return link.includes("cours000000000020034");
}

export function moduleCsvPath(): string {
  return path.join(process.cwd(), "data", "module-links.csv");
}

export function loadModuleSeeds(csvText?: string): ModuleSeed[] {
  const text = csvText ?? readFileSync(moduleCsvPath(), "utf8");
  const rows = parseCsv(text);
  const [header, ...body] = rows;
  if (!header) throw new Error("Module CSV is empty");
  const index = new Map(header.map((name, position) => [name.trim(), position]));
  const cell = (row: string[], name: string) => row[index.get(name) ?? -1] ?? "";
  const counters = { en: 0, es: 0 };
  const seeds: ModuleSeed[] = [];

  for (const row of body) {
    const language = cell(row, "lang").trim().toLowerCase();
    if (language !== "en" && language !== "es") continue;
    counters[language] += 1;
    const link = cell(row, "link").trim();
    const videoRaw = cell(row, "videos").trim();
    const videoCount = videoRaw ? Math.round(Number(videoRaw)) : null;
    const creditRaw = cell(row, "credit").trim();
    const credit = creditRaw || null;
    const name = cell(row, "module").trim();
    const linkVerified = seedLinkVerified(link);
    const timeLabel = cell(row, "time").trim();
    const note = name.startsWith("HazMat")
      ? "The master sheet hardcodes app id 5207 / 162067 in this name on every restaurant. Confirm the id before a crew member uses it."
      : "";
    seeds.push({
      language,
      section: canonicalSection(cell(row, "section")),
      sectionLabel: cell(row, "section").trim(),
      sortOrder: counters[language],
      name,
      timeLabel,
      timeMinutes: parseTimeMinutes(timeLabel),
      videoCount: Number.isFinite(videoCount) ? videoCount : null,
      credit,
      link,
      videoTitles: cell(row, "video_titles").trim(),
      needsReview: moduleNeedsReview(link, linkVerified),
      linkVerified,
      kind: moduleKind({ link, videoCount, credit }),
      note,
    });
  }

  if (counters.en !== 36 || counters.es !== 36) {
    throw new Error(`Expected 36 modules per language, got en=${counters.en} es=${counters.es}`);
  }
  return seeds;
}
