import { parseDevelopmentReport } from "./parse";
import type { DevelopmentReportSource } from "./source";

/**
 * The weekly Development Report sync is retired. The app does not call this.
 * People are added under Admin, then Add Trainer / Manager. The file stays so an old import
 * script can still be read, and `pull()` is not wired to a button or the API.
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
