import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useUpdateUserMutation, useUsersQuery } from "@/lib/queries/users/useUsers";
import { AppProviders } from "./AppProviders";

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

describe("AppProviders", () => {
  afterEach(() => vi.restoreAllMocks());

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
