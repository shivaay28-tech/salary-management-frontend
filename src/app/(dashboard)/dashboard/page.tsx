"use client";

import { useState } from "react";
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
} from "lucide-react";
import { api } from "@/lib/api";
import type { ApiResponse, DashboardData, SalaryRecord, Advance, Employee } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

const CHART_COLORS = {
  primary: "#6366f1",
  paid: "#22c55e",
  pending: "#f59e0b",
  advance: "#f97316",
  accent: "#8b5cf6",
  blue: "#3b82f6",
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

export default function DashboardPage() {
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["dashboard", month, year],
    queryFn: async () => {
      const { data: res } = await api.get<ApiResponse<DashboardData>>(
        `/dashboard?month=${month}&year=${year}`
      );
      return res.data!;
    },
  });

  const periodLabel =
    data?.period.label ??
    new Date(Number(year), Number(month) - 1).toLocaleString("en", {
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
      ].filter((d) => d.value > 0)
    : [];

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Loading dashboard...
      </div>
    );
  }

  const { cards, charts, recent } = data;

  return (
    <div className="space-y-4">
      <PageHeader
        theme="dashboard"
        title="Dashboard"
        description={`Overview for ${periodLabel}${isFetching && !isLoading ? " · updating…" : ""}`}
        className="p-4 [&_h1]:text-xl"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-white/80">Month</Label>
            <Select value={month} onValueChange={(v) => setMonth(v ?? "1")}>
              <SelectTrigger className="h-8 w-32 bg-white/95 text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {new Date(2000, i).toLocaleString("en", { month: "long" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-white/80">Year</Label>
            <Input
              className="h-8 w-20 bg-white/95 text-foreground"
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>
        </div>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;
          const value = cards[card.key as keyof typeof cards];
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
              <AreaChart data={charts.salaryTrend}>
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
            {charts.officeWiseSalary.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No office salary data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.officeWiseSalary} margin={{ bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="office"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={charts.officeWiseSalary.length > 4 ? -25 : 0}
                    textAnchor={charts.officeWiseSalary.length > 4 ? "end" : "middle"}
                    height={charts.officeWiseSalary.length > 4 ? 56 : 30}
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
            {charts.advanceTrend.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No advance data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.advanceTrend}>
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
                {recent.salaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-sm text-muted-foreground">
                      No records
                    </TableCell>
                  </TableRow>
                ) : (
                  recent.salaries.map((s) => (
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
                {recent.advances.map((a) => (
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
                {recent.employees.map((e) => (
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
    </div>
  );
}
