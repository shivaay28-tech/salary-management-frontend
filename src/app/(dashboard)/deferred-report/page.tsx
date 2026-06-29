"use client";

import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { downloadExport } from "@/lib/export";
import type { ApiResponse, DeferredSalaryStatement, Employee, Office } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { EmployeeSelect } from "@/components/forms/employee-select";
import { accentCard } from "@/lib/theme";
import { JAMA_LINE_STATUS_LABELS, JAMA_UI } from "@/lib/jama-labels";

const theme = accentCard("reports");

const now = new Date();
const CURRENT_MONTH = now.getMonth() + 1;
const CURRENT_YEAR = now.getFullYear();
const YEAR_OPTIONS = Array.from({ length: 21 }, (_, i) => CURRENT_YEAR - 10 + i);
const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const emptyForm = {
  employeeId: "",
  month: String(CURRENT_MONTH),
  year: String(CURRENT_YEAR),
  amount: "",
  remarks: "",
};

function monthLabel(month: string) {
  return new Date(2000, Number(month) - 1).toLocaleString("en", { month: "long" });
}

const SUMMARY_GRADIENTS = [
  "border-sky-200 bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-md",
  "border-amber-200 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md",
  "border-violet-200 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md",
  "border-emerald-200 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md",
];

const DEFERRED_LINE_LABELS = JAMA_LINE_STATUS_LABELS;

function formatRs(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function deferredLineVariant(
  status: DeferredSalaryStatement["byEmployee"][number]["entries"][number]["lineStatus"]
): "success" | "warning" | "info" {
  if (status === "settled") return "success";
  if (status === "carried_forward") return "info";
  return "warning";
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  let colorIndex = 0;
  for (const char of label) {
    colorIndex = (colorIndex + char.charCodeAt(0)) % SUMMARY_GRADIENTS.length;
  }
  return (
    <Card className={SUMMARY_GRADIENTS[colorIndex]}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-white/85">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-bold">{value}</CardContent>
    </Card>
  );
}

export default function DeferredReportPage() {
  const queryClient = useQueryClient();
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [officeFilter, setOfficeFilter] = useState("all");
  const [nameFilter, setNameFilter] = useState("");
  const [statementStatus, setStatementStatus] = useState<"active" | "settled" | "all">(
    "active"
  );
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: offices = [] } = useQuery({
    queryKey: ["offices"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Office[]>>("/offices");
      return data.data ?? [];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", "active"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Employee[]>>("/employees?status=active");
      return data.data ?? [];
    },
  });

  const closeDialog = () => {
    setOpen(false);
    setForm(emptyForm);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.post("/salaries/deferred", {
        employeeId: form.employeeId,
        month: Number(form.month),
        year: Number(form.year),
        amount: Number(form.amount),
        remarks: form.remarks || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deferred-report"] });
      queryClient.invalidateQueries({ queryKey: ["deferred-statement"] });
      queryClient.invalidateQueries({ queryKey: ["salaries"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(JAMA_UI.addJamaSuccess);
      closeDialog();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const { data: deferredReport, isLoading } = useQuery({
    queryKey: ["deferred-report", officeFilter, statementStatus, year],
    queryFn: async () => {
      const params = new URLSearchParams({ status: statementStatus });
      if (officeFilter !== "all") params.set("officeId", officeFilter);
      if (statementStatus === "settled" || statementStatus === "all") {
        params.set("year", year);
      }
      const { data } = await api.get<ApiResponse<DeferredSalaryStatement>>(
        `/salaries/deferred-statement?${params.toString()}`
      );
      return data.data!;
    },
  });

  const filteredEmployees = useMemo(() => {
    const trimmed = nameFilter.trim().toLowerCase();
    const list = deferredReport?.byEmployee ?? [];
    if (!trimmed) return list;
    return list.filter((emp) => emp.fullName.toLowerCase().includes(trimmed));
  }, [deferredReport, nameFilter]);

  const summary = useMemo(
    () => ({
      employeeCount: filteredEmployees.length,
      totalOutstanding: filteredEmployees.reduce((sum, emp) => sum + emp.totalOutstanding, 0),
      totalPendingCarry: filteredEmployees.reduce(
        (sum, emp) => sum + (emp.pendingCarryAmount ?? 0),
        0
      ),
      totalSettled: filteredEmployees.reduce((sum, emp) => sum + emp.totalSettled, 0),
    }),
    [filteredEmployees]
  );

  const handleExport = async (format: "excel" | "pdf") => {
    try {
      const exportParams: Record<string, string | number | undefined> = {
        format,
        officeId: officeFilter !== "all" ? officeFilter : undefined,
        status: statementStatus,
      };
      if (statementStatus === "settled" || statementStatus === "all") {
        exportParams.year = Number(year);
      }
      await downloadExport("/export/deferred-statement", exportParams);
      toast.success(JAMA_UI.reportDownloaded(format.toUpperCase()));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        theme="reports"
        title={JAMA_UI.report}
        description={JAMA_UI.statementDescription}
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => handleExport("excel")}>
            <Download className="size-4 mr-2" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={() => handleExport("pdf")}>
            <Download className="size-4 mr-2" />
            Export PDF
          </Button>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4 mr-2" />
          {JAMA_UI.addJama}
        </Button>
      </PageHeader>

      <p className="text-sm text-muted-foreground">
        {JAMA_UI.settledNote}
      </p>

      <FilterSection
        theme="reports"
        title="Filters"
        description={`Scope: ${deferredReport?.scope ?? (statementStatus === "active" ? JAMA_UI.outstandingAll : year)}`}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="deferred-report-search">Employee</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="deferred-report-search"
                className="pl-9 bg-background"
                placeholder="Search by name..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Office</Label>
            <Select value={officeFilter} onValueChange={(v) => setOfficeFilter(v ?? "all")}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All offices</SelectItem>
                {offices.map((office) => (
                  <SelectItem key={office._id} value={office._id}>
                    {office.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={statementStatus}
              onValueChange={(v) =>
                setStatementStatus((v ?? "active") as "active" | "settled" | "all")
              }
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Outstanding</SelectItem>
                <SelectItem value="settled">Settled history</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(statementStatus === "settled" || statementStatus === "all") && (
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={year} onValueChange={(v) => setYear(v ?? String(CURRENT_YEAR))}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
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
          )}
        </div>
      </FilterSection>

      {isLoading ? (
        <p className="text-muted-foreground">{JAMA_UI.loadingReport}</p>
      ) : deferredReport ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Employees" value={summary.employeeCount} />
            <SummaryCard
              label={JAMA_UI.outstanding}
              value={formatRs(summary.totalOutstanding)}
            />
            <SummaryCard
              label="In Pending Month"
              value={formatRs(summary.totalPendingCarry)}
            />
            <SummaryCard label="Settled (shown)" value={formatRs(summary.totalSettled)} />
          </div>

          <Card className={theme.card}>
            <CardHeader className={theme.header}>
              <CardTitle>{JAMA_UI.statement} — {deferredReport.scope}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {JAMA_UI.expandLines}
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Office</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Pending carry</TableHead>
                    <TableHead>Pending net</TableHead>
                    <TableHead>Lines</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        {!deferredReport.byEmployee.length
                          ? JAMA_UI.noDataFilters
                          : nameFilter.trim()
                            ? "No employees match this name"
                            : JAMA_UI.noDataFilters}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <Fragment key={emp.employeeId}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() =>
                            setExpandedEmp(
                              expandedEmp === emp.employeeId ? null : emp.employeeId
                            )
                          }
                        >
                          <TableCell className="font-medium">{emp.fullName}</TableCell>
                          <TableCell>{emp.officeName}</TableCell>
                          <TableCell>{emp.mobileNumber}</TableCell>
                          <TableCell className="font-medium text-amber-600">
                            {formatRs(emp.totalOutstanding)}
                          </TableCell>
                          <TableCell>
                            {emp.pendingCarryAmount ? (
                              <span>
                                {formatRs(emp.pendingCarryAmount)}
                                {emp.pendingCarryPeriod ? (
                                  <span className="block text-xs text-muted-foreground">
                                    in {emp.pendingCarryPeriod}
                                  </span>
                                ) : null}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            {emp.pendingNetSalary ? formatRs(emp.pendingNetSalary) : "—"}
                          </TableCell>
                          <TableCell>{emp.entries.length}</TableCell>
                        </TableRow>
                        {expandedEmp === emp.employeeId && (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-muted/30 p-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>{JAMA_UI.period}</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Carried to</TableHead>
                                    <TableHead>Settled in</TableHead>
                                    <TableHead>Settled on</TableHead>
                                    <TableHead>Remarks</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {emp.entries.length === 0 ? (
                                    <TableRow>
                                      <TableCell
                                        colSpan={7}
                                        className="text-center text-muted-foreground"
                                      >
                                        Pending carry-forward only — no line items in this view
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    emp.entries.map((entry) => (
                                      <TableRow key={entry.id}>
                                        <TableCell className="font-medium">
                                          {entry.periodLabel}
                                        </TableCell>
                                        <TableCell>{formatRs(entry.amount)}</TableCell>
                                        <TableCell>
                                          <Badge variant={deferredLineVariant(entry.lineStatus)}>
                                            {DEFERRED_LINE_LABELS[entry.lineStatus]}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>{entry.carriedToPeriod ?? "—"}</TableCell>
                                        <TableCell>{entry.settledInPeriod ?? "—"}</TableCell>
                                        <TableCell>
                                          {entry.settledOn
                                            ? new Date(entry.settledOn).toLocaleDateString(
                                                "en-IN"
                                              )
                                            : "—"}
                                        </TableCell>
                                        <TableCell className="max-w-[180px] truncate">
                                          {entry.remarks ?? "—"}
                                        </TableCell>
                                      </TableRow>
                                    ))
                                  )}
                                </TableBody>
                              </Table>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}

      <Dialog open={open} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{JAMA_UI.addJamaTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{JAMA_UI.addJamaDescription}</p>
          <div className="space-y-4 py-2">
            <EmployeeSelect
              employees={employees}
              value={form.employeeId}
              onValueChange={(employeeId) => setForm({ ...form, employeeId })}
              dialogOpen={open}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Month</Label>
                <Select
                  value={form.month}
                  onValueChange={(v) => setForm({ ...form, month: v ?? "1" })}
                >
                  <SelectTrigger>
                    <SelectValue>{monthLabel(form.month)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_MONTHS.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {monthLabel(String(m))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Select
                  value={form.year}
                  onValueChange={(v) => setForm({ ...form, year: v ?? String(CURRENT_YEAR) })}
                >
                  <SelectTrigger>
                    <SelectValue>{form.year}</SelectValue>
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
            </div>
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                min={1}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Input
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                placeholder="e.g. will collect after 3 months"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={
                saveMutation.isPending ||
                !form.employeeId ||
                !form.amount ||
                Number(form.amount) <= 0
              }
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
