import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppSidebar from "./AppSidebar";
import { isPointInSafeTriangle } from "./SidebarFlyoutMenu";

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
    },
    isLoading: false,
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
    SettingsIcon: Icon,
    ShootingStarIcon: Icon,
    DocsIcon: Icon,
  };
});
vi.mock("next-intl", () => ({
  useTranslations:
    (namespace: string) => (key: string, values?: Record<string, string>) => {
      const translations: Record<string, string> = {
        "sidebar.navigation": "Main navigation",
        "sidebar.brandLabel": "Continuum AI home",
        "sidebar.groups.administration": "Administration",
        "sidebar.items.overview": "Overview",
        "sidebar.items.projects": "Projects",
        "sidebar.items.projectOverview": "Overview",
        "sidebar.items.projectMembers": "Project members",
        "sidebar.items.workspace": "Workspace",
        "sidebar.items.projectWorkNotes": "Work Notes",
        "sidebar.items.projectSettings": "Setting",
        "sidebar.items.chat": "Chat",
        "sidebar.items.workNotes": "Work Notes",
        "sidebar.items.knowledge": "Knowledge",
        "sidebar.items.aiSearch": "AI Search",
        "sidebar.items.handover": "Handover",
        "sidebar.items.calendar": "Calendar",
        "sidebar.items.members": "Members",
        "sidebar.items.integrations": "Integrations",
        "sidebar.items.settings": "Settings",
        "sidebar.projectsDropdownToggle": "Toggle projects list",
        "sidebar.projectsSubmenuLabel": "Organization projects",
        "sidebar.projectDropdownToggle": `Toggle ${values?.name ?? ""} options`,
        "sidebar.projectActionsLabel": `${values?.name ?? ""} actions`,
        "sidebar.projectsLoading": "Loading projects…",
        "sidebar.projectsEmpty": "No active projects",
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
    ).toEqual(["Overview", "Projects", "Chat", "Members", "Settings"]);
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

  it("expands Projects dropdown to list organization projects, and expands each project to show its Workspace link", () => {
    render(<AppSidebar />);
    const nav = screen.getByRole("navigation", { name: "Main navigation" });

    fireEvent.click(
      within(nav).getByRole("button", { name: "Toggle projects list" }),
    );
    const projectsGroup = within(nav).getByRole("group", {
      name: "Organization projects",
    });
    expect(
      within(projectsGroup).getByText("Continuum Workspace Core"),
    ).toBeInTheDocument();
    expect(
      within(projectsGroup).getByText("AI Knowledge Engine"),
    ).toBeInTheDocument();

    fireEvent.click(
      within(projectsGroup).getByRole("button", {
        name: "Toggle Continuum Workspace Core options",
      }),
    );
    const projectActions = within(projectsGroup).getByRole("group", {
      name: "Continuum Workspace Core actions",
    });
    expect(
      within(projectActions).getByRole("link", { name: "Overview" }),
    ).toHaveAttribute("href", "/projects/69e923c77859fd1c702d4c21/overview");
    expect(
      within(projectActions).getByRole("link", { name: "Project members" }),
    ).toHaveAttribute("href", "/projects/69e923c77859fd1c702d4c21/members");
    const workspaceLink = within(projectActions).getByRole("link", {
      name: "Workspace",
    });
    expect(workspaceLink).toHaveAttribute(
      "href",
      "/projects/69e923c77859fd1c702d4c21/work",
    );
    expect(
      within(projectActions).getByRole("link", { name: "Work Notes" }),
    ).toHaveAttribute("href", "/projects/69e923c77859fd1c702d4c21/work-notes");
    expect(
      within(projectActions).getByRole("link", { name: "Setting" }),
    ).toHaveAttribute("href", "/projects/69e923c77859fd1c702d4c21/settings");
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
    ).toEqual(["Projects", "Chat"]);
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
    for (const label of [
      "Knowledge",
      "AI Search",
      "Integrations",
    ]) {
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

  it("renders a portaled hover Flyout menu after 175ms intent delay, enforces a single active flyout, supports safe triangle geometry, and closes on Escape", () => {
    vi.useFakeTimers();
    try {
      render(<AppSidebar />);
      const nav = screen.getByRole("navigation", { name: "Main navigation" });
      const projectsItem = within(nav).getByRole("link", { name: "Projects" }).closest("li")!;
      const overviewItem = within(nav).getByRole("link", { name: "Overview" }).closest("li")!;

      fireEvent.mouseEnter(projectsItem);
      act(() => {
        vi.advanceTimersByTime(100);
      });
      fireEvent.mouseLeave(projectsItem, { clientX: 200, clientY: 160 });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.queryByTestId("sidebar-flyout-projects")).not.toBeInTheDocument();

      fireEvent.mouseEnter(projectsItem);
      act(() => {
        vi.advanceTimersByTime(180);
      });
      const projectsFlyout = screen.getByTestId("sidebar-flyout-projects");
      expect(projectsFlyout).toBeInTheDocument();
      expect(projectsFlyout.parentElement).toBe(document.body);
      expect(within(projectsFlyout).getByText("Continuum Workspace Core")).toBeInTheDocument();

      fireEvent.mouseLeave(projectsItem, { clientX: 200, clientY: 160 });
      fireEvent.mouseEnter(overviewItem);
      act(() => {
        vi.advanceTimersByTime(180);
      });
      expect(screen.queryByTestId("sidebar-flyout-projects")).not.toBeInTheDocument();
      expect(screen.getByTestId("sidebar-flyout-overview")).toBeInTheDocument();

      expect(
        isPointInSafeTriangle(
          { x: 240, y: 180 },
          { x: 200, y: 160 },
          { x: 290, y: 120 },
          { x: 290, y: 320 },
        ),
      ).toBe(true);

      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByTestId("sidebar-flyout-overview")).not.toBeInTheDocument();
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
