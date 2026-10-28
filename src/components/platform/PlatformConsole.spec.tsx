import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import PlatformConsole from "./PlatformConsole";

let originalDialogShowModal: PropertyDescriptor | undefined;

const {
  routerReplace,
  pathname,
  session,
  organizations,
  organization,
  memberships,
  suspend,
  createOrganization,
  lookup,
  health,
  audit,
  logout,
  organizationListQuery,
  membershipListQuery,
} = vi.hoisted(() => ({
  routerReplace: vi.fn(),
  pathname: { value: "/platform/memberships" },
  session: {
    data: {
      id: "651a2b3c4d5e6f7a8b9c0d1e",
      email: "operator@example.test",
      name: "Platform Operator",
      context: "PLATFORM",
      permissions: [
        "platform.organizations.organization.read",
        "platform.users.account.read",
        "platform.memberships.membership.read",
      ] as string[],
    },
    isPending: false,
    isFetching: false,
    isError: false,
    isSuccess: true,
    isStale: false,
    refetch: vi.fn(),
  },
  organizations: {
    data: {
      data: [
        {
          id: "651a2b3c4d5e6f7a8b9c0d21",
          name: "North Star",
          slug: "north-star",
          plan: "FREE",
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-02T00:00:00.000Z",
        },
      ],
      pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
    },
    isError: false,
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
  },
  organization: {
    data: {
      id: "651a2b3c4d5e6f7a8b9c0d21",
      name: "North Star",
      slug: "north-star",
      plan: "FREE",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
    },
    isError: false,
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
  },
  memberships: {
    data: {
      data: [
        {
          id: "751a2b3c4d5e6f7a8b9c0d21",
          organizationId: "651a2b3c4d5e6f7a8b9c0d21",
          userId: "851a2b3c4d5e6f7a8b9c0d21",
          status: "ACTIVE",
          version: 2,
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-02T00:00:00.000Z",
          user: {
            id: "851a2b3c4d5e6f7a8b9c0d21",
            email: "member@example.test",
            fullName: "Member One",
            accountStatus: "ACTIVE",
          },
          organizationRoles: ["MEMBER"],
        },
      ],
      pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
    },
    isError: false,
    isPending: false,
    refetch: vi.fn(),
  },
  suspend: { mutateAsync: vi.fn(), isPending: false },
  createOrganization: { mutateAsync: vi.fn(), isPending: false },
  lookup: { mutateAsync: vi.fn(), isPending: false },
  health: {
    data: { status: "ok" },
    isError: false,
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
  },
  audit: {
    data: [
      {
        action: "organization.create",
        targetResource: "ORGANIZATION" as const,
        targetResourceId: "651a2b3c4d5e6f7a8b9c0d21",
        actorUserId: "651a2b3c4d5e6f7a8b9c0d1e",
        occurredAt: "2026-10-12T00:00:00.000Z",
      },
      {
        action: "membership.suspend",
        targetResource: "ORGANIZATION_MEMBERSHIP" as const,
        targetResourceId: "751a2b3c4d5e6f7a8b9c0d21",
        actorUserId: "651a2b3c4d5e6f7a8b9c0d1e",
        occurredAt: "2026-10-13T00:00:00.000Z",
      },
    ],
    isError: false,
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
  },
  logout: { mutateAsync: vi.fn(), isPending: false },
  organizationListQuery: vi.fn(),
  membershipListQuery: vi.fn(),
}));

const { operationHooks, operationState } = vi.hoisted(() => {
  const page: {
    data: unknown[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  } = {
    data: [],
    pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
  };
  const query = {
    data: page,
    isError: false,
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
  };
  const usersQuery = {
    data: {
      data: [] as unknown[],
      pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
    },
    isError: false,
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
  };
  const userDetailQuery = {
    data: undefined as unknown,
    isError: false,
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
  };
  const list = {
    data: [],
    isError: false,
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
  };
  const mutation = { mutateAsync: vi.fn(), isPending: false };
  const dashboard = {
    data: {
      organizations: { total: 2 },
      users: { total: 3, active: 2, suspended: 1, pendingInvite: 0 },
      projects: { total: 4, active: 3, archived: 1 },
      memberships: {
        total: 5,
        active: 3,
        suspended: 1,
        pendingInvite: 0,
        removed: 1,
      },
      generatedAt: "2026-10-16T00:00:00.000Z",
      serviceHealth: {
        status: "READY",
        total: 8,
        ready: 8,
        degraded: 0,
        unavailable: 0,
        lastCheckedAt: "2026-10-16T00:00:00.000Z",
      },
      recentOperationalActivity: { availability: "AVAILABLE", items: [] },
    },
    isError: false,
    isPending: false,
    isFetching: false,
    isSuccess: true,
    refetch: vi.fn(),
  };
  const auditEvents = {
    data: page,
    isError: false,
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
  };
  const state = {
    query,
    usersQuery,
    userDetailQuery,
    list,
    dashboard,
    mutation,
    auditEvents,
    auditEventsQuery: vi.fn(),
    operationQuery: vi.fn(),
  };
  return {
    operationState: state,
    operationHooks: {
      usePlatformOrganizationInvitationsQuery: vi.fn(() => query),
      usePlatformChangeOrganizationMetadataMutation: vi.fn(() => mutation),
      usePlatformDashboardQuery: vi.fn(() => dashboard),
      usePlatformUsersQuery: vi.fn((...args: unknown[]) => {
        state.operationQuery("users", ...args);
        return state.usersQuery;
      }),
      usePlatformUserQuery: vi.fn(() => state.userDetailQuery),
      usePlatformUserOrganizationsQuery: vi.fn(() => query),
      usePlatformUserSessionQuery: vi.fn(() => query),
      usePlatformUserSessionsQuery: vi.fn(() => query),
      usePlatformChangeUserStatusMutation: vi.fn(() => mutation),
      usePlatformUpdateUserProfileMutation: vi.fn(() => mutation),
      usePlatformArchiveUserMutation: vi.fn(() => mutation),
      usePlatformRestoreUserMutation: vi.fn(() => mutation),
      usePlatformRevokeSessionMutation: vi.fn(() => mutation),
      usePlatformProjectsQuery: vi.fn(() => query),
      usePlatformProjectQuery: vi.fn(() => query),
      usePlatformChangeProjectMetadataMutation: vi.fn(() => mutation),
      usePlatformServicesQuery: vi.fn(() => list),
      usePlatformQueuesQuery: vi.fn(() => list),
      usePlatformJobsQuery: vi.fn(() => query),
      usePlatformJobCommandMutation: vi.fn(() => mutation),
      usePlatformAiOperationsQuery: vi.fn(() => query),
      usePlatformIntegrationsQuery: vi.fn(() => query),
      usePlatformIncidentsQuery: vi.fn(() => query),
      usePlatformIncidentQuery: vi.fn(() => query),
      usePlatformIncidentHistoryQuery: vi.fn(() => query),
      usePlatformCreateIncidentMutation: vi.fn(() => mutation),
      usePlatformIncidentActionMutation: vi.fn(() => mutation),
      usePlatformRequestTraceQuery: vi.fn(() => query),
      usePlatformAuditEventsQuery: vi.fn((...args: unknown[]) => {
        state.auditEventsQuery(...args);
        return auditEvents;
      }),
      usePlatformAuditEventQuery: vi.fn(() => query),
      usePlatformAuditResourceHistoryQuery: vi.fn(() => query),
    },
  };
});

vi.mock("./overview/OperatorReferenceChart", () => ({
  default: ({ title }: { title?: string }) => <div>{title}</div>,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => pathname.value,
  useRouter: () => ({ replace: routerReplace }),
}));
vi.mock("@/components/common/BrandLogo", () => ({
  default: () => <span>Continuum</span>,
}));
vi.mock("@/components/common/ThemeToggleButton", () => ({
  ThemeToggleButton: () => null,
}));
vi.mock("@/lib/queries/platform/usePlatformConsole", () => ({
  usePlatformSessionQuery: () => session,
  usePlatformLogoutMutation: () => logout,
  usePlatformOrganizationsQuery: (...args: unknown[]) => {
    organizationListQuery(...args);
    return organizations;
  },
  usePlatformOrganizationQuery: () => organization,
  usePlatformMembershipsQuery: (...args: unknown[]) => {
    membershipListQuery(...args);
    return memberships;
  },
  usePlatformMembershipDirectoryQuery: (...args: unknown[]) => {
    membershipListQuery(...args);
    return memberships;
  },
  usePlatformUserLookupMutation: () => lookup,
  useCreatePlatformOrganizationMutation: () => createOrganization,
  useSuspendPlatformMembershipMutation: () => suspend,
  usePlatformHealthQuery: () => health,
  usePlatformAuditQuery: () => audit,
}));
vi.mock(
  "@/lib/queries/platform/usePlatformOperations",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/lib/queries/platform/usePlatformOperations")
      >();
    return {
      ...operationHooks,
      platformAuditActions: actual.platformAuditActions,
    };
  },
);
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations:
    (namespace: string) => (key: string, values?: Record<string, string>) => {
      if (namespace === "platformUserDirectory") {
        const labels: Record<string, string> = {
          title: "User management",
          search: "Search users",
          statusFilter: "User status",
          ARCHIVED: "Archived",
          emptyTitle: "No users found",
        };
        return labels[key] ?? key;
      }
      if (namespace === "platformUserActions" && key === "close")
        return "Close";
      if (namespace === "platformUserActions" && key === "restore")
        return "Restore account";
      return values ? `${key} ${Object.values(values).join(" ")}` : key;
    },
}));

function makePlatformUser(
  status: "ACTIVE" | "SUSPENDED" | "PENDING_INVITE",
  archivedAt: string | null = null,
) {
  return {
    id: "851a2b3c4d5e6f7a8b9c0d30",
    email: "user@example.test",
    fullName: "Directory User",
    avatarUrl: null,
    archivedAt,
    status,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
    memberships: [],
    membershipsTruncated: false,
    lastLoginAt: null,
    effectivePlatformPermissions: [],
  };
}

function renderUserDirectory(user: ReturnType<typeof makePlatformUser>) {
  pathname.value = "/platform/users";
  session.data.permissions = [
    "platform.users.account.read",
    "platform.users.account.manage",
  ];
  operationState.usersQuery.data = {
    data: [user],
    pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
  };
  operationState.userDetailQuery.data = user;
  originalDialogShowModal = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    "showModal",
  );
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  render(<PlatformConsole />);
}

describe("PlatformConsole", () => {
  afterEach(() => {
    if (originalDialogShowModal) {
      Object.defineProperty(
        HTMLDialogElement.prototype,
        "showModal",
        originalDialogShowModal,
      );
    } else {
      Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    }
    originalDialogShowModal = undefined;
  });

  beforeEach(() => {
    session.isStale = false;
    session.refetch.mockReset();
    routerReplace.mockReset();
    pathname.value = "/platform/memberships";
    Object.assign(session, { error: undefined });
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
    operationState.auditEvents.data = {
      data: [],
      pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
    };
    operationState.auditEvents.isError = false;
    operationState.auditEvents.isPending = false;
    operationState.auditEvents.refetch.mockReset();
    operationState.auditEventsQuery.mockClear();
    operationState.operationQuery.mockClear();
    operationState.usersQuery.data = {
      data: [],
      pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
    };
    operationState.usersQuery.isError = false;
    operationState.usersQuery.isPending = false;
    operationState.userDetailQuery.data = undefined;
    operationState.userDetailQuery.isError = false;
    operationState.userDetailQuery.isPending = false;
    operationState.userDetailQuery.refetch.mockReset();
    operationState.mutation.mutateAsync.mockReset().mockResolvedValue({});
  });

  it.each([
    {
      status: "ACTIVE" as const,
      archivedAt: null,
      visible: [
        "View details",
        "Edit profile",
        "Suspend account",
        "Archive user",
      ],
      hidden: ["Reactivate account", "Restore account"],
    },
    {
      status: "SUSPENDED" as const,
      archivedAt: null,
      visible: [
        "View details",
        "Edit profile",
        "Reactivate account",
        "Archive user",
      ],
      hidden: ["Suspend account", "Restore account"],
    },
    {
      status: "SUSPENDED" as const,
      archivedAt: "2026-10-03T00:00:00.000Z",
      visible: ["View details", "Restore account"],
      hidden: [
        "Edit profile",
        "Suspend account",
        "Reactivate account",
        "Archive user",
      ],
    },
  ])(
    "shows only valid $status user actions in the row menu",
    ({ status, archivedAt, visible, hidden }) => {
      const user = makePlatformUser(status, archivedAt);
      renderUserDirectory(user);

      expect(
        screen.queryByRole("button", { name: "Details" }),
      ).not.toBeInTheDocument();
      const trigger = screen.getByRole("button", {
        name: `Actions for ${user.fullName}`,
      });
      fireEvent.click(trigger);

      const menu = screen.getByRole("menu", {
        name: `Actions for ${user.fullName}`,
      });
      for (const label of visible) {
        expect(
          within(menu).getByRole("menuitem", { name: label }),
        ).toBeInTheDocument();
      }
      for (const label of hidden) {
        expect(
          within(menu).queryByRole("menuitem", { name: label }),
        ).not.toBeInTheDocument();
      }
    },
  );

  it("closes the row menu on Escape and returns focus to its trigger", () => {
    const user = makePlatformUser("ACTIVE");
    renderUserDirectory(user);
    const trigger = screen.getByRole("button", {
      name: `Actions for ${user.fullName}`,
    });

    fireEvent.click(trigger);
    const menu = screen.getByRole("menu", {
      name: `Actions for ${user.fullName}`,
    });
    expect(
      within(menu).getByRole("menuitem", { name: "View details" }),
    ).toHaveFocus();
    fireEvent.keyDown(menu, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes the row menu after clicking outside it", () => {
    const user = makePlatformUser("ACTIVE");
    renderUserDirectory(user);
    fireEvent.click(
      screen.getByRole("button", { name: `Actions for ${user.fullName}` }),
    );

    fireEvent.pointerDown(screen.getByRole("combobox"));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens and saves profile edits directly from the row menu", async () => {
    const user = makePlatformUser("ACTIVE");
    renderUserDirectory(user);
    fireEvent.click(
      screen.getByRole("button", { name: `Actions for ${user.fullName}` }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit profile" }));

    const dialog = screen.getByRole("dialog", { name: "Edit user profile" });
    expect(within(dialog).getByLabelText("Full name")).toHaveValue(
      user.fullName,
    );
    fireEvent.change(within(dialog).getByLabelText("Full name"), {
      target: { value: "Updated from menu" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() =>
      expect(operationState.mutation.mutateAsync).toHaveBeenCalledWith({
        userId: user.id,
        fullName: "Updated from menu",
        avatarUrl: null,
        expectedUpdatedAt: user.updatedAt,
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Edit user profile" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Profile updated");
  });

  it("suspends an active account from the row menu after confirmation", async () => {
    const user = makePlatformUser("ACTIVE");
    renderUserDirectory(user);
    fireEvent.click(
      screen.getByRole("button", { name: `Actions for ${user.fullName}` }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Suspend account" }));

    const dialog = screen.getByRole("dialog", { name: "Suspend account?" });
    expect(dialog).toHaveTextContent("revokes the user’s active sessions");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Suspend account" }),
    );

    await waitFor(() =>
      expect(operationState.mutation.mutateAsync).toHaveBeenCalledWith({
        userId: user.id,
        status: "SUSPENDED",
        expectedUpdatedAt: user.updatedAt,
        reasonCode: "ACCESS_REVIEW",
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("SUSPENDED");
  });

  it("reactivates a suspended account from the row menu after confirmation", async () => {
    const user = makePlatformUser("SUSPENDED");
    renderUserDirectory(user);
    fireEvent.click(
      screen.getByRole("button", { name: `Actions for ${user.fullName}` }),
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Reactivate account" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Reactivate account?" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Reactivate account" }),
    );

    await waitFor(() =>
      expect(operationState.mutation.mutateAsync).toHaveBeenCalledWith({
        userId: user.id,
        status: "ACTIVE",
        expectedUpdatedAt: user.updatedAt,
        reasonCode: "ACCESS_REVIEW",
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("ACTIVE");
  });

  it("archives a user from the row menu after acknowledging the retained records", async () => {
    const user = makePlatformUser("ACTIVE");
    renderUserDirectory(user);
    fireEvent.click(
      screen.getByRole("button", { name: `Actions for ${user.fullName}` }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Archive user" }));

    const dialog = screen.getByRole("dialog", { name: "Archive user?" });
    expect(dialog).toHaveTextContent("audit history");
    const archiveButton = within(dialog).getByRole("button", {
      name: "Archive user",
    });
    expect(archiveButton).toBeDisabled();
    fireEvent.click(within(dialog).getByLabelText(/I understand the account/));
    fireEvent.click(archiveButton);

    await waitFor(() =>
      expect(operationState.mutation.mutateAsync).toHaveBeenCalledWith({
        userId: user.id,
        expectedUpdatedAt: user.updatedAt,
        reasonCode: "ACCESS_REVIEW",
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("archived");
  });

  it("renders only the allowed Organization and Membership actions", () => {
    pathname.value = "/platform/organizations";
    render(<PlatformConsole />);

    expect(
      screen.getByRole("heading", { name: "pages.organizations.title" }),
    ).toBeInTheDocument();
    expect(screen.getByText("North Star")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "organizations.create" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Configuration|Export|RAG|Job queue/i),
    ).not.toBeInTheDocument();
  });

  it("does not leave an invalid Organization route in a permanent loading state", () => {
    pathname.value = "/platform/organizations/not-an-object-id";
    organization.isPending = true;
    render(<PlatformConsole />);

    expect(
      screen.getByText("errors.invalidOrganizationId"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("loadingOrganizationDetail"),
    ).not.toBeInTheDocument();
  });

  it("hides cached console data as soon as the Platform session probe fails", () => {
    session.isError = true;
    Object.assign(session, {
      error: new ApiError(403, "PLATFORM_SESSION_FORBIDDEN", "Denied"),
    });
    render(<PlatformConsole />);

    expect(screen.getByText("sessionChecking")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "signOut" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Member One")).not.toBeInTheDocument();
  });

  it("explains when Organization membership access is not granted", () => {
    session.data.permissions = ["platform.organizations.organization.read"];
    render(<PlatformConsole />);

    expect(
      screen.getByText("memberships.readPermissionNeeded"),
    ).toBeInTheDocument();
    expect(membershipListQuery).toHaveBeenLastCalledWith(
      { page: 1, search: "", status: "", organizationId: "" },
      false,
    );
  });

  it("requests the next Organization directory page through the Platform query", () => {
    pathname.value = "/platform/organizations";
    organizations.data.pagination.totalPages = 2;
    render(<PlatformConsole />);

    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "organizations.directory" }),
      ).getByRole("button", { name: "next" }),
    );
    expect(organizationListQuery).toHaveBeenLastCalledWith(true, 2, 10);
  });

  it("shows a confirmation before the permission-gated membership suspend action", async () => {
    session.data.permissions = [
      "platform.organizations.organization.read",
      "platform.memberships.membership.read",
      "platform.memberships.lifecycle.manage",
    ];
    render(<PlatformConsole />);

    fireEvent.click(
      screen.getByRole("button", { name: "memberships.suspend" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "memberships.confirmTitle",
    });
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByText(/memberships.confirmGuard/),
    ).toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "memberships.confirmSuspend",
      }),
    );
    await waitFor(() =>
      expect(suspend.mutateAsync).toHaveBeenCalledWith({
        membershipId: "751a2b3c4d5e6f7a8b9c0d21",
        expectedMembershipVersion: 2,
        reasonCode: "ACCESS_REVIEW",
      }),
    );
  });

  it("shows only navigation destinations granted by exact read permissions", () => {
    session.data.permissions = ["platform.memberships.membership.read"];
    render(<PlatformConsole />);

    expect(
      screen.getByRole("link", { name: "navigation.memberships" }),
    ).toHaveAttribute("href", "/platform/memberships");
    for (const label of [
      "navigation.dashboard",
      "navigation.organizations",
      "navigation.users",
      "navigation.services",
      "navigation.audit",
    ]) {
      expect(
        screen.queryByRole("link", { name: label }),
      ).not.toBeInTheDocument();
    }
    expect(
      screen.queryByRole("button", { name: "organizations.create" }),
    ).not.toBeInTheDocument();
  });

  it("keeps all existing domain routes in grouped navigation", () => {
    session.data.permissions = [
      "platform.dashboard.summary.read",
      "platform.organizations.organization.read",
      "platform.users.account.read",
      "platform.memberships.membership.read",
      "platform.projects.project.read",
      "platform.sessions.session.read",
      "platform.services.service.read",
      "platform.jobs.job.read",
      "platform.ai.operations.read",
      "platform.integrations.integration.read",
      "platform.incidents.incident.read",
      "platform.diagnostics.trace.read",
      "platform.audit.read",
    ];
    render(<PlatformConsole />);

    expect(
      screen.getByRole("link", { name: "navigation.organizations" }),
    ).toHaveAttribute("href", "/platform/organizations");
    for (const label of [
      "navigation.dashboard",
      "navigation.users",
      "navigation.memberships",
      "navigation.projects",
      "navigation.security",
      "navigation.services",
      "navigation.jobs",
      "navigation.ai",
      "navigation.integrations",
      "navigation.incidents",
      "navigation.diagnostics",
      "navigation.audit",
      "navigation.account",
    ]) {
      expect(
        screen.getAllByRole("link", { name: label }).length,
      ).toBeGreaterThan(0);
    }
  });

  it("connects the Users route to the scoped Platform API instead of the organization-creation lookup", () => {
    pathname.value = "/platform/users";
    session.data.permissions = ["platform.users.account.read"];
    render(<PlatformConsole />);

    expect(
      screen.getByRole("heading", { name: "User management" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("users.email")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "users.lookup" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("No users found")).toBeInTheDocument();
    expect(operationState.operationQuery).toHaveBeenCalledWith(
      "users",
      expect.objectContaining({ page: 1, pageSize: 25 }),
      true,
    );
    expect(lookup.mutateAsync).not.toHaveBeenCalled();
  });

  it("searches users and resets pagination when the search changes", () => {
    pathname.value = "/platform/users";
    session.data.permissions = ["platform.users.account.read"];
    operationState.usersQuery.data.pagination = {
      page: 1,
      pageSize: 25,
      totalItems: 50,
      totalPages: 2,
    };
    render(<PlatformConsole />);

    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(operationState.operationQuery).toHaveBeenLastCalledWith(
      "users",
      expect.objectContaining({ page: 2 }),
      true,
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Search users" }), {
      target: { value: "directory" },
    });
    expect(operationState.operationQuery).toHaveBeenLastCalledWith(
      "users",
      expect.objectContaining({ page: 1, search: "directory" }),
      true,
    );
  });

  it("allows profile review for pending invites without exposing suspend, reactivate, or archive actions", async () => {
    pathname.value = "/platform/users";
    session.data.permissions = [
      "platform.users.account.read",
      "platform.users.account.manage",
    ];
    const invite = {
      id: "851a2b3c4d5e6f7a8b9c0d30",
      email: "invite@example.test",
      fullName: "Pending Invite",
      avatarUrl: null,
      archivedAt: null,
      status: "PENDING_INVITE",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
      memberships: [],
      membershipsTruncated: false,
      lastLoginAt: null,
      effectivePlatformPermissions: [],
    };
    operationState.usersQuery.data = {
      data: [invite],
      pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
    };
    operationState.userDetailQuery.data = invite;
    originalDialogShowModal = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      "showModal",
    );
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    });

    render(<PlatformConsole />);
    fireEvent.click(
      screen.getByRole("button", { name: `Actions for ${invite.fullName}` }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "View details" }));

    const detailDialog = await screen.findByRole("dialog", {
      name: invite.fullName,
    });
    expect(
      within(detailDialog).queryByText("Account actions"),
    ).not.toBeInTheDocument();
    expect(
      within(detailDialog).queryByRole("button", { name: "Edit profile" }),
    ).not.toBeInTheDocument();
    expect(
      within(detailDialog).queryByRole("button", { name: "Suspend account" }),
    ).not.toBeInTheDocument();
    expect(
      within(detailDialog).queryByRole("button", {
        name: "Reactivate account",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(detailDialog).queryByRole("button", { name: "Archive user" }),
    ).not.toBeInTheDocument();
  });

  it("edits profile fields from the row menu and returns focus after success", async () => {
    const user = makePlatformUser("ACTIVE");
    renderUserDirectory(user);
    fireEvent.click(
      screen.getByRole("button", { name: `Actions for ${user.fullName}` }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit profile" }));
    const profileDialog = screen.getByRole("dialog", {
      name: "Edit user profile",
    });
    const fullNameInput = within(profileDialog).getByLabelText("Full name");
    expect(fullNameInput).toHaveFocus();
    fireEvent.change(within(profileDialog).getByLabelText("Full name"), {
      target: { value: "Updated Name" },
    });
    fireEvent.change(within(profileDialog).getByLabelText(/Avatar URL/), {
      target: { value: "https://cdn.example.test/avatar.png" },
    });
    fireEvent.click(
      within(profileDialog).getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() =>
      expect(operationState.mutation.mutateAsync).toHaveBeenCalledWith({
        userId: user.id,
        fullName: "Updated Name",
        avatarUrl: "https://cdn.example.test/avatar.png",
        expectedUpdatedAt: user.updatedAt,
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Edit user profile" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: `Actions for ${user.fullName}` }),
    ).toHaveFocus();
  });

  it("reactivates a suspended account from the row menu after confirmation", async () => {
    const user = makePlatformUser("SUSPENDED");
    renderUserDirectory(user);
    fireEvent.click(
      screen.getByRole("button", { name: `Actions for ${user.fullName}` }),
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Reactivate account" }),
    );
    const statusDialog = screen.getByRole("dialog", {
      name: "Reactivate account?",
    });
    fireEvent.click(
      within(statusDialog).getByRole("button", { name: "Reactivate account" }),
    );

    await waitFor(() =>
      expect(operationState.mutation.mutateAsync).toHaveBeenCalledWith({
        userId: user.id,
        status: "ACTIVE",
        expectedUpdatedAt: user.updatedAt,
        reasonCode: "ACCESS_REVIEW",
      }),
    );
  });

  it("requires explicit acknowledgment before archiving and explains a CAS conflict", async () => {
    const user = makePlatformUser("ACTIVE");
    operationState.mutation.mutateAsync
      .mockRejectedValueOnce(
        new ApiError(409, "USER_VERSION_STALE", "private detail"),
      )
      .mockResolvedValueOnce({});
    renderUserDirectory(user);
    fireEvent.click(
      screen.getByRole("button", { name: `Actions for ${user.fullName}` }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Archive user" }));
    const archiveDialog = screen.getByRole("dialog", { name: "Archive user?" });
    const archiveButton = within(archiveDialog).getByRole("button", {
      name: "Archive user",
    });

    expect(archiveButton).toBeDisabled();
    fireEvent.click(
      within(archiveDialog).getByLabelText(/I understand the account/),
    );
    expect(archiveButton).toBeEnabled();
    fireEvent.click(archiveButton);

    expect(await within(archiveDialog).findByRole("alert")).toHaveTextContent(
      "This record changed after it was loaded",
    );
    expect(within(archiveDialog).getByRole("alert")).not.toHaveTextContent(
      "private detail",
    );
    fireEvent.click(archiveButton);
    await waitFor(() =>
      expect(operationState.mutation.mutateAsync).toHaveBeenCalledWith({
        userId: user.id,
        expectedUpdatedAt: user.updatedAt,
        reasonCode: "ACCESS_REVIEW",
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Archive user?" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows a permission-specific profile error without exposing backend detail", async () => {
    const user = makePlatformUser("ACTIVE");
    operationState.mutation.mutateAsync.mockRejectedValueOnce(
      new ApiError(
        403,
        "PLATFORM_PERMISSION_DENIED",
        "sensitive server detail",
      ),
    );
    renderUserDirectory(user);
    fireEvent.click(
      screen.getByRole("button", { name: `Actions for ${user.fullName}` }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit profile" }));
    const profileDialog = screen.getByRole("dialog", {
      name: "Edit user profile",
    });
    fireEvent.click(
      within(profileDialog).getByRole("button", { name: "Save changes" }),
    );

    const alert = await within(profileDialog).findByRole("alert");
    expect(alert).toHaveTextContent("does not have permission");
    expect(alert).not.toHaveTextContent("sensitive server detail");
  });

  it.each([
    [401, "session expired"],
    [404, "no longer exists"],
    [409, "changed after it was loaded"],
    [422, "values are invalid"],
    [429, "Too many requests were made"],
    [500, "could not complete this action"],
    [503, "temporarily unavailable"],
  ])("shows safe contextual feedback for HTTP %i", async (status, message) => {
    const user = makePlatformUser("ACTIVE");
    operationState.mutation.mutateAsync.mockRejectedValueOnce(
      new ApiError(
        status,
        "PLATFORM_USER_REQUEST_FAILED",
        "sensitive server detail",
      ),
    );
    renderUserDirectory(user);
    fireEvent.click(
      screen.getByRole("button", { name: `Actions for ${user.fullName}` }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit profile" }));
    const profileDialog = screen.getByRole("dialog", {
      name: "Edit user profile",
    });
    fireEvent.click(
      within(profileDialog).getByRole("button", { name: "Save changes" }),
    );

    const alert = await within(profileDialog).findByRole("alert");
    expect(alert).toHaveTextContent(message);
    expect(alert).not.toHaveTextContent("sensitive server detail");
  });

  it("explains why login sessions are unavailable without the exact session permission", async () => {
    const user = makePlatformUser("ACTIVE");
    renderUserDirectory(user);
    fireEvent.click(
      screen.getByRole("button", { name: `Actions for ${user.fullName}` }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "View details" }));
    const dialog = await screen.findByRole("dialog", { name: user.fullName });
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Refresh" }),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "sessionsDenied",
    );
    expect(
      within(dialog).queryByRole("heading", { name: "Sessions" }),
    ).not.toBeInTheDocument();
  });

  it("shows archived status and exposes only the safe restore action", async () => {
    const user = makePlatformUser("SUSPENDED", "2026-10-03T00:00:00.000Z");
    renderUserDirectory(user);

    expect(
      within(screen.getByRole("table")).getByText("Archived"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: `Actions for ${user.fullName}` }),
    );
    const menu = screen.getByRole("menu", {
      name: `Actions for ${user.fullName}`,
    });
    expect(
      within(menu).getByRole("menuitem", { name: "Restore account" }),
    ).toBeInTheDocument();
    for (const label of [
      "Edit profile",
      "Suspend account",
      "Reactivate account",
      "Archive user",
    ]) {
      expect(
        within(menu).queryByRole("menuitem", { name: label }),
      ).not.toBeInTheDocument();
    }
  });

  it("limits exact active-account lookup to Organization creation", () => {
    pathname.value = "/platform/organizations";
    session.data.permissions = [
      "organization.create",
      "platform.users.account.read",
    ];
    render(<PlatformConsole />);

    fireEvent.click(
      screen.getByRole("button", { name: "organizations.create" }),
    );

    expect(
      screen.getByLabelText("organizations.firstAdminEmail"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "organizations.findFirstAdmin" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("users.email")).not.toBeInTheDocument();
  });

  it("requires the exact account-read permission before showing first-ADMIN lookup", () => {
    pathname.value = "/platform/organizations";
    session.data.permissions = ["organization.create"];
    render(<PlatformConsole />);

    fireEvent.click(
      screen.getByRole("button", { name: "organizations.create" }),
    );

    expect(
      screen.queryByLabelText("organizations.firstAdminEmail"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "organizations.findFirstAdmin" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("users.accountLookupPermissionNeeded"),
    ).toBeInTheDocument();
  });

  it("rechecks stale sessions on route changes while keeping the Console mounted", () => {
    const { rerender } = render(<PlatformConsole />);
    pathname.value = "/platform/projects";
    rerender(<PlatformConsole />);
    expect(session.refetch).not.toHaveBeenCalled();
    session.isStale = true;
    pathname.value = "/platform/users";
    rerender(<PlatformConsole />);
    expect(session.refetch).toHaveBeenCalledTimes(1);
    rerender(<PlatformConsole />);
    expect(session.refetch).toHaveBeenCalledTimes(1);
  });

  it("connects the Projects route only when its Platform read permission is present", () => {
    pathname.value = "/platform/projects";
    session.data.permissions = ["platform.projects.project.read"];
    render(<PlatformConsole />);

    expect(
      screen.getByRole("heading", { name: "pages.projects.title" }),
    ).toBeInTheDocument();
    expect(screen.getByText("emptyTitle")).toBeInTheDocument();
    expect(operationHooks.usePlatformProjectsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 10 }),
      true,
    );
  });

  it("keeps authorization boundaries visible across operations routes", () => {
    const { rerender } = render(<PlatformConsole />);
    const blockedAreas = [
      [
        "/platform/jobs",
        "Your Platform session does not grant platform.jobs.job.read.",
      ],
      [
        "/platform/ai",
        "Your Platform session does not grant platform.ai.operations.read.",
      ],
      [
        "/platform/integrations",
        "Your Platform session does not grant platform.integrations.integration.read.",
      ],
      [
        "/platform/incidents",
        "Your Platform session does not grant platform.incidents.incident.read.",
      ],
      [
        "/platform/diagnostics",
        "Your Platform session does not grant platform.diagnostics.trace.read.",
      ],
    ] as const;

    for (const [path, expectedMessage] of blockedAreas) {
      pathname.value = path;
      rerender(<PlatformConsole />);
      expect(screen.getByText(expectedMessage)).toBeInTheDocument();
    }
  });

  it("shows only the current validated identity and permission projection on Account", () => {
    pathname.value = "/platform/account";
    render(<PlatformConsole />);

    expect(
      screen.getByRole("heading", { name: "account.identityTitle" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("main")).getByText("operator@example.test"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("platform.organizations.organization.read"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/eyJ[A-Za-z0-9_-]+\./)).not.toBeInTheDocument();
  });

  it("loads the paginated Audit list without filter controls", () => {
    pathname.value = "/platform/audit";
    session.data.permissions = ["platform.audit.read"];
    operationState.auditEvents.data = {
      data: [
        {
          eventId: "event-safe-1",
          occurredAt: "2026-10-13T00:00:00.000Z",
          actorUserId: "651a2b3c4d5e6f7a8b9c0d1e",
          action: "platform.project.metadata.changed",
          resourceType: "PROJECT",
          resourceId: "751a2b3c4d5e6f7a8b9c0d21",
          scope: "PLATFORM",
          result: "SUCCESS",
        },
      ],
      pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
    };
    render(<PlatformConsole />);

    expect(
      screen.queryByLabelText("audit.filterAction"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("audit.filterActor"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("audit.filterResource"),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Resource ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("audit.from")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("audit.to")).not.toBeInTheDocument();
    expect(
      screen.getByText("platform.project.metadata.changed"),
    ).toBeInTheDocument();
    expect(operationState.auditEventsQuery).toHaveBeenLastCalledWith(
      { page: 1, pageSize: 10 },
      true,
    );
  });

  it("renders dashboard aggregates from the Platform dashboard API", () => {
    pathname.value = "/platform";
    session.data.permissions = ["platform.dashboard.summary.read"];
    audit.data = [];
    render(<PlatformConsole />);

    expect(
      screen.getByRole("heading", { name: "pages.dashboard.title" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "dashboard.summary" }),
    ).toHaveTextContent("2");
    expect(
      screen.getByText("operatorDesign.accountDistribution"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("operatorDesign.projectDistribution"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("dashboard.serviceHealthNote").length,
    ).toBeGreaterThan(0);
  });

  it("supports membership review on its own route and requires confirmation before suspension", async () => {
    pathname.value = "/platform/memberships";
    session.data.permissions = [
      "platform.memberships.membership.read",
      "platform.memberships.lifecycle.manage",
    ];
    render(<PlatformConsole />);

    expect(
      screen.getByRole("heading", { name: "pages.memberships.title" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "memberships.search" }),
    ).toBeInTheDocument();
    expect(membershipListQuery).toHaveBeenLastCalledWith(
      { page: 1, search: "", status: "", organizationId: "" },
      true,
    );
    expect(screen.getByText("Member One")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "memberships.suspend" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "memberships.confirmTitle",
    });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "memberships.confirmSuspend",
      }),
    );
    await waitFor(() =>
      expect(suspend.mutateAsync).toHaveBeenCalledWith({
        membershipId: "751a2b3c4d5e6f7a8b9c0d21",
        expectedMembershipVersion: 2,
        reasonCode: "ACCESS_REVIEW",
      }),
    );
  });

  it("requests the next page of the global membership directory", () => {
    pathname.value = "/platform/memberships";
    session.data.permissions = ["platform.memberships.membership.read"];
    memberships.data.pagination.totalPages = 2;
    render(<PlatformConsole />);

    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "memberships.title" }),
      ).getByRole("button", { name: "next" }),
    );
    expect(membershipListQuery).toHaveBeenLastCalledWith(
      { page: 2, search: "", status: "", organizationId: "" },
      true,
    );
  });

  it("offers a retry when the bounded Audit API fails", () => {
    pathname.value = "/platform/audit";
    session.data.permissions = ["platform.audit.read"];
    Object.assign(operationState.auditEvents, { data: undefined });
    operationState.auditEvents.isError = true;
    render(<PlatformConsole />);

    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(operationState.auditEvents.refetch).toHaveBeenCalledOnce();
  });
  it("does not offer manual Refresh buttons on Services", () => {
    pathname.value = "/platform/services";
    session.data.permissions = [
      "platform.health.read",
      "platform.services.service.read",
    ];
    render(<PlatformConsole />);
    expect(
      screen.queryByRole("button", { name: "refresh" }),
    ).not.toBeInTheDocument();
  });
});
