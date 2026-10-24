"use client";

import NotificationDropdown from "@/components/header/NotificationDropdown";
import BrandLogo from "@/components/common/BrandLogo";
import HeaderHelpDrawer from "@/components/header/HeaderHelpDrawer";
import HeaderSettingsDropdown from "@/components/header/HeaderSettingsDropdown";
import HeaderUpdateButton from "@/components/header/HeaderUpdateButton";
import UserDropdown from "@/components/header/UserDropdown";
import { useSidebar } from "@/context/SidebarContext";
import { Link, useRouter } from "@/i18n/navigation";
import {
  ChatIcon,
  DocsIcon,
  FolderIcon,
  GridIcon,
  GroupIcon,
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
        title: "Overview",
        description: "Organization dashboard, summary, and recent activity",
        category: "Workspace",
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
        description: "Browse and manage organization project workspaces",
        category: "Workspace",
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
        title: "Create project",
        description: "Start a new project workspace in this organization",
        category: "Projects",
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
        description: "Real-time direct messages and team rooms",
        category: "Workspace",
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
          category: "Administration",
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
          title: "Pending invitations",
          description: "Invite new members or manage pending invitations",
          category: "Administration",
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
          category: "Administration",
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

    items.push(
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
        category: "Account",
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
        title: "Switch organization",
        description: "Choose or switch your active organization workspace",
        category: "Account",
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
        description: "Open help guide and workspace keyboard shortcuts",
        category: "Support",
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
          description: "Project overview & workspace details",
          category: "Projects",
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
          title: `${project.name} — Work`,
          description: `Tasks and work items for ${project.code}`,
          category: "Projects",
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
  }, [canViewMembers, visibleProjects?.data, setIsHelpOpen, t]);

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
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg
                className="rtl:-scale-x-100"
                width="16"
                height="12"
                viewBox="0 0 16 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M0.583252 1C0.583252 0.585788 0.919038 0.25 1.33325 0.25H14.6666C15.0808 0.25 15.4166 0.585786 15.4166 1C15.4166 1.41421 15.0808 1.75 14.6666 1.75L1.33325 1.75C0.919038 1.75 0.583252 1.41422 0.583252 1ZM0.583252 11C0.583252 10.5858 0.919038 10.25 1.33325 10.25L14.6666 10.25C15.0808 10.25 15.4166 10.5858 15.4166 11C15.4166 11.4142 15.0808 11.75 14.6666 11.75L1.33325 11.75C0.919038 11.75 0.583252 11.4142 0.583252 11ZM1.33325 5.25C0.919038 5.25 0.583252 5.58579 0.583252 6C0.583252 6.41421 0.919038 6.75 1.33325 6.75L7.99992 6.75C8.41413 6.75 8.74992 6.41421 8.74992 6C8.74992 5.58579 8.41413 5.25 7.99992 5.25L1.33325 5.25Z"
                  fill="currentColor"
                />
              </svg>
            )}
          </button>

          <Link href="/" className="inline-flex items-center">
            <BrandLogo className="h-7" priority />
          </Link>

          <button
            onClick={toggleApplicationMenu}
            className="z-99999 flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 xl:hidden dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M5.99902 10.4951C6.82745 10.4951 7.49902 11.1667 7.49902 11.9951V12.0051C7.49902 12.8335 6.82745 13.5051 5.99902 13.5051C5.1706 13.5051 4.49902 12.8335 4.49902 12.0051V11.9951C4.49902 11.1667 5.1706 10.4951 5.99902 10.4951ZM17.999 10.4951C18.8275 10.4951 19.499 11.1667 19.499 11.9951V12.0051C19.499 12.8335 18.8275 13.5051 17.999 13.5051C17.1706 13.5051 16.499 12.8335 16.499 12.0051V11.9951C16.499 11.1667 17.1706 10.4951 17.999 10.4951ZM13.499 11.9951C13.499 11.1667 12.8275 10.4951 11.999 10.4951C11.1706 10.4951 10.499 11.1667 10.499 11.9951V12.0051C10.499 12.8335 11.1706 13.5051 11.999 13.5051C12.8275 13.5051 13.499 12.8335 13.499 12.0051V11.9951Z"
                fill="currentColor"
              />
            </svg>
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
              <span className="pointer-events-none absolute inset-s-3.5 top-1/2 -translate-y-1/2">
                <svg
                  className="fill-gray-500 dark:fill-gray-400"
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z"
                    fill=""
                  />
                </svg>
              </span>
              <input
                ref={inputRef}
                type="text"
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
                  aria-label="Clear search"
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
                  aria-label="System features"
                  className="absolute inset-s-0 top-[calc(100%+0.375rem)] z-50 max-h-80 w-full min-w-80 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900"
                >
                  {filteredFeatures.length === 0 ? (
                    <p className="px-3 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
                      No matching system features found.
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
            {/* 1. Update (Demo Plan Upgrade Modal) */}
            <HeaderUpdateButton />

            {/* 2. Notifications */}
            <NotificationDropdown />

            {/* 3. Help (Question mark in circle -> opens right Help sidebar) */}
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
