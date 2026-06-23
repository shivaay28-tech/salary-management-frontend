"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDefaultRoute } from "@/lib/auth-route";
import { useAuth, getErrorMessage } from "@/providers/auth-provider";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && !submitting) {
      router.replace(getDefaultRoute(user.role, user.permissions));
    }
  }, [loading, user, submitting, router]);

  const handleLogin = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setErrorMessage("Username and password are required.");
      return;
    }

    setErrorMessage(null);
    setSubmitting(true);
    try {
      const loggedInUser = await login(trimmedUsername, password);
      toast.success("Welcome back!");
      router.replace(getDefaultRoute(loggedInUser.role, loggedInUser.permissions));
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || user) {
    return null;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-900 p-4">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900" />
      <div className="pointer-events-none absolute -left-20 top-20 size-72 rounded-full bg-zinc-700/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-20 size-72 rounded-full bg-zinc-600/15 blur-3xl" />

      <Card className="relative w-full max-w-md border-white/20 bg-white/95 shadow-2xl backdrop-blur-md">
        <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-violet-50">
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg">
            <Wallet className="size-6" />
          </div>
          <CardTitle className="text-xl">Salary Management System</CardTitle>
          <CardDescription>Sign in with your username and password</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void handleLogin();
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="admin"
                className="border-indigo-200 focus-visible:ring-indigo-400"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="border-indigo-200 pr-10 focus-visible:ring-indigo-400"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            <Button
              type="button"
              className="mt-1 w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
              disabled={submitting}
              onClick={() => void handleLogin()}
            >
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
