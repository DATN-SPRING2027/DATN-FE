import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlatformConsole from "./PlatformConsole";

const { routerReplace, session, organizations, organization, memberships, suspend, createOrganization, lookup, health, audit, logout } = vi.hoisted(() => ({
  routerReplace: vi.fn(),
  session: { data: { id: "651a2b3c4d5e6f7a8b9c0d1e", email: "operator@example.test", name: "Platform Operator", context: "PLATFORM", permissions: ["platform.organizations.organization.read", "platform.users.account.read", "platform.memberships.membership.read"] as string[] }, isPending: false, isFetching: false, isError: false, isSuccess: true },
  organizations: { data: { data: [{ id: "651a2b3c4d5e6f7a8b9c0d21", name: "North Star", slug: "north-star", plan: "FREE", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-02T00:00:00.000Z" }], pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 } }, isError: false, isPending: false, isFetching: false, refetch: vi.fn() },
  organization: { data: { id: "651a2b3c4d5e6f7a8b9c0d21", name: "North Star", slug: "north-star", plan: "FREE", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-02T00:00:00.000Z" }, isError: false, isFetching: false, refetch: vi.fn() },
  memberships: { data: { data: [{ id: "751a2b3c4d5e6f7a8b9c0d21", organizationId: "651a2b3c4d5e6f7a8b9c0d21", userId: "851a2b3c4d5e6f7a8b9c0d21", status: "ACTIVE", version: 2, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-02T00:00:00.000Z", user: { id: "851a2b3c4d5e6f7a8b9c0d21", email: "member@example.test", fullName: "Member One", accountStatus: "ACTIVE" }, organizationRoles: ["MEMBER"] }], pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 } }, isError: false, isPending: false, refetch: vi.fn() },
  suspend: { mutateAsync: vi.fn(), isPending: false },
  createOrganization: { mutateAsync: vi.fn(), isPending: false },
  lookup: { mutateAsync: vi.fn(), isPending: false },
  health: { data: { status: "ok" }, isError: false, isPending: false, isFetching: false, refetch: vi.fn() },
  audit: { data: [], isError: false, isPending: false, isFetching: false, refetch: vi.fn() },
  logout: { mutateAsync: vi.fn(), isPending: false },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
  useRouter: () => ({ replace: routerReplace }),
}));
vi.mock("@/components/common/BrandLogo", () => ({ default: () => <span>Continuum</span> }));
vi.mock("@/lib/queries/platform/usePlatformConsole", () => ({
  usePlatformSessionQuery: () => session,
  usePlatformLogoutMutation: () => logout,
  usePlatformOrganizationsQuery: () => organizations,
  usePlatformOrganizationQuery: () => organization,
  usePlatformMembershipsQuery: () => memberships,
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
    session.data.permissions = [
      "platform.organizations.organization.read",
      "platform.users.account.read",
      "platform.memberships.membership.read",
    ];
    suspend.mutateAsync.mockReset().mockResolvedValue({});
    organizations.refetch.mockReset();
    memberships.refetch.mockReset();
  });

  it("renders only the allowed Organization and Membership actions", () => {
    render(<PlatformConsole />);

    expect(screen.getByRole("heading", { name: "sections.organizations" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "organizations.open" })).toBeInTheDocument();
    expect(screen.getByText("Member One")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "memberships.suspend" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "organizations.create" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Configuration|Export|RAG|Job queue/i)).not.toBeInTheDocument();
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

  it("does not expose health, audit, or organization creation controls without those permissions", () => {
    session.data.permissions = ["platform.memberships.membership.read"];
    render(<PlatformConsole />);

    expect(screen.queryByRole("button", { name: "navigation.health" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "navigation.audit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "organizations.create" })).not.toBeInTheDocument();
  });
});
