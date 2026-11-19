import { NextResponse } from "next/server";
import { many } from "@/lib/format";
import { REPORTS, getReports, reportCsv, type ReportKind } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("report");
  if (!kind || !REPORTS.includes(kind as ReportKind)) {
    return NextResponse.json({ error: "Unknown report." }, { status: 400 });
  }
  const data = await getReports({
    storeNumbers: many(url.searchParams.getAll("store")),
    entireOrg: url.searchParams.get("org") === "1" || url.searchParams.getAll("store").length === 0,
    range: url.searchParams.get("range") ?? "all",
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const file = reportCsv(kind as ReportKind, data);
  return new NextResponse(file.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
    },
  });
}
