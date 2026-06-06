"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarPlus,
  CheckCircle,
  CheckCheck,
  Pencil,
  Download,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { downloadExport } from "@/lib/export";
import { shareAngadiyaSalaries, shareAngadiyaSalary } from "@/lib/whatsapp";
import type { ApiResponse, SalaryRecord, Office, SalaryPaymentMode } from "@/types";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { FilterSection } from "@/components/layout/filter-section";
import { accentCard } from "@/lib/theme";

const theme = accentCard("salaries");

const now = new Date();
const CURRENT_MONTH = now.getMonth() + 1;
const CURRENT_YEAR = now.getFullYear();

const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

interface AdvanceInfo {
  totalOutstanding: number;
  grossBeforeAdvance: number;
  suggestedAuto: number;
  maxAllowed: number;
  currentDeduction: number;
  isManual: boolean;
  finalSalary: number;
}

function empName(emp: SalaryRecord["employeeId"]) {
  return typeof emp === "object" && emp !== null ? emp.fullName : "—";
}

function empMobile(emp: SalaryRecord["employeeId"]) {
  return typeof emp === "object" && emp !== null ? emp.mobileNumber : "";
}

function formatRs(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

const PAYMENT_MODE_LABELS: Record<SalaryPaymentMode, string> = {
  bank: "Bank",
  angadiya: "Angadiya",
  cash_in_hand: "Cash in Hand",
};

const emptyPayBank = {
  bankName: "",
  accountHolderName: "",
  accountNumber: "",
  ifscCode: "",
  branch: "",
};

const emptyPayAngadiya = {
  name: "",
  number: "",
  angadiyaNumber: "",
  amount: "",
  city: "",
};

export default function SalariesPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(String(CURRENT_MONTH));
  const [year, setYear] = useState(String(CURRENT_YEAR));

  const [officeFilter, setOfficeFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | SalaryPaymentMode>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generateOpen, setGenerateOpen] = useState(false);
  const [genOfficeId, setGenOfficeId] = useState("all");
  const [processOpen, setProcessOpen] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState<SalaryRecord | null>(null);
  const [customAdvance, setCustomAdvance] = useState("");
  const [payAllOpen, setPayAllOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payingSalary, setPayingSalary] = useState<SalaryRecord | null>(null);
  const [paymentMode, setPaymentMode] = useState<SalaryPaymentMode>("bank");
  const [payBank, setPayBank] = useState(emptyPayBank);
  const [payAngadiya, setPayAngadiya] = useState(emptyPayAngadiya);
  const [payAllMode, setPayAllMode] = useState<SalaryPaymentMode>("bank");
  const canConfirmPay =
    paymentMode === "cash_in_hand" ||
    (paymentMode === "bank" &&
      payBank.bankName &&
      payBank.accountHolderName &&
      payBank.accountNumber &&
      payBank.ifscCode &&
      payBank.branch) ||
    (paymentMode === "angadiya" &&
      payAngadiya.name &&
      payAngadiya.number &&
      payAngadiya.angadiyaNumber &&
      payAngadiya.amount &&
      payAngadiya.city);

  const { data: salaries = [], isLoading } = useQuery({
    queryKey: ["salaries", month, year, officeFilter],
    queryFn: async () => {
      let url = `/salaries?month=${month}&year=${year}`;
      if (officeFilter !== "all") url += `&officeId=${officeFilter}`;
      const { data } = await api.get<ApiResponse<SalaryRecord[]>>(url);
      return data.data ?? [];
    },
  });

  const pendingCount = salaries.filter((s) => s.paidStatus === "pending").length;

  const filteredSalaries = useMemo(
    () =>
      salaries.filter((s) => {
        if (paymentFilter === "all") return true;
        return s.paymentMode === paymentFilter;
      }),
    [salaries, paymentFilter]
  );

  const salaryTotals = useMemo(
    () =>
      filteredSalaries.reduce(
        (acc, s) => ({
          base: acc.base + Number(s.baseSalary),
          bonus: acc.bonus + Number(s.bonus ?? 0),
          remAdvance: acc.remAdvance + Number(s.outstandingAdvance ?? 0),
          advanceDed: acc.advanceDed + Number(s.advanceDeduction ?? 0),
          net: acc.net + Number(s.finalSalary),
        }),
        { base: 0, bonus: 0, remAdvance: 0, advanceDed: 0, net: 0 }
      ),
    [filteredSalaries]
  );

  const shareableSalaries = useMemo(
    () =>
      filteredSalaries.filter(
        (s) => s.paidStatus === "paid" && s.paymentMode === "angadiya"
      ),
    [filteredSalaries]
  );

  const allShareableSelected =
    shareableSalaries.length > 0 &&
    shareableSalaries.every((s) => selectedIds.has(s._id));

  useEffect(() => {
    setSelectedIds(new Set());
  }, [paymentFilter, month, year, officeFilter]);

  const { data: offices = [] } = useQuery({
    queryKey: ["offices"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Office[]>>("/offices");
      return data.data ?? [];
    },
  });

  const { data: advanceInfo, isLoading: advanceLoading } = useQuery({
    queryKey: ["salary-advance-info", selectedSalary?._id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AdvanceInfo>>(
        `/salaries/${selectedSalary!._id}/advance-info`
      );
      return data.data!;
    },
    enabled: !!selectedSalary && processOpen,
  });

  useEffect(() => {
    if (advanceInfo && processOpen) {
      setCustomAdvance(String(advanceInfo.currentDeduction));
    }
  }, [advanceInfo, processOpen]);

  const previewNet = selectedSalary
    ? Math.max(
        0,
        selectedSalary.baseSalary +
          (selectedSalary.bonus ?? 0) +
          (selectedSalary.otherAddition ?? 0) -
          (selectedSalary.otherDeduction ?? 0) -
          (Number(customAdvance) || 0)
      )
    : 0;

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ApiResponse<{ created: number; skipped: number }>>(
        "/salaries/generate",
        {
          month: Number(month),
          year: Number(year),
          officeId: genOfficeId !== "all" ? genOfficeId : undefined,
        }
      );
      return data.data!;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["salaries"] });
      const msg =
        result.created > 0
          ? `Created ${result.created} salary record(s). ${result.skipped > 0 ? `${result.skipped} pending record(s) refreshed (custom deductions kept).` : ""}`
          : `Refreshed ${result.skipped} pending salary record(s). Custom advance deductions were kept.`;
      toast.success(msg.trim());
      setGenerateOpen(false);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/salaries/${selectedSalary!._id}`, {
        advanceDeduction: Number(customAdvance) || 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaries"] });
      queryClient.invalidateQueries({ queryKey: ["advances"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Advance deduction saved");
      closeProcess();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const payMutation = useMutation({
    mutationFn: async ({
      salaryId,
      mode,
      bank,
      angadiya,
    }: {
      salaryId: string;
      mode: SalaryPaymentMode;
      bank: typeof emptyPayBank;
      angadiya: typeof emptyPayAngadiya;
    }) => {
      const payload: Record<string, unknown> = { paymentMode: mode };
      if (mode === "bank") payload.bankDetails = bank;
      if (mode === "angadiya") {
        payload.angadiyaDetails = {
          name: angadiya.name,
          number: angadiya.number,
          angadiyaNumber: angadiya.angadiyaNumber,
          amount: Number(angadiya.amount) || 0,
          city: angadiya.city,
        };
      }
      await api.post(`/salaries/${salaryId}/pay`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaries"] });
      queryClient.invalidateQueries({ queryKey: ["advances"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["advance-statement"] });
      toast.success("Salary paid successfully");
      closePay();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const defaultPayAngadiya = (salary: SalaryRecord) => ({
    name: empName(salary.employeeId),
    number: empMobile(salary.employeeId),
    angadiyaNumber: "",
    amount: String(salary.finalSalary),
    city: "",
  });

  const openPay = (salary: SalaryRecord) => {
    setPayingSalary(salary);
    setPaymentMode("bank");
    setPayBank(emptyPayBank);
    setPayAngadiya(defaultPayAngadiya(salary));
    setPayOpen(true);
  };

  const closePay = () => {
    setPayOpen(false);
    setPayingSalary(null);
    setPayBank(emptyPayBank);
    setPayAngadiya(emptyPayAngadiya);
  };

  const openEdit = (salary: SalaryRecord) => {
    setSelectedSalary(salary);
    setCustomAdvance(String(salary.advanceDeduction ?? 0));
    setProcessOpen(true);
  };

  const closeProcess = () => {
    setProcessOpen(false);
    setSelectedSalary(null);
    setCustomAdvance("");
  };

  const applySuggested = (amount: number) => {
    setCustomAdvance(String(amount));
  };

  const payAllMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<
        ApiResponse<{ paid: number; failed: { error: string }[]; total: number }>
      >("/salaries/pay-all", {
        month: Number(month),
        year: Number(year),
        officeId: officeFilter !== "all" ? officeFilter : undefined,
        paymentMode: payAllMode,
      });
      return data.data!;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["salaries"] });
      queryClient.invalidateQueries({ queryKey: ["advances"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setPayAllOpen(false);
      if (result.failed.length > 0) {
        toast.warning(`Paid ${result.paid} of ${result.total}. ${result.failed.length} failed.`);
      } else {
        toast.success(`Marked ${result.paid} salary(s) as paid`);
      }
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const handleExportExcel = async () => {
    try {
      await downloadExport("/export/salary", {
        format: "excel",
        month: Number(month),
        year: Number(year),
        officeId: officeFilter !== "all" ? officeFilter : undefined,
      });
      toast.success("Salary Excel downloaded");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const toggleSelectAll = () => {
    if (allShareableSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(shareableSalaries.map((s) => s._id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleShareSelected = () => {
    const selected = salaries.filter(
      (s) =>
        selectedIds.has(s._id) &&
        s.paidStatus === "paid" &&
        s.paymentMode === "angadiya"
    );
    if (selected.length === 0) {
      toast.error("Select paid angadiya salaries to share");
      return;
    }
    shareAngadiyaSalaries(selected);
    toast.success(
      selected.length === 1
        ? "Opening WhatsApp message..."
        : `Opening WhatsApp with ${selected.length} messages...`
    );
  };

  const handleShareAngadiyaPay = () => {
    if (!payingSalary) return;
    if (!payAngadiya.angadiyaNumber) {
      toast.error("Enter angadiya number first");
      return;
    }
    shareAngadiyaSalary(payingSalary, {
      name: payAngadiya.name,
      number: payAngadiya.number,
      angadiyaNumber: payAngadiya.angadiyaNumber,
      amount: Number(payAngadiya.amount) || 0,
      city: payAngadiya.city,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        theme="salaries"
        title="Salaries"
        description="Edit to set advance deduction, then Pay to mark as paid"
      >
        <Button
          variant="default"
          onClick={() => setPayAllOpen(true)}
          disabled={pendingCount === 0}
        >
          <CheckCheck className="size-4 mr-2" />
          Mark All Paid ({pendingCount})
        </Button>
        <Button variant="outline" onClick={handleExportExcel}>
          <Download className="size-4 mr-2" />
          Export Excel
        </Button>
        <Button onClick={() => setGenerateOpen(true)}>
          <CalendarPlus className="size-4 mr-2" />
          Generate Month
        </Button>
      </PageHeader>

      <FilterSection theme="salaries" description="Filter salary records by period, office, and payment mode">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label>Month</Label>
            <Select value={month} onValueChange={(v) => setMonth(v ?? "1")}>
              <SelectTrigger className="w-32 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_MONTHS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {new Date(2000, m - 1).toLocaleString("en", { month: "long" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Year</Label>
            <Input
              className="w-24 bg-background"
              type="number"
              min={2000}
              value={year}
              onChange={(e) => {
                const nextYear = Math.max(2000, Number(e.target.value) || CURRENT_YEAR);
                setYear(String(nextYear));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Office</Label>
            <Select value={officeFilter} onValueChange={(v) => setOfficeFilter(v ?? "all")}>
              <SelectTrigger className="w-48 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All offices</SelectItem>
                {offices.map((o) => (
                  <SelectItem key={o._id} value={o._id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Payment</Label>
            <Select
              value={paymentFilter}
              onValueChange={(v) => setPaymentFilter((v ?? "all") as "all" | SalaryPaymentMode)}
            >
              <SelectTrigger className="w-40 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payments</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="angadiya">Angadiya</SelectItem>
                <SelectItem value="cash_in_hand">Cash in Hand</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </FilterSection>

      <Card className={theme.card}>
        <CardHeader className={theme.header}>
          <CardTitle>
            {new Date(Number(year), Number(month) - 1).toLocaleString("en", {
              month: "long",
              year: "numeric",
            })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Base</TableHead>
                <TableHead>Bonus</TableHead>
                <TableHead>Rem-Advance</TableHead>
                <TableHead>Advance Ded.</TableHead>
                <TableHead>Net Salary</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right min-w-[180px]">
                  <div className="flex items-center justify-end gap-2">
                    {shareableSalaries.length > 0 && (
                      <>
                        <label className="flex items-center gap-1.5 text-xs font-normal cursor-pointer text-muted-foreground">
                          <input
                            type="checkbox"
                            className="size-4 rounded border"
                            checked={allShareableSelected}
                            onChange={toggleSelectAll}
                          />
                          Select All
                        </label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleShareSelected}
                          disabled={selectedIds.size === 0}
                        >
                          <MessageCircle className="size-3.5 mr-1 text-green-600" />
                          Share
                        </Button>
                      </>
                    )}
                    <span>Actions</span>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredSalaries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    {salaries.length === 0
                      ? "No salaries for this period. Click Generate Month."
                      : "No salaries match this payment filter."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSalaries.map((s) => {
                  const isShareable =
                    s.paidStatus === "paid" && s.paymentMode === "angadiya";
                  return (
                  <TableRow key={s._id}>
                    <TableCell className="font-medium">{empName(s.employeeId)}</TableCell>
                    <TableCell>{formatRs(Number(s.baseSalary))}</TableCell>
                    <TableCell>{formatRs(Number(s.bonus ?? 0))}</TableCell>
                    <TableCell
                      className={
                        Number(s.outstandingAdvance) > 0
                          ? "text-rose-600 font-medium"
                          : "text-muted-foreground"
                      }
                    >
                      {formatRs(Number(s.outstandingAdvance ?? 0))}
                    </TableCell>
                    <TableCell
                      className={
                        Number(s.advanceDeduction) > 0 ? "text-amber-600 font-medium" : ""
                      }
                    >
                      {formatRs(Number(s.advanceDeduction ?? 0))}
                      {s.advanceDeductionManual && (
                        <span className="ml-1 text-xs text-muted-foreground">(custom)</span>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatRs(Number(s.finalSalary))}
                    </TableCell>
                    <TableCell>
                      {s.paymentMode ? (
                        <Badge variant="secondary">
                          {PAYMENT_MODE_LABELS[s.paymentMode]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.paidStatus === "paid" ? "success" : "warning"}>
                        {s.paidStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isShareable && (
                          <input
                            type="checkbox"
                            className="size-4 rounded border mr-1"
                            checked={selectedIds.has(s._id)}
                            onChange={() => toggleSelect(s._id)}
                            title="Select for WhatsApp share"
                          />
                        )}
                        {s.paidStatus === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEdit(s)}
                              title="Edit advance deduction"
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openPay(s)}
                              disabled={payMutation.isPending}
                            >
                              <CheckCircle className="size-4 mr-1" />
                              Pay
                            </Button>
                          </>
                        )}
                        {isShareable && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => shareAngadiyaSalary(s)}
                            title="Share angadiya details on WhatsApp"
                          >
                            <MessageCircle className="size-4 text-green-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
            {filteredSalaries.length > 0 && (
              <TableFooter className="border-t-0 bg-transparent">
                <TableRow className="border-0 bg-gradient-to-r from-violet-600 to-purple-700 hover:!bg-gradient-to-r hover:from-violet-600 hover:to-purple-700">
                  <TableCell className="font-bold text-white">
                    Total ({filteredSalaries.length})
                  </TableCell>
                  <TableCell className="font-bold text-white">
                    {formatRs(salaryTotals.base)}
                  </TableCell>
                  <TableCell className="font-bold text-white">
                    {formatRs(salaryTotals.bonus)}
                  </TableCell>
                  <TableCell className="font-bold text-amber-200">
                    {formatRs(salaryTotals.remAdvance)}
                  </TableCell>
                  <TableCell className="font-bold text-orange-200">
                    {formatRs(salaryTotals.advanceDed)}
                  </TableCell>
                  <TableCell className="font-bold text-white text-base">
                    {formatRs(salaryTotals.net)}
                  </TableCell>
                  <TableCell colSpan={3} className="bg-transparent" />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>

      <Dialog open={payOpen} onOpenChange={(o) => !o && closePay()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Pay Salary — {payingSalary && empName(payingSalary.employeeId)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border p-3 text-sm bg-muted/40">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net salary</span>
                <span className="font-semibold">
                  {payingSalary ? formatRs(Number(payingSalary.finalSalary)) : "—"}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground">Advance deduction</span>
                <span>{payingSalary ? formatRs(Number(payingSalary.advanceDeduction ?? 0)) : "—"}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Salary Payment Mode</Label>
              <Select
                value={paymentMode}
                onValueChange={(v) => {
                  const mode = v as SalaryPaymentMode;
                  setPaymentMode(mode);
                  if (mode === "angadiya" && payingSalary) {
                    setPayAngadiya(defaultPayAngadiya(payingSalary));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="angadiya">Angadiya</SelectItem>
                  <SelectItem value="cash_in_hand">Cash in Hand</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMode === "bank" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <p className="sm:col-span-2 text-sm font-medium">Bank Details</p>
                {(
                  [
                    ["bankName", "Bank Name"],
                    ["accountHolderName", "Account Holder Name"],
                    ["accountNumber", "Account Number"],
                    ["ifscCode", "IFSC Code"],
                    ["branch", "Branch"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <Label>{label}</Label>
                    <Input
                      value={payBank[key]}
                      onChange={(e) =>
                        setPayBank({ ...payBank, [key]: e.target.value })
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            {paymentMode === "angadiya" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Angadiya Details</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleShareAngadiyaPay}
                    disabled={!payAngadiya.angadiyaNumber}
                  >
                    <MessageCircle className="size-4 mr-1 text-green-600" />
                    Share on WhatsApp
                  </Button>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Angadiya Number</Label>
                  <Input
                    value={payAngadiya.angadiyaNumber}
                    onChange={(e) =>
                      setPayAngadiya({ ...payAngadiya, angadiyaNumber: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input
                    value={payAngadiya.name}
                    onChange={(e) =>
                      setPayAngadiya({ ...payAngadiya, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Number</Label>
                  <Input
                    value={payAngadiya.number}
                    onChange={(e) =>
                      setPayAngadiya({ ...payAngadiya, number: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    min={0}
                    value={payAngadiya.amount}
                    onChange={(e) =>
                      setPayAngadiya({ ...payAngadiya, amount: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>City</Label>
                  <Input
                    value={payAngadiya.city}
                    onChange={(e) =>
                      setPayAngadiya({ ...payAngadiya, city: e.target.value })
                    }
                  />
                </div>
              </div>
            )}

            {paymentMode === "cash_in_hand" && (
              <p className="text-sm text-muted-foreground rounded-lg border p-3 bg-muted/30">
                Salary will be paid in cash. No bank or angadiya details needed.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closePay}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                payingSalary &&
                payMutation.mutate({
                  salaryId: payingSalary._id,
                  mode: paymentMode,
                  bank: payBank,
                  angadiya: payAngadiya,
                })
              }
              disabled={payMutation.isPending || !payingSalary || !canConfirmPay}
            >
              {payMutation.isPending ? "Paying..." : "Confirm Pay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={processOpen} onOpenChange={(o) => !o && closeProcess()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Custom Advance Deduction — {selectedSalary && empName(selectedSalary.employeeId)}
            </DialogTitle>
          </DialogHeader>

          {advanceLoading ? (
            <p className="text-sm text-muted-foreground">Loading advance info...</p>
          ) : advanceInfo ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border p-3 text-sm space-y-1 bg-muted/40">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gross salary</span>
                  <span>{formatRs(advanceInfo.grossBeforeAdvance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Rem-Advance</span>
                  <span className="font-medium text-amber-600">
                    {formatRs(advanceInfo.totalOutstanding)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max you can deduct</span>
                  <span>{formatRs(advanceInfo.maxAllowed)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => applySuggested(0)}
                >
                  No deduction
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => applySuggested(advanceInfo.suggestedAuto)}
                >
                  Auto ({formatRs(advanceInfo.suggestedAuto)})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => applySuggested(advanceInfo.maxAllowed)}
                >
                  Full Rem-Advance
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Custom advance deduction (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  max={advanceInfo.maxAllowed}
                  value={customAdvance}
                  onChange={(e) => setCustomAdvance(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter any amount from ₹0 up to {formatRs(advanceInfo.maxAllowed)}. Recovery
                  is applied to oldest advance first.
                </p>
              </div>

              <div className="flex justify-between font-semibold border-t pt-3">
                <span>Net salary to pay</span>
                <span>{formatRs(previewNet)}</span>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={closeProcess}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || advanceLoading}
            >
              {saveMutation.isPending ? "Saving..." : "Save Deduction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payAllOpen} onOpenChange={setPayAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark all salaries as paid?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will mark <strong>{pendingCount}</strong> pending salary record(s) as paid for{" "}
            {new Date(Number(year), Number(month) - 1).toLocaleString("en", {
              month: "long",
              year: "numeric",
            })}
            {officeFilter !== "all"
              ? ` (${offices.find((o) => o._id === officeFilter)?.name ?? "selected office"})`
              : " (all offices)"}
            . Each employee&apos;s current advance deduction (including custom amounts) will be
            applied.
          </p>
          <div className="space-y-2">
            <Label>Salary Payment Mode</Label>
            <Select
              value={payAllMode}
              onValueChange={(v) => setPayAllMode(v as SalaryPaymentMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="angadiya">Angadiya</SelectItem>
                <SelectItem value="cash_in_hand">Cash in Hand</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayAllOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => payAllMutation.mutate()}
              disabled={payAllMutation.isPending}
            >
              {payAllMutation.isPending ? "Processing..." : "Confirm — Mark All Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Monthly Salaries</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Creates salary records for all active employees. You can set custom advance
            amounts before paying.
          </p>
          <div className="space-y-2 py-2">
            <Label>Office (optional)</Label>
            <Select value={genOfficeId} onValueChange={(v) => setGenOfficeId(v ?? "all")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accessible offices</SelectItem>
                {offices.map((o) => (
                  <SelectItem key={o._id} value={o._id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
