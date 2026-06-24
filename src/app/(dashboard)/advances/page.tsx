"use client";

import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Download, FileText, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { downloadExport } from "@/lib/export";
import type { ApiResponse, Advance, Employee, Office, AdvanceRecoveryMode } from "@/types";
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
import { accentCard } from "@/lib/theme";

const theme = accentCard("advances");

const emptyForm = {
  employeeId: "",
  advanceAmount: "",
  date: new Date().toISOString().split("T")[0],
  reason: "",
  notes: "",
  recoveryMode: "installment" as AdvanceRecoveryMode,
  installmentAmount: "",
};

interface StatementDeduction {
  id: string;
  advanceId?: string;
  amount: number;
  deductedAt: string;
  periodLabel: string;
}

interface StatementAdvance {
  id: string;
  date: string;
  advanceAmount: number;
  amountRecovered: number;
  outstandingAmount: number;
  recoveryMode: string;
  installmentAmount?: number;
  reason: string;
  notes?: string;
  status: string;
  deductions: StatementDeduction[];
}

interface StatementEmployee {
  employeeId: string;
  fullName: string;
  mobileNumber: string;
  officeName: string;
  totalTaken: number;
  totalRecovered: number;
  totalOutstanding: number;
  advances: StatementAdvance[];
  deductions: StatementDeduction[];
}

interface AdvanceStatement {
  generatedAt: string;
  employeeCount: number;
  totalTaken: number;
  totalRecovered: number;
  totalOutstanding: number;
  byEmployee: StatementEmployee[];
}

function empName(emp: Advance["employeeId"]) {
  return typeof emp === "object" && emp !== null ? emp.fullName : "—";
}

function formatRs(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function formatDeductionDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function totalDeductionAmount(items: StatementDeduction[]) {
  return items.reduce((sum, d) => sum + d.amount, 0);
}

function formatRecoveryMode(mode: string, installmentAmount?: number) {
  if (mode === "full") return "Full";
  if (mode === "installment") {
    return installmentAmount
      ? `Installment (${formatRs(installmentAmount)}/mo)`
      : "Installment";
  }
  if (mode === "custom") return "Custom (manual)";
  return mode;
}

export default function AdvancesPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"records" | "statement">("records");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Advance | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [officeFilter, setOfficeFilter] = useState("all");
  const [nameFilter, setNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);

  const filterParams = () => {
    const p = new URLSearchParams();
    if (officeFilter !== "all") p.set("officeId", officeFilter);
    if (statusFilter === "active") p.set("status", "active");
    if (statusFilter === "recovered") p.set("status", "recovered");
    return p.toString() ? `?${p}` : "";
  };

  const { data: advances = [], isLoading } = useQuery({
    queryKey: ["advances", officeFilter, statusFilter],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Advance[]>>(`/advances${filterParams()}`);
      return data.data ?? [];
    },
    enabled: view === "records",
  });

  const filteredAdvances = useMemo(() => {
    const trimmed = nameFilter.trim().toLowerCase();
    if (!trimmed) return advances;
    return advances.filter((a) =>
      empName(a.employeeId).toLowerCase().includes(trimmed)
    );
  }, [advances, nameFilter]);

  const { data: statement, isLoading: statementLoading } = useQuery({
    queryKey: ["advance-statement", officeFilter, statusFilter],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AdvanceStatement>>(
        `/advances/statement${filterParams()}`
      );
      return data.data!;
    },
    enabled: view === "statement",
  });

  const filteredStatementEmployees = useMemo(() => {
    const trimmed = nameFilter.trim().toLowerCase();
    const list = statement?.byEmployee ?? [];
    if (!trimmed) return list;
    return list.filter((e) => e.fullName.toLowerCase().includes(trimmed));
  }, [statement, nameFilter]);

  const statementSummary = useMemo(
    () => ({
      employeeCount: filteredStatementEmployees.length,
      totalTaken: filteredStatementEmployees.reduce((s, e) => s + e.totalTaken, 0),
      totalRecovered: filteredStatementEmployees.reduce((s, e) => s + e.totalRecovered, 0),
      totalOutstanding: filteredStatementEmployees.reduce(
        (s, e) => s + e.totalOutstanding,
        0
      ),
    }),
    [filteredStatementEmployees]
  );

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Employee[]>>("/employees");
      return data.data ?? [];
    },
  });

  const { data: offices = [] } = useQuery({
    queryKey: ["offices"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Office[]>>("/offices");
      return data.data ?? [];
    },
  });

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (advance: Advance) => {
    setEditing(advance);
    setForm({
      employeeId:
        typeof advance.employeeId === "object"
          ? advance.employeeId._id
          : String(advance.employeeId),
      advanceAmount: String(advance.advanceAmount),
      date: new Date(advance.date).toISOString().split("T")[0],
      reason: advance.reason,
      notes: advance.notes ?? "",
      recoveryMode: advance.recoveryMode,
      installmentAmount: advance.installmentAmount
        ? String(advance.installmentAmount)
        : "",
    });
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        advanceAmount: Number(form.advanceAmount),
        date: form.date,
        reason: form.reason,
        notes: form.notes || undefined,
        recoveryMode: form.recoveryMode,
        installmentAmount:
          form.recoveryMode === "installment"
            ? Number(form.installmentAmount)
            : undefined,
      };
      if (editing) {
        await api.put(`/advances/${editing._id}`, payload);
      } else {
        await api.post("/advances", {
          employeeId: form.employeeId,
          ...payload,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advances"] });
      queryClient.invalidateQueries({ queryKey: ["advance-statement"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(editing ? "Advance updated" : "Advance recorded");
      closeDialog();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/advances/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advances"] });
      queryClient.invalidateQueries({ queryKey: ["advance-statement"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Advance deleted");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const handleDelete = (advance: Advance) => {
    if (advance.amountRecovered > 0) {
      toast.error("Cannot delete — salary deductions already recorded for this advance");
      return;
    }
    if (!window.confirm(`Delete advance of ${formatRs(advance.advanceAmount)}?`)) return;
    deleteMutation.mutate(advance._id);
  };

  const handleExportStatement = async () => {
    try {
      const params: Record<string, string | undefined> = { format: "excel" };
      if (officeFilter !== "all") params.officeId = officeFilter;
      await downloadExport("/export/advance-statement", params);
      toast.success("Advance statement downloaded");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const officeFilterLabel =
    officeFilter === "all"
      ? "All offices"
      : offices.find((o) => o._id === officeFilter)?.name ?? "All offices";

  const selectedEmployeeLabel =
    employees.find((e) => e._id === form.employeeId)?.fullName ??
    (editing ? empName(editing.employeeId) : "Select employee");

  const statusFilterLabel =
    statusFilter === "all"
      ? "All status"
      : statusFilter === "active"
        ? "Active only"
        : "Recovered only";

  return (
    <div className="space-y-6">
      <PageHeader
        theme="advances"
        title="Advances"
        description="Track advances and view employee-wise statements"
      >
        {view === "statement" && (
          <Button variant="outline" onClick={handleExportStatement}>
            <Download className="size-4 mr-2" />
            Export Statement
          </Button>
        )}
        <Button onClick={openCreate}>
          <Plus className="size-4 mr-2" />
          Add Advance
        </Button>
      </PageHeader>

      <FilterSection theme="advances" description="Switch view and filter advance records">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={view === "records" ? "default" : "outline"}
              onClick={() => setView("records")}
            >
              Advance Records
            </Button>
            <Button
              variant={view === "statement" ? "default" : "outline"}
              onClick={() => setView("statement")}
            >
              <FileText className="size-4 mr-2" />
              Statement
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid w-full gap-1.5 sm:w-48">
              <Label className="text-sm font-medium">Office</Label>
              <Select value={officeFilter} onValueChange={(v) => setOfficeFilter(v ?? "all")}>
                <SelectTrigger className="h-9 w-full bg-background shadow-sm">
                  <SelectValue>{officeFilterLabel}</SelectValue>
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
            <div className="grid min-w-[200px] flex-1 gap-1.5 sm:max-w-xs">
              <Label htmlFor="advance-employee-search" className="text-sm font-medium">
                Employee
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="advance-employee-search"
                  className="h-9 bg-background pl-9 shadow-sm"
                  placeholder="Search by name..."
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                />
              </div>
            </div>
            <div className="grid w-full gap-1.5 sm:w-44">
              <Label className="text-sm font-medium">Status</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
                <SelectTrigger className="h-9 w-full bg-background shadow-sm">
                  <SelectValue>{statusFilterLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="recovered">Recovered only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </FilterSection>

      {view === "records" && (
        <Card className={theme.card}>
          <CardHeader className={theme.header}>
            <CardTitle>Advance Records</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Recovered</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredAdvances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      {advances.length === 0
                        ? "No advances found"
                        : nameFilter.trim()
                          ? "No employees match this name."
                          : "No advances found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAdvances.map((a) => (
                    <TableRow key={a._id}>
                      <TableCell className="font-medium">{empName(a.employeeId)}</TableCell>
                      <TableCell>{formatRs(a.advanceAmount)}</TableCell>
                      <TableCell>{formatRs(a.amountRecovered)}</TableCell>
                      <TableCell>{formatRs(a.outstandingAmount)}</TableCell>
                      <TableCell>
                        {formatRecoveryMode(a.recoveryMode, a.installmentAmount)}
                      </TableCell>
                      <TableCell>{new Date(a.date).toLocaleDateString("en-IN")}</TableCell>
                      <TableCell>
                        <Badge variant={a.isFullyRecovered ? "success" : "warning"}>
                          {a.isFullyRecovered ? "Recovered" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(a)}
                          title="Edit advance"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(a)}
                          disabled={deleteMutation.isPending}
                          title={
                            a.amountRecovered > 0
                              ? "Cannot delete — deductions recorded"
                              : "Delete advance"
                          }
                        >
                          <Trash2
                            className={`size-4 ${
                              a.amountRecovered > 0
                                ? "text-muted-foreground"
                                : "text-destructive"
                            }`}
                          />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {view === "statement" && (
        <>
          {statement && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-blue-200 bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-md">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-white/90">Employees</CardTitle></CardHeader>
                <CardContent className="text-2xl font-bold">{statementSummary.employeeCount}</CardContent>
              </Card>
              <Card className="border-violet-200 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-white/90">Total Taken</CardTitle></CardHeader>
                <CardContent className="text-2xl font-bold">{formatRs(statementSummary.totalTaken)}</CardContent>
              </Card>
              <Card className="border-emerald-200 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-white/90">Total Recovered</CardTitle></CardHeader>
                <CardContent className="text-2xl font-bold">
                  {formatRs(statementSummary.totalRecovered)}
                </CardContent>
              </Card>
              <Card className="border-amber-200 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-white/90">Outstanding</CardTitle></CardHeader>
                <CardContent className="text-2xl font-bold">
                  {formatRs(statementSummary.totalOutstanding)}
                </CardContent>
              </Card>
            </div>
          )}

          <Card className={theme.card}>
            <CardHeader className={theme.header}>
              <CardTitle>Advance Statement — By Employee</CardTitle>
              <p className="text-sm text-muted-foreground">
                Click an employee row to see advances taken and salary deductions
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Office</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Total Taken</TableHead>
                    <TableHead>Recovered</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Salary deductions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statementLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Loading statement...
                      </TableCell>
                    </TableRow>
                  ) : filteredStatementEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        {!statement?.byEmployee.length
                          ? "No data for statement"
                          : nameFilter.trim()
                            ? "No employees match this name."
                            : "No data for statement"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStatementEmployees.map((emp) => (
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
                          <TableCell>{formatRs(emp.totalTaken)}</TableCell>
                          <TableCell>{formatRs(emp.totalRecovered)}</TableCell>
                          <TableCell className="font-semibold text-amber-600">
                            {formatRs(emp.totalOutstanding)}
                          </TableCell>
                          <TableCell>
                            {emp.deductions?.length ? (
                              <span className="text-sm">
                                {emp.deductions.length} — {formatRs(totalDeductionAmount(emp.deductions))}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                        {expandedEmp === emp.employeeId && (
                          <TableRow key={`${emp.employeeId}-detail`}>
                            <TableCell colSpan={7} className="bg-muted/30 p-4 space-y-4">
                              <div>
                                <p className="mb-2 text-sm font-medium">Advances taken</p>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Date</TableHead>
                                      <TableHead>Advance</TableHead>
                                      <TableHead>Recovered</TableHead>
                                      <TableHead>Outstanding</TableHead>
                                      <TableHead>Mode</TableHead>
                                      <TableHead>Reason</TableHead>
                                      <TableHead>Status</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {emp.advances.map((a) => (
                                      <TableRow key={a.id}>
                                        <TableCell>
                                          {new Date(a.date).toLocaleDateString("en-IN")}
                                        </TableCell>
                                        <TableCell>{formatRs(a.advanceAmount)}</TableCell>
                                        <TableCell>{formatRs(a.amountRecovered)}</TableCell>
                                        <TableCell>{formatRs(a.outstandingAmount)}</TableCell>
                                        <TableCell>
                                          {formatRecoveryMode(a.recoveryMode, a.installmentAmount)}
                                        </TableCell>
                                        <TableCell>{a.reason}</TableCell>
                                        <TableCell>
                                          <Badge
                                            variant={
                                              a.status === "Recovered" ? "secondary" : "default"
                                            }
                                          >
                                            {a.status}
                                          </Badge>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                              <div>
                                <p className="mb-2 text-sm font-medium">
                                  Deducted from salary
                                  {emp.deductions?.length
                                    ? ` (${formatRs(totalDeductionAmount(emp.deductions))} total)`
                                    : ""}
                                </p>
                                {!emp.deductions?.length ? (
                                  <p className="text-sm text-muted-foreground">
                                    No salary deductions recorded yet
                                  </p>
                                ) : (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Salary month</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Deducted on</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {emp.deductions.map((d) => (
                                        <TableRow key={d.id}>
                                          <TableCell>{d.periodLabel}</TableCell>
                                          <TableCell className="font-medium text-green-700">
                                            {formatRs(d.amount)}
                                          </TableCell>
                                          <TableCell>{formatDeductionDate(d.deductedAt)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                )}
                              </div>
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
      )}

      <Dialog open={open} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Advance" : "New Salary Advance"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editing && editing.amountRecovered > 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                ₹{editing.amountRecovered.toLocaleString("en-IN")} already recovered from salary.
                Amount cannot be set below recovered total.
              </p>
            )}
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select
                value={form.employeeId}
                onValueChange={(v) => setForm({ ...form, employeeId: v ?? "" })}
                disabled={!!editing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee">
                    {form.employeeId ? selectedEmployeeLabel : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e._id} value={e._id}>{e.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input type="number" value={form.advanceAmount} onChange={(e) => setForm({ ...form, advanceAmount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Recovery Mode</Label>
              <Select
                value={form.recoveryMode}
                onValueChange={(v) => setForm({ ...form, recoveryMode: v as AdvanceRecoveryMode })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full (deduct in one salary)</SelectItem>
                  <SelectItem value="installment">Installment (monthly)</SelectItem>
                  <SelectItem value="custom">Custom (manual per salary)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.recoveryMode === "installment" && (
              <div className="space-y-2">
                <Label>Monthly Installment (₹)</Label>
                <Input
                  type="number"
                  value={form.installmentAmount}
                  onChange={(e) => setForm({ ...form, installmentAmount: e.target.value })}
                />
              </div>
            )}
            {form.recoveryMode === "custom" && (
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
                No fixed monthly amount. Set the deduction when you pay salary on the Salaries
                page.
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={
                saveMutation.isPending ||
                !form.advanceAmount ||
                !form.reason ||
                (!editing && !form.employeeId)
              }
            >
              {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
