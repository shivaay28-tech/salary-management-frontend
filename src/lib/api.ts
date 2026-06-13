import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./auth-storage";
import type { ApiResponse } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001/api";

export { API_URL };

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

function isPublicAuthRequest(url?: string): boolean {
  return !!url?.includes("/auth/login") || !!url?.includes("/auth/refresh");
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (isPublicAuthRequest(config.url)) {
    delete config.headers.Authorization;
    return config;
  }

  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else if (token) prom.resolve(token);
  });
  failedQueue = [];
}

function redirectToLoginIfNeeded() {
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    if (!error.config) {
      return Promise.reject(error);
    }

    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isPublicAuthRequest(original.url)) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          },
          reject,
        });
      });
    }

    original._retry = true;
    isRefreshing = true;
    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      clearTokens();
      redirectToLoginIfNeeded();
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
        `${API_URL}/auth/refresh`,
        { refreshToken }
      );
      const tokens = data.data!;
      setTokens(tokens.accessToken, tokens.refreshToken);
      processQueue(null, tokens.accessToken);
      original.headers.Authorization = `Bearer ${tokens.accessToken}`;
      return api(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearTokens();
      redirectToLoginIfNeeded();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (message) return message;

    if (!error.response) {
      if (error.code === "ECONNABORTED") {
        return "Request timed out. Please try again.";
      }
      return "Unable to reach the server. Check your connection and that the API is running.";
    }

    const status = error.response.status;
    switch (status) {
      case 401:
        return "Invalid email or password.";
      case 403:
        return "You do not have permission to perform this action.";
      case 404:
        return "The requested resource was not found.";
      case 500:
        return "Server error. Please try again later.";
      default:
        return error.message || `Request failed (${status}).`;
    }
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

export async function apiDownload(
  path: string,
  params: Record<string, string | number | undefined>
): Promise<{ blob: Blob; filename: string }> {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) search.set(k, String(v));
  });
  const qs = search.toString();
  const url = qs ? `${path}?${qs}` : path;

  try {
    const response = await api.get(url, { responseType: "blob" });
    const disposition = response.headers["content-disposition"] as string | undefined;
    const match = disposition?.match(/filename="(.+)"/);
    const filename = match?.[1] ?? "export";
    return { blob: response.data as Blob, filename };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      const text = await error.response.data.text();
      let message = `Download failed (${error.response.status})`;
      try {
        const body = JSON.parse(text) as { message?: string };
        if (body.message) message = body.message;
      } catch {
        /* use default message */
      }
      throw new Error(message);
    }
    throw error;
  }
}
