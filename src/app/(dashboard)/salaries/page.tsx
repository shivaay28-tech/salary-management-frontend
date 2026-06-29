"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarPlus,
  CheckCircle,
  CheckCheck,
  Pencil,
  Download,
  MessageCircle,
  Search,
  PauseCircle,
  Ban,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { downloadExport } from "@/lib/export";
import { shareAngadiyaSalaries, shareAngadiyaSalary } from "@/lib/whatsapp";
import type {
  ApiResponse,
  DeferredSalaryStatement,
  SkippedSalaryStatement,
  SalaryRecord,
  Office,
  SalaryPaymentMode,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { JAMA_LABEL, JAMA_LINE_STATUS_LABELS, JAMA_UI, SALARY_STATUS_LABELS } from "@/lib/jama-labels";

const theme = accentCard("salaries");

const now = new Date();
const CURRENT_MONTH = now.getMonth() + 1;
const CURRENT_YEAR = now.getFullYear();
const YEAR_OPTIONS = Array.from({ length: 21 }, (_, i) => CURRENT_YEAR - 10 + i);

const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function monthLabel(month: string) {
  return new Date(2000, Number(month) - 1).toLocaleString("en", { month: "long" });
}

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

function proRataDaysLabel(salary: SalaryRecord) {
  const { payableDays, daysInMonth } = salary;
  if (
    payableDays == null ||
    daysInMonth == null ||
    payableDays >= daysInMonth
  ) {
    return null;
  }
  return `${payableDays}/${daysInMonth} days`;
}

function decidedMonthlySalary(salary: SalaryRecord) {
  if (salary.fullMonthlySalary != null) return Number(salary.fullMonthlySalary);
  const emp = salary.employeeId;
  if (typeof emp === "object" && emp !== null && "monthlySalary" in emp) {
    return Number(emp.monthlySalary);
  }
  return Number(salary.baseSalary);
}

const PAYMENT_MODE_LABELS: Record<SalaryPaymentMode, string> = {
  bank: "Bank",
  angadiya: "Angadiya",
  cash_in_hand: "Cash in Hand",
};

const STATUS_LABELS = SALARY_STATUS_LABELS;

function statusBadgeVariant(
  status: SalaryRecord["paidStatus"]
): "success" | "warning" | "info" | "secondary" {
  if (status === "paid") return "success";
  if (status === "pending") return "warning";
  if (status === "deferred") return "info";
  return "secondary";
}

const DEFERRED_LINE_STATUS = JAMA_LINE_STATUS_LABELS;

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
  const [view, setView] = useState<"records" | "statement">("records");
  const [statementStatus, setStatementStatus] = useState<"active" | "settled" | "all">("active");
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);
  const [expandedSkippedEmp, setExpandedSkippedEmp] = useState<string | null>(null);
  const [month, setMonth] = useState(String(CURRENT_MONTH));
  const [year, setYear] = useState(String(CURRENT_YEAR));

  const [officeFilter, setOfficeFilter] = useState("all");
  const [nameFilter, setNameFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"all" | SalaryPaymentMode>("all");
  const [salarySort, setSalarySort] = useState<"high-low" | "low-high">("high-low");
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
  const [payAdvanceDeduction, setPayAdvanceDeduction] = useState("");
  const [payCustomAmount, setPayCustomAmount] = useState("");
  const [payAllMode, setPayAllMode] = useState<SalaryPaymentMode>("bank");
  const [deferOpen, setDeferOpen] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [actionSalary, setActionSalary] = useState<SalaryRecord | null>(null);
  const [actionRemarks, setActionRemarks] = useState("");
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
      payCustomAmount &&
      payAngadiya.city);

  const {
    data: salaries = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["salaries", month, year, officeFilter],
    queryFn: async () => {
      let url = `/salaries?month=${month}&year=${year}`;
      if (officeFilter !== "all") url += `&officeId=${officeFilter}`;
      const { data } = await api.get<ApiResponse<SalaryRecord[]>>(url);
      return data.data ?? [];
    },
  });

  useEffect(() => {
    if (isError) {
      toast.error(getErrorMessage(error));
    }
  }, [isError, error]);

  const pendingCount = salaries.filter((s) => s.paidStatus === "pending").length;
  const deferredCount = salaries.filter((s) => s.paidStatus === "deferred").length;
  const skippedCount = salaries.filter((s) => s.paidStatus === "skipped").length;

  const filteredSalaries = useMemo(() => {
    const trimmedName = nameFilter.trim().toLowerCase();
    const list = salaries.filter((s) => {
      if (paymentFilter !== "all" && s.paymentMode !== paymentFilter) return false;
      if (trimmedName) {
        const name = empName(s.employeeId).toLowerCase();
        if (!name.includes(trimmedName)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      const diff = Number(b.finalSalary) - Number(a.finalSalary);
      return salarySort === "high-low" ? diff : -diff;
    });
    return list;
  }, [salaries, paymentFilter, nameFilter, salarySort]);

  const salaryTotals = useMemo(
    () =>
      filteredSalaries.reduce(
        (acc, s) => ({
          monthly: acc.monthly + decidedMonthlySalary(s),
          base: acc.base + Number(s.baseSalary),
          bonus: acc.bonus + Number(s.bonus ?? 0),
          remAdvance: acc.remAdvance + Number(s.outstandingAdvance ?? 0),
          advanceDed: acc.advanceDed + Number(s.advanceDeduction ?? 0),
          deferredAdd: acc.deferredAdd + Number(s.deferredCarryForward ?? 0),
          net: acc.net + Number(s.finalSalary),
        }),
        { monthly: 0, base: 0, bonus: 0, remAdvance: 0, advanceDed: 0, deferredAdd: 0, net: 0 }
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
  }, [paymentFilter, month, year, officeFilter, nameFilter]);

  const statementParams = () => {
    const params = new URLSearchParams();
    if (officeFilter !== "all") params.set("officeId", officeFilter);
    params.set("status", statementStatus);
    if (statementStatus === "settled" || statementStatus === "all") {
      params.set("year", year);
    }
    return params.toString() ? `?${params.toString()}` : "";
  };

  const { data: deferredStatement, isLoading: statementLoading } = useQuery({
    queryKey: ["deferred-statement", officeFilter, statementStatus, year],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<DeferredSalaryStatement>>(
        `/salaries/deferred-statement${statementParams()}`
      );
      return data.data!;
    },
    enabled: view === "statement",
  });

  const { data: skippedStatement, isLoading: skippedStatementLoading } = useQuery({
    queryKey: ["skipped-statement", officeFilter, year],
    queryFn: async () => {
      const params = new URLSearchParams({ year });
      if (officeFilter !== "all") params.set("officeId", officeFilter);
      const { data } = await api.get<ApiResponse<SkippedSalaryStatement>>(
        `/salaries/skipped-statement?${params.toString()}`
      );
      return data.data!;
    },
    enabled: view === "statement",
  });

  const filteredStatementEmployees = useMemo(() => {
    const trimmed = nameFilter.trim().toLowerCase();
    const list = deferredStatement?.byEmployee ?? [];
    if (!trimmed) return list;
    return list.filter((e) => e.fullName.toLowerCase().includes(trimmed));
  }, [deferredStatement, nameFilter]);

  const statementSummary = useMemo(
    () => ({
      employeeCount: filteredStatementEmployees.length,
      totalOutstanding: filteredStatementEmployees.reduce(
        (s, e) => s + e.totalOutstanding,
        0
      ),
      totalSettled: filteredStatementEmployees.reduce((s, e) => s + e.totalSettled, 0),
      totalPendingCarry: filteredStatementEmployees.reduce(
        (s, e) => s + (e.pendingCarryAmount ?? 0),
        0
      ),
    }),
    [filteredStatementEmployees]
  );

  const filteredSkippedEmployees = useMemo(() => {
    const trimmed = nameFilter.trim().toLowerCase();
    const list = skippedStatement?.byEmployee ?? [];
    if (!trimmed) return list;
    return list.filter((e) => e.fullName.toLowerCase().includes(trimmed));
  }, [skippedStatement, nameFilter]);

  const skippedSummary = useMemo(
    () => ({
      employeeCount: filteredSkippedEmployees.length,
      totalSkipped: filteredSkippedEmployees.reduce((s, e) => s + e.skippedCount, 0),
      totalWaived: filteredSkippedEmployees.reduce((s, e) => s + e.totalWaived, 0),
    }),
    [filteredSkippedEmployees]
  );

  const { data: offices = [] } = useQuery({
    queryKey: ["offices"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Office[]>>("/offices");
      return data.data ?? [];
    },
  });

  const { data: advanceInfo, isLoading: advanceLoading } = useQuery({
    queryKey: ["salary-advance-info", selectedSalary?._id ?? payingSalary?._id],
    queryFn: async () => {
      const salaryId = selectedSalary?._id ?? payingSalary!._id;
      const { data } = await api.get<ApiResponse<AdvanceInfo>>(
        `/salaries/${salaryId}/advance-info`
      );
      return data.data!;
    },
    enabled: !!((selectedSalary && processOpen) || (payingSalary && payOpen)),
  });

  useEffect(() => {
    if (advanceInfo && processOpen) {
      setCustomAdvance(String(advanceInfo.currentDeduction));
    }
  }, [advanceInfo, processOpen]);

  useEffect(() => {
    if (advanceInfo && payOpen) {
      setPayAdvanceDeduction(String(advanceInfo.currentDeduction));
    }
  }, [advanceInfo, payOpen]);

  const previewNet = selectedSalary
    ? Math.max(
        0,
        selectedSalary.baseSalary +
          (selectedSalary.bonus ?? 0) +
          (selectedSalary.otherAddition ?? 0) +
          (selectedSalary.deferredCarryForward ?? 0) -
          (selectedSalary.otherDeduction ?? 0) -
          (Number(customAdvance) || 0)
      )
    : 0;

  const payPreviewNet = payingSalary
    ? Math.max(
        0,
        payingSalary.baseSalary +
          (payingSalary.bonus ?? 0) +
          (payingSalary.otherAddition ?? 0) +
          (payingSalary.deferredCarryForward ?? 0) -
          (payingSalary.otherDeduction ?? 0) -
          (Number(payAdvanceDeduction) || 0)
      )
    : 0;

  const payAdvanceInvalid =
    advanceInfo !== undefined &&
    payOpen &&
    (Number(payAdvanceDeduction) || 0) > advanceInfo.maxAllowed;

  const payCustomInvalid =
    payOpen &&
    (Number(payCustomAmount) <= 0 || Number(payCustomAmount) > payPreviewNet);

  const payPartialRemainder = Math.max(
    0,
    payPreviewNet - (Number(payCustomAmount) || 0)
  );

  useEffect(() => {
    if (payOpen) {
      setPayCustomAmount(String(payPreviewNet));
      if (paymentMode === "angadiya") {
        setPayAngadiya((prev) => ({ ...prev, amount: String(payPreviewNet) }));
      }
    }
  }, [payOpen, payPreviewNet, paymentMode]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ApiResponse<{ created: number; skipped: number }>>(
        "/salaries/generate",
        {
          month: Number(month),
          year: Number(year),
          officeId: genOfficeId !== "all" ? genOfficeId : undefined,
        },
        { timeout: 120000 }
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
      advanceDeduction,
      paidAmount,
    }: {
      salaryId: string;
      mode: SalaryPaymentMode;
      bank: typeof emptyPayBank;
      angadiya: typeof emptyPayAngadiya;
      advanceDeduction: number;
      paidAmount: number;
    }) => {
      const payload: Record<string, unknown> = {
        paymentMode: mode,
        advanceDeduction,
        paidAmount,
      };
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
      queryClient.invalidateQueries({ queryKey: ["deferred-statement"] });
      toast.success("Salary paid successfully");
      closePay();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const defaultPayAngadiya = (salary: SalaryRecord, netAmount?: number) => ({
    name: empName(salary.employeeId),
    number: empMobile(salary.employeeId),
    angadiyaNumber: "",
    amount: String(netAmount ?? salary.finalSalary),
    city: "",
  });

  const openPay = (salary: SalaryRecord) => {
    setPayingSalary(salary);
    setPaymentMode("bank");
    setPayBank(emptyPayBank);
    setPayAdvanceDeduction(String(salary.advanceDeduction ?? 0));
    setPayAngadiya(defaultPayAngadiya(salary));
    setPayOpen(true);
  };

  const closePay = () => {
    setPayOpen(false);
    setPayingSalary(null);
    setPayBank(emptyPayBank);
    setPayAngadiya(emptyPayAngadiya);
    setPayAdvanceDeduction("");
    setPayCustomAmount("");
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

  const openDefer = (salary: SalaryRecord) => {
    setActionSalary(salary);
    setActionRemarks("");
    setDeferOpen(true);
  };

  const closeDefer = () => {
    setDeferOpen(false);
    setActionSalary(null);
    setActionRemarks("");
  };

  const openSkip = (salary: SalaryRecord) => {
    setActionSalary(salary);
    setActionRemarks("");
    setSkipOpen(true);
  };

  const closeSkip = () => {
    setSkipOpen(false);
    setActionSalary(null);
    setActionRemarks("");
  };

  const applySuggested = (amount: number) => {
    setCustomAdvance(String(amount));
  };

  const applyPaySuggested = (amount: number) => {
    setPayAdvanceDeduction(String(amount));
    if (payingSalary) {
      const net = Math.max(
        0,
        payingSalary.baseSalary +
          (payingSalary.bonus ?? 0) +
          (payingSalary.otherAddition ?? 0) +
          (payingSalary.deferredCarryForward ?? 0) -
          (payingSalary.otherDeduction ?? 0) -
          amount
      );
      setPayCustomAmount(String(net));
      if (paymentMode === "angadiya") {
        setPayAngadiya((prev) => ({ ...prev, amount: String(net) }));
      }
    }
  };

  const updatePayCustomAmount = (value: string) => {
    setPayCustomAmount(value);
    if (paymentMode === "angadiya") {
      setPayAngadiya((prev) => ({ ...prev, amount: value }));
    }
  };

  const deferMutation = useMutation({
    mutationFn: async ({ salaryId, remarks }: { salaryId: string; remarks: string }) => {
      await api.post(`/salaries/${salaryId}/defer`, { remarks: remarks || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaries"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["deferred-statement"] });
      toast.success(JAMA_UI.markedSuccess);
      closeDefer();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const skipMutation = useMutation({
    mutationFn: async ({ salaryId, remarks }: { salaryId: string; remarks: string }) => {
      await api.post(`/salaries/${salaryId}/skip`, { remarks });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaries"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["deferred-statement"] });
      queryClient.invalidateQueries({ queryKey: ["skipped-statement"] });
      queryClient.invalidateQueries({ queryKey: ["report-skipped-statement"] });
      toast.success("Salary skipped for this month");
      closeSkip();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

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

  const handleExportDeferredStatement = async () => {
    try {
      const exportParams: Record<string, string | number | undefined> = {
        format: "excel",
        officeId: officeFilter !== "all" ? officeFilter : undefined,
        status: statementStatus,
      };
      if (statementStatus === "settled" || statementStatus === "all") {
        exportParams.year = Number(year);
      }
      await downloadExport("/export/deferred-statement", exportParams);
      toast.success(JAMA_UI.statementDownloaded);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

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

  const officeFilterLabel =
    officeFilter === "all"
      ? "All offices"
      : offices.find((o) => o._id === officeFilter)?.name ?? "All offices";

  const paymentFilterLabel =
    paymentFilter === "all" ? "All payments" : PAYMENT_MODE_LABELS[paymentFilter];

  return (
    <div className="space-y-6">
      <PageHeader
        theme="salaries"
        title="Salaries"
        description={
          view === "statement"
            ? JAMA_UI.statementDescription
            : `${JAMA_UI.pageDescription}${deferredCount || skippedCount ? ` · ${deferredCount} ${JAMA_LABEL.toLowerCase()}, ${skippedCount} skipped` : ""}`
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={view === "records" ? "default" : "outline"}
            onClick={() => setView("records")}
          >
            Records
          </Button>
          <Button
            variant={view === "statement" ? "default" : "outline"}
            onClick={() => setView("statement")}
          >
            <FileText className="size-4 mr-2" />
            {JAMA_UI.andSkipped}
          </Button>
        </div>
        {view === "records" && (
          <>
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
          </>
        )}
        {view === "statement" && (
          <>
            <Button variant="outline" onClick={handleExportDeferredStatement}>
              <Download className="size-4 mr-2" />
              {JAMA_UI.export}
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await downloadExport("/export/skipped-statement", {
                    format: "excel",
                    year: Number(year),
                    officeId: officeFilter !== "all" ? officeFilter : undefined,
                  });
                  toast.success("Skipped statement downloaded");
                } catch (e) {
                  toast.error(getErrorMessage(e));
                }
              }}
            >
              <Download className="size-4 mr-2" />
              Export Skipped
            </Button>
          </>
        )}
      </PageHeader>

      <FilterSection
        theme="salaries"
        description={
          view === "statement"
            ? JAMA_UI.filterStatement
            : "Filter salary records by period, employee, office, and payment mode"
        }
      >
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid min-w-[200px] flex-1 gap-1.5 sm:max-w-xs">
            <Label htmlFor="salary-employee-search" className="text-sm font-medium">
              Employee
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="salary-employee-search"
                className="h-9 bg-background pl-9 shadow-sm"
                placeholder="Search by name..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
              />
            </div>
          </div>
          <div className="grid w-36 gap-1.5">
            <Label className="text-sm font-medium">Month</Label>
            <Select value={month} onValueChange={(v) => setMonth(v ?? "1")}>
              <SelectTrigger className="h-9 w-full bg-background shadow-sm">
                <SelectValue>{monthLabel(month)}</SelectValue>
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
          <div className="grid w-28 gap-1.5">
            <Label className="text-sm font-medium">Year</Label>
            <Select value={year} onValueChange={(v) => setYear(v ?? String(CURRENT_YEAR))}>
              <SelectTrigger className="h-9 w-full bg-background shadow-sm">
                <SelectValue>{year}</SelectValue>
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
          {view === "records" ? (
            <>
            <div className="grid w-full gap-1.5 sm:w-40">
              <Label className="text-sm font-medium">Payment</Label>
              <Select
                value={paymentFilter}
                onValueChange={(v) => setPaymentFilter((v ?? "all") as "all" | SalaryPaymentMode)}
              >
                <SelectTrigger className="h-9 w-full bg-background shadow-sm">
                  <SelectValue>{paymentFilterLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All payments</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="angadiya">Angadiya</SelectItem>
                  <SelectItem value="cash_in_hand">Cash in Hand</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid w-full gap-1.5 sm:w-44">
              <Label className="text-sm font-medium">Salary</Label>
              <Select
                value={salarySort}
                onValueChange={(v) =>
                  setSalarySort((v ?? "high-low") as "high-low" | "low-high")
                }
              >
                <SelectTrigger className="h-9 w-full bg-background shadow-sm">
                  <SelectValue>
                    {salarySort === "high-low" ? "High to low" : "Low to high"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high-low">High to low</SelectItem>
                  <SelectItem value="low-high">Low to high</SelectItem>
                </SelectContent>
              </Select>
            </div>
            </>
          ) : (
            <div className="grid w-full gap-1.5 sm:w-44">
              <Label className="text-sm font-medium">Statement</Label>
              <Select
                value={statementStatus}
                onValueChange={(v) =>
                  setStatementStatus((v ?? "active") as "active" | "settled" | "all")
                }
              >
                <SelectTrigger className="h-9 w-full bg-background shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Outstanding</SelectItem>
                  <SelectItem value="settled">Settled history</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </FilterSection>

      {view === "statement" && (
        <>
          {deferredStatement && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-sky-200 bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white/90">Employees</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                  {statementSummary.employeeCount}
                </CardContent>
              </Card>
              <Card className="border-amber-200 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white/90">{JAMA_UI.outstanding}</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                  {formatRs(statementSummary.totalOutstanding)}
                </CardContent>
              </Card>
              <Card className="border-violet-200 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white/90">In Pending Month</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                  {formatRs(statementSummary.totalPendingCarry)}
                </CardContent>
              </Card>
              <Card className="border-emerald-200 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white/90">Settled (shown)</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                  {formatRs(statementSummary.totalSettled)}
                </CardContent>
              </Card>
            </div>
          )}

          <Card className={theme.card}>
            <CardHeader className={theme.header}>
              <CardTitle>{JAMA_UI.statementByEmployee}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {JAMA_UI.expandDetails}
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14 text-center">No.</TableHead>
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
                  {statementLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        Loading statement...
                      </TableCell>
                    </TableRow>
                  ) : filteredStatementEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        {!deferredStatement?.byEmployee.length
                          ? JAMA_UI.noData
                          : nameFilter.trim()
                            ? "No employees match this name."
                            : JAMA_UI.noDataFilters}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStatementEmployees.map((emp, index) => (
                      <Fragment key={emp.employeeId}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() =>
                            setExpandedEmp(
                              expandedEmp === emp.employeeId ? null : emp.employeeId
                            )
                          }
                        >
                          <TableCell className="text-center text-sm font-medium tabular-nums text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-medium">{emp.fullName}</TableCell>
                          <TableCell>{emp.officeName}</TableCell>
                          <TableCell>{emp.mobileNumber}</TableCell>
                          <TableCell className="font-semibold text-amber-600">
                            {formatRs(emp.totalOutstanding)}
                          </TableCell>
                          <TableCell>
                            {emp.pendingCarryAmount ? (
                              <span className="text-sky-600 font-medium">
                                {formatRs(emp.pendingCarryAmount)}
                                {emp.pendingCarryPeriod ? (
                                  <span className="block text-xs text-muted-foreground font-normal">
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
                            <TableCell colSpan={8} className="bg-muted/30 p-4">
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
                                        Only pending carry-forward — no line items in this filter
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    emp.entries.map((entry) => (
                                      <TableRow key={entry.id}>
                                        <TableCell>{entry.periodLabel}</TableCell>
                                        <TableCell className="font-medium">
                                          {formatRs(entry.amount)}
                                        </TableCell>
                                        <TableCell>
                                          <Badge
                                            variant={
                                              entry.lineStatus === "settled"
                                                ? "success"
                                                : entry.lineStatus === "carried_forward"
                                                  ? "info"
                                                  : "warning"
                                            }
                                          >
                                            {DEFERRED_LINE_STATUS[entry.lineStatus]}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>{entry.carriedToPeriod ?? "—"}</TableCell>
                                        <TableCell>{entry.settledInPeriod ?? "—"}</TableCell>
                                        <TableCell>
                                          {entry.settledOn
                                            ? new Date(entry.settledOn).toLocaleDateString("en-IN")
                                            : "—"}
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate">
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

          <Card className={theme.card}>
            <CardHeader className={theme.header}>
              <CardTitle>
                Skipped / Waived Salaries — {skippedStatement?.scope ?? year}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Months where salary was waived (no payment due)
              </p>
            </CardHeader>
            <CardContent>
              {skippedStatement && (
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                    <p className="text-muted-foreground">Employees</p>
                    <p className="text-xl font-bold">{skippedSummary.employeeCount}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                    <p className="text-muted-foreground">Skipped months</p>
                    <p className="text-xl font-bold">{skippedSummary.totalSkipped}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                    <p className="text-muted-foreground">Total waived</p>
                    <p className="text-xl font-bold">{formatRs(skippedSummary.totalWaived)}</p>
                  </div>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14 text-center">No.</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Office</TableHead>
                    <TableHead>Skipped months</TableHead>
                    <TableHead>Total waived</TableHead>
                    <TableHead>Lines</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {skippedStatementLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Loading skipped statement...
                      </TableCell>
                    </TableRow>
                  ) : filteredSkippedEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No skipped salaries for {year}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSkippedEmployees.map((emp, index) => (
                      <Fragment key={emp.employeeId}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() =>
                            setExpandedSkippedEmp(
                              expandedSkippedEmp === emp.employeeId
                                ? null
                                : emp.employeeId
                            )
                          }
                        >
                          <TableCell className="text-center text-sm font-medium tabular-nums text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-medium">{emp.fullName}</TableCell>
                          <TableCell>{emp.officeName}</TableCell>
                          <TableCell>{emp.skippedCount}</TableCell>
                          <TableCell>{formatRs(emp.totalWaived)}</TableCell>
                          <TableCell>{emp.entries.length}</TableCell>
                        </TableRow>
                        {expandedSkippedEmp === emp.employeeId && (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-muted/30 p-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Period</TableHead>
                                    <TableHead>Waived amount</TableHead>
                                    <TableHead>Skipped on</TableHead>
                                    <TableHead>Reason</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {emp.entries.map((entry) => (
                                    <TableRow key={entry.id}>
                                      <TableCell>{entry.periodLabel}</TableCell>
                                      <TableCell>{formatRs(entry.waivedAmount)}</TableCell>
                                      <TableCell>
                                        {entry.skippedAt
                                          ? new Date(entry.skippedAt).toLocaleDateString("en-IN")
                                          : "—"}
                                      </TableCell>
                                      <TableCell>{entry.remarks ?? "—"}</TableCell>
                                    </TableRow>
                                  ))}
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
      )}

      {view === "records" && (
      <Card className={theme.card}>
        <CardHeader className={theme.header}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>
                {new Date(Number(year), Number(month) - 1).toLocaleString("en", {
                  month: "long",
                  year: "numeric",
                })}
              </CardTitle>
              <CardDescription>
                {isLoading
                  ? "Loading salary records..."
                  : `${filteredSalaries.length} record${filteredSalaries.length !== 1 ? "s" : ""}${
                      filteredSalaries.length !== salaries.length
                        ? ` (${salaries.length} total)`
                        : ""
                    }`}
              </CardDescription>
            </div>
            {shareableSalaries.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer text-muted-foreground">
                  <input
                    type="checkbox"
                    className="size-4 rounded border"
                    checked={allShareableSelected}
                    onChange={toggleSelectAll}
                  />
                  Select angadiya ({shareableSalaries.length})
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleShareSelected}
                  disabled={selectedIds.size === 0}
                >
                  <MessageCircle className="size-3.5 mr-1 text-green-600" />
                  Share on WhatsApp
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="min-w-[1180px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 pl-4 text-center">No.</TableHead>
                <TableHead className="min-w-[130px]">Employee</TableHead>
                <TableHead className="text-right">Monthly</TableHead>
                <TableHead className="text-right">Payable</TableHead>
                <TableHead className="text-right">Bonus</TableHead>
                <TableHead className="text-right">Rem-Adv.</TableHead>
                <TableHead className="text-right">Adv. Ded.</TableHead>
                <TableHead className="text-right">{JAMA_UI.add}</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="min-w-[168px] pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={12} className="py-12 text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={12} className="py-12 text-center text-destructive">
                    Failed to load salaries. Check the error message above and refresh the page.
                  </TableCell>
                </TableRow>
              ) : filteredSalaries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="py-12 text-center text-muted-foreground">
                    {salaries.length === 0
                      ? "No salaries for this period. Click Generate Month."
                      : nameFilter.trim()
                        ? "No employees match this name."
                        : "No salaries match this payment filter."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSalaries.map((s, index) => {
                  const isShareable =
                    s.paidStatus === "paid" && s.paymentMode === "angadiya";
                  const daysLabel = proRataDaysLabel(s);
                  return (
                  <TableRow key={s._id} className="group">
                    <TableCell className="pl-4 text-center text-sm font-medium tabular-nums text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell className="font-medium whitespace-normal">
                      {empName(s.employeeId)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatRs(decidedMonthlySalary(s))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div>{formatRs(Number(s.baseSalary))}</div>
                      {daysLabel && (
                        <Badge variant="info" className="mt-1 text-xs">
                          {daysLabel}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatRs(Number(s.bonus ?? 0))}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        Number(s.outstandingAdvance) > 0
                          ? "text-rose-600 font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatRs(Number(s.outstandingAdvance ?? 0))}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        Number(s.advanceDeduction) > 0 ? "text-amber-600 font-medium" : ""
                      }`}
                    >
                      {formatRs(Number(s.advanceDeduction ?? 0))}
                      {s.advanceDeductionManual && (
                        <span className="ml-1 text-xs text-muted-foreground">(custom)</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        Number(s.deferredCarryForward) > 0
                          ? "text-sky-600 font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {Number(s.deferredCarryForward) > 0
                        ? formatRs(Number(s.deferredCarryForward))
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums whitespace-normal">
                      {formatRs(Number(s.finalSalary))}
                      {s.remarks && (s.paidStatus === "deferred" || s.paidStatus === "skipped") && (
                        <p
                          className="text-xs font-normal text-muted-foreground mt-0.5 max-w-[120px] ml-auto truncate"
                          title={s.remarks}
                        >
                          {s.remarks}
                        </p>
                      )}
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
                      <Badge variant={statusBadgeVariant(s.paidStatus)}>
                        {STATUS_LABELS[s.paidStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="inline-flex items-center justify-end gap-0.5 flex-nowrap">
                        {isShareable && (
                          <input
                            type="checkbox"
                            className="size-4 rounded border mr-1 shrink-0"
                            checked={selectedIds.has(s._id)}
                            onChange={() => toggleSelect(s._id)}
                            title="Select for WhatsApp share"
                          />
                        )}
                        {s.paidStatus === "pending" && (
                          <>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => openEdit(s)}
                              title="Edit advance deduction"
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="outline"
                              onClick={() => openDefer(s)}
                              disabled={deferMutation.isPending}
                              title={JAMA_UI.actionTooltip}
                            >
                              <PauseCircle className="size-4" />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => openSkip(s)}
                              disabled={skipMutation.isPending}
                              title="Skip — waived, no payment due"
                            >
                              <Ban className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 shrink-0 px-2.5"
                              onClick={() => openPay(s)}
                              disabled={payMutation.isPending}
                            >
                              <CheckCircle className="size-3.5 mr-1" />
                              Pay
                            </Button>
                          </>
                        )}
                        {isShareable && (
                          <Button
                            size="icon-sm"
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
            {!isLoading && !isError && filteredSalaries.length > 0 && (
              <TableFooter>
                <TableRow className="border-0 bg-gradient-to-r from-violet-600 to-purple-700 hover:!bg-gradient-to-r hover:from-violet-600 hover:to-purple-700">
                  <TableCell className="bg-transparent pl-4" />
                  <TableCell className="font-bold text-white whitespace-normal">
                    Total ({filteredSalaries.length})
                  </TableCell>
                  <TableCell className="text-right font-bold text-white tabular-nums">
                    {formatRs(salaryTotals.monthly)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-white tabular-nums">
                    {formatRs(salaryTotals.base)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-white tabular-nums">
                    {formatRs(salaryTotals.bonus)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-amber-200 tabular-nums">
                    {formatRs(salaryTotals.remAdvance)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-orange-200 tabular-nums">
                    {formatRs(salaryTotals.advanceDed)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-sky-200 tabular-nums">
                    {formatRs(salaryTotals.deferredAdd)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-white text-base tabular-nums">
                    {formatRs(salaryTotals.net)}
                  </TableCell>
                  <TableCell colSpan={3} className="bg-transparent pr-4" />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>
      )}

      <Dialog open={payOpen} onOpenChange={(o) => !o && closePay()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Pay Salary — {payingSalary && empName(payingSalary.employeeId)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border p-3 text-sm bg-muted/40 space-y-1">
              {payingSalary && Number(payingSalary.deferredCarryForward) > 0 && (
                <div className="flex justify-between text-sky-700">
                  <span>{JAMA_UI.fromPriorMonths}</span>
                  <span className="font-medium">
                    +{formatRs(Number(payingSalary.deferredCarryForward))}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net salary</span>
                <span className="font-semibold">
                  {payingSalary ? formatRs(payPreviewNet) : "—"}
                </span>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Pencil className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">Amount to pay</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => updatePayCustomAmount(String(payPreviewNet))}
                >
                  Full net ({formatRs(payPreviewNet)})
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Custom amount to pay (₹)</Label>
                <Input
                  type="number"
                  min={1}
                  max={payPreviewNet}
                  value={payCustomAmount}
                  onChange={(e) => updatePayCustomAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter any amount from ₹1 up to {formatRs(payPreviewNet)}.
                </p>
                {payPartialRemainder > 0 && (
                  <p className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg p-2">
                    {formatRs(payPartialRemainder)} will be added as {JAMA_LABEL.toLowerCase()}{" "}
                    and carried to a future salary month.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Pencil className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">Edit advance deduction</p>
              </div>
              {advanceLoading ? (
                <p className="text-sm text-muted-foreground">Loading advance info...</p>
              ) : advanceInfo ? (
                <>
                  <div className="rounded-lg border p-3 text-sm space-y-1 bg-muted/40">
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
                      onClick={() => applyPaySuggested(0)}
                    >
                      No deduction
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => applyPaySuggested(advanceInfo.suggestedAuto)}
                    >
                      Auto ({formatRs(advanceInfo.suggestedAuto)})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => applyPaySuggested(advanceInfo.maxAllowed)}
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
                      value={payAdvanceDeduction}
                      onChange={(e) => {
                        const value = e.target.value;
                        setPayAdvanceDeduction(value);
                        if (payingSalary) {
                          const net = Math.max(
                            0,
                            payingSalary.baseSalary +
                              (payingSalary.bonus ?? 0) +
                              (payingSalary.otherAddition ?? 0) +
                              (payingSalary.deferredCarryForward ?? 0) -
                              (payingSalary.otherDeduction ?? 0) -
                              (Number(value) || 0)
                          );
                          updatePayCustomAmount(String(net));
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter any amount from ₹0 up to {formatRs(advanceInfo.maxAllowed)}.
                    </p>
                  </div>
                </>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Salary Payment Mode</Label>
              <Select
                value={paymentMode}
                onValueChange={(v) => {
                  const mode = v as SalaryPaymentMode;
                  setPaymentMode(mode);
                  if (mode === "angadiya" && payingSalary) {
                    setPayAngadiya(defaultPayAngadiya(payingSalary, Number(payCustomAmount) || payPreviewNet));
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
                    min={1}
                    max={payPreviewNet}
                    value={payCustomAmount}
                    onChange={(e) => updatePayCustomAmount(e.target.value)}
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
                  angadiya: {
                    ...payAngadiya,
                    amount: payCustomAmount,
                  },
                  advanceDeduction: Number(payAdvanceDeduction) || 0,
                  paidAmount: Number(payCustomAmount) || 0,
                })
              }
              disabled={
                payMutation.isPending ||
                !payingSalary ||
                !canConfirmPay ||
                payAdvanceInvalid ||
                payCustomInvalid ||
                advanceLoading
              }
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

      <Dialog
        open={generateOpen}
        onOpenChange={(open) => {
          if (!generateMutation.isPending) setGenerateOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Monthly Salaries</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Creates salary records for payable employees in this month. Mid-month
            joiners and leavers are paid automatically on remaining calendar days.
            You can set custom advance amounts before paying.
            {generateMutation.isPending && (
              <span className="mt-2 block text-violet-600">
                Generating records — this may take a moment for large teams.
              </span>
            )}
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
            <Button
              variant="outline"
              onClick={() => setGenerateOpen(false)}
              disabled={generateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deferOpen} onOpenChange={(o) => !o && closeDefer()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {JAMA_UI.actionTitle} — {actionSalary && empName(actionSalary.employeeId)}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Employee does not want salary now. Amount{" "}
            <strong>{actionSalary ? formatRs(Number(actionSalary.finalSalary)) : ""}</strong>{" "}
            will be added to next month&apos;s net salary when you generate it.
          </p>
          <div className="space-y-2 py-2">
            <Label>Reason (optional)</Label>
            <Input
              value={actionRemarks}
              onChange={(e) => setActionRemarks(e.target.value)}
              placeholder="e.g. will collect after 3 months"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDefer}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                actionSalary &&
                deferMutation.mutate({ salaryId: actionSalary._id, remarks: actionRemarks })
              }
              disabled={deferMutation.isPending}
            >
              {deferMutation.isPending ? "Saving..." : JAMA_UI.actionButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={skipOpen} onOpenChange={(o) => !o && closeSkip()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Skip Salary — {actionSalary && empName(actionSalary.employeeId)}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Employee waives salary for this month. No payment is due and nothing carries forward.
          </p>
          <div className="space-y-2 py-2">
            <Label>Reason (required)</Label>
            <Input
              value={actionRemarks}
              onChange={(e) => setActionRemarks(e.target.value)}
              placeholder="e.g. on leave without pay"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeSkip}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                actionSalary &&
                skipMutation.mutate({ salaryId: actionSalary._id, remarks: actionRemarks })
              }
              disabled={skipMutation.isPending || !actionRemarks.trim()}
            >
              {skipMutation.isPending ? "Saving..." : "Skip this month"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
