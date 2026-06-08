export type Permission =
  | "dashboard"
  | "offices"
  | "employees"
  | "salaries"
  | "advances"
  | "reports"
  | "users"
  | "audit_logs";

export const ALL_PERMISSIONS: Permission[] = [
  "dashboard",
  "offices",
  "employees",
  "salaries",
  "advances",
  "reports",
  "users",
  "audit_logs",
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  dashboard: "Dashboard",
  offices: "Offices",
  employees: "Employees",
  salaries: "Salaries",
  advances: "Advances",
  reports: "Reports & Export",
  users: "Sub Admins",
  audit_logs: "Audit Logs",
};

export const PERMISSION_ROUTES: Record<Permission, string> = {
  dashboard: "/dashboard",
  offices: "/offices",
  employees: "/employees",
  salaries: "/salaries",
  advances: "/advances",
  reports: "/reports",
  users: "/users",
  audit_logs: "/audit-logs",
};

export function resolvePermissions(
  permissions?: Permission[] | null
): Permission[] {
  if (permissions && permissions.length > 0) return permissions;
  return ALL_PERMISSIONS;
}

export function hasPermission(
  userPermissions: Permission[] | undefined,
  permission: Permission,
  role?: string
): boolean {
  if (role === "super_admin") return true;
  return resolvePermissions(userPermissions).includes(permission);
}
