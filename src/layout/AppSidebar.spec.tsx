import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppSidebar from "./AppSidebar";
import { isPointInSafeTriangle } from "./SidebarFlyoutMenu";
import { ApiError } from "@/lib/api-client";

const managementAccess = vi.hoisted(() => ({
  allowed: {} as Record<string, boolean>,
}));
vi.mock("@/lib/queries/projects/useProjectSettings", () => ({
  useProjectManagementAccess: (_organizationId: string, projectId: string) => ({
    canAccessSettings: managementAccess.allowed[projectId] ?? true,
  }),
}));

const {
  replace,
  logoutAsync,
  selectAsync,
  currentUser,
  organizations,
  projectsData,
  routeState,
} = vi.hoisted(() => ({
  replace: vi.fn(),
  logoutAsync: vi.fn(),
  selectAsync: vi.fn(),
  currentUser: {
    error: undefined as Error | undefined,
    data: {
      id: "user-1",
      name: "Minh Anh",
      email: "minh@example.test",
      organizationId: "org-1",
      roles: ["ADMIN"],
    },
  },
  organizations: { data: [{ id: "org-1", name: "North Star Company" }] },
  projectsData: {
    data: {
      data: [
        {
          id: "69e923c77859fd1c702d4c21",
          organizationId: "org-1",
          name: "Continuum Workspace Core",
          code: "CNTM",
          visibility: "PRIVATE",
          status: "ACTIVE",
        },
        {
          id: "69e923c77859fd1c702d4c99",
          organizationId: "org-1",
          name: "AI Knowledge Engine",
          code: "AIKE",
          visibility: "PUBLIC",
          status: "ACTIVE",
        },
      ],
      pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  routeState: { pathname: "/projects" },
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
  usePathname: () => routeState.pathname,
  useRouter: () => ({ replace }),
}));
vi.mock("@/context/SidebarContext", () => ({
  useSidebar: () => ({
    isExpanded: true,
    isMobileOpen: false,
    isHovered: false,
    setIsHovered: vi.fn(),
  }),
}));
vi.mock("@/components/common/BrandLogo", () => ({
  default: () => <span>Continuum AI</span>,
}));
vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCurrentUserQuery: () => currentUser,
  useLogoutMutation: () => ({
    mutateAsync: logoutAsync,
    isPending: false,
    isError: false,
  }),
}));
vi.mock("@/lib/queries/auth/useAccountOnboarding", () => ({
  useOrganizationOptionsQuery: () => organizations,
  useSelectOrganizationMutation: () => ({
    mutateAsync: selectAsync,
    reset: vi.fn(),
    isPending: false,
    isError: false,
  }),
}));
vi.mock("@/lib/queries/projects/useProjects", () => ({
  useProjectsQuery: () => projectsData,
  useInfiniteProjectsQuery: () => ({
    data: { pages: [projectsData.data] },
    isSuccess: true,
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    fetchNextPage: vi.fn(),
  }),
}));
vi.mock("@/icons/index", () => {
  const Icon = () => null;
  return {
    ArrowRightIcon: Icon,
    BookOpenIcon: Icon,
    ChatIcon: Icon,
    CalenderIcon: Icon,
    CheckCircleIcon: Icon,
    ChevronDownIcon: Icon,
    FolderIcon: Icon,
    GridIcon: Icon,
    GroupIcon: Icon,
    HandShakeIcon: Icon,
    LogOutIcon: Icon,
    PlugInIcon: Icon,
    PlusIcon: Icon,
    SearchIcon: Icon,
    SettingsIcon: Icon,
    ShootingStarIcon: Icon,
    BoxCubeIcon: Icon,
    DocsIcon: Icon,
    FileIcon: Icon,
    TaskIcon: Icon,
  };
});
vi.mock("next-intl", () => ({
  useTranslations:
    (namespace: string) => (key: string, values?: Record<string, string>) => {
      const translations: Record<string, string> = {
        "sidebar.navigation": "Main navigation",
        "sidebar.projectNavigation": "Project navigation",
        "sidebar.brandLabel": "Continuum AI home",
        "sidebar.groups.project": "Project",
        "sidebar.groups.organization": "Organization",
        "sidebar.groups.workspace": "Workspace",
        "sidebar.items.dashboard": "Dashboard",
        "sidebar.groups.administration": "Administration",
        "sidebar.items.overview": "Overview",
        "sidebar.items.projects": "Projects",
        "sidebar.items.projectOverview": "Overview",
        "sidebar.items.projectMembers": "Members",
        "sidebar.items.workspace": "Workspace",
        "sidebar.items.projectWorkNotes": "Work Notes",
        "sidebar.items.projectHandover": "Handover",
        "sidebar.items.projectSettings": "Settings",
        "sidebar.items.chat": "Chat",
        "sidebar.items.workNotes": "Work Notes",
        "sidebar.items.knowledge": "Knowledge",
        "sidebar.items.aiSearch": "AI Chat",
        "sidebar.items.handover": "Handover",
        "sidebar.items.calendar": "Calendar",
        "sidebar.items.members": "Members",
        "sidebar.items.integrations": "Integrations",
        "sidebar.items.settings": "Settings",
        "sidebar.projectLabel": "Project",
        "sidebar.projectSwitcherLabel": "Choose project",
        "sidebar.projectListLabel": "Projects",
        "sidebar.projectUnavailable": "No active projects",
        "sidebar.projectSelectPlaceholder": "Select a project",
        "sidebar.projectsDropdownToggle": "Toggle projects list",
        "sidebar.projectsSubmenuLabel": "Organization projects",
        "sidebar.projectDropdownToggle": `Toggle ${values?.name ?? ""} options`,
        "sidebar.projectActionsLabel": `${values?.name ?? ""} actions`,
        "sidebar.projectsLoading": "Loading projects…",
        "sidebar.projectsLoadError": "Could not load projects.",
        "sidebar.projectsRetry": "Try again",
        "sidebar.projectsEmpty": "No active projects",
        "sidebar.searchProjectsPlaceholder": "Search projects...",
        "sidebar.recentProjectsHeading": "Recent",
        "sidebar.activeProjectStatus": "Active",
        "sidebar.currentProject": "Current project",
        "sidebar.noProjectsMatchSearch": "No matching projects",
        "sidebar.createProject": "Create project",
        "sidebar.viewAllProjects": "View all projects",
        "sidebar.organizationLabel": "Organization",
        "sidebar.organizationUnavailable": "Organization unavailable",
        "sidebar.organizationSwitcherLabel": "Choose organization",
        "sidebar.organizationListLabel": "Organizations",
        "sidebar.organizationLoading": "Loading organizations…",
        "sidebar.organizationLoadError": "Could not load organizations.",
        "sidebar.organizationRetry": "Try again",
        "sidebar.organizationSelectError": "Could not switch organizations.",
        "sidebar.organizationSwitching": "Switching…",
        "sidebar.manageOrganizations": "Manage organizations",
        "sidebar.createOrganization": "Create organization",
        "sidebar.account.signOut": "Sign out",
        "sidebar.account.signingOut": "Signing out…",
        "sidebar.account.signOutError": "Could not sign out. Try again.",
        "sidebar.account.defaultRole": "Member",
      };
      return translations[`${namespace}.${key}`] ?? key;
    },
}));

describe("AppSidebar navigation", () => {
  beforeEach(() => {
    managementAccess.allowed = {};
    currentUser.error = undefined;
    replace.mockReset();
    logoutAsync.mockReset().mockResolvedValue(undefined);
    selectAsync.mockReset().mockResolvedValue(undefined);
    routeState.pathname = "/projects";
    currentUser.data = {
      id: "user-1",
      name: "Minh Anh",
      email: "minh@example.test",
      organizationId: "org-1",
      roles: ["ADMIN"],
    };
    organizations.data = [{ id: "org-1", name: "North Star Company" }];
  });

  it("does not expose cached Manager navigation after identity access is rejected", () => {
    currentUser.error = new ApiError(403, "FORBIDDEN", "Membership revoked");
    render(<AppSidebar />);
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Members" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Project navigation" }),
    ).not.toBeInTheDocument();
  });

  it("hides Project Settings from a Member and limits a Leader to the authorized Project", () => {
    currentUser.data.roles = ["MEMBER"];
    managementAccess.allowed = {
      "69e923c77859fd1c702d4c21": true,
      "69e923c77859fd1c702d4c99": false,
    };
    render(<AppSidebar />);

    const projectNav = screen.getByRole("navigation", {
      name: "Project navigation",
    });
    expect(
      within(projectNav).getByRole("group", {
        name: "Continuum Workspace Core actions",
      }),
    ).toBeInTheDocument();
    expect(
      within(projectNav).getByRole("link", { name: "Settings" }),
    ).toBeInTheDocument();

    // Switch to AI Knowledge Engine via the Project Selector
    fireEvent.click(screen.getByRole("button", { name: "Choose project" }));
    const projectOptions = screen.getByRole("region", { name: "Projects" });
    fireEvent.click(
      within(projectOptions).getByRole("button", {
        name: /AI Knowledge Engine/,
      }),
    );

    expect(
      within(projectNav).getByRole("group", {
        name: "AI Knowledge Engine actions",
      }),
    ).toBeInTheDocument();
    expect(
      within(projectNav).queryByRole("link", { name: "Settings" }),
    ).not.toBeInTheDocument();
  });

  it("opens a dropdown containing exactly the organizations available to the account", () => {
    render(<AppSidebar />);

    expect(screen.getByText("North Star Company")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Choose organization" }),
    );
    expect(
      screen.getByRole("region", { name: "Organizations" }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", { name: "Organizations" }),
      ).getAllByRole("button"),
    ).toHaveLength(1);
    expect(
      within(screen.getByRole("region", { name: "Organizations" })).getByText(
        "North Star Company",
      ),
    ).toBeInTheDocument();
  });

  it("enforces mutual exclusion so Organization selector and Project selector are never open simultaneously", () => {
    render(<AppSidebar />);

    const orgTrigger = screen.getByRole("button", {
      name: "Choose organization",
    });
    const projectTrigger = screen.getByRole("button", {
      name: "Choose project",
    });

    fireEvent.click(orgTrigger);
    expect(
      screen.getByRole("region", { name: "Organizations" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Projects" }),
    ).not.toBeInTheDocument();

    // Opening Project selector must automatically close Organization selector
    fireEvent.click(projectTrigger);
    expect(
      screen.queryByRole("region", { name: "Organizations" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Projects" }),
    ).toBeInTheDocument();

    // Opening Organization selector again must automatically close Project selector
    fireEvent.click(orgTrigger);
    expect(
      screen.getByRole("region", { name: "Organizations" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Projects" }),
    ).not.toBeInTheDocument();
  });

  it("shows both organization choices and switches workspace when one is selected", async () => {
    organizations.data = [
      { id: "org-1", name: "North Star Company" },
      { id: "org-2", name: "Sunrise Institute" },
    ];
    render(<AppSidebar />);
    fireEvent.click(
      screen.getByRole("button", { name: "Choose organization" }),
    );
    const list = screen.getByRole("region", { name: "Organizations" });

    expect(within(list).getAllByRole("button")).toHaveLength(2);
    await act(async () => {
      fireEvent.click(
        within(list).getByRole("button", { name: /Sunrise Institute/ }),
      );
    });

    expect(selectAsync).toHaveBeenCalledWith("org-2");
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/projects"));
  });

  it("routes to /dashboard when switching from /organization/members to an organization without ADMIN access", async () => {
    routeState.pathname = "/organization/members";
    organizations.data = [
      { id: "org-1", name: "North Star Company" },
      { id: "org-2", name: "Sunrise Institute" },
    ];
    selectAsync.mockResolvedValueOnce({
      user: {
        id: "user-1",
        name: "Minh Anh",
        email: "minh@example.test",
        organizationId: "org-2",
        roles: [],
      },
    });
    render(<AppSidebar />);
    fireEvent.click(
      screen.getByRole("button", { name: "Choose organization" }),
    );
    const list = screen.getByRole("region", { name: "Organizations" });

    await act(async () => {
      fireEvent.click(
        within(list).getByRole("button", { name: /Sunrise Institute/ }),
      );
    });

    expect(selectAsync).toHaveBeenCalledWith("org-2");
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("closes the organization dropdown with Escape and restores trigger focus", () => {
    render(<AppSidebar />);
    const trigger = screen.getByRole("button", { name: "Choose organization" });
    fireEvent.click(trigger);
    expect(
      screen.getByRole("region", { name: "Organizations" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(
      screen.queryByRole("region", { name: "Organizations" }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps available destinations in the requested order and marks the active route", () => {
    render(<AppSidebar />);
    const nav = screen.getByRole("navigation", { name: "Main navigation" });

    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent?.trim()),
    ).toEqual(["Dashboard", "Projects", "Chat", "AI Chat", "Members", "Settings"]);
    expect(within(nav).getByRole("region", { name: "Organization" })).toBeInTheDocument();
    expect(
      within(nav).queryByRole("button", { name: "Work Notes" }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: "Work" }),
    ).not.toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Projects" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders only the active project's navigation (Overview, Members, Workspace, Work Notes, Settings) and switches project context via the Project Selector", () => {
    routeState.pathname = "/projects/69e923c77859fd1c702d4c21/work-notes";
    render(<AppSidebar />);

    const projectNav = screen.getByRole("navigation", {
      name: "Project navigation",
    });
    const projectActions = within(projectNav).getByRole("group", {
      name: "Continuum Workspace Core actions",
    });

    expect(
      within(projectActions)
        .getAllByRole("link")
        .map((link) => link.textContent?.trim()),
    ).toEqual(["Overview", "Members", "Workspace", "Work Notes", "Handover", "Settings"]);

    expect(
      within(projectActions).getByRole("link", { name: "Overview" }),
    ).toHaveAttribute("href", "/projects/69e923c77859fd1c702d4c21/overview");
    expect(
      within(projectActions).getByRole("link", { name: "Members" }),
    ).toHaveAttribute("href", "/projects/69e923c77859fd1c702d4c21/members");
    expect(
      within(projectActions).getByRole("link", { name: "Workspace" }),
    ).toHaveAttribute("href", "/projects/69e923c77859fd1c702d4c21/work");
    expect(
      within(projectActions).getByRole("link", { name: "Work Notes" }),
    ).toHaveAttribute("href", "/projects/69e923c77859fd1c702d4c21/work-notes");
    expect(
      within(projectActions).getByRole("link", { name: "Work Notes" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(projectActions).getByRole("link", { name: "Handover" }),
    ).toHaveAttribute("href", "/projects/69e923c77859fd1c702d4c21/handover");
    expect(
      within(projectActions).getByRole("link", { name: "Settings" }),
    ).toHaveAttribute("href", "/projects/69e923c77859fd1c702d4c21/settings");

    // Ensure non-selected projects do NOT duplicate navigation groups in the sidebar
    expect(
      within(projectNav).queryByRole("group", {
        name: "AI Knowledge Engine actions",
      }),
    ).not.toBeInTheDocument();

    // Open Project Selector, filter projects by search, and switch to AI Knowledge Engine
    fireEvent.click(screen.getByRole("button", { name: "Choose project" }));
    const projectDropdown = screen.getByRole("region", { name: "Projects" });
    const searchInput = within(projectDropdown).getByRole("searchbox", {
      name: "Search projects...",
    });

    fireEvent.change(searchInput, { target: { value: "AIKE" } });
    expect(
      within(projectDropdown).queryByRole("button", {
        name: /Continuum Workspace Core/,
      }),
    ).not.toBeInTheDocument();
    const targetProjectBtn = within(projectDropdown).getByRole("button", {
      name: /AI Knowledge Engine/,
    });
    expect(targetProjectBtn).toBeInTheDocument();

    expect(
      within(projectDropdown).getByRole("link", { name: "Create project" }),
    ).toHaveAttribute("href", "/projects/new");
    expect(
      within(projectDropdown).getByRole("link", { name: "View all projects" }),
    ).toHaveAttribute("href", "/projects");

    fireEvent.click(targetProjectBtn);
    expect(replace).toHaveBeenCalledWith(
      "/projects/69e923c77859fd1c702d4c99/work-notes",
    );
  });

  it("keeps the user on /workspace?projectId=<id> when switching project from /workspace", () => {
    routeState.pathname = "/workspace";
    render(<AppSidebar />);

    fireEvent.click(screen.getByRole("button", { name: "Choose project" }));
    const projectDropdown = screen.getByRole("region", { name: "Projects" });
    fireEvent.click(
      within(projectDropdown).getByRole("button", {
        name: /AI Knowledge Engine/,
      }),
    );

    expect(replace).toHaveBeenCalledWith(
      "/workspace?projectId=69e923c77859fd1c702d4c99",
    );
  });

  it("hides Organization Members and Settings from navigation when the user lacks organization.memberships.read", () => {
    currentUser.data = {
      ...currentUser.data,
      roles: ["MEMBER"],
    };
    render(<AppSidebar />);
    const nav = screen.getByRole("navigation", { name: "Main navigation" });

    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent?.trim()),
    ).toEqual(["Projects", "Chat", "AI Chat"]);
    expect(
      within(nav).queryByRole("link", { name: "Members" }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: "Settings" }),
    ).not.toBeInTheDocument();
  });

  it("keeps Organization Members hidden for non-admin roles even with an unsupported read permission claim", () => {
    currentUser.data = {
      ...currentUser.data,
      roles: ["MEMBER"],
      permissions: ["organization.memberships.read"],
    } as typeof currentUser.data;
    render(<AppSidebar />);
    const nav = screen.getByRole("navigation", { name: "Main navigation" });

    expect(
      within(nav).queryByRole("link", { name: "Members" }),
    ).not.toBeInTheDocument();
  });

  it("does not expose deferred Platform operations to a Platform Operator", () => {
    currentUser.data = {
      ...currentUser.data,
      roles: ["PLATFORM_OPERATOR"],
    };
    render(<AppSidebar />);

    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    const controls = [
      ...within(nav).getAllByRole("link"),
      ...within(nav).getAllByRole("button"),
    ];

    expect(
      controls.filter((control) =>
        /platform|operations|configuration/i.test(
          control.getAttribute("aria-label") ?? control.textContent ?? "",
        ),
      ),
    ).toHaveLength(0);
    expect(
      within(nav)
        .getAllByRole("link")
        .some((link) => link.getAttribute("href")?.includes("/platform")),
    ).toBe(false);
  });

  it("shows not-yet-routed features as disabled items with dark-mode legible text instead of broken links", () => {
    render(<AppSidebar />);

    expect(screen.getByRole("complementary")).toHaveClass("dark:text-gray-100");
    for (const label of ["Knowledge", "Integrations"]) {
      const button = screen.getByRole("button", { name: label });
      expect(button).toBeDisabled();
      expect(button).toHaveClass("text-gray-500", "dark:text-gray-400");
    }
  });

  it("shows the signed-in account and redirects only after a successful sign-out", async () => {
    render(<AppSidebar />);

    expect(screen.getByText("Minh Anh")).toBeInTheDocument();
    expect(screen.getByText("organizationAdmin")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(logoutAsync).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/signin"));
  });

  it("does not open hover flyout popovers when hovering over Dashboard, Projects, Chat, Members, or Settings", () => {
    vi.useFakeTimers();
    try {
      render(<AppSidebar />);
      const nav = screen.getByRole("navigation", { name: "Main navigation" });
      for (const name of ["Dashboard", "Projects", "Chat", "Members", "Settings"]) {
        const item = within(nav).getByRole("link", { name }).closest("li")!;
        fireEvent.mouseEnter(item);
        act(() => {
          vi.advanceTimersByTime(300);
        });
      }
      expect(screen.queryByTestId(/sidebar-flyout-/)).not.toBeInTheDocument();
      expect(
        isPointInSafeTriangle(
          { x: 240, y: 180 },
          { x: 200, y: 160 },
          { x: 290, y: 120 },
          { x: 290, y: 320 },
        ),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("allows dragging the sidebar edge resizer between 180px and 420px and resets to 240px on double-click", () => {
    render(<AppSidebar />);
    const aside = screen.getByRole("complementary");
    const resizer = screen.getByTestId("sidebar-resizer");

    expect(aside).toHaveStyle({ width: "240px" });

    fireEvent.mouseDown(resizer, { button: 0, clientX: 240 });
    fireEvent.mouseMove(window, { clientX: 320 });
    fireEvent.mouseUp(window);
    expect(aside).toHaveStyle({ width: "320px" });

    fireEvent.mouseDown(resizer, { button: 0, clientX: 320 });
    fireEvent.mouseMove(window, { clientX: 520 });
    fireEvent.mouseUp(window);
    expect(aside).toHaveStyle({ width: "420px" });

    fireEvent.mouseDown(resizer, { button: 0, clientX: 420 });
    fireEvent.mouseMove(window, { clientX: 90 });
    fireEvent.mouseUp(window);
    expect(aside).toHaveStyle({ width: "64px" });
    expect(screen.queryByText("Projects")).not.toBeInTheDocument();

    fireEvent.mouseEnter(aside);
    expect(aside).toHaveStyle({ width: "64px" });
    expect(screen.queryByText("Projects")).not.toBeInTheDocument();

    fireEvent.doubleClick(resizer);
    expect(aside).toHaveStyle({ width: "240px" });
    expect(screen.getByText("Projects")).toBeInTheDocument();
  });
});
