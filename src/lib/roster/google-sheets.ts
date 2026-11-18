import { parseDevelopmentReport } from "./parse";
import type { DevelopmentReportSource } from "./source";

/**
 * Plug a live Development Report in here.
 *
 * The current hook reads a published CSV from DEVELOPMENT_REPORT_CSV_URL.
 * To use the Sheets API instead, replace `pull()` and keep the same
 * DevelopmentReportSource shape. The data layer will upsert whatever this returns.
 */
export function googleSheetsDevelopmentReportSource(): DevelopmentReportSource {
  return {
    id: "google-sheets",
    label: "Development Report Google Sheet",
    async pull() {
      const url = process.env.DEVELOPMENT_REPORT_CSV_URL?.trim();
      if (!url) {
        throw new Error(
          "Google Sheets sync is not connected. Publish the Development Report as CSV, set DEVELOPMENT_REPORT_CSV_URL, or upload the file. The Sheets API call belongs in src/lib/roster/google-sheets.ts.",
        );
      }
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`The Development Report link returned ${response.status}.`);
      }
      const parsed = parseDevelopmentReport(await response.text());
      if (parsed.entries.length === 0) {
        throw new Error(parsed.issues[0]?.message ?? "The sheet has no roster rows.");
      }
      return parsed.entries;
    },
  };
}
