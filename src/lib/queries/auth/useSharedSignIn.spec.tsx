import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadSignInSession, loginFromSharedForm } from "./sign-in-session";
import {
  useSharedLoginMutation,
  useSignInSessionQuery,
} from "./useSharedSignIn";
import { authKeys } from "./auth.keys";
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
describe("shared sign-in hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
  });
});
