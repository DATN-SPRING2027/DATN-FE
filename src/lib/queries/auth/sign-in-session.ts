import {
  ApiError,
  apiClient,
  getAuthContextHint,
  setAuthContextHint,
} from "@/lib/api-client";
import {
  loadPlatformSession,
  type PlatformSession,
} from "../platform/usePlatformConsole";
import type { CurrentUserResponse, LoginInput, LoginResponse } from "./useAuth";

type PlatformLoginResponse = Readonly<{
  context: "PLATFORM";
  user: { id: string; email: string; name: string };
}>;
export type SharedLoginResponse = LoginResponse | PlatformLoginResponse;
export type SignInSession = CurrentUserResponse | PlatformSession;

export async function loginFromSharedForm(
  credentials: LoginInput,
): Promise<SharedLoginResponse> {
  // Always authenticate via standard /auth/login first (FE-PERF-005 + SEC-AUTH-003):
  // - Prevents wasted /auth/platform/login probes and 401/403 noise on normal user logins.
  // - Compatible with hardened uniform 401 responses from /auth/platform/login (SEC-AUTH-003).
  const accountLogin = await apiClient<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
    cache: "no-store",
  });

  if (
    credentials.organizationId ||
    accountLogin.user.context !== "ACCOUNT"
  ) {
    setAuthContextHint(null);
    return accountLogin;
  }

  // Platform Operators are provisioned separately without Organization memberships.
  // Only check /auth/platform/login when the authenticated account holds 0 organizations.
  let hasOrganizations = true;
  try {
    const organizations = await apiClient<readonly { id: string; name: string }[]>(
      "/auth/organizations",
      {
        cache: "no-store",
        skipSessionRecovery: true,
      },
    );
    hasOrganizations = Array.isArray(organizations) && organizations.length > 0;
  } catch {
    // Preserve the already-valid ACCOUNT session if the organization list probe fails transiently.
    setAuthContextHint(null);
    return accountLogin;
  }

  if (hasOrganizations) {
    setAuthContextHint(null);
    return accountLogin;
  }

  try {
    const platformLogin = await apiClient<PlatformLoginResponse>(
      "/auth/platform/login",
      {
        method: "POST",
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
        cache: "no-store",
      },
    );
    setAuthContextHint("PLATFORM");
    return platformLogin;
  } catch (error) {
    // A brand-new non-operator user with 0 organizations receives 401 (or legacy 403)
    // from /auth/platform/login while keeping their verified ACCOUNT session cookies intact.
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      setAuthContextHint(null);
      return accountLogin;
    }
    throw error;
  }
}

export async function loadSignInSession(): Promise<SignInSession> {
  if (getAuthContextHint() === "PLATFORM") {
    try {
      return await loadPlatformSession({ skipSessionRecovery: true });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      setAuthContextHint(null);
    }
    const user = await apiClient<CurrentUserResponse>("/auth/me", {
      cache: "no-store",
      skipSessionRecovery: true,
    });
    setAuthContextHint(null);
    return user;
  }

  try {
    const user = await apiClient<CurrentUserResponse>("/auth/me", {
      cache: "no-store",
      skipSessionRecovery: true,
    });
    setAuthContextHint(null);
    return user;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
  }
  return loadPlatformSession({ skipSessionRecovery: true });
}
