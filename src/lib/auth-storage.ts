import Cookies from "js-cookie";

const ACCESS_KEY = "sms_access_token";
const REFRESH_KEY = "sms_refresh_token";

function cookieOptions() {
  return {
    expires: undefined as number | undefined,
    path: "/",
    sameSite: "lax" as const,
    secure:
      typeof window !== "undefined" && window.location.protocol === "https:",
  };
}

export function getAccessToken(): string | undefined {
  return Cookies.get(ACCESS_KEY);
}

export function getRefreshToken(): string | undefined {
  return Cookies.get(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  const base = cookieOptions();
  Cookies.set(ACCESS_KEY, accessToken, { ...base, expires: 1 / 96 });
  Cookies.set(REFRESH_KEY, refreshToken, { ...base, expires: 7 });
}

export function clearTokens(): void {
  const base = { path: "/" };
  Cookies.remove(ACCESS_KEY, base);
  Cookies.remove(REFRESH_KEY, base);
}
