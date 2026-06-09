"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  Users,
  Wallet,
  FileText,
  TrendingUp,
  ScrollText,
  UserCircle,
  Clock,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import type { Permission } from "@/types";
import { cn } from "@/lib/utils";

const mainNav: {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
  anyPermission?: Permission[];
  activeClass: string;
  iconClass: string;
}[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard",
    activeClass: "bg-indigo-500/25 text-indigo-100",
    iconClass: "text-indigo-300",
  },
  {
    title: "Offices",
    href: "/offices",
    icon: Building2,
    permission: "offices",
    activeClass: "bg-blue-500/25 text-blue-100",
    iconClass: "text-blue-300",
  },
  {
    title: "Employees",
    href: "/employees",
    icon: UserCircle,
    permission: "employees",
    activeClass: "bg-emerald-500/25 text-emerald-100",
    iconClass: "text-emerald-300",
  },
  {
    title: "Salaries",
    href: "/salaries",
    icon: Wallet,
    permission: "salaries",
    activeClass: "bg-violet-500/25 text-violet-100",
    iconClass: "text-violet-300",
  },
  {
    title: "Advances",
    href: "/advances",
    icon: TrendingUp,
    permission: "advances",
    activeClass: "bg-orange-500/25 text-orange-100",
    iconClass: "text-orange-300",
  },
  {
    title: "Jama Report",
    href: "/deferred-report",
    icon: Clock,
    anyPermission: ["reports", "salaries"],
    activeClass: "bg-amber-500/25 text-amber-100",
    iconClass: "text-amber-300",
  },
  {
    title: "Reports",
    href: "/reports",
    icon: FileText,
    permission: "reports",
    activeClass: "bg-cyan-500/25 text-cyan-100",
    iconClass: "text-cyan-300",
  },
];

const adminNav: {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: Permission;
  activeClass: string;
  iconClass: string;
}[] = [
  {
    title: "Sub Admins",
    href: "/users",
    icon: Users,
    permission: "users",
    activeClass: "bg-fuchsia-500/25 text-fuchsia-100",
    iconClass: "text-fuchsia-300",
  },
  {
    title: "Audit Logs",
    href: "/audit-logs",
    icon: ScrollText,
    permission: "audit_logs",
    activeClass: "bg-slate-400/25 text-slate-100",
    iconClass: "text-slate-300",
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout, isSuperAdmin, hasPermission } = useAuth();

  const canSeeNavItem = (item: (typeof mainNav)[number]) => {
    if (isSuperAdmin) return true;
    if (item.anyPermission?.length) {
      return item.anyPermission.some((permission) => hasPermission(permission));
    }
    if (!item.permission) return true;
    return hasPermission(item.permission);
  };

  const visibleMainNav = mainNav.filter(canSeeNavItem);

  const visibleAdminNav = adminNav.filter(
    (item) => isSuperAdmin || hasPermission(item.permission)
  );

  const renderItem = (item: (typeof mainNav)[number] | (typeof adminNav)[number]) => (
    <SidebarMenuItem key={item.href}>
      <SidebarMenuButton
        isActive={pathname === item.href}
        tooltip={item.title}
        className={cn(
          pathname === item.href && item.activeClass,
          "hover:bg-sidebar-accent/80"
        )}
        render={<Link href={item.href} />}
      >
        <item.icon
          className={cn(
            "size-4",
            pathname === item.href ? "text-white" : item.iconClass
          )}
        />
        <span>{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border bg-gradient-to-br from-indigo-700/40 to-violet-800/40 px-3 py-3">
        <div className="bg-gradient-to-r from-white to-indigo-100 bg-clip-text text-sm font-bold text-transparent">
          Salary Management
        </div>
        <div className="truncate text-xs text-sidebar-foreground/75">
          {user?.name} ·{" "}
          <span className="text-indigo-200">
            {user?.role === "super_admin" ? "Super Admin" : "Sub Admin"}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{visibleMainNav.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {visibleAdminNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60">
              Administration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{visibleAdminNav.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-rose-500/20 hover:text-rose-100"
          onClick={() => logout()}
        >
          <LogOut className="mr-2 size-4" />
          Logout
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
