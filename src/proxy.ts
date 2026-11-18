import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/login/")) return NextResponse.next();

  const valid = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (valid) return NextResponse.next();

  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.png$|.*\\.svg$|.*\\.ico$).*)"],
};
