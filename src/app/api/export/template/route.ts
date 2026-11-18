import { csvResponse } from "@/lib/csv-response";
import { exportTemplateCsv } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const lang = new URL(request.url).searchParams.get("lang") === "es" ? "es" : "en";
  const file = await exportTemplateCsv(lang);
  return csvResponse(file.filename, file.csv);
}
