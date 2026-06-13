"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { api, getErrorMessage } from "@/lib/api";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/auth-storage";
import type { ApiResponse, AuthResponse, Permission, User } from "@/types";
import { hasPermission } from "@/lib/permissions";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  isSuperAdmin: boolean;
  hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchMe = useCallback(async () => {
    const accessToken = getAccessToken();
    const refreshToken = getRefreshToken();

    if (!accessToken && !refreshToken) {
      setLoading(false);
      return;
    }

    try {
      if (!accessToken && refreshToken) {
        const { data } = await api.post<
          ApiResponse<{ accessToken: string; refreshToken: string }>
        >("/auth/refresh", { refreshToken });
        const tokens = data.data!;
        setTokens(tokens.accessToken, tokens.refreshToken);
      }

      const { data } = await api.get<
        ApiResponse<{ user: User; accessToken: string }>
      >("/auth/me");
      const me = data.data;
      setUser(me?.user ?? null);
      if (me?.accessToken) {
        const refresh = getRefreshToken();
        if (refresh) {
          setTokens(me.accessToken, refresh);
        }
      }
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 401 || error.response?.status === 403)
      ) {
        clearTokens();
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (email: string, password: string): Promise<User> => {
    const { data } = await api.post<ApiResponse<AuthResponse>>("/auth/login", {
      email,
      password,
    });
    const payload = data.data!;
    setTokens(payload.accessToken, payload.refreshToken);
    setUser(payload.user);
    return payload.user;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore */
    }
    clearTokens();
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isSuperAdmin: user?.role === "super_admin",
        hasPermission: (permission) =>
          hasPermission(user?.permissions, permission, user?.role),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { getErrorMessage };
