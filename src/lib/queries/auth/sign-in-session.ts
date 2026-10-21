import { ApiError, apiClient } from "@/lib/api-client";
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
  try {
    return await apiClient<PlatformLoginResponse>("/auth/platform/login", {
      method: "POST",
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
      cache: "no-store",
    });
  } catch (error) {
    // Only the existing server permission denial permits account login.
    // Invalid credentials, throttling and unavailable authorization fail closed.
    if (
      !(error instanceof ApiError) ||
      error.status !== 403 ||
      error.code !== "FORBIDDEN"
    )
      throw error;
  }
  return apiClient<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export async function loadSignInSession(): Promise<SignInSession> {
  try {
    return await loadPlatformSession();
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
  }
  return apiClient<CurrentUserResponse>("/auth/me");
}
