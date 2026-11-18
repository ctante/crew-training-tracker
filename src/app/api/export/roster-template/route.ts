import { csvResponse } from "@/lib/csv-response";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export function GET() {
  const csv = toCsv([
    ["Name", "Store", "Position", "Qualified"],
    ["Example Trainer", "05207", "Crew Trainer", "Yes"],
    ["Example Leader", "05207", "Area Manager", "Yes"],
    ["Example Shift", "5207", "Shift Manager", "No"],
  ]);
  return csvResponse("development-report-template.csv", csv);
}
