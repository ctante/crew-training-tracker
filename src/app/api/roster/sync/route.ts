import { NextResponse } from "next/server";
import { syncEmployeeSnapshot } from "@/lib/employees";
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Send a JSON array." }, { status: 400 });
  }
  if (!Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Send a JSON array of employees." }, { status: 400 });
  }
  const rows = body.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { store?: unknown; employeeId?: unknown; name?: unknown; position?: unknown };
    const store = typeof row.store === "string" ? row.store : "";
    const name = typeof row.name === "string" ? row.name : "";
    if (!store || !name) return [];
    return [
      {
        store,
        name,
        employeeId: typeof row.employeeId === "string" ? row.employeeId : undefined,
        position: typeof row.position === "string" ? row.position : "",
      },
    ];
  });
  const result = await syncEmployeeSnapshot(rows);
  return NextResponse.json({ ok: true, ...result });
}
