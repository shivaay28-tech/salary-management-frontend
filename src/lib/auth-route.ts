import {
  ALL_PERMISSIONS,
  PERMISSION_ROUTES,
  type Permission,
} from "@/lib/permissions";

const ROUTE_ORDER: Permission[] = [
  "dashboard",
  "employees",
  "salaries",
  "advances",
  "reports",
];

interface TokenClaims {
  role?: string;
  permissions?: Permission[];
}

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

  if (pathname.startsWith("/users") || pathname.startsWith("/audit-logs")) {
    return false;
  }

  if (pathname.startsWith("/offices")) return true;

  for (const permission of ROUTE_ORDER) {
    if (pathname.startsWith(PERMISSION_ROUTES[permission])) {
      const resolved =
        permissions && permissions.length > 0 ? permissions : ALL_PERMISSIONS;
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
