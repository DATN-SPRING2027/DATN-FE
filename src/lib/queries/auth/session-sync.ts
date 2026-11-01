export const AUTH_SESSION_CHANGE_STORAGE_KEY = "continuum:auth-session-change";

const LOCAL_SESSION_CHANGE_EVENT = "continuum:auth-session-change-local";
const CSRF_COOKIE_PREFIX = "__Host-csrf=";

function readCsrfCookie(): string | null {
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(CSRF_COOKIE_PREFIX));
  return cookie?.slice(CSRF_COOKIE_PREFIX.length) ?? null;
}

export function notifyAuthSessionChanged(): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new Event(LOCAL_SESSION_CHANGE_EVENT));

  try {
    const marker = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    window.localStorage.setItem(AUTH_SESSION_CHANGE_STORAGE_KEY, marker);
  } catch {
    // Cookie comparison on focus remains available if browser storage is disabled.
  }
}

export function subscribeToAuthSessionChanges(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  let csrfCookie = readCsrfCookie();
  const handleSessionChange = () => {
    csrfCookie = readCsrfCookie();
    onChange();
  };
  const checkCookieSession = () => {
    const currentCookie = readCsrfCookie();
    if (currentCookie === csrfCookie) return;
    csrfCookie = currentCookie;
    onChange();
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === AUTH_SESSION_CHANGE_STORAGE_KEY) handleSessionChange();
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") checkCookieSession();
  };

  window.addEventListener(LOCAL_SESSION_CHANGE_EVENT, handleSessionChange);
  window.addEventListener("storage", handleStorage);
  window.addEventListener("focus", checkCookieSession);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    window.removeEventListener(LOCAL_SESSION_CHANGE_EVENT, handleSessionChange);
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("focus", checkCookieSession);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}
