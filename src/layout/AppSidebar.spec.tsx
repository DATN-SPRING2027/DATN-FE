import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppSidebar from "./AppSidebar";

const { replace, logoutAsync, selectAsync, currentUser, organizations } =
  vi.hoisted(() => ({
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
  usePathname: () => "/projects",
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
vi.mock("@/icons/index", () => {
  const Icon = () => null;
  return {
    ArrowRightIcon: Icon,
    BookOpenIcon: Icon,
    CalenderIcon: Icon,
    CheckCircleIcon: Icon,
    ChevronDownIcon: Icon,
    FolderIcon: Icon,
    GridIcon: Icon,
    GroupIcon: Icon,
    HandShakeIcon: Icon,
    LogOutIcon: Icon,
    PlugInIcon: Icon,
    SettingsIcon: Icon,
    ShootingStarIcon: Icon,
    DocsIcon: Icon,
  };
});
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const translations: Record<string, string> = {
      "sidebar.navigation": "Main navigation",
      "sidebar.brandLabel": "Continuum AI home",
      "sidebar.groups.administration": "Administration",
      "sidebar.items.overview": "Overview",
      "sidebar.items.projects": "Projects",
      "sidebar.items.workNotes": "Work Notes",
      "sidebar.items.knowledge": "Knowledge",
      "sidebar.items.aiSearch": "AI Search",
      "sidebar.items.handover": "Handover",
      "sidebar.items.calendar": "Calendar",
      "sidebar.items.members": "Members",
      "sidebar.items.integrations": "Integrations",
      "sidebar.items.settings": "Settings",
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
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
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
    ).toEqual(["Overview", "Projects", "Calendar", "Members"]);
    expect(within(nav).queryByRole("link", { name: "Work" })).not.toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Projects" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("hides Organization Members from navigation when the user lacks organization.memberships.read", () => {
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
    ).toEqual(["Overview", "Projects", "Calendar"]);
    expect(
      within(nav).queryByRole("link", { name: "Members" }),
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

  it("shows not-yet-routed features as disabled items instead of broken links", () => {
    render(<AppSidebar />);

    for (const label of [
      "Work Notes",
      "Knowledge",
      "AI Search",
      "Handover",
      "Integrations",
      "Settings",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
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
});
