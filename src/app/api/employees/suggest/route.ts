import { NextResponse } from "next/server";
import { suggestEmployees } from "@/lib/employees";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const people = await suggestEmployees(url.searchParams.get("q") ?? "", url.searchParams.get("storeId") ?? undefined);
  return NextResponse.json({ people });
}
