import {
  ALL_PERMISSIONS,
  PERMISSION_ROUTES,
  type Permission,
} from "@/lib/permissions";

const ROUTE_ORDER: Permission[] = [
  "dashboard",
  "offices",
  "employees",
  "salaries",
  "advances",
  "reports",
  "users",
  "audit_logs",
];

interface TokenClaims {
  role?: string;
  permissions?: Permission[];
  exp?: number;
}

const ACCESS_KEY = "sms_access_token";
const REFRESH_KEY = "sms_refresh_token";

export function getDefaultRoute(
  role?: string,
  permissions?: Permission[] | null
): string {
  if (role === "super_admin") return "/dashboard";

  const resolved =
    permissions && permissions.length > 0 ? permissions : ALL_PERMISSIONS;
  const first = ROUTE_ORDER.find((permission) => resolved.includes(permission));
  return first ? PERMISSION_ROUTES[first] : "/offices";
}

export function canAccessRoute(
  pathname: string,
  role?: string,
  permissions?: Permission[] | null
): boolean {
  if (role === "super_admin") return true;

  const resolved =
    permissions && permissions.length > 0 ? permissions : ALL_PERMISSIONS;

  if (pathname.startsWith("/deferred-report")) {
    return resolved.includes("reports") || resolved.includes("salaries");
  }

  for (const permission of ROUTE_ORDER) {
    if (pathname.startsWith(PERMISSION_ROUTES[permission])) {
      return resolved.includes(permission);
    }
  }

  return true;
}

export function parseTokenClaims(token: string): TokenClaims | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as TokenClaims;
  } catch {
    return null;
  }
}

export function isAccessTokenValid(token: string): boolean {
  const claims = parseTokenClaims(token);
  if (!claims) return false;
  if (typeof claims.exp !== "number") return false;
  return claims.exp * 1000 > Date.now();
}

export function clearAuthCookies(response: {
  cookies: {
    delete: (name: string) => void;
  };
}): void {
  response.cookies.delete(ACCESS_KEY);
  response.cookies.delete(REFRESH_KEY);
}
