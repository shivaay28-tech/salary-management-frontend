"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { downloadExport } from "@/lib/export";
import type { ApiResponse, Office, Employee, SalaryPaymentMode } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { FilterSection } from "@/components/layout/filter-section";
import { accentCard } from "@/lib/theme";

const theme = accentCard("reports");

const now = new Date();
const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const PAYMENT_LABELS: Record<SalaryPaymentMode, string> = {
  bank: "Bank",
  angadiya: "Angadiya",
  cash_in_hand: "Cash in Hand",
};

function formatRs(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function periodLabel(month: number, year: number) {
  return `${new Date(2000, month - 1).toLocaleString("en", { month: "long" })} ${year}`;
}

function monthDateBounds(month: number, year: number) {
  const lastDay = new Date(year, month, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

function formatDateLabel(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-IN");
}

type ReportTab =
  | "monthly"
  | "employees"
  | "history"
  | "advances"
  | "statement";

interface MonthlyRecord {
  _id: string;
  employeeName: string;
  employeeMobile: string;
  officeName: string;
  baseSalary: number;
  bonus: number;
  otherAddition: number;
  otherDeduction: number;
  advanceDeduction: number;
  finalSalary: number;
  paidStatus: string;
  paymentMode?: SalaryPaymentMode;
  paidDate?: string;
}

interface MonthlyReport {
  month: number;
  year: number;
  totalEmployees: number;
  paidCount: number;
  pendingCount: number;
  totalSalary: number;
  totalAdvances: number;
  totalPaid: number;
  totalPending: number;
  paymentBreakdown: { mode: SalaryPaymentMode; count: number; amount: number }[];
  records: MonthlyRecord[];
}

interface AdvanceRow {
  employee?: { fullName: string };
  officeName: string;
  advanceTaken: number;
  amountRecovered: number;
  outstandingBalance: number;
  recoveryMode: string;
  isFullyRecovered: boolean;
  date: string;
  reason: string;
}

interface AdvanceReportData {
  month: number;
  year: number;
  summary: {
    totalAdvances: number;
    totalTaken: number;
    totalRecovered: number;
    totalOutstanding: number;
    activeCount: number;
  };
  rows: AdvanceRow[];
}

interface EmployeePeriodRow {
  _id: string;
  fullName: string;
  mobileNumber: string;
  officeName: string;
  monthlySalary: number;
  status: string;
  dateOfJoining: string;
  hasSalaryRecord: boolean;
  netSalary?: number;
  paidStatus?: string;
  paymentMode?: SalaryPaymentMode;
  advanceDeduction?: number;
}

interface EmployeePeriodReport {
  month: number;
  year: number;
  totalEmployees: number;
  withSalaryCount: number;
  rows: EmployeePeriodRow[];
}

function buildPeriodQuery(
  month: string,
  year: string,
  officeId: string,
  dateFrom: string,
  dateTo: string,
  extra?: Record<string, string>
) {
  const params = new URLSearchParams({
    month,
    year,
    dateFrom,
    dateTo,
    ...extra,
  });
  if (officeId !== "all") params.set("officeId", officeId);
  return params.toString();
}

interface StatementEmployee {
  employeeId: string;
  fullName: string;
  mobileNumber: string;
  officeName: string;
  totalTaken: number;
  totalRecovered: number;
  totalOutstanding: number;
}

function ExportButtons({
  onExcel,
  onPdf,
  excelLabel = "Excel",
  pdfLabel = "PDF",
}: {
  onExcel: () => void;
  onPdf?: () => void;
  excelLabel?: string;
  pdfLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={onExcel}>
        <Download className="size-4 mr-2" />
        {excelLabel}
      </Button>
      {onPdf && (
        <Button variant="outline" size="sm" onClick={onPdf}>
          <Download className="size-4 mr-2" />
          {pdfLabel}
        </Button>
      )}
    </div>
  );
}

const SUMMARY_GRADIENTS = [
  "border-blue-200 bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-md",
  "border-violet-200 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md",
  "border-emerald-200 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md",
  "border-amber-200 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md",
  "border-rose-200 bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-md",
];

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  let colorIndex = 0;
  for (const char of label) colorIndex = (colorIndex + char.charCodeAt(0)) % SUMMARY_GRADIENTS.length;
  const gradient = SUMMARY_GRADIENTS[colorIndex];
  return (
    <Card className={gradient}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-white/85">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-bold">{value}</CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const initialMonth = now.getMonth() + 1;
  const initialYear = now.getFullYear();
  const initialBounds = monthDateBounds(initialMonth, initialYear);

  const [month, setMonth] = useState(String(initialMonth));
  const [year, setYear] = useState(String(initialYear));
  const [dateFrom, setDateFrom] = useState(initialBounds.from);
  const [dateTo, setDateTo] = useState(initialBounds.to);
  const [officeId, setOfficeId] = useState("all");
  const [nameFilter, setNameFilter] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [searchMatches, setSearchMatches] = useState<Employee[]>([]);
  const [statementStatus, setStatementStatus] = useState("all");
  const [tab, setTab] = useState<ReportTab>("monthly");

  const { data: offices = [] } = useQuery({
    queryKey: ["offices"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Office[]>>("/offices");
      return data.data ?? [];
    },
  });

  const historySearchMutation = useMutation({
    mutationFn: async (name: string) => {
      const params = new URLSearchParams({ name });
      const { data } = await api.get<ApiResponse<Employee[]>>(`/employees?${params}`);
      return data.data ?? [];
    },
    onSuccess: (matches) => {
      setSearchMatches(matches);
      if (matches.length === 0) {
        setEmployeeId("");
        toast.error("No employee found with that name");
        return;
      }
      if (matches.length === 1) {
        setEmployeeId(matches[0]._id);
        toast.success(`Showing history for ${matches[0].fullName}`);
        return;
      }
      setEmployeeId("");
      toast.message(`${matches.length} employees found — select one below`);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const handleHistorySearch = () => {
    const trimmed = nameFilter.trim();
    if (!trimmed) {
      toast.error("Enter an employee name to search");
      return;
    }
    setSearchMatches([]);
    historySearchMutation.mutate(trimmed);
  };

  const selectHistoryEmployee = (employee: Employee) => {
    setEmployeeId(employee._id);
    setSearchMatches([]);
    toast.success(`Showing history for ${employee.fullName}`);
  };

  const syncDatesFromMonthYear = (m: string, y: string) => {
    const bounds = monthDateBounds(Number(m), Number(y));
    setDateFrom(bounds.from);
    setDateTo(bounds.to);
  };

  const { data: monthlyReport, isLoading: monthlyLoading } = useQuery({
    queryKey: ["report-monthly", month, year, dateFrom, dateTo, officeId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<MonthlyReport>>(
        `/reports/monthly-salary?${buildPeriodQuery(month, year, officeId, dateFrom, dateTo)}`
      );
      return data.data;
    },
    enabled: tab === "monthly",
  });

  const { data: employeeReport, isLoading: employeesLoading } = useQuery({
    queryKey: ["report-employees", month, year, dateFrom, dateTo, officeId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<EmployeePeriodReport>>(
        `/reports/employees?${buildPeriodQuery(month, year, officeId, dateFrom, dateTo)}`
      );
      return data.data;
    },
    enabled: tab === "employees",
  });

  const { data: historyReport, isLoading: historyLoading } = useQuery({
    queryKey: ["report-history", employeeId, month, year, dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await api.get(
        `/reports/employee-history?${buildPeriodQuery(month, year, "all", dateFrom, dateTo, {
          employeeId,
        })}`
      );
      return data.data;
    },
    enabled: tab === "history" && !!employeeId,
  });

  const { data: advanceReport, isLoading: advancesLoading } = useQuery({
    queryKey: ["report-advances", month, year, dateFrom, dateTo, officeId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AdvanceReportData>>(
        `/reports/advances?${buildPeriodQuery(month, year, officeId, dateFrom, dateTo)}`
      );
      return data.data;
    },
    enabled: tab === "advances",
  });

  const { data: statementReport, isLoading: statementLoading } = useQuery({
    queryKey: ["report-statement", month, year, dateFrom, dateTo, officeId, statementStatus],
    queryFn: async () => {
      const extra: Record<string, string> = {};
      if (statementStatus !== "all") extra.status = statementStatus;
      const { data } = await api.get(
        `/advances/statement?${buildPeriodQuery(month, year, officeId, dateFrom, dateTo, extra)}`
      );
      return data.data as {
        employeeCount: number;
        totalTaken: number;
        totalRecovered: number;
        totalOutstanding: number;
        byEmployee: StatementEmployee[];
      };
    },
    enabled: tab === "statement",
  });

  const handleExport = async (
    type: "salary" | "employees" | "advances" | "advance-statement",
    format: "excel" | "pdf"
  ) => {
    try {
      const params: Record<string, string | number | undefined> = {
        format,
        month: Number(month),
        year: Number(year),
        dateFrom,
        dateTo,
      };
      if (officeId !== "all") params.officeId = officeId;
      await downloadExport(`/export/${type}`, params);
      toast.success("Download started");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const selectedPeriod = `${periodLabel(Number(month), Number(year))} (${formatDateLabel(dateFrom)} – ${formatDateLabel(dateTo)})`;

  const tabs: { id: ReportTab; label: string }[] = [
    { id: "monthly", label: "Monthly Salary" },
    { id: "employees", label: "Employees" },
    { id: "history", label: "Employee History" },
    { id: "advances", label: "Advances" },
    { id: "statement", label: "Advance Statement" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        theme="reports"
        title="Reports"
        description="View and export salary, employee, and advance reports"
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <FilterSection theme="reports" description={`Report period: ${selectedPeriod}`}>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label>Month</Label>
            <Select
              value={month}
              onValueChange={(v) => {
                const next = v ?? "1";
                setMonth(next);
                syncDatesFromMonthYear(next, year);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_MONTHS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {new Date(2000, m - 1).toLocaleString("en", { month: "long" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Year</Label>
            <Input
              className="w-24"
              type="number"
              min={2000}
              value={year}
              onChange={(e) => {
                const next = e.target.value;
                setYear(next);
                syncDatesFromMonthYear(month, next);
              }}
            />
          </div>
          <div>
            <Label>From Date</Label>
            <Input
              className="w-40"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <Label>To Date</Label>
            <Input
              className="w-40"
              type="date"
              value={dateTo}
              min={dateFrom}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div>
            <Label>Office</Label>
            <Select value={officeId} onValueChange={(v) => setOfficeId(v ?? "all")}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All offices</SelectItem>
                {offices.map((o) => (
                  <SelectItem key={o._id} value={o._id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FilterSection>

      {tab === "monthly" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <ExportButtons
              onExcel={() => handleExport("salary", "excel")}
              onPdf={() => handleExport("salary", "pdf")}
            />
          </div>

          {monthlyLoading ? (
            <p className="text-muted-foreground">Loading report...</p>
          ) : monthlyReport ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard label="Employees" value={monthlyReport.totalEmployees} />
                <SummaryCard label="Total Salary" value={formatRs(monthlyReport.totalSalary)} />
                <SummaryCard label="Paid" value={formatRs(monthlyReport.totalPaid)} />
                <SummaryCard label="Pending" value={formatRs(monthlyReport.totalPending)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard label="Paid Count" value={monthlyReport.paidCount} />
                <SummaryCard label="Pending Count" value={monthlyReport.pendingCount} />
                <SummaryCard
                  label="Advance Deductions"
                  value={formatRs(monthlyReport.totalAdvances)}
                />
                <SummaryCard
                  label="Period"
                  value={periodLabel(monthlyReport.month, monthlyReport.year)}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Payment Mode Breakdown (Paid)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {monthlyReport.paymentBreakdown.map((p) => (
                      <div
                        key={p.mode}
                        className="rounded-lg border p-4 bg-muted/30"
                      >
                        <p className="text-sm text-muted-foreground">
                          {PAYMENT_LABELS[p.mode]}
                        </p>
                        <p className="text-xl font-bold">{formatRs(p.amount)}</p>
                        <p className="text-xs text-muted-foreground">{p.count} employee(s)</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Salary Details — {periodLabel(monthlyReport.month, monthlyReport.year)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Mobile</TableHead>
                        <TableHead>Office</TableHead>
                        <TableHead>Base</TableHead>
                        <TableHead>Bonus</TableHead>
                        <TableHead>Advance Ded.</TableHead>
                        <TableHead>Net Salary</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Paid Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyReport.records.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-muted-foreground">
                            No salary records for this period
                          </TableCell>
                        </TableRow>
                      ) : (
                        monthlyReport.records.map((r) => (
                          <TableRow key={r._id}>
                            <TableCell className="font-medium">{r.employeeName}</TableCell>
                            <TableCell>{r.employeeMobile}</TableCell>
                            <TableCell>{r.officeName}</TableCell>
                            <TableCell>{formatRs(r.baseSalary)}</TableCell>
                            <TableCell>{formatRs(r.bonus ?? 0)}</TableCell>
                            <TableCell>{formatRs(r.advanceDeduction ?? 0)}</TableCell>
                            <TableCell className="font-semibold">
                              {formatRs(r.finalSalary)}
                            </TableCell>
                            <TableCell>
                              {r.paymentMode ? (
                                <Badge variant="secondary">
                                  {PAYMENT_LABELS[r.paymentMode]}
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={r.paidStatus === "paid" ? "default" : "secondary"}
                              >
                                {r.paidStatus}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {r.paidDate
                                ? new Date(r.paidDate).toLocaleDateString("en-IN")
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      )}

      {tab === "employees" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <ExportButtons
              onExcel={() => handleExport("employees", "excel")}
              excelLabel="Export Excel"
            />
          </div>
          {employeesLoading ? (
            <p className="text-muted-foreground">Loading employees...</p>
          ) : employeeReport ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <SummaryCard label="Total Employees" value={employeeReport.totalEmployees} />
                <SummaryCard
                  label="With Salary Record"
                  value={employeeReport.withSalaryCount}
                />
                <SummaryCard label="Period" value={selectedPeriod} />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Employees — {selectedPeriod}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Mobile</TableHead>
                        <TableHead>Office</TableHead>
                        <TableHead>Monthly Salary</TableHead>
                        <TableHead>Net ({selectedPeriod})</TableHead>
                        <TableHead>Advance Ded.</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joining Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeeReport.rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground">
                            No employees found
                          </TableCell>
                        </TableRow>
                      ) : (
                        employeeReport.rows.map((e) => (
                          <TableRow key={e._id}>
                            <TableCell className="font-medium">{e.fullName}</TableCell>
                            <TableCell>{e.mobileNumber}</TableCell>
                            <TableCell>{e.officeName}</TableCell>
                            <TableCell>{formatRs(e.monthlySalary)}</TableCell>
                            <TableCell>
                              {e.hasSalaryRecord ? formatRs(e.netSalary ?? 0) : "—"}
                            </TableCell>
                            <TableCell>
                              {e.hasSalaryRecord ? formatRs(e.advanceDeduction ?? 0) : "—"}
                            </TableCell>
                            <TableCell>
                              {e.paymentMode ? PAYMENT_LABELS[e.paymentMode] : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={e.status === "active" ? "default" : "secondary"}>
                                {e.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(e.dateOfJoining).toLocaleDateString("en-IN")}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Search Employee</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1 space-y-2">
                  <Label htmlFor="history-employee-search">Employee Name</Label>
                  <div className="relative max-w-md">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="history-employee-search"
                      className="pl-9"
                      placeholder="Search by name..."
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleHistorySearch();
                      }}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleHistorySearch}
                  disabled={historySearchMutation.isPending}
                >
                  <Search className="size-4 mr-2" />
                  {historySearchMutation.isPending ? "Searching..." : "Search"}
                </Button>
              </div>

              {searchMatches.length > 1 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Multiple employees found — select one:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {searchMatches.map((e) => (
                      <Button
                        key={e._id}
                        variant="outline"
                        size="sm"
                        onClick={() => selectHistoryEmployee(e)}
                      >
                        {e.fullName} — {e.mobileNumber}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {historyLoading ? (
            <p className="text-muted-foreground">Loading history...</p>
          ) : historyReport && employeeId ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                  label="Employee"
                  value={historyReport.employee?.fullName ?? "—"}
                />
                <SummaryCard
                  label="Total Earned"
                  value={formatRs(historyReport.summary?.totalEarned ?? 0)}
                />
                <SummaryCard
                  label="Advance Deducted"
                  value={formatRs(historyReport.summary?.totalAdvanceDed ?? 0)}
                />
                <SummaryCard
                  label="Salary Records"
                  value={historyReport.summary?.totalRecords ?? 0}
                />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Salary History — {selectedPeriod}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Base</TableHead>
                        <TableHead>Bonus</TableHead>
                        <TableHead>Advance Ded.</TableHead>
                        <TableHead>Net Salary</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Paid Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyReport.history?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground">
                            No salary history
                          </TableCell>
                        </TableRow>
                      ) : (
                        historyReport.history?.map(
                          (
                            h: {
                              month: number;
                              year: number;
                              baseSalary: number;
                              bonus: number;
                              advanceDeduction: number;
                              netSalary: number;
                              paymentMode?: SalaryPaymentMode;
                              paidDate?: string;
                              paidStatus: string;
                            },
                            i: number
                          ) => (
                            <TableRow key={i}>
                              <TableCell>{periodLabel(h.month, h.year)}</TableCell>
                              <TableCell>{formatRs(h.baseSalary ?? 0)}</TableCell>
                              <TableCell>{formatRs(h.bonus ?? 0)}</TableCell>
                              <TableCell>{formatRs(h.advanceDeduction ?? 0)}</TableCell>
                              <TableCell className="font-semibold">
                                {formatRs(h.netSalary ?? 0)}
                              </TableCell>
                              <TableCell>
                                {h.paymentMode ? PAYMENT_LABELS[h.paymentMode] : "—"}
                              </TableCell>
                              <TableCell>{h.paidStatus}</TableCell>
                              <TableCell>
                                {h.paidDate
                                  ? new Date(h.paidDate).toLocaleDateString("en-IN")
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          )
                        )
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <p className="text-muted-foreground">
              Search for an employee to view salary history
            </p>
          )}
        </div>
      )}

      {tab === "advances" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <ExportButtons
              onExcel={() => handleExport("advances", "excel")}
              onPdf={() => handleExport("advances", "pdf")}
            />
          </div>

          {advancesLoading ? (
            <p className="text-muted-foreground">Loading advances...</p>
          ) : advanceReport ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <SummaryCard
                  label="Total Advances"
                  value={advanceReport.summary.totalAdvances}
                />
                <SummaryCard
                  label="Total Taken"
                  value={formatRs(advanceReport.summary.totalTaken)}
                />
                <SummaryCard
                  label="Recovered"
                  value={formatRs(advanceReport.summary.totalRecovered)}
                />
                <SummaryCard
                  label="Outstanding"
                  value={formatRs(advanceReport.summary.totalOutstanding)}
                />
                <SummaryCard label="Active" value={advanceReport.summary.activeCount} />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Advances — {selectedPeriod}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Office</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Taken</TableHead>
                        <TableHead>Recovered</TableHead>
                        <TableHead>Outstanding</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {advanceReport.rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground">
                            No advances found
                          </TableCell>
                        </TableRow>
                      ) : (
                        advanceReport.rows.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">
                              {row.employee?.fullName ?? "—"}
                            </TableCell>
                            <TableCell>{row.officeName}</TableCell>
                            <TableCell>
                              {new Date(row.date).toLocaleDateString("en-IN")}
                            </TableCell>
                            <TableCell>{formatRs(row.advanceTaken)}</TableCell>
                            <TableCell>{formatRs(row.amountRecovered)}</TableCell>
                            <TableCell className="text-rose-600 font-medium">
                              {formatRs(row.outstandingBalance)}
                            </TableCell>
                            <TableCell>{row.recoveryMode}</TableCell>
                            <TableCell>
                              <Badge
                                variant={row.isFullyRecovered ? "secondary" : "default"}
                              >
                                {row.isFullyRecovered ? "Recovered" : "Active"}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {row.reason}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      )}

      {tab === "statement" && (
        <div className="space-y-4">
          <FilterSection theme="reports" title="Filters" description="Filter advance statement by status">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={statementStatus}
                  onValueChange={(v) => setStatementStatus(v ?? "all")}
                >
                  <SelectTrigger className="w-40 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="recovered">Recovered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <ExportButtons
                onExcel={() => handleExport("advance-statement", "excel")}
                onPdf={() => handleExport("advance-statement", "pdf")}
                excelLabel="Export Statement Excel"
                pdfLabel="Export Statement PDF"
              />
            </div>
          </FilterSection>

          {statementLoading ? (
            <p className="text-muted-foreground">Loading statement...</p>
          ) : statementReport ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard label="Employees" value={statementReport.employeeCount} />
                <SummaryCard label="Total Taken" value={formatRs(statementReport.totalTaken)} />
                <SummaryCard
                  label="Total Recovered"
                  value={formatRs(statementReport.totalRecovered)}
                />
                <SummaryCard
                  label="Outstanding"
                  value={formatRs(statementReport.totalOutstanding)}
                />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Advance Statement — {selectedPeriod}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Mobile</TableHead>
                        <TableHead>Office</TableHead>
                        <TableHead>Total Taken</TableHead>
                        <TableHead>Recovered</TableHead>
                        <TableHead>Outstanding</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statementReport.byEmployee.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            No advance data
                          </TableCell>
                        </TableRow>
                      ) : (
                        statementReport.byEmployee.map((row) => (
                          <TableRow key={row.employeeId}>
                            <TableCell className="font-medium">{row.fullName}</TableCell>
                            <TableCell>{row.mobileNumber}</TableCell>
                            <TableCell>{row.officeName}</TableCell>
                            <TableCell>{formatRs(row.totalTaken)}</TableCell>
                            <TableCell>{formatRs(row.totalRecovered)}</TableCell>
                            <TableCell className="text-rose-600 font-medium">
                              {formatRs(row.totalOutstanding)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
