import { exportAllCsv } from "@/lib/data";
import { csvResponse } from "@/lib/csv-response";

export const dynamic = "force-dynamic";

export async function GET() {
  const file = await exportAllCsv();
  return csvResponse(file.filename, file.csv);
}
