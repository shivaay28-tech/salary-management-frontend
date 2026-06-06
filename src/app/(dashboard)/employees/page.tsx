"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Upload, Download, Search, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { downloadExport } from "@/lib/export";
import { getPhotoUrl } from "@/lib/media";
import { getAccessToken } from "@/lib/auth-storage";
import type { ApiResponse, Employee, Office, EmployeeStatus } from "@/types";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/layout/page-header";
import { FilterSection } from "@/components/layout/filter-section";
import { StatusSegment } from "@/components/ui/status-segment";
import { accentCard } from "@/lib/theme";

const theme = accentCard("employees");

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

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [officeFilter, setOfficeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus>("active");
  const [appliedFilter, setAppliedFilter] = useState("all");
  const [appliedStatusFilter, setAppliedStatusFilter] =
    useState<EmployeeStatus>("active");

  const buildEmployeeQuery = (office: string, status: EmployeeStatus) => {
    const params = new URLSearchParams();
    if (office !== "all") params.set("officeId", office);
    params.set("status", status);
    return `?${params.toString()}`;
  };

  const { data: employees = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["employees", appliedFilter, appliedStatusFilter],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Employee[]>>(
        `/employees${buildEmployeeQuery(appliedFilter, appliedStatusFilter)}`
      );
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
    const token = getAccessToken();
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";
    const res = await fetch(`${base}/employees/${employeeId}/photo`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) throw new Error("Photo upload failed");
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

  const handleLoad = () => {
    setAppliedFilter(officeFilter);
    setAppliedStatusFilter(statusFilter);
    if (officeFilter === appliedFilter && statusFilter === appliedStatusFilter) {
      refetch();
    }
  };

  const totalEmployees = employees.length;
  const totalSalary = employees.reduce((sum, emp) => sum + emp.monthlySalary, 0);

  const formatRs = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

  return (
    <div className="space-y-6">
      <PageHeader
        theme="employees"
        title="Employees"
        description="Manage staff and monthly salary"
      >
        <Button variant="outline" onClick={handleExportExcel}>
          <Download className="size-4 mr-2" />
          Export Excel
        </Button>
        <Button onClick={openCreate}>
          <Plus className="size-4 mr-2" />
          Add Employee
        </Button>
      </PageHeader>

      <FilterSection theme="employees">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Office</Label>
              <Select value={officeFilter} onValueChange={(v) => setOfficeFilter(v ?? "all")}>
                <SelectTrigger className="w-52 bg-background">
                  <SelectValue placeholder="Filter office" />
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
            <div className="space-y-2">
              <Label>Status</Label>
              <StatusSegment
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as EmployeeStatus)}
              />
            </div>
            <Button onClick={handleLoad} disabled={isFetching}>
              <Search className="size-4 mr-2" />
              {isFetching ? "Loading..." : "Load"}
            </Button>
            <div className="ml-auto flex flex-wrap gap-3">
              <div className="flex min-w-[140px] items-center gap-3 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-500 to-teal-600 px-4 py-3 text-white shadow-md">
                <Users className="size-5 shrink-0 opacity-90" />
                <div>
                  <p className="text-xs text-white/85">Total Employees</p>
                  <p className="text-xl font-bold">{totalEmployees}</p>
                  <p className="text-[10px] text-white/75 capitalize">{appliedStatusFilter}</p>
                </div>
              </div>
              <div className="flex min-w-[160px] items-center gap-3 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-500 to-purple-600 px-4 py-3 text-white shadow-md">
                <Wallet className="size-5 shrink-0 opacity-90" />
                <div>
                  <p className="text-xs text-white/85">Total Salary</p>
                  <p className="text-xl font-bold">{formatRs(totalSalary)}</p>
                  <p className="text-[10px] text-white/75">monthly sum</p>
                </div>
              </div>
            </div>
          </div>
      </FilterSection>

      <Card className={theme.card}>
        <CardHeader className={theme.header}>
          <CardTitle>Employee List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Photo</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Office</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No employees yet
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((emp) => (
                  <TableRow key={emp._id}>
                    <TableCell>
                      <Avatar>
                        <AvatarImage src={getPhotoUrl(emp.photoUrl)} />
                        <AvatarFallback>{emp.fullName[0]}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{emp.fullName}</TableCell>
                    <TableCell>{getOfficeName(emp.officeId)}</TableCell>
                    <TableCell>₹{emp.monthlySalary.toLocaleString("en-IN")}</TableCell>
                    <TableCell>
                      <Badge variant={emp.status === "active" ? "success" : "secondary"}>
                        {emp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = "image/jpeg,image/png,image/webp";
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
                      >
                        <Upload className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Delete ${emp.fullName}?`)) {
                            deleteMutation.mutate(emp._id);
                          }
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Full Name</Label>
              <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Mobile</Label>
              <Input value={form.mobileNumber} onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Monthly Salary (₹)</Label>
              <Input type="number" value={form.monthlySalary} onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Date of Joining</Label>
              <Input type="date" value={form.dateOfJoining} onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Office</Label>
              <Select value={form.officeId} onValueChange={(v) => setForm({ ...form, officeId: v ?? "" })}>
                <SelectTrigger><SelectValue placeholder="Select office" /></SelectTrigger>
                <SelectContent>
                  {offices.map((o) => (
                    <SelectItem key={o._id} value={o._id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as EmployeeStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.status === "inactive" && (
              <div className="space-y-2">
                <Label>Out Date</Label>
                <Input type="date" value={form.outDate} onChange={(e) => setForm({ ...form, outDate: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.officeId}>
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <input ref={fileRef} type="file" className="hidden" />
    </div>
  );
}
