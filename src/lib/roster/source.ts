import { parseDevelopmentReport, type RosterEntry } from "./parse";

export type { RosterEntry } from "./parse";

/**
 * A Development Report feed. CSV upload and a future Google Sheets sync both
 * implement this, and neither one writes to the database. `syncDevelopmentReport`
 * in the data layer is the only writer.
 */
export interface DevelopmentReportSource {
  readonly id: "csv" | "google-sheets";
  readonly label: string;
  pull(): Promise<RosterEntry[]>;
}

export function csvDevelopmentReportSource(csv: string): DevelopmentReportSource {
  return {
    id: "csv",
    label: "Development Report CSV",
    async pull() {
      const parsed = parseDevelopmentReport(csv);
      if (parsed.entries.length === 0) {
        throw new Error(parsed.issues[0]?.message ?? "The Development Report has no people.");
      }
      return parsed.entries;
    },
  };
}
