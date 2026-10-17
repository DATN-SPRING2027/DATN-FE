import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useUpdateUserMutation, useUsersQuery } from "@/lib/queries/users/useUsers";
import { AppProviders } from "./AppProviders";
import { usePlatformOrganizationsQuery, usePlatformSessionQuery } from "@/lib/queries/platform/usePlatformConsole";

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
  return <span>{session.isError ? "platform-session-error" : "platform-session-loading"}</span>;
}

function PlatformDirectoryScreen() {
  const session = usePlatformSessionQuery();
  const organizations = usePlatformOrganizationsQuery(Boolean(session.data));
  return <span>{session.isError ? "platform-session-error" : organizations.isError ? "platform-directory-error" : "platform-directory-loading"}</span>;
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

    await waitFor(() => expect(screen.getByText("platform-session-error")).toBeInTheDocument());
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

    await waitFor(() => expect(screen.getByText("platform-session-error")).toBeInTheDocument());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    expect(platformMeCalls).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(4);
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
