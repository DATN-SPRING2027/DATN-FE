import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { apiClient, ApiError } from "@/lib/api-client";
import { organizationMembershipReadiness } from "@/lib/queries/organization-memberships/organization-membership-readiness";
import OrganizationMembershipManager from "./OrganizationMembershipManager";

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock("@/icons", () => ({
  GroupIcon: () => null,
  MailIcon: () => null,
  MoreDotIcon: () => null,
  UserIcon: () => null,
}));

const api = vi.mocked(apiClient);
const invitationReadiness = organizationMembershipReadiness.invitationCommands as unknown as { status: "READY" | "BLOCKED"; gates: readonly string[] };
const organizationId = "0123456789abcdef01234567";
const memberId = "1123456789abcdef01234567";
const userId = "2123456789abcdef01234567";
const invitationId = "3123456789abcdef01234567";
const user = { id: "9123456789abcdef01234567", email: "admin@example.com", name: "Viewer", organizationId, roles: ["ADMIN"] };

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

function mutationAck(status: "PENDING_INVITE" | "ACTIVE" | "SUSPENDED" | "REMOVED" = "PENDING_INVITE") {
  return {
    operationId: "7123456789abcdef01234567",
    membership: { id: memberId, organizationId, userId, status, version: 4 },
  };
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

function openMemberMenu(action = "Suspend") {
  fireEvent.click(screen.getByRole("button", { name: "Member actions for Alex Member" }));
  fireEvent.click(screen.getByRole("menuitem", { name: action }));
}

beforeEach(() => {
  api.mockReset();
  invitationReadiness.status = "BLOCKED";
});
afterEach(() => {
  vi.restoreAllMocks();
  invitationReadiness.status = "BLOCKED";
});

describe("Organization membership management page", () => {
  it("separates membership and invitation records into accessible tabs", async () => {
    respond({
      memberships: membershipPage(),
      invitations: invitationPage([{ ...invitation, email: "pending@example.com" }]),
    });
    mount();

    const membersTab = await screen.findByRole("tab", { name: /Members/ });
    expect(membersTab).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("pending@example.com")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Invitations/ }));
    expect(await screen.findByText("pending@example.com")).toBeVisible();
    expect(screen.getByRole("tab", { name: /Invitations/ })).toHaveAttribute("aria-selected", "true");
  });

  it("opens a keyboard-accessible member action menu with only supported actions", async () => {
    respond();
    mount();
    await screen.findByText("Alex Member");

    const trigger = screen.getByRole("button", { name: "Member actions for Alex Member" });
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu", { name: "Member actions for Alex Member" });
    expect(within(menu).getByRole("menuitem", { name: "Suspend" })).toBeVisible();
    expect(within(menu).queryByRole("menuitem", { name: /remove|reactivate/i })).not.toBeInTheDocument();

    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("opens the member action menu and focuses its first action with Arrow Down", async () => {
    respond();
    mount();
    await screen.findByText("Alex Member");

    fireEvent.keyDown(screen.getByRole("button", { name: "Member actions for Alex Member" }), { key: "ArrowDown" });
    const action = await screen.findByRole("menuitem", { name: "Suspend" });
    await waitFor(() => expect(action).toHaveFocus());
  });

  it("closes the action menu on Tab without preventing normal focus navigation", async () => {
    respond();
    mount();
    await screen.findByText("Alex Member");

    fireEvent.click(screen.getByRole("button", { name: "Member actions for Alex Member" }));
    const action = await screen.findByRole("menuitem", { name: "Suspend" });
    const tabEvent = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    fireEvent(action, tabEvent);

    expect(tabEvent.defaultPrevented).toBe(false);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("keeps one page title and uses the server-paginated count in a responsive membership table", async () => {
    const page = membershipPage();
    respond({ memberships: { ...page, pagination: { ...page.pagination, totalItems: 42, totalPages: 3 } } });
    mount();

    expect(await screen.findByText("42 results")).toBeVisible();
    expect(screen.getAllByRole("heading", { name: "Members" })).toHaveLength(1);
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb).toBeVisible();
    expect(within(breadcrumb).getByText("Organization")).toBeVisible();
    expect(within(breadcrumb).getByText("Members")).toBeVisible();
    expect(screen.getByText("AM")).toBeVisible();
    const table = screen.getByRole("table");
    expect(table).toHaveClass("table-fixed");
    expect(within(table).getAllByRole("row").at(-1)).toHaveClass("grid", "lg:table-row");
  });

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
    expect(screen.getByRole("button", { name: "Member actions for Alex Member" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /remove|reactivate|reinvite/i })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).queryByText("Role")).not.toBeInTheDocument();
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
    await screen.findByRole("tab", { name: /Members/ });
    fireEvent.click(screen.getByRole("tab", { name: /Invitations/ }));
    expect((await screen.findAllByText("alex@example.com")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Invite an existing user")).not.toBeInTheDocument();
    expect(screen.queryByText(/Invitation creation is currently paused/)).not.toBeInTheDocument();
    expect(screen.queryByText(/This list is read-only/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Invite member" }));
    const dialog = screen.getByRole("dialog", { name: "Invite member" });
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
    expect(screen.queryByRole("dialog", { name: "Invite member" })).not.toBeInTheDocument();
  });

  it("submits the existing email and reason payload when invitation readiness is approved", async () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("__Host-csrf=csrf-value");
    invitationReadiness.status = "READY";
    api.mockImplementation(async (endpoint, options) => {
      if (endpoint === "/auth/me") return user;
      if (endpoint.includes("/memberships?")) return membershipPage([]);
      if (endpoint.includes("/invitations?") && options?.method !== "POST") return invitationPage();
      if (endpoint === `/iam/organizations/${organizationId}/invitations` && options?.method === "POST") return mutationAck();
      throw new Error(`Unexpected request ${endpoint}`);
    });
    mount();
    await screen.findByRole("tab", { name: /Members/ });
    fireEvent.click(screen.getByRole("button", { name: "Invite member" }));
    const dialog = screen.getByRole("dialog", { name: "Invite member" });
    fireEvent.change(within(dialog).getByLabelText("Email address"), { target: { value: "  new-member@example.com  " } });
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "ACCESS_REQUEST" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send invite" }));

    expect(await screen.findByText("The server accepted the invitation request.")).toBeVisible();
    const call = api.mock.calls.find(([endpoint, options]) => endpoint === `/iam/organizations/${organizationId}/invitations` && options?.method === "POST");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ email: "new-member@example.com", reasonCode: "ACCESS_REQUEST" });
    expect(new Headers(call?.[1]?.headers).get("X-CSRF-Token")).toBe("csrf-value");
    expect(new Headers(call?.[1]?.headers).get("Idempotency-Key")).toMatch(/^[A-Za-z0-9._:-]{16,128}$/);
  });

  it("cancels a pending invitation through its existing versioned API after confirmation", async () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("__Host-csrf=csrf-value");
    invitationReadiness.status = "READY";
    let invitationStatus: "PENDING" | "CANCELLED" = "PENDING";
    api.mockImplementation(async (endpoint, options) => {
      if (endpoint === "/auth/me") return user;
      if (endpoint.includes("/memberships?")) return membershipPage([]);
      if (endpoint.includes("/invitations?") && options?.method !== "POST") {
        return invitationPage([{ ...invitation, email: "pending@example.com", status: invitationStatus }]);
      }
      if (endpoint.endsWith(`/invitations/${invitationId}/cancel`) && options?.method === "POST") {
        invitationStatus = "CANCELLED";
        return mutationAck();
      }
      throw new Error(`Unexpected request ${endpoint}`);
    });
    mount();
    await screen.findByRole("tab", { name: /Members/ });
    fireEvent.click(screen.getByRole("tab", { name: /Invitations/ }));
    await screen.findByText("pending@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Invitation actions for pending@example.com" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Cancel invitation" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel invitation?" });
    expect(within(dialog).getByText("pending@example.com")).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep invitation" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.mock.calls.some(([endpoint, options]) => endpoint.endsWith(`/invitations/${invitationId}/cancel`) && options?.method === "POST")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Invitation actions for pending@example.com" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Cancel invitation" }));
    const reopenedDialog = screen.getByRole("dialog", { name: "Cancel invitation?" });
    fireEvent.click(within(reopenedDialog).getByRole("button", { name: "Cancel invitation" }));

    expect(await screen.findByText("The server accepted the request.")).toBeVisible();
    expect(await screen.findByText("Cancelled")).toBeVisible();
    const call = api.mock.calls.find(([endpoint, options]) => endpoint.endsWith(`/invitations/${invitationId}/cancel`) && options?.method === "POST");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ expectedMembershipVersion: 3, expectedInvitationVersion: 2, reasonCode: "INVITATION_CANCELLED" });
    expect(new Headers(call?.[1]?.headers).get("X-CSRF-Token")).toBe("csrf-value");
  });

  it("resends a pending invitation with the selected documented reason", async () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("__Host-csrf=csrf-value");
    invitationReadiness.status = "READY";
    api.mockImplementation(async (endpoint, options) => {
      if (endpoint === "/auth/me") return user;
      if (endpoint.includes("/memberships?")) return membershipPage([]);
      if (endpoint.includes("/invitations?") && options?.method !== "POST") return invitationPage([{ ...invitation, email: "pending@example.com" }]);
      if (endpoint.endsWith(`/invitations/${invitationId}/resend`) && options?.method === "POST") return mutationAck();
      throw new Error(`Unexpected request ${endpoint}`);
    });
    mount();
    await screen.findByRole("tab", { name: /Members/ });
    fireEvent.click(screen.getByRole("tab", { name: /Invitations/ }));
    await screen.findByText("pending@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Invitation actions for pending@example.com" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Resend invitation" }));
    const dialog = screen.getByRole("dialog", { name: "Resend invitation?" });
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "ACCESS_REVIEW" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Resend invitation" }));

    expect(await screen.findByText("The server accepted the request.")).toBeVisible();
    const call = api.mock.calls.find(([endpoint, options]) => endpoint.endsWith(`/invitations/${invitationId}/resend`) && options?.method === "POST");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ expectedMembershipVersion: 3, expectedInvitationVersion: 2, reasonCode: "ACCESS_REVIEW" });
    expect(new Headers(call?.[1]?.headers).get("X-CSRF-Token")).toBe("csrf-value");
  });

  it("shows empty member and invitation states", async () => {
    respond({ memberships: membershipPage([]), invitations: invitationPage() });
    mount();
    expect(await screen.findByText("No members yet")).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: /Invitations/ }));
    expect(await screen.findByText("No pending invitations")).toBeVisible();
    expect(screen.getByText("Invitations awaiting a response appear here.")).toBeVisible();
  });

  it("shows the initial loading state while the authenticated context is unresolved", () => {
    api.mockImplementation(() => new Promise(() => undefined));
    mount();
    expect(screen.getByRole("status")).toHaveTextContent("Loading your Organization context…");
  });

  it("shows separate loading states while the member and invitation reads are pending", async () => {
    api.mockImplementation(async (endpoint) => {
      if (endpoint === "/auth/me") return user;
      return new Promise(() => undefined);
    });
    mount();
    expect(await screen.findByRole("status", { name: "Loading memberships…" })).toHaveAttribute("aria-busy", "true");
    fireEvent.click(screen.getByRole("tab", { name: /Invitations/ }));
    expect(screen.getByRole("status", { name: "Loading pending invitations…" })).toHaveAttribute("aria-busy", "true");
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
    openMemberMenu();
    const dialog = await screen.findByRole("dialog", { name: "Suspend Organization membership?" });
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "ACCESS_REVIEW" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Suspend member" }));

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
    openMemberMenu();
    const dialog = await screen.findByRole("dialog", { name: "Suspend Organization membership?" });
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "ACCESS_REVIEW" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Suspend member" }));
    expect(await within(dialog).findByText("The server did not allow this change because it would remove the last eligible Manager.")).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Suspend member" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Create invitation" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Account email")).not.toBeInTheDocument();
    expect(screen.getAllByText("Alex Member").length).toBeGreaterThan(0);
    expect(screen.queryByText("The server accepted the request.")).not.toBeInTheDocument();
    const call = api.mock.calls.find(([endpoint, options]) => endpoint.endsWith("/suspend") && options?.method === "POST");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ expectedMembershipVersion: 3, reasonCode: "ACCESS_REVIEW" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Refresh lists before a new action" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Member actions for Alex Member" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Create invitation" })).not.toBeInTheDocument();
  });

  it("does not offer self-suspend in the membership row", async () => {
    respond({ currentUser: { ...user, id: userId } });
    mount();
    await screen.findAllByText("Alex Member");
    expect(screen.queryByRole("button", { name: "Suspend" })).not.toBeInTheDocument();
    expect(screen.getByText("You cannot change your own membership.")).toBeVisible();
  });

  it("shows an invitation read error and recovers on retry", async () => {
    let invitationReads = 0;
    api.mockImplementation(async (endpoint) => {
      if (endpoint === "/auth/me") return user;
      if (endpoint.includes("/memberships?")) return membershipPage([]);
      if (endpoint.includes("/invitations?")) {
        invitationReads += 1;
        if (invitationReads === 1) throw new ApiError(500, "UNKNOWN_ERROR", "Could not load invitations");
        return invitationPage();
      }
      throw new Error("Unexpected request");
    });
    mount();
    await screen.findByRole("tab", { name: /Members/ });
    fireEvent.click(screen.getByRole("tab", { name: /Invitations/ }));
    expect(await screen.findByText("Could not load pending invitations.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No pending invitations")).toBeVisible();
    expect(invitationReads).toBe(2);
  });

  it("renders a permission-aware error for invitation 403 rather than generic load error", async () => {
    api.mockImplementation(async (endpoint) => {
      if (endpoint === "/auth/me") return user;
      if (endpoint.includes("/memberships?")) return membershipPage([]);
      if (endpoint.includes("/invitations?")) {
        throw new ApiError(403, "ORGANIZATION_MEMBERSHIP_FORBIDDEN", "Forbidden");
      }
      throw new Error("Unexpected request");
    });
    mount();
    await screen.findByRole("tab", { name: /Members/ });
    fireEvent.click(screen.getByRole("tab", { name: /Invitations/ }));
    expect(
      await screen.findByText(
        "You do not have permission to view or manage these Organization memberships.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByText("Could not load pending invitations."),
    ).not.toBeInTheDocument();
  });

  it("does not render invite member action when user lacks manage permission", async () => {
    const memberUser = { ...user, roles: ["MEMBER"] };
    respond({ currentUser: memberUser, memberships: membershipPage([]) });
    mount();
    await screen.findByText("No members yet");
    expect(
      screen.queryByRole("button", { name: "Invite member" }),
    ).not.toBeInTheDocument();
  });

  it("does not expose member actions when the current user lacks manage permission", async () => {
    respond({ currentUser: { ...user, roles: ["MEMBER"] } });
    mount();
    await screen.findByText("Alex Member");

    expect(screen.queryByRole("button", { name: "Member actions for Alex Member" })).not.toBeInTheDocument();
    expect(screen.getByText("You do not have permission to manage this member.")).toBeVisible();
  });

  it("sends supported status filters to the existing paginated query and can clear them", async () => {
    respond();
    mount();
    await screen.findByText("Alex Member");

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "SUSPENDED" } });
    await waitFor(() => expect(api).toHaveBeenCalledWith(
      `/iam/organizations/${organizationId}/memberships?page=1&pageSize=20&status=SUSPENDED`,
      expect.objectContaining({ cache: "no-store" }),
    ));
    fireEvent.click(await screen.findByRole("button", { name: "Clear filters" }));
    expect(screen.getByLabelText("Status")).toHaveValue("ALL");
    await waitFor(() => expect(api).toHaveBeenCalledWith(
      `/iam/organizations/${organizationId}/memberships?page=1&pageSize=20`,
      expect.objectContaining({ cache: "no-store" }),
    ));
  });

  it("does not query member data when the authenticated context has no Organization", async () => {
    respond({ currentUser: { id: user.id, email: user.email, name: user.name, context: "ACCOUNT" } });
    mount();
    expect(await screen.findByText("An active Organization membership is required to view this page.")).toBeVisible();
    await waitFor(() => expect(api).toHaveBeenCalledWith("/auth/me"));
    expect(api.mock.calls.some(([endpoint]) => endpoint.includes("/memberships?"))).toBe(false);
  });
});
