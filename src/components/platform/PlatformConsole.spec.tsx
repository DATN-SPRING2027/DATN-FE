import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlatformConsole from "./PlatformConsole";

const { routerReplace, pathname, session, organizations, organization, memberships, suspend, createOrganization, lookup, health, audit, logout, organizationListQuery, membershipListQuery } = vi.hoisted(() => ({
  routerReplace: vi.fn(),
  pathname: { value: "/platform/organizations/651a2b3c4d5e6f7a8b9c0d21" },
  session: { data: { id: "651a2b3c4d5e6f7a8b9c0d1e", email: "operator@example.test", name: "Platform Operator", context: "PLATFORM", permissions: ["platform.organizations.organization.read", "platform.users.account.read", "platform.memberships.membership.read"] as string[] }, isPending: false, isFetching: false, isError: false, isSuccess: true },
  organizations: { data: { data: [{ id: "651a2b3c4d5e6f7a8b9c0d21", name: "North Star", slug: "north-star", plan: "FREE", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-02T00:00:00.000Z" }], pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 } }, isError: false, isPending: false, isFetching: false, refetch: vi.fn() },
  organization: { data: { id: "651a2b3c4d5e6f7a8b9c0d21", name: "North Star", slug: "north-star", plan: "FREE", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-02T00:00:00.000Z" }, isError: false, isPending: false, isFetching: false, refetch: vi.fn() },
  memberships: { data: { data: [{ id: "751a2b3c4d5e6f7a8b9c0d21", organizationId: "651a2b3c4d5e6f7a8b9c0d21", userId: "851a2b3c4d5e6f7a8b9c0d21", status: "ACTIVE", version: 2, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-02T00:00:00.000Z", user: { id: "851a2b3c4d5e6f7a8b9c0d21", email: "member@example.test", fullName: "Member One", accountStatus: "ACTIVE" }, organizationRoles: ["MEMBER"] }], pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 } }, isError: false, isPending: false, refetch: vi.fn() },
  suspend: { mutateAsync: vi.fn(), isPending: false },
  createOrganization: { mutateAsync: vi.fn(), isPending: false },
  lookup: { mutateAsync: vi.fn(), isPending: false },
  health: { data: { status: "ok" }, isError: false, isPending: false, isFetching: false, refetch: vi.fn() },
  audit: { data: [
    { action: "organization.create", targetResource: "ORGANIZATION" as const, targetResourceId: "651a2b3c4d5e6f7a8b9c0d21", actorUserId: "651a2b3c4d5e6f7a8b9c0d1e", occurredAt: "2026-10-12T00:00:00.000Z" },
    { action: "membership.suspend", targetResource: "ORGANIZATION_MEMBERSHIP" as const, targetResourceId: "751a2b3c4d5e6f7a8b9c0d21", actorUserId: "651a2b3c4d5e6f7a8b9c0d1e", occurredAt: "2026-10-13T00:00:00.000Z" },
  ], isError: false, isPending: false, isFetching: false, refetch: vi.fn() },
  logout: { mutateAsync: vi.fn(), isPending: false },
  organizationListQuery: vi.fn(),
  membershipListQuery: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
  usePathname: () => pathname.value,
  useRouter: () => ({ replace: routerReplace }),
}));
vi.mock("@/components/common/BrandLogo", () => ({ default: () => <span>Continuum</span> }));
vi.mock("@/lib/queries/platform/usePlatformConsole", () => ({
  usePlatformSessionQuery: () => session,
  usePlatformLogoutMutation: () => logout,
  usePlatformOrganizationsQuery: (...args: unknown[]) => { organizationListQuery(...args); return organizations; },
  usePlatformOrganizationQuery: () => organization,
  usePlatformMembershipsQuery: (...args: unknown[]) => { membershipListQuery(...args); return memberships; },
  usePlatformUserLookupMutation: () => lookup,
  useCreatePlatformOrganizationMutation: () => createOrganization,
  useSuspendPlatformMembershipMutation: () => suspend,
  usePlatformHealthQuery: () => health,
  usePlatformAuditQuery: () => audit,
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values ? `${key} ${Object.values(values).join(" ")}` : key,
}));

describe("PlatformConsole", () => {
  beforeEach(() => {
    routerReplace.mockReset();
    pathname.value = "/platform/organizations/651a2b3c4d5e6f7a8b9c0d21";
    session.isPending = false;
    session.isFetching = false;
    session.isError = false;
    session.data.permissions = [
      "platform.organizations.organization.read",
      "platform.users.account.read",
      "platform.memberships.membership.read",
    ];
    suspend.mutateAsync.mockReset().mockResolvedValue({});
    lookup.mutateAsync.mockReset();
    organizations.refetch.mockReset();
    organizations.isError = false;
    organizations.isPending = false;
    organizations.data.pagination.page = 1;
    organizations.data.pagination.totalPages = 1;
    organizationListQuery.mockClear();
    organization.isError = false;
    organization.isPending = false;
    memberships.refetch.mockReset();
    memberships.isError = false;
    memberships.isPending = false;
    memberships.data.pagination.page = 1;
    memberships.data.pagination.totalPages = 1;
    membershipListQuery.mockClear();
    audit.data = [];
    audit.isError = false;
    audit.isPending = false;
    audit.refetch.mockReset();
    health.isError = false;
    health.isPending = false;
  });

  it("renders only the allowed Organization and Membership actions", () => {
    render(<PlatformConsole />);

    expect(screen.getByRole("heading", { name: "pages.organizations.title" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "organizations.open" })).toBeInTheDocument();
    expect(screen.getByText("Member One")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "memberships.suspend" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "organizations.create" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Configuration|Export|RAG|Job queue/i)).not.toBeInTheDocument();
  });

  it("does not leave an invalid Organization route in a permanent loading state", () => {
    pathname.value = "/platform/organizations/not-an-object-id";
    organization.isPending = true;
    render(<PlatformConsole />);

    expect(screen.getByText("errors.invalidOrganizationId")).toBeInTheDocument();
    expect(screen.queryByText("loadingOrganizationDetail")).not.toBeInTheDocument();
  });

  it("hides cached console data as soon as the Platform session probe fails", () => {
    session.isError = true;
    render(<PlatformConsole />);

    expect(screen.getByText("sessionChecking")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "signOut" })).not.toBeInTheDocument();
    expect(screen.queryByText("Member One")).not.toBeInTheDocument();
  });

  it("explains when Organization membership access is not granted", () => {
    session.data.permissions = ["platform.organizations.organization.read"];
    render(<PlatformConsole />);

    expect(screen.getByText("memberships.readPermissionNeeded")).toBeInTheDocument();
    expect(membershipListQuery).toHaveBeenLastCalledWith("651a2b3c4d5e6f7a8b9c0d21", false, 1);
  });

  it("requests the next Organization directory page through the Platform query", () => {
    pathname.value = "/platform/organizations";
    organizations.data.pagination.totalPages = 2;
    render(<PlatformConsole />);

    fireEvent.click(within(screen.getByRole("navigation", { name: "organizations.directory" })).getByRole("button", { name: "next" }));
    expect(organizationListQuery).toHaveBeenLastCalledWith(true, 2);
  });

  it("shows a confirmation before the permission-gated membership suspend action", async () => {
    session.data.permissions = [
      "platform.organizations.organization.read",
      "platform.memberships.membership.read",
      "platform.memberships.lifecycle.manage",
    ];
    render(<PlatformConsole />);

    fireEvent.click(screen.getByRole("button", { name: "memberships.suspend" }));
    const dialog = screen.getByRole("dialog", { name: "memberships.confirmTitle" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/memberships.confirmGuard/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "memberships.confirmSuspend" }));
    await waitFor(() => expect(suspend.mutateAsync).toHaveBeenCalledWith({
      membershipId: "751a2b3c4d5e6f7a8b9c0d21",
      expectedMembershipVersion: 2,
      reasonCode: "ACCESS_REVIEW",
    }));
  });

  it("keeps every module discoverable while withholding ungranted operation controls", () => {
    session.data.permissions = ["platform.memberships.membership.read"];
    render(<PlatformConsole />);

    expect(screen.getByRole("link", { name: "navigation.services" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "navigation.audit" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "navigation.dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "organizations.create" })).not.toBeInTheDocument();
  });

  it("renders all requested domain routes in grouped navigation", () => {
    render(<PlatformConsole />);

    for (const label of [
      "navigation.dashboard", "navigation.organizations", "navigation.users", "navigation.memberships",
      "navigation.projects", "navigation.security", "navigation.services", "navigation.jobs",
      "navigation.ai", "navigation.integrations", "navigation.incidents", "navigation.diagnostics",
      "navigation.audit", "navigation.account",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("does not expose the Organization-creation account lookup as general User search", () => {
    pathname.value = "/platform/users";
    session.data.permissions = ["platform.users.account.read"];
    render(<PlatformConsole />);

    expect(screen.getByRole("heading", { name: "pages.users.title" })).toBeInTheDocument();
    expect(screen.queryByLabelText("users.email")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "users.lookup" })).not.toBeInTheDocument();
    expect(screen.getByText("capabilities.userDescription")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /activate|deactivate|revoke session/i })).not.toBeInTheDocument();
    expect(lookup.mutateAsync).not.toHaveBeenCalled();
  });

  it("limits exact active-account lookup to Organization creation", () => {
    pathname.value = "/platform/organizations";
    session.data.permissions = ["organization.create", "platform.users.account.read"];
    render(<PlatformConsole />);

    expect(screen.getByLabelText("organizations.firstAdminEmail")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "organizations.findFirstAdmin" })).toBeInTheDocument();
    expect(screen.queryByLabelText("users.email")).not.toBeInTheDocument();
  });

  it("requires the exact account-read permission before showing first-ADMIN lookup", () => {
    pathname.value = "/platform/organizations";
    session.data.permissions = ["organization.create"];
    render(<PlatformConsole />);

    expect(screen.queryByLabelText("organizations.firstAdminEmail")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "organizations.findFirstAdmin" })).not.toBeInTheDocument();
    expect(screen.getByText("users.accountLookupPermissionNeeded")).toBeInTheDocument();
  });

  it("keeps unsupported Projects operations non-callable and names the backend dependency", () => {
    pathname.value = "/platform/projects";
    render(<PlatformConsole />);

    expect(screen.getByRole("heading", { name: "pages.projects.title" })).toBeInTheDocument();
    expect(screen.getByText("capabilities.projectDescription")).toBeInTheDocument();
    expect(screen.getByText("capabilities.projectDependency")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit|save|invite|change|retry/i })).not.toBeInTheDocument();
  });

  it("renders safe unavailable states for every backend-blocked operations area", () => {
    const { rerender } = render(<PlatformConsole />);
    const blockedAreas = [
      ["/platform/projects", "capabilities.projectDescription"],
      ["/platform/security", "capabilities.securityDescription"],
      ["/platform/jobs", "capabilities.jobsDescription"],
      ["/platform/ai", "capabilities.aiDescription"],
      ["/platform/integrations", "capabilities.integrationDescription"],
      ["/platform/incidents", "capabilities.incidentDescription"],
      ["/platform/diagnostics", "capabilities.diagnosticsDescription"],
    ] as const;

    for (const [path, expectedMessage] of blockedAreas) {
      pathname.value = path;
      rerender(<PlatformConsole />);
      expect(screen.getByText(expectedMessage)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /retry|edit|save|invite|change|revoke/i })).not.toBeInTheDocument();
    }
  });

  it("shows only the current validated identity and permission projection on Account", () => {
    pathname.value = "/platform/account";
    render(<PlatformConsole />);

    expect(screen.getByRole("heading", { name: "account.identityTitle" })).toBeInTheDocument();
    expect(screen.getAllByText("operator@example.test")).toHaveLength(2);
    expect(screen.getByText("platform.organizations.organization.read")).toBeInTheDocument();
    expect(screen.queryByText(/eyJ[A-Za-z0-9_-]+\./)).not.toBeInTheDocument();
  });

  it("keeps Audit filters local to the loaded bounded projection", () => {
    pathname.value = "/platform/audit";
    session.data.permissions = ["platform.audit.read"];
    audit.data = [
      { action: "organization.create", targetResource: "ORGANIZATION", targetResourceId: "651a2b3c4d5e6f7a8b9c0d21", actorUserId: "651a2b3c4d5e6f7a8b9c0d1e", occurredAt: "2026-10-12T00:00:00.000Z" },
      { action: "membership.suspend", targetResource: "ORGANIZATION_MEMBERSHIP", targetResourceId: "751a2b3c4d5e6f7a8b9c0d21", actorUserId: "651a2b3c4d5e6f7a8b9c0d1e", occurredAt: "2026-10-13T00:00:00.000Z" },
    ];
    render(<PlatformConsole />);

    fireEvent.change(screen.getByLabelText("audit.filterAction"), { target: { value: "membership" } });
    expect(screen.getByText("membership.suspend")).toBeInTheDocument();
    expect(screen.queryByText("organization.create")).not.toBeInTheDocument();
    expect(screen.getByText(/audit.localFilterNote/)).toBeInTheDocument();
  });

  it("shows Dashboard counts only from available projections and marks missing metrics unavailable", () => {
    pathname.value = "/platform";
    session.data.permissions = ["platform.organizations.organization.read", "platform.health.read", "platform.audit.read"];
    audit.data = [];
    render(<PlatformConsole />);

    expect(screen.getByRole("heading", { name: "pages.dashboard.title" })).toBeInTheDocument();
    expect(screen.getByText("dashboard.totalOrganizations")).toBeInTheDocument();
    expect(screen.getByText("dashboard.userMetricsUnavailable")).toBeInTheDocument();
    expect(screen.getByText("dashboard.projectMetricsUnavailable")).toBeInTheDocument();
    expect(screen.getByText("dashboard.iamHealthDetail")).toBeInTheDocument();
  });

  it("supports membership review on its own route and requires confirmation before suspension", async () => {
    pathname.value = "/platform/memberships";
    session.data.permissions = [
      "platform.organizations.organization.read",
      "platform.memberships.membership.read",
      "platform.memberships.lifecycle.manage",
    ];
    render(<PlatformConsole />);

    expect(screen.getByRole("heading", { name: "pages.memberships.title" })).toBeInTheDocument();
    expect(screen.getByLabelText("memberships.organization")).toHaveValue("651a2b3c4d5e6f7a8b9c0d21");
    expect(screen.getByText("Member One")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "memberships.suspend" }));
    const dialog = screen.getByRole("dialog", { name: "memberships.confirmTitle" });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "memberships.confirmSuspend" }));
    await waitFor(() => expect(suspend.mutateAsync).toHaveBeenCalledWith({
      membershipId: "751a2b3c4d5e6f7a8b9c0d21",
      expectedMembershipVersion: 2,
      reasonCode: "ACCESS_REVIEW",
    }));
  });

  it("requests the next membership page for the selected Organization", () => {
    pathname.value = "/platform/memberships";
    session.data.permissions = ["platform.organizations.organization.read", "platform.memberships.membership.read"];
    memberships.data.pagination.totalPages = 2;
    render(<PlatformConsole />);

    fireEvent.click(within(screen.getByRole("navigation", { name: "memberships.title" })).getByRole("button", { name: "next" }));
    expect(membershipListQuery).toHaveBeenLastCalledWith("651a2b3c4d5e6f7a8b9c0d21", true, 2);
  });

  it("offers a retry when the bounded Audit API fails", () => {
    pathname.value = "/platform/audit";
    session.data.permissions = ["platform.audit.read"];
    audit.isError = true;
    render(<PlatformConsole />);

    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(audit.refetch).toHaveBeenCalledOnce();
  });
});
