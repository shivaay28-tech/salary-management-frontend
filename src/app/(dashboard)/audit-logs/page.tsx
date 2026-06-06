"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ApiResponse, AuditLog } from "@/types";
import { PageHeader } from "@/components/layout/page-header";
import { accentCard } from "@/lib/theme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AuditLogsPage() {
  const { isSuperAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isSuperAdmin) router.replace("/dashboard");
  }, [loading, isSuperAdmin, router]);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AuditLog[]>>("/audit-logs?limit=200");
      return data.data ?? [];
    },
    enabled: isSuperAdmin,
  });

  if (!isSuperAdmin) return null;

  const theme = accentCard("audit");

  return (
    <div className="space-y-6">
      <PageHeader
        theme="audit"
        title="Audit Logs"
        description="System activity trail (Super Admin)"
      />
      <Card className={theme.card}>
        <CardHeader className={theme.header}>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Module</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log._id}>
                    <TableCell className="text-sm">
                      {new Date(log.createdAt).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell>{log.userEmail}</TableCell>
                    <TableCell className="font-medium">{log.action}</TableCell>
                    <TableCell>{log.module}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
