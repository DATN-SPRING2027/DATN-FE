import { cookies } from "next/headers";

const SERVER_SESSION_COOKIE_NAMES = [
  "continuum_access",
  "__Secure-refresh",
  "continuum_refresh",
  "__Host-csrf",
  "continuum_csrf",
  "csrf_token",
] as const;

export async function hasServerSessionCookie(): Promise<boolean> {
  const cookieStore = await cookies();
  return SERVER_SESSION_COOKIE_NAMES.some((name) => {
    const value = cookieStore.get(name)?.value;
    return Boolean(value && value.trim().length > 0);
  });
}
