export type PageThemeKey =
  | "dashboard"
  | "offices"
  | "employees"
  | "salaries"
  | "advances"
  | "reports"
  | "users"
  | "audit";

export const PAGE_THEMES: Record<
  PageThemeKey,
  {
    gradient: string;
    cardBorder: string;
    cardHeader: string;
    icon: string;
    badge: string;
  }
> = {
  dashboard: {
    gradient: "from-indigo-600 via-violet-600 to-purple-700",
    cardBorder: "border-indigo-200",
    cardHeader: "border-b bg-gradient-to-r from-indigo-50 to-violet-50",
    icon: "text-indigo-600",
    badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
  },
  offices: {
    gradient: "from-blue-600 to-cyan-600",
    cardBorder: "border-blue-200",
    cardHeader: "border-b bg-gradient-to-r from-blue-50 to-cyan-50",
    icon: "text-blue-600",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
  },
  employees: {
    gradient: "from-emerald-600 to-teal-600",
    cardBorder: "border-emerald-200",
    cardHeader: "border-b bg-gradient-to-r from-emerald-50 to-teal-50",
    icon: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  salaries: {
    gradient: "from-violet-600 to-purple-600",
    cardBorder: "border-violet-200",
    cardHeader: "border-b bg-gradient-to-r from-violet-50 to-purple-50",
    icon: "text-violet-600",
    badge: "bg-violet-100 text-violet-700 border-violet-200",
  },
  advances: {
    gradient: "from-orange-500 to-rose-600",
    cardBorder: "border-orange-200",
    cardHeader: "border-b bg-gradient-to-r from-orange-50 to-rose-50",
    icon: "text-orange-600",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
  },
  reports: {
    gradient: "from-cyan-600 to-blue-600",
    cardBorder: "border-cyan-200",
    cardHeader: "border-b bg-gradient-to-r from-cyan-50 to-blue-50",
    icon: "text-cyan-600",
    badge: "bg-cyan-100 text-cyan-700 border-cyan-200",
  },
  users: {
    gradient: "from-fuchsia-600 to-pink-600",
    cardBorder: "border-fuchsia-200",
    cardHeader: "border-b bg-gradient-to-r from-fuchsia-50 to-pink-50",
    icon: "text-fuchsia-600",
    badge: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  },
  audit: {
    gradient: "from-slate-700 to-indigo-700",
    cardBorder: "border-slate-200",
    cardHeader: "border-b bg-gradient-to-r from-slate-50 to-indigo-50",
    icon: "text-slate-600",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

export function accentCard(theme: PageThemeKey) {
  const t = PAGE_THEMES[theme];
  return {
    card: `${t.cardBorder} shadow-md overflow-hidden`,
    header: t.cardHeader,
  };
}
