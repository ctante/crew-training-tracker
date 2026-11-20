import { addDays } from "./format";

export type DevelopmentPerson = {
  id: string;
  name: string;
  position: string;
  active: boolean;
  hours: string;
  trainingNeeded: string;
  comments: string;
};

export type DevelopmentStoreWeek = {
  id: string;
  number: string;
  notes: string;
  hoursTotal: number;
  people: DevelopmentPerson[];
};

export function mondayOf(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function weekLabel(start: string): string {
  const end = addDays(start, 6);
  const short = (value: string) => {
    const [, month, day] = value.split("-");
    return `${month}/${day}`;
  };
  return `Week of ${short(start)}-${short(end)}`;
}

export function parseWeekLabel(label: string, year = 2026): string | null {
  const match = /week of\s+(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})/i.exec(label.trim());
  if (!match) return null;
  const month = match[1].padStart(2, "0");
  const day = match[2].padStart(2, "0");
  return mondayOf(`${year}-${month}-${day}`);
}

export const HOUR_CHOICES = Array.from({ length: 20 }, (_, index) => {
  const value = (index + 1) / 2;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
});

const HOUR_SET = new Set(HOUR_CHOICES);

export function convertHours(value: string): { hours: string; converted: boolean } {
  const trimmed = value.trim();
  if (!trimmed) return { hours: "", converted: true };
  const direct = normalizeHourToken(trimmed);
  if (direct && HOUR_SET.has(direct)) return { hours: direct, converted: true };
  const parts = trimmed.split("+").map((part) => part.trim()).filter(Boolean);
  if (parts.length > 0 && parts.every((part) => /^\d+(?:\.\d+)?$/.test(part))) {
    const sum = parts.reduce((total, part) => total + Number(part), 0);
    const formatted = normalizeHourToken(String(sum));
    if (formatted && HOUR_SET.has(formatted)) return { hours: formatted, converted: true };
  }
  return { hours: trimmed, converted: false };
}

function normalizeHourToken(value: string): string | null {
  if (!/^\d+(?:\.\d+)?$/.test(value)) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const rounded = Math.round(number * 2) / 2;
  if (Math.abs(rounded - number) > 0.001) return null;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function developmentHours(value: string): number {
  const parts = value.split("+").map((part) => part.trim()).filter(Boolean);
  let total = 0;
  let any = false;
  for (const part of parts) {
    const number = Number(part);
    if (Number.isFinite(number)) {
      total += number;
      any = true;
    }
  }
  return any ? total : 0;
}

export function formatHourTotal(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}
