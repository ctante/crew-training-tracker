import { csvResponse } from "@/lib/csv-response";
import { exportTraineeCsv } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const file = await exportTraineeCsv(id);
  if (!file) return new Response("Trainee not found", { status: 404 });
  return csvResponse(file.filename, file.csv);
}
