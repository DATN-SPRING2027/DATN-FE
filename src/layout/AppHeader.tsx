"use client";

import NotificationDropdown from "@/components/header/NotificationDropdown";
import BrandLogo from "@/components/common/BrandLogo";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import HeaderHelpDrawer from "@/components/header/HeaderHelpDrawer";
import HeaderSettingsDropdown from "@/components/header/HeaderSettingsDropdown";
import UserDropdown from "@/components/header/UserDropdown";
import { useSidebar } from "@/context/SidebarContext";
import { Link, useRouter } from "@/i18n/navigation";
import {
  ChatIcon,
  CloseIcon,
  DocsIcon,
  FolderIcon,
  GridIcon,
  GroupIcon,
  HorizontaLDots,
  ListIcon,
  PlugInIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  UserCircleIcon,
} from "@/icons";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import { canReadOrganizationMemberships } from "@/lib/queries/organization-memberships/organization-membership-permissions";
import { useProjectsQuery } from "@/lib/queries/projects/useProjects";
import { cn } from "@/utils";
import { useTranslations } from "next-intl";
import { tr } from "@/i18n/tr";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type SystemFeatureItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  href?: string;
  keywords: string;
  icon: React.ReactNode;
  onSelect?: () => void;
};

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

const AppHeader = ({ compact = false }: { compact?: boolean }) => {
  const t = useTranslations("header");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedProjectSearch, setDebouncedProjectSearch] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedProjectSearch(searchQuery.trim()),
      250,
    );
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {
    isMobileOpen,
    toggleSidebar,
    toggleMobileSidebar,
    setIsHelpOpen,
  } = useSidebar();

  const currentUser = useCurrentUserQuery();
  const currentUserAccessLost = isAccessOrResourceUnavailableError(currentUser.error);
  const visibleCurrentUser = currentUserAccessLost ? undefined : currentUser.data;
  const organizationId =
    visibleCurrentUser && "organizationId" in visibleCurrentUser
      ? (visibleCurrentUser.organizationId ?? "")
      : "";
  const canViewMembers = canReadOrganizationMemberships(visibleCurrentUser);
  const projectsQuery = useProjectsQuery(
    organizationId,
    {
      page: 1,
      pageSize: 8,
      status: "ACTIVE",
      q: debouncedProjectSearch,
      includeTotal: false,
    },
    {
      enabled: isSearchOpen && debouncedProjectSearch.length >= 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  );
  const projectsAccessLost = currentUserAccessLost || isAccessOrResourceUnavailableError(projectsQuery.error);
  const visibleProjects = projectsAccessLost ? undefined : projectsQuery.data;

  const systemFeatures = useMemo<SystemFeatureItem[]>(() => {
    const translateOrFallback = (key: string, fallback: string) => {
      const value = t(key);
      if (!value || value === key || value === `header.${key}`) {
        return fallback;
      }
      return value;
    };
    const items: SystemFeatureItem[] = [];

    if (canViewMembers) {
      items.push({
        id: "feature-overview",
        title: tr(t, "searchItems.overviewTitle", "Overview"),
        description: tr(t, "searchItems.overviewDesc", "Organization dashboard, summary, and recent activity"),
        category: tr(t, "searchItems.categoryWorkspace", "Workspace"),
        href: "/dashboard",
        keywords:
          "overview dashboard home summary organization workspace tong quan trang chu",
        icon: (
          <GridIcon
            viewBox="1.5 1.5 21 21"
            className="size-4 shrink-0"
            aria-hidden="true"
          />
        ),
      });
    }

    items.push(
      {
        id: "feature-projects",
        title: translateOrFallback("helpDrawer.projects", "Projects"),
        description: tr(t, "searchItems.projectsDesc", "Browse and manage organization project workspaces"),
        category: tr(t, "searchItems.categoryWorkspace", "Workspace"),
        href: "/projects",
        keywords:
          "projects spaces directory workspace du an danh sach du an",
        icon: (
          <FolderIcon
            viewBox="-2 -3 24 24"
            className="size-4 shrink-0"
            aria-hidden="true"
          />
        ),
      },
      {
        id: "feature-create-project",
        title: tr(t, "searchItems.createProjectTitle", "Create project"),
        description: tr(t, "searchItems.createProjectDesc", "Start a new project workspace in this organization"),
        category: tr(t, "searchItems.categoryProjects", "Projects"),
        href: "/projects/new",
        keywords:
          "create project new project add project tao du an moi them du an",
        icon: (
          <PlusIcon
            viewBox="0 0 12 12"
            className="size-3.5 shrink-0"
            aria-hidden="true"
          />
        ),
      },
      {
        id: "feature-chat",
        title: translateOrFallback("helpDrawer.chat", "Chat"),
        description: tr(t, "searchItems.chatDesc", "Real-time direct messages and team rooms"),
        category: tr(t, "searchItems.categoryWorkspace", "Workspace"),
        href: "/chat",
        keywords:
          "chat messages direct rooms channels conversation tin nhan tro chuyen phong chat",
        icon: (
          <ChatIcon
            viewBox="1 1.1 22 22"
            className="size-4 shrink-0"
            aria-hidden="true"
          />
        ),
      },
    );

    if (canViewMembers) {
      items.push(
        {
          id: "feature-members",
          title: translateOrFallback(
            "settingsMenu.userManagementTitle",
            "User management",
          ),
          description: translateOrFallback(
            "settingsMenu.userManagementDesc",
            "Manage members, roles & invitations",
          ),
          category: tr(t, "searchItems.categoryAdministration", "Administration"),
          href: "/organization/members",
          keywords:
            "members users team roles permissions user management thanh vien phan quyen nhan su",
          icon: (
            <GroupIcon
              viewBox="0.5 0.5 23 23"
              className="size-4 shrink-0"
              aria-hidden="true"
            />
          ),
        },
        {
          id: "feature-invitations",
          title: tr(t, "searchItems.invitationsTitle", "Pending invitations"),
          description: tr(t, "searchItems.invitationsDesc", "Invite new members or manage pending invitations"),
          category: tr(t, "searchItems.categoryAdministration", "Administration"),
          href: "/organization/members?tab=invitations",
          keywords:
            "invitations invite member pending loi moi them thanh vien",
          icon: (
            <GroupIcon
              viewBox="0.5 0.5 23 23"
              className="size-4 shrink-0"
              aria-hidden="true"
            />
          ),
        },
        {
          id: "feature-org-settings",
          title: translateOrFallback(
            "settingsMenu.systemTitle",
            "Organization settings",
          ),
          description: translateOrFallback(
            "settingsMenu.systemDesc",
            "Profile, security & governance policies",
          ),
          category: tr(t, "searchItems.categoryAdministration", "Administration"),
          href: "/organization/settings",
          keywords:
            "organization settings system governance policies cai dat to chuc cau hinh",
          icon: (
            <SettingsIcon
              viewBox="0 0 24 24"
              className="size-4 shrink-0"
              aria-hidden="true"
            />
          ),
        },
      );
    }

    if (organizationId) {
      items.push({
        id: "feature-integrations",
        title: tr(
          t,
          "searchItems.integrationsTitle",
          "MCP Integrations & API Keys",
        ),
        description: tr(
          t,
          "searchItems.integrationsDesc",
          "Generate personal ctm_mcp keys for Cursor, Claude Code, Antigravity & VS Code",
        ),
        category: tr(t, "searchItems.categoryAdministration", "Administration"),
        href: "/organization/integrations",
        keywords:
          "integrations mcp api keys token cursor claude code antigravity vscode windsurf tich hop khoa api",
        icon: (
          <PlugInIcon
            viewBox="0.5 0.5 23 23"
            className="size-4 shrink-0"
            aria-hidden="true"
          />
        ),
      });
    }

    items.push(
      {
        id: "feature-developer-docs",
        title: tr(
          t,
          "searchItems.developerDocsTitle",
          "Developer & MCP Docs",
        ),
        description: tr(
          t,
          "searchItems.developerDocsDesc",
          "Streamable HTTP MCP gateway, 28 tools, and IDE setup",
        ),
        category: tr(t, "searchItems.categorySupport", "Support"),
        href: "/docs",
        keywords:
          "docs documentation developer mcp reference tools schema sdk ide tai lieu nha phat trien",
        icon: (
          <DocsIcon
            viewBox="0.5 0.5 23 23"
            className="size-4 shrink-0"
            aria-hidden="true"
          />
        ),
      },
      {
        id: "feature-profile",
        title: translateOrFallback(
          "settingsMenu.generalTitle",
          "General settings",
        ),
        description: translateOrFallback(
          "settingsMenu.generalDesc",
          "Personal profile, security & preferences",
        ),
        category: tr(t, "searchItems.categoryAccount", "Account"),
        href: "/profile",
        keywords:
          "profile account general settings password security ho so ca nhan tai khoan mat khau",
        icon: (
          <UserCircleIcon
            viewBox="0 0 24 24"
            className="size-4 shrink-0"
            aria-hidden="true"
          />
        ),
      },
      {
        id: "feature-switch-org",
        title: tr(t, "searchItems.switchOrgTitle", "Switch organization"),
        description: tr(t, "searchItems.switchOrgDesc", "Choose or switch your active organization workspace"),
        category: tr(t, "searchItems.categoryAccount", "Account"),
        href: "/select-organization",
        keywords:
          "switch organization workspace change organization chuyen to chuc doi to chuc",
        icon: (
          <GridIcon
            viewBox="1.5 1.5 21 21"
            className="size-4 shrink-0"
            aria-hidden="true"
          />
        ),
      },
      {
        id: "feature-help",
        title: translateOrFallback(
          "helpDrawer.keyboardShortcuts",
          "Help & Keyboard shortcuts",
        ),
        description: tr(t, "searchItems.helpDesc", "Open help guide and workspace keyboard shortcuts"),
        category: tr(t, "searchItems.categorySupport", "Support"),
        keywords:
          "help support keyboard shortcuts guide tro giup huong dan phim tat",
        icon: (
          <SearchIcon
            viewBox="0 0 24 24"
            className="size-4 shrink-0"
            aria-hidden="true"
          />
        ),
        onSelect: () => {
          setIsHelpOpen?.(true);
        },
      },
    );

    const activeProjects = visibleProjects?.data ?? [];
    for (const project of activeProjects.slice(0, 8)) {
      const encodedId = encodeURIComponent(project.id);
      items.push(
        {
          id: `project-overview-${project.id}`,
          title: `${project.name} (${project.code})`,
          description: tr(t, "searchItems.projectOverviewDesc", "Project overview & workspace details"),
          category: tr(t, "searchItems.categoryProjects", "Projects"),
          href: `/projects/${encodedId}`,
          keywords: `${project.name} ${project.code} project overview du an`,
          icon: (
            <FolderIcon
              viewBox="-2 -3 24 24"
              className="size-4 shrink-0"
              aria-hidden="true"
            />
          ),
        },
        {
          id: `project-work-${project.id}`,
          title: tr(t, "searchItems.projectWorkTitle", `${project.name} — Work`, { name: project.name }),
          description: tr(t, "searchItems.projectWorkDesc", `Tasks and work items for ${project.code}`, { code: project.code }),
          category: tr(t, "searchItems.categoryProjects", "Projects"),
          href: `/projects/${encodedId}/work`,
          keywords: `${project.name} ${project.code} work tasks cong viec`,
          icon: (
            <DocsIcon
              viewBox="0.5 0.5 23 23"
              className="size-4 shrink-0"
              aria-hidden="true"
            />
          ),
        },
      );
    }

    return items;
  }, [canViewMembers, organizationId, visibleProjects?.data, setIsHelpOpen, t]);

  const filteredFeatures = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);
    if (!normalizedQuery) {
      return systemFeatures.slice(0, 8);
    }
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    return systemFeatures
      .filter((item) => {
        const haystack = normalizeSearchText(
          `${item.title} ${item.description} ${item.category} ${item.keywords}`,
        );
        return tokens.every((token) => haystack.includes(token));
      })
      .slice(0, 10);
  }, [searchQuery, systemFeatures]);

  const navigateToFeature = (item: SystemFeatureItem) => {
    setIsSearchOpen(false);
    setSearchQuery("");
    if (item.onSelect) {
      item.onSelect();
      return;
    }
    if (item.href) {
      const nav = router as {
        push?: (href: string) => void;
        replace: (href: string) => void;
      };
      if (typeof nav.push === "function") {
        nav.push(item.href);
      } else {
        nav.replace(item.href);
      }
    }
  };

  const handleToggle = () => {
    if (window.innerWidth >= 1280) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  const toggleApplicationMenu = () => {
    setApplicationMenuOpen(!isApplicationMenuOpen);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const searchInput = inputRef.current;

      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        searchInput &&
        searchInput.getClientRects().length > 0
      ) {
        event.preventDefault();
        searchInput.focus();
        setIsSearchOpen(true);
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 flex min-h-14 w-full shrink-0 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex grow flex-col items-center justify-between xl:flex-row xl:px-4">
        <div
          className={`flex w-full items-center justify-between gap-2 border-b border-gray-200 px-3 ${compact ? "py-2 xl:py-2" : "py-2.5 xl:py-2.5"} sm:gap-3 xl:w-auto xl:flex-1 xl:justify-normal xl:border-b-0 xl:px-0 dark:border-gray-800`}
        >
          <button
            className={`z-50 flex h-8 w-8 items-center justify-center rounded-[5px] border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 xl:border dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 ${
              isMobileOpen ? "bg-gray-100 dark:bg-white/3" : ""
            }`}
            onClick={handleToggle}
            aria-label={t("toggleSidebar")}
          >
            {isMobileOpen ? (
              <CloseIcon aria-hidden="true" className="h-5 w-5" />
            ) : (
              <ListIcon
                aria-hidden="true"
                className="h-4 w-4 rtl:-scale-x-100"
              />
            )}
          </button>

          <Link href="/" className="inline-flex items-center">
            <BrandLogo className="h-7" priority />
          </Link>

          <button
            type="button"
            onClick={toggleApplicationMenu}
            aria-label={tr(t, "toggleMenu", "Toggle header menu")}
            aria-expanded={isApplicationMenuOpen}
            className="z-99999 flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 xl:hidden dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <HorizontaLDots aria-hidden="true" className="h-6 w-6" />
          </button>
        </div>

        <div
          ref={searchContainerRef}
          onBlur={(event) => {
            if (
              event.relatedTarget instanceof Node &&
              !event.currentTarget.contains(event.relatedTarget)
            ) {
              setIsSearchOpen(false);
            }
          }}
          className="hidden xl:flex xl:justify-center"
        >
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              const selected =
                filteredFeatures[activeIndex] ?? filteredFeatures[0];
              if (selected) {
                navigateToFeature(selected);
              }
            }}
          >
            <div className="relative">
              <span className="pointer-events-none absolute inset-s-3.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                <SearchIcon aria-hidden="true" className="h-[18px] w-[18px]" />
              </span>
              <input
                ref={inputRef}
                type="text"
                aria-label={t("searchPlaceholder")}
                value={searchQuery}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setActiveIndex(0);
                  setIsSearchOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setIsSearchOpen(false);
                    inputRef.current?.blur();
                    return;
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setIsSearchOpen(true);
                    setActiveIndex((prev) =>
                      filteredFeatures.length > 0
                        ? (prev + 1) % filteredFeatures.length
                        : 0,
                    );
                    return;
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setIsSearchOpen(true);
                    setActiveIndex((prev) =>
                      filteredFeatures.length > 0
                        ? (prev - 1 + filteredFeatures.length) %
                          filteredFeatures.length
                        : 0,
                    );
                  }
                }}
                placeholder={t("searchPlaceholder")}
                className="dark:bg-dark-900 h-9 w-full rounded-md border border-gray-200 bg-transparent py-1.5 ps-10 pe-8 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden xl:w-96 dark:border-gray-800 dark:bg-white/3 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label={tr(t, "clearSearch", "Clear search")}
                  onClick={() => {
                    setSearchQuery("");
                    setActiveIndex(0);
                    inputRef.current?.focus();
                  }}
                  className="inset-e-2.5 absolute top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  ×
                </button>
              )}

              {isSearchOpen && (
                <div
                  id="header-feature-search-results"
                  role="region"
                  aria-label={tr(t, "systemFeatures", "System features")}
                  className="absolute inset-s-0 top-[calc(100%+0.375rem)] z-50 max-h-80 w-full min-w-80 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900"
                >
                  {filteredFeatures.length === 0 ? (
                    <p className="px-3 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
                      {tr(t, "noMatchingFeatures", "No matching system features found.")}
                    </p>
                  ) : (
                    <ul className="space-y-0.5">
                      {filteredFeatures.map((item, index) => {
                        const isActive = index === activeIndex;
                        const rowClassName = cn(
                          "group flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-start transition-colors",
                          isActive
                            ? "bg-brand-50/90 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                            : "text-gray-700 hover:bg-gray-100/80 dark:text-gray-200 dark:hover:bg-white/[0.06]",
                        );

                        const content = (
                          <>
                            <span className="flex min-w-0 flex-1 items-center gap-2.5">
                              <span
                                className={cn(
                                  "flex size-6 shrink-0 items-center justify-center rounded-md border",
                                  isActive
                                    ? "border-brand-200 bg-white text-brand-600 dark:border-brand-500/30 dark:bg-gray-900 dark:text-brand-300"
                                    : "border-gray-200/80 bg-gray-50 text-gray-500 group-hover:text-gray-800 dark:border-gray-800 dark:bg-gray-800/60 dark:text-gray-400 dark:group-hover:text-white",
                                )}
                              >
                                {item.icon}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] leading-4 font-medium text-gray-900 dark:text-white">
                                  {item.title}
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] leading-3.5 text-gray-500 dark:text-gray-400">
                                  {item.description}
                                </span>
                              </span>
                            </span>
                            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                              {item.category}
                            </span>
                          </>
                        );

                        return (
                          <li key={item.id}>
                            {item.href ? (
                              <Link
                                href={item.href}
                                onMouseEnter={() => setActiveIndex(index)}
                                onClick={() => {
                                  setIsSearchOpen(false);
                                  setSearchQuery("");
                                }}
                                className={rowClassName}
                              >
                                {content}
                              </Link>
                            ) : (
                              <button
                                type="button"
                                onMouseEnter={() => setActiveIndex(index)}
                                onClick={() => navigateToFeature(item)}
                                className={rowClassName}
                              >
                                {content}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>

        <div
          className={cn(
            "flex w-full items-center justify-between gap-3 px-5 shadow-theme-md xl:flex xl:w-auto xl:flex-1 xl:justify-end xl:px-0 xl:shadow-none",
            compact ? "py-2" : "py-2.5",
            isApplicationMenuOpen ? "flex" : "hidden",
          )}
        >
          <div className="flex items-center gap-2 2xsm:gap-2.5">
            {/* 1. Notifications */}
            <NotificationDropdown />

            {/* 3. Theme Toggle (1-click Light/Dark mode) */}
            <ThemeToggleButton
              ariaLabel={tr(t, "toggleTheme", "Toggle color theme")}
              className="h-10 w-10 border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300"
            />

            {/* 4. Help (Question mark in circle -> opens right Help sidebar) */}
            <HeaderHelpDrawer />

            {/* 4. Settings (Gear icon dropdown with role-based sections) */}
            <HeaderSettingsDropdown
              onFocusSearch={() => {
                inputRef.current?.focus();
                setIsSearchOpen(true);
              }}
            />
          </div>

          {/* 5. User Avatar Dropdown */}
          <UserDropdown />
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
