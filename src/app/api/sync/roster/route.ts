import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/session";

export const dynamic = "force-dynamic";

const retired = {
  ok: true,
  retired: true,
  rowsRead: 0,
  added: 0,
  updated: 0,
  deactivated: 0,
  skipped: 0,
  issues: [] as { row: number; message: string }[],
  message: "The weekly roster sync is retired. People are added under Admin, then Trainer / Manager. Nothing was changed.",
};

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
  await request.text();
  return NextResponse.json(retired);
}
