import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  clearAuthCookies,
  getDefaultRoute,
  isAccessTokenValid,
  parseTokenClaims,
} from "@/lib/auth-route";

const publicPaths = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("sms_access_token")?.value;
  const refreshToken = request.cookies.get("sms_refresh_token")?.value;
  const hasValidAccess = !!(token && isAccessTokenValid(token));
  const hasRefresh = !!refreshToken;

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    if (hasValidAccess) {
      const claims = parseTokenClaims(token!);
      const destination = getDefaultRoute(claims?.role, claims?.permissions);
      return NextResponse.redirect(new URL(destination, request.url));
    }

    if (token && !hasRefresh) {
      const response = NextResponse.next();
      clearAuthCookies(response);
      return response;
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
    if (!hasValidAccess) {
      if (hasRefresh) {
        return NextResponse.next();
      }

      const response = NextResponse.redirect(new URL("/login", request.url));
      if (token) {
        clearAuthCookies(response);
      }
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
