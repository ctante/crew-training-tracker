import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { access } from "@/lib/access";
import { canWatchHelp, helpMediaRole } from "@/lib/help";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  mp4: "video/mp4",
  vtt: "text/vtt; charset=utf-8",
  jpg: "image/jpeg",
};

export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const role = helpMediaRole(file);
  const extension = file.split(".").pop() ?? "";
  const type = TYPES[extension];
  if (!role || !type) return new NextResponse("Not found", { status: 404 });

  const who = await access();
  if (!canWatchHelp(who.role, role)) return new NextResponse("Forbidden", { status: 403 });

  const full = path.join(process.cwd(), "content/help", file);
  let data: Buffer;
  try {
    data = await readFile(full);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const size = data.length;
  const headers = new Headers({
    "Content-Type": type,
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  });
  const range = request.headers.get("range");
  if (!range) {
    headers.set("Content-Length", String(size));
    return new NextResponse(new Uint8Array(data), { status: 200, headers });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  const start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= size || end < start) {
    return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  end = Math.min(end, size - 1);
  const slice = data.subarray(start, end + 1);
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(slice.length));
  return new NextResponse(new Uint8Array(slice), { status: 206, headers });
}
