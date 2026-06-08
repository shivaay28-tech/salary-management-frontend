import Cookies from "js-cookie";

const ACCESS_KEY = "sms_access_token";
const REFRESH_KEY = "sms_refresh_token";

export function getAccessToken(): string | undefined {
  return Cookies.get(ACCESS_KEY);
}

export function getRefreshToken(): string | undefined {
  return Cookies.get(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  Cookies.set(ACCESS_KEY, accessToken, { expires: 1, sameSite: "lax" });
  Cookies.set(REFRESH_KEY, refreshToken, { expires: 7, sameSite: "lax" });
}

export function clearTokens(): void {
  Cookies.remove(ACCESS_KEY);
  Cookies.remove(REFRESH_KEY);
}
