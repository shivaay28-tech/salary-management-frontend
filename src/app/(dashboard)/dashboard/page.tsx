"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Building2,
  Users,
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle,
  Banknote,
  RefreshCw,
  PauseCircle,
  Ban,
} from "lucide-react";
import { getDefaultRoute } from "@/lib/auth-route";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import type { ApiResponse, DashboardData, SalaryRecord, Advance, Employee } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const YEAR_OPTIONS = Array.from({ length: 21 }, (_, i) => CURRENT_YEAR - 10 + i);

const CHART_COLORS = {
  primary: "#6366f1",
  paid: "#22c55e",
  pending: "#f59e0b",
  advance: "#f97316",
  accent: "#8b5cf6",
  blue: "#3b82f6",
  deferred: "#0ea5e9",
  skipped: "#94a3b8",
};

const STAT_CARDS = [
  {
    key: "totalOffices",
    title: "Total Offices",
    icon: Building2,
    gradient: "from-blue-500 to-blue-600",
    format: (v: number) => String(v),
  },
  {
    key: "totalEmployees",
    title: "Total Employees",
    icon: Users,
    gradient: "from-violet-500 to-purple-600",
    format: (v: number) => String(v),
  },
  {
    key: "activeEmployees",
    title: "Active Employees",
    icon: Users,
    gradient: "from-emerald-500 to-teal-600",
    format: (v: number) => String(v),
  },
  {
    key: "totalMonthlySalary",
    title: "Monthly Salary",
    icon: Wallet,
    gradient: "from-indigo-500 to-indigo-600",
    format: (v: number) => `₹${v.toLocaleString("en-IN")}`,
  },
  {
    key: "paidSalaryThisMonth",
    title: "Paid",
    icon: CheckCircle,
    gradient: "from-green-500 to-green-600",
    format: (v: number) => `₹${v.toLocaleString("en-IN")}`,
  },
  {
    key: "pendingSalaryThisMonth",
    title: "Pending",
    icon: Clock,
    gradient: "from-amber-500 to-orange-500",
    format: (v: number) => `₹${v.toLocaleString("en-IN")}`,
  },
  {
    key: "deferredSalaryThisMonth",
    title: "Deferred",
    icon: PauseCircle,
    gradient: "from-sky-500 to-cyan-600",
    format: (v: number) => `₹${v.toLocaleString("en-IN")}`,
  },
  {
    key: "skippedCountThisMonth",
    title: "Skipped",
    icon: Ban,
    gradient: "from-slate-500 to-slate-600",
    format: (v: number) => String(v),
  },
  {
    key: "totalOutstandingAdvances",
    title: "Outstanding Advances",
    icon: TrendingUp,
    gradient: "from-rose-500 to-pink-600",
    format: (v: number) => `₹${v.toLocaleString("en-IN")}`,
  },
  {
    key: "advancesThisMonth",
    title: "Advances (Month)",
    icon: Banknote,
    gradient: "from-cyan-500 to-sky-600",
    format: (v: number) => `₹${v.toLocaleString("en-IN")}`,
  },
] as const;

function empName(emp: SalaryRecord["employeeId"] | Advance["employeeId"] | Employee) {
  if (typeof emp === "object" && emp !== null && "fullName" in emp) {
    return (emp as Employee).fullName;
  }
  return "—";
}

function formatRsTooltip(value: unknown) {
  const n = Array.isArray(value) ? Number(value[0]) : Number(value ?? 0);
  return `₹${n.toLocaleString("en-IN")}`;
}

function monthLabel(month: string) {
  return new Date(2000, Number(month) - 1).toLocaleString("en", { month: "long" });
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, isSuperAdmin, hasPermission } = useAuth();
  const canViewDashboard = isSuperAdmin || hasPermission("dashboard");
  const initialMonth = String(now.getMonth() + 1);
  const initialYear = String(now.getFullYear());
  const [monthFilter, setMonthFilter] = useState(initialMonth);
  const [yearFilter, setYearFilter] = useState(initialYear);
  const [appliedMonth, setAppliedMonth] = useState(initialMonth);
  const [appliedYear, setAppliedYear] = useState(initialYear);

  useEffect(() => {
    if (!loading && user && !canViewDashboard) {
      router.replace(getDefaultRoute(user.role, user.permissions));
    }
  }, [loading, user, canViewDashboard, router]);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["dashboard", appliedMonth, appliedYear],
    queryFn: async () => {
      const { data: res } = await api.get<ApiResponse<DashboardData>>(
        `/dashboard?month=${appliedMonth}&year=${appliedYear}`
      );
      return res.data!;
    },
    enabled: !loading && canViewDashboard,
  });

  const handleLoad = () => {
    setAppliedMonth(monthFilter);
    setAppliedYear(yearFilter);
    if (monthFilter === appliedMonth && yearFilter === appliedYear) {
      refetch();
    }
  };

  if (!loading && !canViewDashboard) {
    return null;
  }

  const periodLabel =
    data?.period.label ??
    new Date(Number(appliedYear), Number(appliedMonth) - 1).toLocaleString("en", {
      month: "long",
      year: "numeric",
    });

  const salaryStatusData = data
    ? [
        { name: "Paid", value: data.charts.salaryStatus.paid, color: CHART_COLORS.paid },
        {
          name: "Pending",
          value: data.charts.salaryStatus.pending,
          color: CHART_COLORS.pending,
        },
        {
          name: "Deferred",
          value: data.charts.salaryStatus.deferred,
          color: CHART_COLORS.deferred,
        },
        {
          name: "Skipped",
          value: data.charts.salaryStatus.skipped,
          color: CHART_COLORS.skipped,
        },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-4">
      <PageHeader
        theme="dashboard"
        title="Dashboard"
        description={`Overview for ${periodLabel}${
          !isSuperAdmin ? " · your assigned offices" : ""
        }${isFetching && !isLoading ? " · updating…" : ""}`}
        className="p-4 [&_h1]:text-xl [&>div]:items-end"
      >
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-white/25 bg-white/10 p-3 backdrop-blur-sm">
          <div className="grid w-36 gap-1.5">
            <Label className="text-xs font-medium text-white/90">Month</Label>
            <Select value={monthFilter} onValueChange={(v) => setMonthFilter(v ?? "1")}>
              <SelectTrigger className="h-9 w-full border-white/30 bg-white text-foreground shadow-sm">
                <SelectValue>{monthLabel(monthFilter)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {monthLabel(String(i + 1))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid w-28 gap-1.5">
            <Label className="text-xs font-medium text-white/90">Year</Label>
            <Select
              value={yearFilter}
              onValueChange={(v) => setYearFilter(v ?? String(CURRENT_YEAR))}
            >
              <SelectTrigger className="h-9 w-full border-white/30 bg-white text-foreground shadow-sm">
                <SelectValue>{yearFilter}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-medium text-white/90 invisible select-none" aria-hidden>
              Load
            </Label>
            <Button
              onClick={handleLoad}
              disabled={isFetching}
              className="h-9 border-white/30 bg-white text-indigo-700 shadow-sm hover:bg-white/90"
            >
              <RefreshCw className="size-4 mr-2" />
              {isFetching ? "Loading..." : "Load"}
            </Button>
          </div>
        </div>
      </PageHeader>

      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          Loading dashboard...
        </div>
      ) : isError || !data ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
          <p>Unable to load dashboard.</p>
          <p className="text-sm">{isError ? getErrorMessage(error) : "No data returned"}</p>
        </div>
      ) : (
        <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;
          const value = data.cards[card.key as keyof typeof data.cards];
          return (
            <div
              key={card.key}
              className={`rounded-xl bg-gradient-to-br ${card.gradient} p-3.5 text-white shadow-md`}
            >
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium text-white/90">{card.title}</p>
                <div className="rounded-md bg-white/20 p-1.5">
                  <Icon className="size-3.5" />
                </div>
              </div>
              <p className="mt-1.5 text-xl font-bold tracking-tight">
                {card.format(value)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden border-indigo-100 shadow-md py-3 gap-2">
          <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-2 dark:from-indigo-950/40 dark:to-violet-950/40">
            <CardTitle className="text-sm">Salary trend (last 6 months)</CardTitle>
            <p className="text-xs text-muted-foreground">Paid vs pending by month</p>
          </CardHeader>
          <CardContent className="h-56 px-4 pt-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.charts.salaryTrend}>
                <defs>
                  <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.paid} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={CHART_COLORS.paid} stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="pendingGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.pending} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={CHART_COLORS.pending} stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${v}`
                  }
                />
                <Tooltip formatter={formatRsTooltip} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="paid"
                  name="Paid"
                  stackId="1"
                  stroke={CHART_COLORS.paid}
                  fill="url(#paidGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="pending"
                  name="Pending"
                  stackId="1"
                  stroke={CHART_COLORS.pending}
                  fill="url(#pendingGrad)"
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-emerald-100 shadow-md py-3 gap-2">
          <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-green-50 px-4 py-2 dark:from-emerald-950/40 dark:to-green-950/40">
            <CardTitle className="text-sm">Salary status</CardTitle>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </CardHeader>
          <CardContent className="h-56 px-4 pt-2 pb-3">
            {salaryStatusData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No salary data for this month
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salaryStatusData}
                    cx="50%"
                    cy="45%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {salaryStatusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={formatRsTooltip} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden border-blue-100 shadow-md py-3 gap-2">
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-cyan-50 px-4 py-2 dark:from-blue-950/40 dark:to-cyan-950/40">
            <CardTitle className="text-sm">Office-wise salary</CardTitle>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </CardHeader>
          <CardContent className="h-56 px-4 pt-2 pb-3">
            {data.charts.officeWiseSalary.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No office salary data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.officeWiseSalary} margin={{ bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="office"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={data.charts.officeWiseSalary.length > 4 ? -25 : 0}
                    textAnchor={data.charts.officeWiseSalary.length > 4 ? "end" : "middle"}
                    height={data.charts.officeWiseSalary.length > 4 ? 56 : 30}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${v}`
                    }
                  />
                  <Tooltip formatter={formatRsTooltip} />
                  <Legend />
                  <Bar
                    dataKey="paid"
                    name="Paid"
                    stackId="a"
                    fill={CHART_COLORS.paid}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="pending"
                    name="Pending"
                    stackId="a"
                    fill={CHART_COLORS.pending}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-orange-100 shadow-md py-3 gap-2">
          <CardHeader className="border-b bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-2 dark:from-orange-950/40 dark:to-amber-950/40">
            <CardTitle className="text-sm">Advance trend</CardTitle>
            <p className="text-xs text-muted-foreground">Amount given by month</p>
          </CardHeader>
          <CardContent className="h-56 px-4 pt-2 pb-3">
            {data.charts.advanceTrend.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No advance data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.advanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${v}`
                    }
                  />
                  <Tooltip formatter={formatRsTooltip} />
                  <Bar
                    dataKey="total"
                    name="Advances"
                    fill={CHART_COLORS.advance}
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-l-4 border-l-indigo-500 shadow-sm py-3 gap-2">
          <CardHeader className="px-4 py-2">
            <CardTitle className="text-sm">Recent salaries</CardTitle>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </CardHeader>
          <CardContent className="px-4 pt-0">
            <Table>
              <TableBody>
                {data.recent.salaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-sm text-muted-foreground">
                      No records
                    </TableCell>
                  </TableRow>
                ) : (
                  data.recent.salaries.map((s) => (
                    <TableRow key={s._id}>
                      <TableCell className="text-sm">{empName(s.employeeId)}</TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-medium">
                          ₹{s.finalSalary.toLocaleString("en-IN")}
                        </span>
                        <Badge
                          variant={s.paidStatus === "paid" ? "success" : "warning"}
                          className="ml-2 text-[10px]"
                        >
                          {s.paidStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm py-3 gap-2">
          <CardHeader className="px-4 py-2">
            <CardTitle className="text-sm">Recent advances</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-0">
            <Table>
              <TableBody>
                {data.recent.advances.map((a) => (
                  <TableRow key={a._id}>
                    <TableCell className="text-sm">{empName(a.employeeId)}</TableCell>
                    <TableCell className="text-right text-sm font-medium text-orange-600">
                      ₹{a.advanceAmount.toLocaleString("en-IN")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm py-3 gap-2">
          <CardHeader className="px-4 py-2">
            <CardTitle className="text-sm">Recent employees</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-0">
            <Table>
              <TableBody>
                {data.recent.employees.map((e) => (
                  <TableRow key={e._id}>
                    <TableCell className="text-sm">{e.fullName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {typeof e.officeId === "object" && e.officeId !== null
                        ? e.officeId.name
                        : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
        </>
      )}
    </div>
  );
}
