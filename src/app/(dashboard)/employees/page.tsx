"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  FileUp,
  Download,
  Search,
  Users,
  Wallet,
  Building2,
  Phone,
  UserRound,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { api, apiDownload, getErrorMessage } from "@/lib/api";
import { downloadExport } from "@/lib/export";
import { getPhotoUrl } from "@/lib/media";
import type { ApiResponse, Employee, Office, EmployeeStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/layout/page-header";
import { FilterSection } from "@/components/layout/filter-section";
import { StatusSegment } from "@/components/ui/status-segment";
import { accentCard, PAGE_THEMES } from "@/lib/theme";
import { cn } from "@/lib/utils";

const theme = accentCard("employees");
const pageTheme = PAGE_THEMES.employees;

const emptyForm = {
  fullName: "",
  mobileNumber: "",
  dateOfJoining: "",
  officeId: "",
  monthlySalary: "",
  status: "active" as EmployeeStatus,
  outDate: "",
};

function getOfficeName(officeId: Employee["officeId"]) {
  if (typeof officeId === "object" && officeId !== null && "name" in officeId) {
    return officeId.name;
  }
  return "—";
}

function formatRs(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface EmployeeImportFailure {
  row: number;
  fullName?: string;
  error: string;
}

interface EmployeeImportResult {
  created: number;
  failed: EmployeeImportFailure[];
}

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<EmployeeImportResult | null>(null);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [officeFilter, setOfficeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus>("active");
  const [nameFilter, setNameFilter] = useState("");
  const [appliedFilter, setAppliedFilter] = useState("all");
  const [appliedStatusFilter, setAppliedStatusFilter] =
    useState<EmployeeStatus>("active");
  const [appliedNameFilter, setAppliedNameFilter] = useState("");
  type EmployeeSort = "joined-oldest" | "joined-newest" | "salary-high-low" | "salary-low-high";
  const [employeeSort, setEmployeeSort] = useState<EmployeeSort>("joined-oldest");

  const buildEmployeeQuery = (
    office: string,
    status: EmployeeStatus,
    name: string
  ) => {
    const params = new URLSearchParams();
    if (office !== "all") params.set("officeId", office);
    params.set("status", status);
    const trimmedName = name.trim();
    if (trimmedName) params.set("name", trimmedName);
    return `?${params.toString()}`;
  };

  const { data: employees = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["employees", appliedFilter, appliedStatusFilter, appliedNameFilter],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Employee[]>>(
        `/employees${buildEmployeeQuery(appliedFilter, appliedStatusFilter, appliedNameFilter)}`
      );
      return data.data ?? [];
    },
  });

  const sortedEmployees = useMemo(() => {
    const list = [...employees];
    list.sort((a, b) => {
      if (employeeSort.startsWith("salary-")) {
        const diff = b.monthlySalary - a.monthlySalary;
        return employeeSort === "salary-high-low" ? diff : -diff;
      }
      const aTime = new Date(a.dateOfJoining).getTime();
      const bTime = new Date(b.dateOfJoining).getTime();
      return employeeSort === "joined-oldest" ? aTime - bTime : bTime - aTime;
    });
    return list;
  }, [employees, employeeSort]);

  const { data: offices = [] } = useQuery({
    queryKey: ["offices"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Office[]>>("/offices");
      return data.data ?? [];
    },
  });

  const buildPayload = () => ({
    fullName: form.fullName,
    mobileNumber: form.mobileNumber,
    dateOfJoining: form.dateOfJoining,
    officeId: form.officeId,
    monthlySalary: Number(form.monthlySalary),
    status: form.status,
    outDate: form.outDate || undefined,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (editing) {
        await api.put(`/employees/${editing._id}`, payload);
      } else {
        await api.post("/employees", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success(editing ? "Employee updated" : "Employee created");
      closeDialog();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee deleted");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const uploadPhoto = async (employeeId: string, file: File) => {
    const fd = new FormData();
    fd.append("photo", file);
    await api.post(`/employees/${employeeId}/photo`, fd);
    queryClient.invalidateQueries({ queryKey: ["employees"] });
    toast.success("Photo uploaded");
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    const officeId =
      typeof emp.officeId === "object" && emp.officeId !== null
        ? emp.officeId._id
        : emp.officeId;
    setForm({
      fullName: emp.fullName,
      mobileNumber: emp.mobileNumber,
      dateOfJoining: emp.dateOfJoining.split("T")[0],
      officeId,
      monthlySalary: String(emp.monthlySalary),
      status: emp.status,
      outDate: emp.outDate?.split("T")[0] ?? "",
    });
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleExportExcel = async () => {
    try {
      await downloadExport("/export/employees", {
        format: "excel",
        officeId: appliedFilter !== "all" ? appliedFilter : undefined,
        status: appliedStatusFilter,
      });
      toast.success("Employee details Excel downloaded");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const { blob, filename } = await apiDownload("/employees/import/template", {});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Import template downloaded");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post<ApiResponse<EmployeeImportResult>>(
        "/employees/import",
        fd
      );
      return data.data!;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setImportResult(result);
      if (result.created > 0 && result.failed.length === 0) {
        toast.success(`Imported ${result.created} employee(s)`);
      } else if (result.created > 0) {
        toast.success(
          `Imported ${result.created} employee(s). ${result.failed.length} row(s) failed.`
        );
      } else {
        toast.error("No employees were imported. Check the errors below.");
      }
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const handleImportFile = (file: File) => {
    setImportResult(null);
    importMutation.mutate(file);
  };

  const openImportDialog = () => {
    setImportResult(null);
    setImportOpen(true);
  };

  const handleSearch = () => {
    const trimmedName = nameFilter.trim();
    setAppliedFilter(officeFilter);
    setAppliedStatusFilter(statusFilter);
    setAppliedNameFilter(trimmedName);
    if (
      officeFilter === appliedFilter &&
      statusFilter === appliedStatusFilter &&
      trimmedName === appliedNameFilter
    ) {
      refetch();
    }
  };

  const handleReset = () => {
    setNameFilter("");
    setOfficeFilter("all");
    setStatusFilter("active");
    setAppliedNameFilter("");
    setAppliedFilter("all");
    setAppliedStatusFilter("active");
    setEmployeeSort("joined-oldest");
  };

  const hasActiveFilters =
    appliedNameFilter ||
    appliedFilter !== "all" ||
    appliedStatusFilter !== "active";

  const appliedOfficeName =
    appliedFilter !== "all"
      ? offices.find((o) => o._id === appliedFilter)?.name
      : null;

  const totalEmployees = sortedEmployees.length;
  const totalSalary = sortedEmployees.reduce((sum, emp) => sum + emp.monthlySalary, 0);

  const officeFilterLabel =
    officeFilter === "all"
      ? "All offices"
      : offices.find((o) => o._id === officeFilter)?.name ?? "All offices";

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <PageHeader
          theme="employees"
          title="Employees"
          description="Manage staff records, salaries, and photos"
        >
          <Button
            variant="outline"
            className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            onClick={openImportDialog}
          >
            <FileUp className="size-4 mr-2" />
            Import Excel
          </Button>
          <Button
            variant="outline"
            className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            onClick={handleExportExcel}
          >
            <Download className="size-4 mr-2" />
            Export Excel
          </Button>
          <Button
            className="bg-white text-emerald-700 hover:bg-white/90"
            onClick={openCreate}
          >
            <Plus className="size-4 mr-2" />
            Add Employee
          </Button>
        </PageHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className={cn(theme.card, "overflow-hidden")}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
                <Users className="size-6" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Total Employees</p>
                <p className="text-2xl font-bold tracking-tight">{totalEmployees}</p>
                <p className="text-xs capitalize text-muted-foreground">
                  {appliedStatusFilter} staff
                  {appliedOfficeName ? ` · ${appliedOfficeName}` : ""}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className={cn(theme.card, "overflow-hidden")}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md">
                <Wallet className="size-6" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Monthly Payroll</p>
                <p className="text-2xl font-bold tracking-tight">{formatRs(totalSalary)}</p>
                <p className="text-xs text-muted-foreground">sum of listed salaries</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <FilterSection
          theme="employees"
          title="Search & Filters"
          description="Find employees by name, office, or status"
        >
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid min-w-[220px] flex-1 gap-1.5 sm:max-w-sm">
              <Label htmlFor="employee-name-search" className="text-sm font-medium">
                Employee Name
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="employee-name-search"
                  className="h-9 bg-background pl-9 shadow-sm"
                  placeholder="Search by name..."
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                />
              </div>
            </div>
            <div className="grid w-full gap-1.5 sm:w-48">
              <Label className="text-sm font-medium">Office</Label>
              <Select
                value={officeFilter}
                onValueChange={(v) => setOfficeFilter(v ?? "all")}
              >
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
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium">Status</Label>
              <StatusSegment
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as EmployeeStatus)}
              />
            </div>
            <div className="grid w-full gap-1.5 sm:w-48">
              <Label className="text-sm font-medium">Sort</Label>
              <Select
                value={employeeSort}
                onValueChange={(v) =>
                  setEmployeeSort((v ?? "joined-oldest") as EmployeeSort)
                }
              >
                <SelectTrigger className="h-9 w-full bg-background shadow-sm">
                  <SelectValue>
                    {employeeSort === "joined-oldest"
                      ? "Joined: Old to newest"
                      : employeeSort === "joined-newest"
                        ? "Joined: Newest to old"
                        : employeeSort === "salary-high-low"
                          ? "Salary: High to low"
                          : "Salary: Low to high"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="joined-oldest">Joined: Old to newest</SelectItem>
                  <SelectItem value="joined-newest">Joined: Newest to old</SelectItem>
                  <SelectItem value="salary-high-low">Salary: High to low</SelectItem>
                  <SelectItem value="salary-low-high">Salary: Low to high</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium invisible select-none" aria-hidden>
                Actions
              </Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleSearch}
                  disabled={isFetching}
                  className="h-9 min-w-28 px-4"
                >
                  <Search className="size-4 mr-2" />
                  {isFetching ? "Searching..." : "Search"}
                </Button>
                <Button
                  variant="outline"
                  className="h-9 px-4"
                  onClick={handleReset}
                  disabled={isFetching && !hasActiveFilters}
                >
                  <RotateCcw className="size-4 mr-2" />
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </FilterSection>

        <Card className={theme.card}>
          <CardHeader className={cn(theme.header, "gap-2")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Employee List</CardTitle>
                <CardDescription>
                  {isLoading
                    ? "Loading employees..."
                    : `${totalEmployees} employee${totalEmployees !== 1 ? "s" : ""} found`}
                </CardDescription>
              </div>
              {hasActiveFilters && !isLoading && (
                <div className="flex flex-wrap gap-1.5">
                  {appliedNameFilter && (
                    <Badge variant="outline" className={pageTheme.badge}>
                      Name: {appliedNameFilter}
                    </Badge>
                  )}
                  {appliedOfficeName && (
                    <Badge variant="outline" className={pageTheme.badge}>
                      {appliedOfficeName}
                    </Badge>
                  )}
                  <Badge variant="outline" className={pageTheme.badge}>
                    {appliedStatusFilter}
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-14 pl-6 text-center">No.</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Office</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-12 text-center text-muted-foreground"
                      >
                        Loading employees...
                      </TableCell>
                    </TableRow>
                  ) : sortedEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-16">
                        <div className="flex flex-col items-center gap-3 text-center">
                          <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                            <UserRound className="size-7" />
                          </div>
                          <div>
                            <p className="font-medium">No employees found</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {hasActiveFilters
                                ? "Try adjusting your search or filters."
                                : "Add your first employee to get started."}
                            </p>
                          </div>
                          {!hasActiveFilters && (
                            <Button size="sm" onClick={openCreate}>
                              <Plus className="size-4 mr-2" />
                              Add Employee
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedEmployees.map((emp, index) => (
                      <TableRow key={emp._id} className="group">
                        <TableCell className="pl-6 text-center text-sm font-medium tabular-nums text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-10 ring-2 ring-emerald-100">
                              <AvatarImage src={getPhotoUrl(emp.photoUrl)} />
                              <AvatarFallback className="bg-emerald-50 text-emerald-700">
                                <UserRound className="size-4" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{emp.fullName}</p>
                              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="size-3 shrink-0" />
                                {emp.mobileNumber}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                            {getOfficeName(emp.officeId)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(emp.dateOfJoining)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatRs(emp.monthlySalary)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={emp.status === "active" ? "success" : "secondary"}
                          >
                            {emp.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <div className="inline-flex items-center rounded-lg border bg-muted/40 p-0.5 opacity-90 transition-opacity group-hover:opacity-100">
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => {
                                      const input = document.createElement("input");
                                      input.type = "file";
                                      input.accept =
                                        "image/jpeg,image/png,image/webp";
                                      input.onchange = async () => {
                                        const file = input.files?.[0];
                                        if (file) {
                                          try {
                                            await uploadPhoto(emp._id, file);
                                          } catch {
                                            toast.error("Upload failed");
                                          }
                                        }
                                      };
                                      input.click();
                                    }}
                                  />
                                }
                              >
                                <Upload className="size-3.5" />
                              </TooltipTrigger>
                              <TooltipContent>Upload photo</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => openEdit(emp)}
                                  />
                                }
                              >
                                <Pencil className="size-3.5" />
                              </TooltipTrigger>
                              <TooltipContent>Edit employee</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => {
                                      if (confirm(`Delete ${emp.fullName}?`)) {
                                        deleteMutation.mutate(emp._id);
                                      }
                                    }}
                                  />
                                }
                              >
                                <Trash2 className="size-3.5 text-destructive" />
                              </TooltipTrigger>
                              <TooltipContent>Delete employee</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={importOpen}
          onOpenChange={(next) => {
            setImportOpen(next);
            if (!next) setImportResult(null);
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Import Employees from Excel</DialogTitle>
              <DialogDescription>
                Upload an Excel file to add multiple employees at once. Office
                names must match existing offices exactly.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Required columns</p>
                <p className="mt-1">
                  Full Name, Mobile, Office, Monthly Salary, Date of Joining
                </p>
                <p className="mt-2 font-medium text-foreground">Optional</p>
                <p>Status (active/inactive), Out Date (required if inactive)</p>
                {offices.length > 0 && (
                  <>
                    <p className="mt-2 font-medium text-foreground">
                      Your assigned offices
                    </p>
                    <p>{offices.map((office) => office.name).join(", ")}</p>
                    <p className="mt-1 text-xs">
                      The Office column must match one of these names exactly.
                    </p>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleDownloadTemplate}>
                  <Download className="size-4 mr-2" />
                  Download Template
                </Button>
                <Button
                  onClick={() => importFileRef.current?.click()}
                  disabled={importMutation.isPending}
                >
                  <FileUp className="size-4 mr-2" />
                  {importMutation.isPending ? "Importing..." : "Choose Excel File"}
                </Button>
              </div>
              {importResult && (
                <div className="space-y-2 rounded-lg border p-4">
                  <p className="text-sm font-medium text-emerald-700">
                    {importResult.created} employee(s) imported successfully
                  </p>
                  {importResult.failed.length > 0 && (
                    <div className="max-h-40 space-y-1 overflow-y-auto text-sm">
                      <p className="font-medium text-destructive">
                        {importResult.failed.length} row(s) failed:
                      </p>
                      {importResult.failed.map((item) => (
                        <p key={item.row} className="text-muted-foreground">
                          Row {item.row}
                          {item.fullName ? ` (${item.fullName})` : ""}: {item.error}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Employee" : "Add Employee"}
              </DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update employee details below."
                  : "Fill in the details to register a new employee."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Full Name</Label>
                <Input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Employee full name"
                />
              </div>
              <div className="space-y-2">
                <Label>Mobile</Label>
                <Input
                  value={form.mobileNumber}
                  onChange={(e) =>
                    setForm({ ...form, mobileNumber: e.target.value })
                  }
                  placeholder="10-digit mobile number"
                />
              </div>
              <div className="space-y-2">
                <Label>Monthly Salary (₹)</Label>
                <Input
                  type="number"
                  value={form.monthlySalary}
                  onChange={(e) =>
                    setForm({ ...form, monthlySalary: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Date of Joining</Label>
                <Input
                  type="date"
                  value={form.dateOfJoining}
                  onChange={(e) =>
                    setForm({ ...form, dateOfJoining: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Office</Label>
                <Select
                  value={form.officeId}
                  onValueChange={(v) => setForm({ ...form, officeId: v ?? "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select office" />
                  </SelectTrigger>
                  <SelectContent>
                    {offices.map((o) => (
                      <SelectItem key={o._id} value={o._id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm({ ...form, status: v as EmployeeStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.status === "inactive" && (
                <div className="space-y-2">
                  <Label>Out Date</Label>
                  <Input
                    type="date"
                    value={form.outDate}
                    onChange={(e) =>
                      setForm({ ...form, outDate: e.target.value })
                    }
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.officeId}
              >
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <input ref={fileRef} type="file" className="hidden" />
        <input
          ref={importFileRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file);
            e.target.value = "";
          }}
        />
      </div>
    </TooltipProvider>
  );
}
