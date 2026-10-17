import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { focusManager, onlineManager, QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useUpdateUserMutation, useUsersQuery } from "@/lib/queries/users/useUsers";
import { AppProviders } from "./AppProviders";
import { usePlatformOrganizationsQuery, usePlatformSessionQuery } from "@/lib/queries/platform/usePlatformConsole";
import { platformSessionQueryKey } from "@/lib/queries/platform/platform-session.key";

const cachedPlatformSession = {
  id: "651a2b3c4d5e6f7a8b9c0d21",
  email: "old-operator@example.test",
  name: "Old Operator",
  context: "PLATFORM" as const,
  permissions: ["platform.organizations.organization.read"],
};
const cachedOrganizations = {
  data: [{
    id: "751a2b3c4d5e6f7a8b9c0d21",
    name: "Old Tenant",
    slug: "old-tenant",
    plan: "FREE",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
  }],
  pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
};

function reauthenticatedSession(id: string, email: string) {
  return {
    id,
    email,
    name: "Current Operator",
    context: "PLATFORM",
    permissions: ["platform.organizations.organization.read"],
  };
}

function currentOrganizations() {
  return {
    data: [{
      id: "851a2b3c4d5e6f7a8b9c0d21",
      name: "Current Tenant",
      slug: "current-tenant",
      plan: "ENTERPRISE",
      createdAt: "2026-10-03T00:00:00.000Z",
      updatedAt: "2026-10-04T00:00:00.000Z",
    }],
    pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
  };
}

function ProtectedScreen() {
  const currentUser = useCurrentUserQuery();
  const users = useUsersQuery(currentUser.data?.organizationId ?? "", {
    page: 1,
    pageSize: 20,
  });
  return (
    <>
      <span>{currentUser.isError ? "session-expired" : currentUser.data?.name}</span>
      <span>{users.isError ? "users-error" : "users-loading"}</span>
    </>
  );
}

function EditableScreen() {
  const currentUser = useCurrentUserQuery();
  const update = useUpdateUserMutation();
  return (
    <>
      <span>{currentUser.isError ? "session-expired" : currentUser.data?.name}</span>
      <button onClick={() => update.mutate({ userId: "user-2", fullName: "Changed" })}>Save</button>
    </>
  );
}

function PlatformSessionScreen() {
  const session = usePlatformSessionQuery();
  return <span>{session.isError ? "platform-session-error" : session.data === null ? "platform-session-expired" : "platform-session-loading"}</span>;
}

function PlatformDirectoryScreen() {
  const session = usePlatformSessionQuery();
  const verified = session.isSuccess && !session.isError && !session.isFetching ? session.data : undefined;
  const organizations = usePlatformOrganizationsQuery(Boolean(verified));
  return <span>{session.isError ? "platform-session-error" : session.data === null ? "platform-session-expired" : organizations.isError ? "platform-directory-error" : "platform-directory-loading"}</span>;
}

function createSeededPlatformClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(platformSessionQueryKey, cachedPlatformSession);
  client.setQueryData(["platform-console", "organizations", 1], cachedOrganizations, { updatedAt: 0 });
  return client;
}

function PlatformReauthScreen() {
  const client = useQueryClient();
  const session = usePlatformSessionQuery();
  const verified = session.isSuccess && !session.isError && !session.isFetching ? session.data : undefined;
  const organizations = usePlatformOrganizationsQuery(Boolean(verified));
  const status = session.isFetching
    ? "checking"
    : session.isError
      ? "error"
      : session.data === null
        ? "expired"
        : verified?.id ?? "unverified";
  return <>
    <button onClick={() => void session.refetch()}>revalidate</button>
    {session.isError && <button onClick={() => void session.refetch()}>retry-probe</button>}
    <span>{status}</span>
    <span>{verified ? organizations.data?.data[0]?.name : ""}</span>
    <span data-testid="cached-organization">{client.getQueryData(["platform-console", "organizations", 1]) ? "cached" : "cleared"}</span>
  </>;
}

describe("AppProviders", () => {
  afterEach(() => { vi.restoreAllMocks(); focusManager.setFocused(undefined); onlineManager.setOnline(true); });

  it("does not restart failed recovery on window focus or reconnect", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (url) =>
      new Response(JSON.stringify({ code: String(url).endsWith("/auth/refresh") ? "AUTH_CSRF_INVALID" : "AUTHENTICATION_FAILED" }),
        { status: String(url).endsWith("/auth/refresh") ? 403 : 401 }),
    );
    render(<AppProviders><EditableScreen /></AppProviders>);
    await waitFor(() => expect(screen.getByText("session-expired")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps a failed Platform session probe terminal instead of looping after 401/403", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const isRefresh = String(input).endsWith("/auth/refresh");
      return new Response(JSON.stringify({ code: isRefresh ? "AUTH_CSRF_INVALID" : "AUTHENTICATION_FAILED" }), {
        status: isRefresh ? 403 : 401,
      });
    });

    render(<AppProviders><PlatformSessionScreen /></AppProviders>);

    await waitFor(() => expect(screen.getByText("platform-session-expired")).toBeInTheDocument());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rechecks Platform identity once after a protected Platform endpoint loses its session", async () => {
    let platformMeCalls = 0;
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/auth/platform/me")) {
        platformMeCalls += 1;
        return new Response(JSON.stringify(platformMeCalls === 1
          ? { id: "651a2b3c4d5e6f7a8b9c0d21", email: "operator@example.test", name: "Operator", context: "PLATFORM", permissions: ["platform.organizations.organization.read"] }
          : { code: "AUTHENTICATION_FAILED" }), { status: platformMeCalls === 1 ? 200 : 401 });
      }
      if (url.includes("/iam/platform/organizations")) {
        return new Response(JSON.stringify({ code: "AUTHENTICATION_FAILED" }), { status: 401 });
      }
      return new Response(JSON.stringify({ code: "AUTH_CSRF_INVALID" }), { status: 403 });
    });

    render(<AppProviders><PlatformDirectoryScreen /></AppProviders>);

    await waitFor(() => expect(screen.getByText("platform-session-expired")).toBeInTheDocument());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    expect(platformMeCalls).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("hides and clears cached Platform data during re-authentication, then loads the newly verified identity", async () => {
    let resolveProbe!: (response: Response) => void;
    let resolveOldOrganizationRequest!: (response: Response) => void;
    let organizationCalls = 0;
    const oldOrganizationRequest: { signal: AbortSignal | null } = { signal: null };
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/platform/me")) return new Promise((resolve) => { resolveProbe = resolve; });
      if (url.includes("/iam/platform/organizations?")) {
        organizationCalls += 1;
        if (organizationCalls === 1) {
          oldOrganizationRequest.signal = (init?.signal as AbortSignal | null | undefined) ?? null;
          return new Promise((resolve) => { resolveOldOrganizationRequest = resolve; });
        }
        return Promise.resolve(new Response(JSON.stringify(currentOrganizations())));
      }
      return Promise.resolve(new Response("{}", { status: 500 }));
    });

    render(<QueryClientProvider client={createSeededPlatformClient()}><PlatformReauthScreen /></QueryClientProvider>);
    expect(await screen.findByText("Old Tenant")).toBeInTheDocument();
    await waitFor(() => expect(organizationCalls).toBe(1));
    fireEvent.click(screen.getByText("revalidate"));

    await waitFor(() => expect(screen.getByText("checking")).toBeInTheDocument());
    expect(screen.queryByText("Old Tenant")).not.toBeInTheDocument();
    expect(screen.getByTestId("cached-organization")).toHaveTextContent("cleared");
    expect(oldOrganizationRequest.signal?.aborted).toBe(true);

    await act(async () => {
      resolveProbe(new Response(JSON.stringify(reauthenticatedSession("951a2b3c4d5e6f7a8b9c0d21", "new-operator@example.test"))));
    });

    expect(await screen.findByText("Current Tenant")).toBeInTheDocument();
    expect(screen.getByText("951a2b3c4d5e6f7a8b9c0d21")).toBeInTheDocument();
    await act(async () => { resolveOldOrganizationRequest(new Response(JSON.stringify(cachedOrganizations))); });
    expect(screen.queryByText("Old Tenant")).not.toBeInTheDocument();
    expect(organizationCalls).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/iam/platform/organizations?page=1&pageSize=100",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("clears the Platform resource cache and routes a 401 session probe to the expired state", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/auth/platform/me")) return Promise.resolve(new Response(JSON.stringify({ code: "AUTHENTICATION_FAILED" }), { status: 401 }));
      if (url.endsWith("/auth/refresh")) return Promise.resolve(new Response(JSON.stringify({ code: "AUTHENTICATION_FAILED" }), { status: 401 }));
      return Promise.resolve(new Response("{}", { status: 500 }));
    });

    render(<QueryClientProvider client={createSeededPlatformClient()}><PlatformReauthScreen /></QueryClientProvider>);
    expect(await screen.findByText("Old Tenant")).toBeInTheDocument();
    fireEvent.click(screen.getByText("revalidate"));

    expect(await screen.findByText("expired")).toBeInTheDocument();
    expect(screen.queryByText("Old Tenant")).not.toBeInTheDocument();
    expect(screen.getByTestId("cached-organization")).toHaveTextContent("cleared");
    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/auth/platform/me") || String(input).endsWith("/auth/refresh"))).toHaveLength(2);
  });

  it("keeps transient probe failures retryable without showing stale organizations", async () => {
    let probeCalls = 0;
    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/auth/platform/me")) {
        probeCalls += 1;
        return probeCalls === 1
          ? Promise.reject(new TypeError("Failed to fetch"))
          : Promise.resolve(new Response(JSON.stringify(reauthenticatedSession("a51a2b3c4d5e6f7a8b9c0d21", "new-operator@example.test"))));
      }
      if (url.includes("/iam/platform/organizations?")) return Promise.resolve(new Response(JSON.stringify(currentOrganizations())));
      return Promise.resolve(new Response("{}", { status: 500 }));
    });

    render(<QueryClientProvider client={createSeededPlatformClient()}><PlatformReauthScreen /></QueryClientProvider>);
    expect(await screen.findByText("Old Tenant")).toBeInTheDocument();
    fireEvent.click(screen.getByText("revalidate"));

    expect(await screen.findByText("error")).toBeInTheDocument();
    expect(screen.queryByText("Old Tenant")).not.toBeInTheDocument();
    expect(screen.getByTestId("cached-organization")).toHaveTextContent("cleared");

    fireEvent.click(screen.getByText("retry-probe"));
    expect(await screen.findByText("Current Tenant")).toBeInTheDocument();
    expect(screen.queryByText("Old Tenant")).not.toBeInTheDocument();
    expect(probeCalls).toBe(2);
  });

  it("rechecks a successful /auth/me session after a Users 401", async () => {
    let meCalls = 0;
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/auth/me")) {
        meCalls += 1;
        return Promise.resolve(new Response(JSON.stringify(
          meCalls === 1
            ? { id: "admin", name: "Admin", organizationId: "org-1", email: "admin@example.test", roles: ["ADMIN"] }
            : { code: "AUTHENTICATION_FAILED", message: "Expired" },
        ), { status: meCalls === 1 ? 200 : 401 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ code: "AUTHENTICATION_FAILED", message: "Expired" }), { status: 401 }));
    });

    render(<AppProviders><ProtectedScreen /></AppProviders>);

    await waitFor(() => expect(screen.getByText("session-expired")).toBeInTheDocument());
    expect(meCalls).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/iam/users?"),
      expect.any(Object),
    );
  });

  it("rechecks /auth/me after a User update receives 401", async () => {
    let meCalls = 0;
    vi.spyOn(global, "fetch").mockImplementation((input) => {
      if (String(input).endsWith("/auth/me")) {
        meCalls += 1;
        return Promise.resolve(new Response(JSON.stringify(
          meCalls === 1
            ? { id: "admin", name: "Admin", organizationId: "org-1", email: "admin@example.test", roles: ["ADMIN"] }
            : { code: "AUTHENTICATION_FAILED", message: "Expired" },
        ), { status: meCalls === 1 ? 200 : 401 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ code: "AUTHENTICATION_FAILED", message: "Expired" }), { status: 401 }));
    });

    render(<AppProviders><EditableScreen /></AppProviders>);
    await waitFor(() => expect(screen.getByText("Admin")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(screen.getByText("session-expired")).toBeInTheDocument());
    expect(meCalls).toBe(2);
  });
});
