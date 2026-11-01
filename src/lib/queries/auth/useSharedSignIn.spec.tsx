import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { loadSignInSession, loginFromSharedForm } from "./sign-in-session";
import {
  useSharedLoginMutation,
  useSignInSessionQuery,
} from "./useSharedSignIn";
import { authKeys } from "./auth.keys";
import { AUTH_SESSION_CHANGE_STORAGE_KEY } from "./session-sync";
vi.mock("./sign-in-session", () => ({
  loadSignInSession: vi.fn(),
  loginFromSharedForm: vi.fn(),
}));
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

function ChildSessionConsumer() {
  const session = useSignInSessionQuery();
  if (session.isPending) return <span data-testid="child-pending">loading</span>;
  return (
    <span data-testid="child-ready">
      {session.data ? "authenticated" : "guest"}
    </span>
  );
}

function ParentSessionGate() {
  const session = useSignInSessionQuery();
  if (session.isPending) return <span data-testid="parent-pending">loading</span>;
  return <ChildSessionConsumer />;
}

describe("shared sign-in hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.removeItem(AUTH_SESSION_CHANGE_STORAGE_KEY);
  });
  it("loads the actual cookie context when the sign-in page opens", async () => {
    vi.mocked(loadSignInSession).mockResolvedValue({
      id: "operator",
      name: "Operator",
      email: "op@example.test",
      context: "PLATFORM",
      permissions: [],
    });
    const { wrapper } = setup();
    const { result } = renderHook(useSignInSessionQuery, { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.context).toBe("PLATFORM");
  });
  it("does not enter a refetch loop when a child observer mounts after a failed session probe", async () => {
    vi.mocked(loadSignInSession).mockRejectedValue(
      new ApiError(403, "AUTH_CSRF_INVALID", "Session recovery failed", undefined, true),
    );
    const { wrapper } = setup();
    render(<ParentSessionGate />, { wrapper });

    await waitFor(() =>
      expect(screen.getByTestId("child-ready")).toHaveTextContent("guest"),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(loadSignInSession).toHaveBeenCalledTimes(1);
  });
  it("does not fire duplicate requests when a child observer mounts after a successful session probe", async () => {
    vi.mocked(loadSignInSession).mockResolvedValue({
      id: "operator",
      name: "Operator",
      email: "op@example.test",
      context: "PLATFORM",
      permissions: [],
    });
    const { wrapper } = setup();
    render(<ParentSessionGate />, { wrapper });

    await waitFor(() =>
      expect(screen.getByTestId("child-ready")).toHaveTextContent("authenticated"),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(loadSignInSession).toHaveBeenCalledTimes(1);
  });
  it("clears prior account and platform cache before verifying a new login", async () => {
    const { client, wrapper } = setup();
    client.setQueryData(["users"], [{ id: "private-user" }]);
    client.setQueryData(["platform-console", "session"], {
      id: "old-operator",
    });
    client.setQueryData(authKeys.session(), null);
    vi.mocked(loginFromSharedForm).mockResolvedValue({
      context: "PLATFORM",
      user: { id: "operator", name: "Operator", email: "op@example.test" },
    });
    const { result } = renderHook(useSharedLoginMutation, { wrapper });
    await act(() =>
      result.current.mutateAsync({
        email: "op@example.test",
        password: "secret",
      }),
    );
    expect(client.getQueryData(["users"])).toBeUndefined();
    expect(
      client.getQueryData(["platform-console", "session"]),
    ).toBeUndefined();
    expect(client.getQueryData(authKeys.session())).toBeNull();
    expect(window.localStorage.getItem(AUTH_SESSION_CHANGE_STORAGE_KEY)).toBeTruthy();
  });
});
