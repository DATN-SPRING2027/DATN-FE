import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, logoutSession } from "@/lib/api-client";
import {
  useCurrentUserQuery,
  useLoginMutation,
  useLogoutMutation,
  useRequestPasswordResetMutation,
  useRequestEmailRegistrationMutation,
  useCompletePasswordResetMutation,
} from "./useAuth";

vi.mock("@/lib/api-client", () => ({
  apiClient: vi.fn(),
  logoutSession: vi.fn(),
}));

const mockedApiClient = vi.mocked(apiClient);
const mockedLogoutSession = vi.mocked(logoutSession);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("auth query hooks", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
    mockedLogoutSession.mockReset();
  });

  it("fetches current user via useCurrentUserQuery", async () => {
    mockedApiClient.mockResolvedValue({
      id: "user-1",
      email: "engineer@continuum.ai",
      name: "Lead Engineer",
      organizationId: "org-1",
      roles: ["engineer"],
    });

    const { result } = renderHook(() => useCurrentUserQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.email).toBe("engineer@continuum.ai");
    expect(mockedApiClient).toHaveBeenCalledWith("/auth/me");
  });

  it("authenticates credentials via useLoginMutation", async () => {
    mockedApiClient.mockResolvedValue({
      user: {
        id: "user-1",
        email: "test@continuum.ai",
        name: "Test User",
        organizationId: "org-1",
        roles: ["engineer"],
      },
    });

    const { result } = renderHook(() => useLoginMutation(), {
      wrapper: createWrapper(),
    });

    await act(() =>
      result.current.mutateAsync({
        email: "test@continuum.ai",
        password: "password123",
      }),
    );

    expect(mockedApiClient).toHaveBeenCalledWith("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "test@continuum.ai",
        password: "password123",
      }),
    });
  });

  it("logs out via useLogoutMutation", async () => {
    mockedLogoutSession.mockResolvedValue(undefined);

    const { result } = renderHook(() => useLogoutMutation(), {
      wrapper: createWrapper(),
    });

    await act(() => result.current.mutateAsync());

    expect(mockedLogoutSession).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("requests a password reset through the BFF", async () => {
    mockedApiClient.mockResolvedValue({ status: "accepted" });
    const { result } = renderHook(() => useRequestPasswordResetMutation(), {
      wrapper: createWrapper(),
    });

    await act(() =>
      result.current.mutateAsync({ email: "person@example.com" }),
    );

    expect(mockedApiClient).toHaveBeenCalledWith(
      "/auth/password-reset/request",
      {
        method: "POST",
        body: JSON.stringify({ email: "person@example.com" }),
      },
    );
  });

  it("passes the non-secret invitation ID through email registration", async () => {
    mockedApiClient.mockResolvedValue({ status: "accepted" });
    const { result } = renderHook(() => useRequestEmailRegistrationMutation(), {
      wrapper: createWrapper(),
    });

    await act(() =>
      result.current.mutateAsync({
        fullName: "Invitee",
        email: "invitee@example.test",
        returnToInvitationId: "3123456789abcdef01234567",
      }),
    );

    expect(mockedApiClient).toHaveBeenCalledWith("/auth/registrations", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Invitee",
        email: "invitee@example.test",
        returnToInvitationId: "3123456789abcdef01234567",
      }),
    });
  });

  it("confirms a password reset through the BFF without replaying credentials", async () => {
    mockedApiClient.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCompletePasswordResetMutation(), {
      wrapper: createWrapper(),
    });

    await act(() =>
      result.current.mutateAsync({
        token: "a".repeat(43),
        password: "A-long-password-123",
      }),
    );

    expect(mockedApiClient).toHaveBeenCalledWith(
      "/auth/password-reset/confirm",
      {
        method: "POST",
        body: JSON.stringify({
          token: "a".repeat(43),
          password: "A-long-password-123",
        }),
      },
    );
  });
});
