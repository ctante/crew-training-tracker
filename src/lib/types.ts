import { SECTION_TITLES, type SectionId } from "./constants";
import type { ProgressSummary, TrainingPath } from "./progress";

export type StoreOption = {
  id: string;
  number: string;
  name: string;
  activeTrainees: number;
  gmNames: string[];
};

export type StaffMember = {
  id: string;
  storeId: string;
  storeNumber: string;
  storeName: string;
  name: string;
  position: string;
  isGm: boolean;
  isTrainer: boolean;
  qualified: boolean;
  rosterSource: string;
  active: boolean;
  isSample: boolean;
};

export type TraineeSummary = {
  id: string;
  name: string;
  storeId: string;
  storeNumber: string;
  storeName: string;
  language: "en" | "es";
  position: string;
  path: TrainingPath | null;
  startDate: string;
  status: string;
  isSample: boolean;
  progress: ProgressSummary;
};

export type TrainerOption = {
  id: string;
  name: string;
  position: string;
  isGm: boolean;
};

export type EditorModule = {
  id: string;
  sortOrder: number;
  section: SectionId;
  sectionTitle: string;
  name: string;
  timeLabel: string;
  videoCount: number | null;
  credit: string | null;
  link: string;
  videoTitles: string[];
  needsReview: boolean;
  kind: string;
  note: string;
  blockName: string | null;
  blockHours: string | null;
  scheduledDate: string;
  trainerValue: string;
  trainerLabel: string;
  completed: boolean;
  completedDate: string;
  notes: string;
};

export type TraineeDetail = {
  id: string;
  name: string;
  storeId: string;
  storeNumber: string;
  storeName: string;
  language: "en" | "es";
  position: string;
  path: TrainingPath | null;
  startDate: string;
  status: string;
  isSample: boolean;
  progress: ProgressSummary;
  trainers: TrainerOption[];
  modules: EditorModule[];
  stores: { id: string; number: string; name: string }[];
};

export type ScheduleSession = {
  id: string;
  date: string;
  traineeId: string;
  traineeName: string;
  storeNumber: string;
  storeName: string;
  moduleName: string;
  sortOrder: number;
  section: SectionId;
  sectionTitle: string;
  timeLabel: string;
  kind: string;
  trainerName: string;
  trainerIsGm: boolean;
  overdue: boolean;
  dueToday: boolean;
  traineeStatus: string;
};

export type ModuleTemplate = {
  id: string;
  language: "en" | "es";
  section: SectionId;
  sectionTitle: string;
  sortOrder: number;
  name: string;
  timeLabel: string;
  timeMinutes: number | null;
  videoCount: number | null;
  credit: string | null;
  link: string;
  videoTitles: string;
  needsReview: boolean;
  kind: string;
  note: string;
  archived: boolean;
};

export type ScheduledSessionRow = {
  id: string;
  date: string;
  traineeId: string;
  traineeName: string;
  storeNumber: string;
  moduleName: string;
  trainerName: string;
  completed: boolean;
  timeLabel: string;
};

export function sectionTitle(language: string, section: SectionId): string {
  const pack = language === "es" ? SECTION_TITLES.es : SECTION_TITLES.en;
  return pack[section];
}
