import { NextResponse } from "next/server";
import { applyRosterSync } from "@/lib/data";
import { parseDevelopmentReport } from "@/lib/roster/parse";
import { safeEqual } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expected = process.env.SYNC_TOKEN;
  if (!expected) {
    return NextResponse.json({ ok: false, error: "Roster sync is not configured." }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  const provided = /^Bearer\s+(\S+)\s*$/i.exec(header)?.[1] ?? "";
  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const csv = await request.text();
  if (!csv.trim()) {
    return NextResponse.json({ ok: false, error: "Send the roster CSV in the request body." }, { status: 400 });
  }
  const parsed = parseDevelopmentReport(csv);
  if (parsed.entries.length === 0) {
    return NextResponse.json(
      { ok: false, error: parsed.issues[0]?.message ?? "No roster rows to import.", issues: parsed.issues },
      { status: 400 },
    );
  }
  const result = await applyRosterSync(parsed.entries);
  return NextResponse.json({
    ok: true,
    rowsRead: result.rowsRead,
    added: result.createdCount,
    updated: result.updatedCount,
    deactivated: result.deactivatedCount,
    skipped: result.skippedCount + parsed.issues.length,
    issues: [...parsed.issues, ...result.issues],
  });
}
