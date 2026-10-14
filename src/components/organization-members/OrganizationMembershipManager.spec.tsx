import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { apiClient, ApiError } from "@/lib/api-client";
import OrganizationMembershipManager from "./OrganizationMembershipManager";

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const api = vi.mocked(apiClient);
const organizationId = "0123456789abcdef01234567";
const memberId = "1123456789abcdef01234567";
const userId = "2123456789abcdef01234567";
const invitationId = "3123456789abcdef01234567";
const user = { id: "9123456789abcdef01234567", email: "admin@example.com", name: "Viewer", organizationId, roles: ["MEMBER"] };

function membership(status: "PENDING_INVITE" | "ACTIVE" | "SUSPENDED" | "REMOVED", id = memberId) {
  return {
    id,
    organizationId,
    userId,
    status,
    version: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    user: { id: userId, fullName: "Alex Member", email: "alex@example.com", accountStatus: "ACTIVE" },
  };
}

function membershipPage(data = [membership("ACTIVE")]) {
  return { data, pagination: { page: 1, pageSize: 20, totalItems: data.length, totalPages: data.length ? 1 : 0 } };
}

function invitationPage(data: unknown[] = []) {
  return { data, pagination: { page: 1, pageSize: 20, totalItems: data.length, totalPages: data.length ? 1 : 0 } };
}

const invitation = {
  id: invitationId,
  membershipId: memberId,
  organizationId,
  status: "PENDING",
  version: 2,
  expiresAt: "2026-02-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  membershipVersion: 3,
  targetUserId: userId,
  email: "alex@example.com",
};

function mount() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">{children}</NextIntlClientProvider>
    </QueryClientProvider>
  );
  return { queryClient, ...render(<OrganizationMembershipManager />, { wrapper: Wrapper }) };
}

function respond(options: {
  memberships?: unknown;
  invitations?: unknown;
  currentUser?: unknown;
} = {}) {
  api.mockImplementation(async (endpoint) => {
    if (endpoint === "/auth/me") return options.currentUser ?? user;
    if (endpoint.includes("/memberships?")) return options.memberships ?? membershipPage();
    if (endpoint.includes("/invitations?")) return options.invitations ?? invitationPage();
    throw new Error(`Unexpected request ${endpoint}`);
  });
}

beforeEach(() => api.mockReset());
afterEach(() => vi.restoreAllMocks());

describe("Organization membership management page", () => {
  it("shows all four approved states and leaves authority to the server", async () => {
    respond({ memberships: membershipPage([
      membership("PENDING_INVITE"),
      membership("ACTIVE", "4123456789abcdef01234567"),
      membership("SUSPENDED", "5123456789abcdef01234567"),
      membership("REMOVED", "6123456789abcdef01234567"),
    ]) });
    mount();
    expect((await screen.findAllByText("Alex Member")).length).toBe(4);
    for (const status of ["Pending invite", "Active", "Suspended", "Removed"]) {
      expect(screen.getAllByText(status).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole("button", { name: "Suspend" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /remove|resume|reinvite/i })).not.toBeInTheDocument();
    expect(api).toHaveBeenCalledWith(
      `/iam/organizations/${organizationId}/memberships?page=1&pageSize=20`,
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("renders a permission denial as an error rather than an empty directory", async () => {
    api.mockImplementation(async (endpoint) => {
      if (endpoint === "/auth/me") return user;
      if (endpoint.includes("/memberships?")) throw new ApiError(403, "ORGANIZATION_MEMBERSHIP_FORBIDDEN", "Denied");
      return invitationPage();
    });
    mount();
    expect(await screen.findByText("You do not have permission to view or manage these Organization memberships.")).toBeVisible();
    expect(screen.queryByText("No memberships match this status.")).not.toBeInTheDocument();
  });

  it("hides cached membership rows when a later refresh is denied", async () => {
    let denied = false;
    api.mockImplementation(async (endpoint) => {
      if (endpoint === "/auth/me") return user;
      if (endpoint.includes("/memberships?")) {
        if (denied) throw new ApiError(403, "ORGANIZATION_MEMBERSHIP_FORBIDDEN", "Denied");
        return membershipPage();
      }
      return invitationPage();
    });
    const { queryClient } = mount();
    expect((await screen.findAllByText("Alex Member")).length).toBeGreaterThan(0);
    denied = true;
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["organization-memberships", user.id, organizationId] });
    });
    expect(await screen.findByText("You do not have permission to view or manage these Organization memberships.")).toBeVisible();
    expect(screen.queryByText("Alex Member")).not.toBeInTheDocument();
  });

  it("opens the invitation dialog but keeps submission blocked until readiness gates clear", async () => {
    respond({
      memberships: membershipPage([membership("PENDING_INVITE")]),
      invitations: invitationPage([invitation]),
    });
    mount();
    expect((await screen.findAllByText("alex@example.com")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Invite an existing user")).not.toBeInTheDocument();
    expect(screen.queryByText(/Invitation creation is currently paused/)).not.toBeInTheDocument();
    expect(screen.queryByText(/This list is read-only/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Invite user" }));
    const dialog = screen.getByRole("dialog", { name: "Invite user" });
    expect(within(dialog).getByLabelText("Email address")).toBeVisible();
    expect(within(dialog).getByLabelText("Reason")).toBeVisible();
    expect(within(dialog).getByText(/Sending invitations is unavailable until/)).toHaveAttribute("role", "status");
    fireEvent.change(within(dialog).getByLabelText("Email address"), { target: { value: "new-member@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "ACCESS_REQUEST" } });
    expect(within(dialog).getByRole("button", { name: "Send invite" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Resend invitation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel invitation" })).not.toBeInTheDocument();
    expect(api.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Invite user" })).not.toBeInTheDocument();
  });

  it("shows empty member and invitation states", async () => {
    respond({ memberships: membershipPage([]), invitations: invitationPage() });
    mount();
    expect(await screen.findByText("No memberships match this status.")).toBeVisible();
    expect(await screen.findByText("There are no pending invitations.")).toBeVisible();
  });

  it("shows the initial loading state while the authenticated context is unresolved", () => {
    api.mockImplementation(() => new Promise(() => undefined));
    mount();
    expect(screen.getByRole("status")).toHaveTextContent("Loading your Organization context…");
  });

  it("suspends an active membership only after the server acknowledges the contract request", async () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("__Host-csrf=csrf-value");
    let state: "ACTIVE" | "SUSPENDED" = "ACTIVE";
    api.mockImplementation(async (endpoint, options) => {
      if (endpoint === "/auth/me") return user;
      if (endpoint.includes("/memberships?")) return membershipPage([membership(state)]);
      if (endpoint.includes("/invitations?")) return invitationPage();
      if (endpoint.endsWith("/suspend") && options?.method === "POST") {
        state = "SUSPENDED";
        return {
          operationId: "7123456789abcdef01234567",
          membership: { id: memberId, organizationId, userId, status: state, version: 4 },
        };
      }
      throw new Error("Unexpected request");
    });
    mount();
    await screen.findAllByText("Alex Member");
    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
    const dialog = await screen.findByRole("dialog", { name: "Suspend Organization membership?" });
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "ACCESS_REVIEW" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText("The server accepted the request.")).toBeVisible();
    const suspendedLabels = await screen.findAllByText("Suspended");
    expect(suspendedLabels.some((label) => label.tagName === "SPAN")).toBe(true);
    const call = api.mock.calls.find(([endpoint, options]) => endpoint.endsWith("/suspend") && options?.method === "POST");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ expectedMembershipVersion: 3, reasonCode: "ACCESS_REVIEW" });
    expect(new Headers(call?.[1]?.headers).get("X-CSRF-Token")).toBe("csrf-value");
    expect(new Headers(call?.[1]?.headers).get("Idempotency-Key")).toMatch(/^[A-Za-z0-9._:-]{16,128}$/);
  });

  it("safely handles the last eligible ADMIN conflict without showing success", async () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("__Host-csrf=csrf-value");
    api.mockImplementation(async (endpoint, options) => {
      if (endpoint === "/auth/me") return user;
      if (endpoint.includes("/memberships?")) return membershipPage();
      if (endpoint.includes("/invitations?") && options?.method !== "POST") return invitationPage();
      if (endpoint.endsWith("/suspend") && options?.method === "POST") {
        throw new ApiError(409, "LAST_ELIGIBLE_ADMIN", "Not permitted");
      }
      return invitationPage();
    });
    mount();
    await screen.findAllByText("Alex Member");
    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
    const dialog = await screen.findByRole("dialog", { name: "Suspend Organization membership?" });
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "ACCESS_REVIEW" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
    expect(await within(dialog).findByText("The server did not allow this change because it would remove the last eligible ADMIN.")).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Keep current state" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Create invitation" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Account email")).not.toBeInTheDocument();
    expect(screen.getByText("Alex Member")).toBeVisible();
    expect(screen.queryByText("The server accepted the request.")).not.toBeInTheDocument();
    const call = api.mock.calls.find(([endpoint, options]) => endpoint.endsWith("/suspend") && options?.method === "POST");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ expectedMembershipVersion: 3, reasonCode: "ACCESS_REVIEW" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Refresh lists before a new action" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Suspend" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Create invitation" })).not.toBeInTheDocument();
  });

  it("does not offer self-suspend in the membership row", async () => {
    respond({ currentUser: { ...user, id: userId } });
    mount();
    await screen.findAllByText("Alex Member");
    expect(screen.queryByRole("button", { name: "Suspend" })).not.toBeInTheDocument();
  });

  it("shows an invitation read error and recovers on retry", async () => {
    let invitationReads = 0;
    api.mockImplementation(async (endpoint) => {
      if (endpoint === "/auth/me") return user;
      if (endpoint.includes("/memberships?")) return membershipPage([]);
      if (endpoint.includes("/invitations?")) {
        invitationReads += 1;
        if (invitationReads === 1) throw new ApiError(503, "IAM_MEMBERSHIP_DEPENDENCY_UNAVAILABLE", "Unavailable");
        return invitationPage();
      }
      throw new Error("Unexpected request");
    });
    mount();
    expect(await screen.findByText("Could not load pending invitations.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("There are no pending invitations.")).toBeVisible();
    expect(invitationReads).toBe(2);
  });

  it("does not query member data when the authenticated context has no Organization", async () => {
    respond({ currentUser: { id: user.id, email: user.email, name: user.name, context: "ACCOUNT" } });
    mount();
    expect(await screen.findByText("An active Organization membership is required to view this page.")).toBeVisible();
    await waitFor(() => expect(api).toHaveBeenCalledWith("/auth/me"));
    expect(api.mock.calls.some(([endpoint]) => endpoint.includes("/memberships?"))).toBe(false);
  });
});
