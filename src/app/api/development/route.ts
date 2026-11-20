import { developmentCsv } from "@/lib/development";
import { csvResponse } from "@/lib/csv-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const file = await developmentCsv({
    week: url.searchParams.get("week") ?? undefined,
    store: url.searchParams.get("store") ?? undefined,
    position: url.searchParams.get("position") ?? undefined,
  });
  return csvResponse(file.filename, file.csv);
}
