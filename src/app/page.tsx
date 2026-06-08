"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth-storage";
import { getDefaultRoute, parseTokenClaims } from "@/lib/auth-route";
import { useAuth } from "@/providers/auth-provider";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (user) {
      router.replace(getDefaultRoute(user.role, user.permissions));
      return;
    }

    const token = getAccessToken();
    if (token) {
      const claims = parseTokenClaims(token);
      router.replace(getDefaultRoute(claims?.role, claims?.permissions));
      return;
    }

    router.replace("/login");
  }, [loading, user, router]);

  return null;
}
