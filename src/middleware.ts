import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getDefaultRoute, parseTokenClaims } from "@/lib/auth-route";

const publicPaths = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("sms_access_token")?.value;

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    if (token) {
      const claims = parseTokenClaims(token);
      const destination = getDefaultRoute(claims?.role, claims?.permissions);
      return NextResponse.redirect(new URL(destination, request.url));
    }
    return NextResponse.next();
  }

  const protectedPrefixes = [
    "/dashboard",
    "/offices",
    "/users",
    "/employees",
    "/salaries",
    "/advances",
    "/reports",
    "/deferred-report",
    "/audit-logs",
  ];
  if (protectedPrefixes.some((p) => pathname.startsWith(p))) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
