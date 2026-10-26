import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AppProviders } from "@/lib/providers/AppProviders";
import AppHeader from "./AppHeader";

const replace = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace, push: replace }),
  usePathname: () => "/dashboard",
  Link: ({
    children,
    href,
    onClick,
    className,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: () => void;
    className?: string;
  }) => (
    <a href={href} onClick={onClick} className={className} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values?.plan ? `${key}:${values.plan}` : key,
}));

vi.mock("@/i18n/languages", () => ({
  getLanguage: () => ({
    FlagIcon: () => null,
    name: "English",
    shortName: "English",
  }),
  languages: [
    {
      id: "en",
      name: "English",
      shortName: "English",
      FlagIcon: () => null,
    },
  ],
}));

vi.mock("@/components/common/BrandLogo", () => ({
  default: () => <span>ContinuumLogo</span>,
}));

vi.mock("@/components/chat/ChatNotifications", () => ({
  default: () => <button type="button">NotificationsMock</button>,
}));

function mockSessionFetch(
  roles: string[],
  projects: Array<Record<string, unknown>> = [],
) {
  vi.spyOn(global, "fetch").mockImplementation(async (url) => {
    const target = String(url);
    if (target.endsWith("/auth/me")) {
      return new Response(
        JSON.stringify({
          id: "user-1",
          name: "Phuc Nguyen",
          email: "phuc@continuum.ai",
          organizationId: "org-1",
          roles,
        }),
      );
    }
    if (target.endsWith("/iam/users/user-1")) {
      return new Response(
        JSON.stringify({
          id: "user-1",
          fullName: "Phuc Nguyen",
          avatarUrl: null,
        }),
      );
    }
    if (target.includes("/projects")) {
      return new Response(
        JSON.stringify({
          data: projects,
          pagination: {
            page: 1,
            pageSize: projects.length || 20,
            totalItems: projects.length,
            totalPages: projects.length ? 1 : 0,
          },
        }),
      );
    }
    return new Response("{}");
  });
}

function renderHeader() {
  return render(
    <AppProviders>
      <ThemeProvider>
        <SidebarProvider>
          <AppHeader />
        </SidebarProvider>
      </ThemeProvider>
    </AppProviders>,
  );
}

describe("AppHeader", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    replace.mockReset();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("renders centered search input without Ctrl/Cmd+K badge, searches system features, opens Update modal, and toggles Help drawer", async () => {
    mockSessionFetch(["ADMIN"]);
    renderHeader();

    const searchInput = screen.getByPlaceholderText("searchPlaceholder");
    expect(searchInput).toBeInTheDocument();
    expect(screen.queryByText("⌘")).not.toBeInTheDocument();

    // Search for Chat feature and press Enter to navigate
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: "tin nhan" } });
    const resultsRegion = screen.getByRole("region", { name: "System features" });
    expect(within(resultsRegion).getByRole("link", { name: /Chat/i })).toHaveAttribute(
      "href",
      "/chat",
    );
    fireEvent.submit(searchInput.closest("form")!);
    expect(replace).toHaveBeenCalledWith("/chat");

    // Open Update modal
    fireEvent.click(screen.getByRole("button", { name: "update" }));
    expect(screen.getByText("upgradeModal.title")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "upgradeModal.upgradeNow" }),
    );
    expect(
      screen.getByText("upgradeModal.demoNotice:upgradeModal.plans.pro.name"),
    ).toBeInTheDocument();

    // Toggle Help right sidebar
    fireEvent.click(screen.getByRole("button", { name: "help" }));
    expect(
      screen.getByRole("complementary", { name: "helpDrawer.title" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "helpDrawer.keyboardShortcuts" }),
    );
    expect(screen.getByText("helpDrawer.shortcutSearch")).toBeInTheDocument();
  });

  it("debounces project search and requests suggestions with the search query", async () => {
    mockSessionFetch(["ADMIN"], [
      {
        id: "project-1",
        organizationId: "org-1",
        name: "Apollo",
        code: "APOLLO",
        visibility: "PRIVATE",
        status: "ACTIVE",
        createdBy: "user-1",
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-20T00:00:00.000Z",
      },
    ]);
    renderHeader();

    const searchInput = screen.getByPlaceholderText("searchPlaceholder");
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: "Ap" } });

    await waitFor(() => {
      const projectRequests = vi
        .mocked(global.fetch)
        .mock.calls.map(([url]) => String(url))
        .filter((url) => url.includes("/projects?"));
      expect(projectRequests).toHaveLength(1);
      expect(projectRequests[0]).toContain(
        "/projects?page=1&pageSize=8&status=ACTIVE&q=Ap&includeTotal=false",
      );
    });

    fireEvent.change(searchInput, { target: { value: "Apollo" } });
    await waitFor(() => {
      const projectRequests = vi
        .mocked(global.fetch)
        .mock.calls.map(([url]) => String(url))
        .filter((url) => url.includes("/projects?"));
      expect(projectRequests).toHaveLength(2);
      expect(projectRequests[1]).toContain("q=Apollo");
    });
  });

  it("shows role-adapted Settings items and closes Settings when opening UserDropdown", async () => {
    mockSessionFetch(["ADMIN"]);
    renderHeader();

    await waitFor(() =>
      expect(screen.getByText("Phuc Nguyen")).toBeInTheDocument(),
    );
    expect(
      vi.mocked(global.fetch).mock.calls.some(([url]) =>
        String(url).includes("/projects?"),
      ),
    ).toBe(false);

    // Open Settings dropdown as Manager (ADMIN)
    fireEvent.click(screen.getByRole("button", { name: "settings" }));
    expect(vi.mocked(global.fetch).mock.calls.some(([url]) => String(url).includes("/projects?page=1&pageSize=20"))).toBe(false);
    expect(
      screen.getByText("settingsMenu.systemTitle"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("settingsMenu.userManagementTitle"),
    ).toBeInTheDocument();

    // Clicking UserDropdown avatar button closes Settings dropdown (mutual exclusion)
    const avatarBtn = screen.getByRole("button", { name: /Phuc Nguyen/ });
    fireEvent.mouseDown(avatarBtn);
    fireEvent.click(avatarBtn);

    expect(
      screen.queryByText("settingsMenu.systemTitle"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("profile")).toBeInTheDocument();
    expect(screen.getByText("theme")).toBeInTheDocument();
    expect(screen.getByText("language")).toBeInTheDocument();
    expect(screen.getByText("switchAccount")).toBeInTheDocument();

    // Open Theme submenu inside UserDropdown
    fireEvent.click(screen.getByRole("button", { name: "theme" }));
    expect(screen.getByText("themeLight")).toBeInTheDocument();
    expect(screen.getByText("themeDark")).toBeInTheDocument();
    expect(screen.getByText("themeSystem")).toBeInTheDocument();
  });

  it("hides admin settings items for Member role", async () => {
    mockSessionFetch(["MEMBER"]);
    renderHeader();

    await waitFor(() =>
      expect(screen.getByText("Phuc Nguyen")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "settings" }));
    expect(
      screen.getByText("settingsMenu.generalTitle"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("settingsMenu.spacesTitle"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("settingsMenu.systemTitle"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("settingsMenu.userManagementTitle"),
    ).not.toBeInTheDocument();
  });
});
