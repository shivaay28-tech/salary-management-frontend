export type Permission =
  | "dashboard"
  | "employees"
  | "salaries"
  | "advances"
  | "reports";

export const ALL_PERMISSIONS: Permission[] = [
  "dashboard",
  "employees",
  "salaries",
  "advances",
  "reports",
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  dashboard: "Dashboard",
  employees: "Employees",
  salaries: "Salaries",
  advances: "Advances",
  reports: "Reports & Export",
};

export const PERMISSION_ROUTES: Record<Permission, string> = {
  dashboard: "/dashboard",
  employees: "/employees",
  salaries: "/salaries",
  advances: "/advances",
  reports: "/reports",
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
