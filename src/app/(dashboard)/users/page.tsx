"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  resolvePermissions,
  type Permission,
} from "@/lib/permissions";
import type { ApiResponse, Office } from "@/types";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDefaultRoute } from "@/lib/auth-route";
import { useAuth } from "@/providers/auth-provider";
import { PageHeader } from "@/components/layout/page-header";
import { accentCard } from "@/lib/theme";

const theme = accentCard("users");

interface SubAdmin {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  permissions: Permission[];
  assignedOfficeIds: Office[];
}

const emptyForm = {
  name: "",
  email: "",
  password: "",
  assignedOfficeIds: [] as string[],
  permissions: [...ALL_PERMISSIONS] as Permission[],
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { isSuperAdmin, hasPermission, loading, user } = useAuth();
  const canManageUsers = isSuperAdmin || hasPermission("users");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SubAdmin | null>(null);
  const [form, setForm] = useState(emptyForm);

  const assignablePermissions = isSuperAdmin
    ? ALL_PERMISSIONS
    : resolvePermissions(user?.permissions);

  const assignableOffices: Office[] = isSuperAdmin
    ? []
    : (user?.assignedOfficeIds ?? []).flatMap((office) =>
        typeof office === "string" ? [] : [office]
      );

  useEffect(() => {
    if (!loading && !canManageUsers) {
      router.replace(getDefaultRoute(user?.role, user?.permissions));
    }
  }, [loading, canManageUsers, user, router]);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<SubAdmin[]>>("/users");
      return data.data ?? [];
    },
    enabled: canManageUsers,
  });

  const { data: offices = [] } = useQuery({
    queryKey: ["offices"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Office[]>>("/offices");
      return data.data ?? [];
    },
    enabled: canManageUsers,
  });

  const officeOptions = isSuperAdmin
    ? offices
    : assignableOffices.length > 0
      ? assignableOffices
      : offices;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        email: form.email,
        assignedOfficeIds: form.assignedOfficeIds,
        permissions: form.permissions,
        role: "sub_admin" as const,
        ...(form.password ? { password: form.password } : {}),
      };
      if (editing) {
        await api.put(`/users/${editing._id}`, payload);
      } else {
        await api.post("/users", { ...payload, password: form.password });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(editing ? "Sub admin updated" : "Sub admin created");
      closeDialog();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Sub admin deleted");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const toggleOffice = (officeId: string) => {
    setForm((prev) => ({
      ...prev,
      assignedOfficeIds: prev.assignedOfficeIds.includes(officeId)
        ? prev.assignedOfficeIds.filter((id) => id !== officeId)
        : [...prev.assignedOfficeIds, officeId],
    }));
  };

  const togglePermission = (permission: Permission) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      permissions: [...assignablePermissions],
    });
    setOpen(true);
  };

  const openEdit = (user: SubAdmin) => {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      assignedOfficeIds: user.assignedOfficeIds.map((o) =>
        typeof o === "string" ? o : o._id
      ),
      permissions: user.permissions?.length ? user.permissions : [...ALL_PERMISSIONS],
    });
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  if (!canManageUsers) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        theme="users"
        title="Sub Admins"
        description="Create sub admins, assign offices, and set module permissions"
      >
        <Button onClick={openCreate}>
          <Plus className="size-4 mr-2" />
          Add Sub Admin
        </Button>
      </PageHeader>

      <Card className={theme.card}>
        <CardHeader className={theme.header}>
          <CardTitle>Sub Administrators</CardTitle>
          <CardDescription>Office-scoped access for salary operations</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Offices</TableHead>
                <TableHead>Permissions</TableHead>
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
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No sub admins yet
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.assignedOfficeIds
                        .map((o) => (typeof o === "string" ? o : o.name))
                        .join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {(user.permissions?.length ? user.permissions : ALL_PERMISSIONS).map(
                          (perm) => (
                            <Badge key={perm} variant="info" className="text-xs">
                              {PERMISSION_LABELS[perm]}
                            </Badge>
                          )
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "success" : "secondary"}>
                        {user.isActive ? "active" : "inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Delete ${user.name}?`)) {
                            deleteMutation.mutate(user._id);
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
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Sub Admin" : "Create Sub Admin"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{editing ? "New Password (optional)" : "Password"}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Assigned Offices</Label>
              <div className="flex flex-wrap gap-2 border rounded-md p-3 min-h-[80px]">
                {officeOptions.map((office) => (
                  <Button
                    key={office._id}
                    type="button"
                    size="sm"
                    variant={
                      form.assignedOfficeIds.includes(office._id)
                        ? "default"
                        : "outline"
                    }
                    onClick={() => toggleOffice(office._id)}
                  >
                    {office.name}
                  </Button>
                ))}
                {officeOptions.length === 0 && (
                  <span className="text-sm text-muted-foreground">
                    Create offices first
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Module Permissions</Label>
              <p className="text-xs text-muted-foreground">
                Choose which sections this sub admin can access
              </p>
              <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
                {assignablePermissions.map((permission) => (
                  <Button
                    key={permission}
                    type="button"
                    size="sm"
                    variant={
                      form.permissions.includes(permission) ? "default" : "outline"
                    }
                    className="justify-start"
                    onClick={() => togglePermission(permission)}
                  >
                    {PERMISSION_LABELS[permission]}
                  </Button>
                ))}
              </div>
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
                form.assignedOfficeIds.length === 0 ||
                form.permissions.length === 0 ||
                (!editing && !form.password)
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
