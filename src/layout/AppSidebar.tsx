"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOrganizationOptionsQuery } from "@/lib/queries/auth/useAccountOnboarding";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectsQuery } from "@/lib/queries/projects/useProjects";
import { Link, usePathname } from "@/i18n/navigation";
import { useSidebar } from "@/context/SidebarContext";
import {
  BookOpenIcon,
  ChatIcon,
  ChevronDownIcon,
  DocsIcon,
  FolderIcon,
  GridIcon,
  GroupIcon,
  PlugInIcon,
  SettingsIcon,
  ShootingStarIcon,
} from "@/icons/index";
import { useTranslations } from "next-intl";
import { cn } from "@/utils";
import { isSidebarPathActive } from "@/utils/sidebar-active";
import { canReadOrganizationMemberships } from "@/lib/queries/organization-memberships/organization-membership-permissions";
import SidebarAccountFooter from "./SidebarAccountFooter";
import SidebarOrganizationSwitcher from "./SidebarOrganizationSwitcher";
import {
  SidebarFlyoutPortal,
  useSidebarFlyoutController,
  type FlyoutItemConfig,
} from "./SidebarFlyoutMenu";

const primaryItems = [
  { key: "overview", path: "/dashboard", icon: GridIcon, viewBox: "1.5 1.5 21 21", viewBox: "1.5 1.5 21 21" },
  { key: "projects", path: "/projects", icon: FolderIcon, viewBox: "-2 -3 24 24" },
  { key: "chat", path: "/chat", icon: ChatIcon, viewBox: "1 1.1 22 22" },
  { key: "knowledge", icon: BookOpenIcon, viewBox: "0.5 1.5 23 23", viewBox: "0.5 1.5 23 23" },
  { key: "aiSearch", icon: ShootingStarIcon, viewBox: "0.5 -0.8 23 23" },
] as const;

const administrationItems = [
  { key: "members", path: "/organization/members", icon: GroupIcon, viewBox: "0.5 0.5 23 23", viewBox: "0.5 0.5 23 23" },
  { key: "integrations", icon: PlugInIcon, viewBox: "0.5 0.5 23 23" },
  { key: "settings", path: "/organization/settings", icon: SettingsIcon, viewBox: "0 0 24 24", viewBox: "0 0 24 24" },
] as const;

const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 180;
const MAX_WIDTH = 420;
const COLLAPSED_WIDTH = 64;
const COLLAPSE_SNAP_WIDTH = 140;

function safeClampWidth(width: number): number {
  if (!Number.isFinite(width)) return DEFAULT_WIDTH;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
}

const AppSidebar: React.FC = () => {
  const {
    isExpanded,
    isMobileOpen,
    sidebarWidth,
    isResizing,
    setIsExpanded,
    setSidebarWidth,
    setIsResizing,
    resetSidebarWidth,
  } = useSidebar();
  const pathname = usePathname();
  const t = useTranslations("sidebar");
  const currentUser = useCurrentUserQuery();
  const organizationId = currentUser.data?.organizationId;
  const organizations = useOrganizationOptionsQuery(Boolean(currentUser.data));
  const organizationName = organizations.data?.find(
    (organization) => organization.id === organizationId,
  )?.name;
  const projectsQuery = useProjectsQuery(organizationId ?? "", {
    page: 1,
    pageSize: 100,
    status: "ACTIVE",
  });
  const sidebarProjects = projectsQuery.data?.data ?? [];
  const projectRouteMatch = /^\/projects\/([^/]+)/.exec(pathname);
  const activeProjectIdFromPath = projectRouteMatch?.[1]
    ? decodeURIComponent(projectRouteMatch[1])
    : null;
  const [manualProjectsOpen, setManualProjectsOpen] = useState<boolean | null>(
    null,
  );
  const isProjectsOpen =
    manualProjectsOpen ?? Boolean(activeProjectIdFromPath);
  const [toggledProjectIds, setToggledProjectIds] = useState<
    Record<string, boolean>
  >({});
  const [syncedProjectTab, setSyncedProjectTab] = useState<{
    pathnameAtSync: string;
    projectId: string;
    tab: "overview" | "members" | "settings";
  } | null>(null);

  useEffect(() => {
    const handleProjectTabSync = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          projectId?: string;
          tab?: string;
        }>
      ).detail;
      if (
        detail?.projectId &&
        (detail.tab === "overview" ||
          detail.tab === "members" ||
          detail.tab === "settings")
      ) {
        setSyncedProjectTab({
          pathnameAtSync: pathname,
          projectId: detail.projectId,
          tab: detail.tab,
        });
      }
    };
    window.addEventListener("continuum:project-tab-sync", handleProjectTabSync);
    return () => {
      window.removeEventListener(
        "continuum:project-tab-sync",
        handleProjectTabSync,
      );
    };
  }, [pathname]);

  const [fallbackWidth, setFallbackWidth] = useState(DEFAULT_WIDTH);
  const [fallbackExpanded, setFallbackExpanded] = useState<boolean | null>(null);
  const [fallbackIsResizing, setFallbackIsResizing] = useState(false);
  const cleanupResizeRef = useRef<(() => void) | null>(null);

  const resolvedExpandedWidth = safeClampWidth(
    sidebarWidth ?? fallbackWidth,
  );
  const resolvedIsExpanded =
    typeof setIsExpanded === "function"
      ? isExpanded
      : (fallbackExpanded ?? isExpanded);
  const activeIsResizing = isResizing ?? fallbackIsResizing;

  const updateExpanded = useCallback(
    (nextExpanded: boolean) => {
      if (typeof setIsExpanded === "function") {
        setIsExpanded(nextExpanded);
      } else {
        setFallbackExpanded(nextExpanded);
      }
    },
    [setIsExpanded],
  );

  const updateWidth = useCallback(
    (nextWidth: number) => {
      const clamped = safeClampWidth(nextWidth);
      if (typeof setSidebarWidth === "function") {
        setSidebarWidth(clamped);
      } else {
        setFallbackWidth(clamped);
      }
    },
    [setSidebarWidth],
  );

  const updateResizing = useCallback(
    (nextResizing: boolean) => {
      if (typeof setIsResizing === "function") {
        setIsResizing(nextResizing);
      } else {
        setFallbackIsResizing(nextResizing);
      }
    },
    [setIsResizing],
  );

  const {
    activeKey,
    anchorRect,
    flyoutElRef,
    registerTrigger,
    handleTriggerMouseEnter,
    handleTriggerMouseLeave,
    handleFlyoutMouseEnter,
    handleFlyoutMouseLeave,
    closeFlyout,
  } = useSidebarFlyoutController({
    openDelayMs: 175,
    closeDelayMs: 180,
  });

  // Do NOT expand on mouse hover; only show text labels when expanded (dragged >= 140px) or on mobile drawer
  const isExpandedView = resolvedIsExpanded || isMobileOpen;
  const currentWidthPx = isExpandedView
    ? resolvedExpandedWidth
    : COLLAPSED_WIDTH;

  const handleResizeMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      closeFlyout();

      cleanupResizeRef.current?.();
      updateResizing(true);

      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      let expandedState = resolvedIsExpanded;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const isRtl = document.documentElement.dir === "rtl";
        const rawWidth = isRtl
          ? window.innerWidth - moveEvent.clientX
          : moveEvent.clientX;

        if (rawWidth < COLLAPSE_SNAP_WIDTH) {
          if (expandedState) {
            expandedState = false;
            updateExpanded(false);
          }
          return;
        }

        if (!expandedState) {
          expandedState = true;
          updateExpanded(true);
        }
        updateWidth(rawWidth);
      };

      const cleanup = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        updateResizing(false);
        cleanupResizeRef.current = null;
      };

      const handleMouseUp = () => {
        cleanup();
      };

      cleanupResizeRef.current = cleanup;
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [
      closeFlyout,
      resolvedIsExpanded,
      updateExpanded,
      updateResizing,
      updateWidth,
    ],
  );

  const handleResizeDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof resetSidebarWidth === "function") {
        resetSidebarWidth();
      } else {
        updateExpanded(true);
        updateWidth(DEFAULT_WIDTH);
      }
    },
    [resetSidebarWidth, updateExpanded, updateWidth],
  );

  const handleResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = 16;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (resolvedIsExpanded && resolvedExpandedWidth - step < MIN_WIDTH) {
          updateExpanded(false);
        } else if (resolvedIsExpanded) {
          updateWidth(resolvedExpandedWidth - step);
        }
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        if (!resolvedIsExpanded) {
          updateExpanded(true);
          updateWidth(MIN_WIDTH);
        } else {
          updateWidth(resolvedExpandedWidth + step);
        }
      } else if (event.key === "Home") {
        event.preventDefault();
        updateExpanded(false);
      } else if (event.key === "End") {
        event.preventDefault();
        updateExpanded(true);
        updateWidth(MAX_WIDTH);
      }
    },
    [resolvedExpandedWidth, resolvedIsExpanded, updateExpanded, updateWidth],
  );

  useEffect(() => {
    return () => {
      cleanupResizeRef.current?.();
    };
  }, []);

  const canViewMembers = canReadOrganizationMemberships(currentUser.data);
  const visiblePrimaryItems = primaryItems.filter(
    (item) => item.key !== "overview" || canViewMembers,
  );
  const visibleAdministrationItems = administrationItems.filter(
    (item) =>
      (item.key !== "members" && item.key !== "settings") || canViewMembers,
  );

  const flyoutConfigs = useMemo<Record<string, FlyoutItemConfig>>(
    () => ({
      overview: {
        key: "overview",
        title: t("items.overview"),
        subtitle: organizationName ?? t("organizationLabel"),
        primaryHref: "/dashboard",
        primaryCtaLabel: "Open",
        quickLinks: [
          {
            id: "org-dashboard",
            label: "Organization Dashboard",
            description: "Workspace summary, active projects, and recent activity",
            href: "/dashboard",
          },
          {
            id: "org-projects",
            label: "Projects Directory",
            description: "Browse and filter all organization projects",
            href: "/projects",
          },
        ],
      },
      chat: {
        key: "chat",
        title: t("items.chat"),
        subtitle: "Real-time team & project messaging",
        primaryHref: "/chat",
        primaryCtaLabel: "Open Chat",
        quickLinks: [
          {
            id: "chat-channels",
            label: "Channels & Direct Messages",
            description: "Collaborate with organization and project members",
            href: "/chat",
            badge: "Live",
          },
        ],
      },
      members: {
        key: "members",
        title: t("items.members"),
        subtitle: "Organization roster & invitations",
        primaryHref: "/organization/members",
        primaryCtaLabel: "Manage",
        quickLinks: [
          {
            id: "members-directory",
            label: "Active Members",
            description: "Review roles, permissions, and membership status",
            href: "/organization/members",
          },
          {
            id: "members-invitations",
            label: "Pending Invitations",
            description: "Invite new members or resend pending invites",
            href: "/organization/members?tab=invitations",
          },
        ],
      },
      settings: {
        key: "settings",
        title: t("items.settings"),
        subtitle: "Governance, roles & workspace policies",
        primaryHref: "/organization/settings",
        primaryCtaLabel: "Configure",
        quickLinks: [
          {
            id: "settings-general",
            label: "Organization Profile & Policies",
            description: "Manage organization details, roles, and project governance",
            href: "/organization/settings",
          },
        ],
      },
    }),
    [organizationName, t],
  );

  const activeFlyoutConfig =
    activeKey && !activeIsResizing ? (flyoutConfigs[activeKey] ?? null) : null;

  const renderItem = (
    item: (typeof primaryItems)[number] | (typeof administrationItems)[number],
  ) => {
    const label = t(`items.${item.key}`);
    const Icon = item.icon;
    const iconViewBox = item.viewBox;
    const hasFlyout = "path" in item && Boolean(flyoutConfigs[item.key]);
    const isFlyoutOpen = activeKey === item.key && !activeIsResizing;

    if (item.key === "projects") {
      const isActive = isSidebarPathActive(item.path, pathname);
      return (
        <li key={item.key}>
          <div className="relative flex items-center">
            <Link
              href={item.path}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              title={!isExpandedView ? label : undefined}
              onClick={() => setManualProjectsOpen(true)}
              className={cn(
                "group menu-item h-8 min-h-8 w-full focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-gray-900",
                isActive
                  ? "menu-item-active"
                  : "menu-item-inactive",
                isExpandedView ? "pe-8" : "justify-center px-1.5",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "menu-item-icon",
                  isActive
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive",
                )}
              >
                <Icon
                  viewBox={iconViewBox}
                  preserveAspectRatio="xMidYMid meet"
                  className="size-[18px] shrink-0"
                />
              </span>
              {isExpandedView && (
                <span className="menu-item-text">{label}</span>
              )}
            </Link>
            {isExpandedView && (
              <button
                type="button"
                aria-label={t("projectsDropdownToggle")}
                aria-expanded={isProjectsOpen}
                onClick={() =>
                  setManualProjectsOpen(
                    (prev) => !(prev ?? Boolean(activeProjectIdFromPath)),
                  )
                }
                className={cn(
                  "absolute end-1.5 inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none",
                  isActive
                    ? "text-brand-600 hover:bg-brand-100/70 dark:text-brand-300 dark:hover:bg-brand-500/20"
                    : "text-gray-400 hover:bg-gray-200/70 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200",
                )}
              >
                <ChevronDownIcon
                  viewBox="0 0 20 20"
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isProjectsOpen && "rotate-180",
                  )}
                />
              </button>
            )}
          </div>

          {isExpandedView && isProjectsOpen && (
            <ul
              role="group"
              aria-label={t("projectsSubmenuLabel")}
              className="continuum-accordion-open mt-1.5 ms-4 flex flex-col gap-1 border-s border-gray-200 ps-2.5 dark:border-gray-800"
            >
              {projectsQuery.isLoading ? (
                <li className="px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {t("projectsLoading")}
                </li>
              ) : sidebarProjects.length === 0 ? (
                <li className="px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {t("projectsEmpty")}
                </li>
              ) : (
                sidebarProjects.map((project) => {
                  const isProjectExpanded =
                    toggledProjectIds[project.id] ??
                    activeProjectIdFromPath === project.id;
                  const projectBasePath = `/projects/${project.id}`;
                  const projectOverviewPath = `${projectBasePath}/overview`;
                  const projectMembersPath = `${projectBasePath}/members`;
                  const projectWorkPath = `${projectBasePath}/work`;
                  const projectWorkNotesPath = `${projectBasePath}/work-notes`;
                  const projectSettingsPath = `${projectBasePath}/settings`;
                  const isProjectWorkActive =
                    pathname === projectWorkPath ||
                    pathname.startsWith(`${projectWorkPath}/`);
                  const isProjectWorkNotesActive =
                    pathname === projectWorkNotesPath ||
                    pathname.startsWith(`${projectWorkNotesPath}/`);
                  const activeSyncedTab =
                    syncedProjectTab?.pathnameAtSync === pathname &&
                    syncedProjectTab.projectId === project.id &&
                    !isProjectWorkActive &&
                    !isProjectWorkNotesActive
                      ? syncedProjectTab.tab
                      : null;
                  const isProjectMembersActive = activeSyncedTab
                    ? activeSyncedTab === "members"
                    : pathname === projectMembersPath ||
                      pathname.startsWith(`${projectMembersPath}/`);
                  const isProjectSettingsActive = activeSyncedTab
                    ? activeSyncedTab === "settings"
                    : pathname === projectSettingsPath ||
                      pathname.startsWith(`${projectSettingsPath}/`);
                  const isProjectOverviewActive = activeSyncedTab
                    ? activeSyncedTab === "overview"
                    : pathname === projectBasePath ||
                      pathname === projectOverviewPath ||
                      pathname.startsWith(`${projectOverviewPath}/`);
                  const isThisProjectActive =
                    activeProjectIdFromPath === project.id;
                  const projectSubItems = [
                    {
                      key: "overview",
                      label: t("items.projectOverview"),
                      href: projectOverviewPath,
                      isActive: isProjectOverviewActive,
                      icon: GridIcon, viewBox: "1.5 1.5 21 21",
                      tab: "overview" as const,
                    },
                    {
                      key: "members",
                      label: t("items.projectMembers"),
                      href: projectMembersPath,
                      isActive: isProjectMembersActive,
                      icon: GroupIcon, viewBox: "0.5 0.5 23 23",
                      tab: "members" as const,
                    },
                    {
                      key: "workspace",
                      label: t("items.workspace"),
                      href: projectWorkPath,
                      isActive: isProjectWorkActive,
                      icon: DocsIcon, viewBox: "0.5 0.5 23 23",
                    },
                    {
                      key: "workNotes",
                      label: t("items.projectWorkNotes"),
                      href: projectWorkNotesPath,
                      isActive: isProjectWorkNotesActive,
                      icon: BookOpenIcon, viewBox: "0.5 1.5 23 23",
                    },
                    {
                      key: "settings",
                      label: t("items.projectSettings"),
                      href: projectSettingsPath,
                      isActive: isProjectSettingsActive,
                      icon: SettingsIcon, viewBox: "0 0 24 24",
                      tab: "settings" as const,
                    },
                  ];

                  return (
                    <li key={project.id} className="flex flex-col gap-1">
                      <button
                        type="button"
                        aria-expanded={isProjectExpanded}
                        aria-label={t("projectDropdownToggle", {
                          name: project.name,
                        })}
                        onClick={() =>
                          setToggledProjectIds((prev) => ({
                            ...prev,
                            [project.id]: !isProjectExpanded,
                          }))
                        }
                        className={cn(
                          "flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-start text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none",
                          isThisProjectActive
                            ? "bg-brand-50/70 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                            : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5",
                        )}
                      >
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-gray-200 bg-white text-[10px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {project.code.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {project.name}
                        </span>
                        <ChevronDownIcon
                          viewBox="0 0 20 20"
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200 dark:text-gray-500",
                            isProjectExpanded && "rotate-180",
                          )}
                        />
                      </button>

                      {isProjectExpanded && (
                        <ul
                          role="group"
                          aria-label={t("projectActionsLabel", {
                            name: project.name,
                          })}
                          className="continuum-accordion-open ms-3.5 flex flex-col gap-0.5 border-s border-gray-200 ps-2 dark:border-gray-800"
                        >
                          {projectSubItems.map((subItem) => {
                            const SubIcon = subItem.icon;
                            return (
                              <li key={subItem.key}>
                                <Link
                                  href={subItem.href}
                                  aria-current={
                                    subItem.isActive ? "page" : undefined
                                  }
                                  onClick={() => {
                                    if (subItem.tab) {
                                      setSyncedProjectTab({
                                        pathnameAtSync: pathname,
                                        projectId: project.id,
                                        tab: subItem.tab,
                                      });
                                      window.dispatchEvent(
                                        new CustomEvent(
                                          "continuum:project-tab-change",
                                          {
                                            detail: {
                                              projectId: project.id,
                                              tab: subItem.tab,
                                            },
                                          },
                                        ),
                                      );
                                    }
                                  }}
                                  className={cn(
                                    "flex min-h-8 items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none",
                                    subItem.isActive
                                      ? "bg-brand-50 font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200",
                                  )}
                                >
                                  <SubIcon viewBox={subItem.viewBox} className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">
                                    {subItem.label}
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </li>
      );
    }

    return (
      <li
        key={item.key}
        ref={(element) => {
          if (hasFlyout) {
            registerTrigger(item.key, element);
          }
        }}
        onMouseEnter={() => {
          if (hasFlyout && !activeIsResizing) {
            handleTriggerMouseEnter(item.key);
          }
        }}
        onMouseLeave={(event) => {
          if (hasFlyout && !activeIsResizing) {
            handleTriggerMouseLeave(item.key, event);
          }
        }}
      >
        {"path" in item ? (
          <Link
            href={item.path}
            aria-label={label}
            aria-expanded={hasFlyout ? isFlyoutOpen : undefined}
            aria-haspopup={hasFlyout ? "dialog" : undefined}
            aria-current={
              isSidebarPathActive(item.path, pathname) ? "page" : undefined
            }
            title={!isExpandedView ? label : undefined}
            onClick={closeFlyout}
            className={cn(
              "group menu-item h-8 min-h-8 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-gray-900",
              isSidebarPathActive(item.path, pathname) || isFlyoutOpen
                ? "menu-item-active"
                : "menu-item-inactive",
              !isExpandedView && "justify-center px-1.5",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "menu-item-icon",
                isSidebarPathActive(item.path, pathname) || isFlyoutOpen
                  ? "menu-item-icon-active"
                  : "menu-item-icon-inactive",
              )}
            >
              <Icon
                viewBox={iconViewBox}
                preserveAspectRatio="xMidYMid meet"
                className="size-[18px] shrink-0"
              />
            </span>
            {isExpandedView && (
              <>
                <span className="menu-item-text flex-1 truncate">{label}</span>
                {hasFlyout && (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    className={cn(
                      "ms-auto h-3.5 w-3.5 shrink-0 transition-transform duration-150",
                      isFlyoutOpen
                        ? "translate-x-0.5 text-brand-600 opacity-100 dark:text-brand-300"
                        : "text-gray-400 opacity-0 group-hover:opacity-100",
                    )}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m6 4 4 4-4 4"
                    />
                  </svg>
                )}
              </>
            )}
          </Link>
        ) : (
          <button
            type="button"
            aria-label={label}
            aria-disabled="true"
            title={
              isExpandedView ? t("comingSoon") : `${label} — ${t("comingSoon")}`
            }
            disabled
            className={cn(
              "group menu-item h-8 min-h-8 cursor-not-allowed text-start text-gray-500 opacity-65 dark:text-gray-400",
              !isExpandedView && "justify-center px-1.5",
            )}
          >
            <span
              aria-hidden="true"
              className="menu-item-icon-inactive menu-item-icon"
            >
              <Icon
                viewBox={iconViewBox}
                preserveAspectRatio="xMidYMid meet"
                className="size-[18px] shrink-0"
              />
            </span>
            {isExpandedView && (
              <span className="menu-item-text truncate">{label}</span>
            )}
          </button>
        )}
      </li>
    );
  };

  return (
    <aside
      style={{ width: `${currentWidthPx}px` }}
      className={cn(
        "fixed top-14 bottom-0 start-0 z-40 flex h-[calc(100dvh-3.5rem)] flex-col border-e border-gray-200/90 bg-white px-2.5 pt-2.5 text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100",
        isExpandedView ? "w-60" : "w-16",
        activeIsResizing
          ? "transition-none select-none"
          : "transition-all duration-200 ease-in-out",
        isMobileOpen
          ? "translate-x-0"
          : "-translate-x-full rtl:translate-x-full",
        "xl:translate-x-0 xl:rtl:translate-x-0",
      )}
    >
      <div className="shrink-0 pb-2.5">
        <SidebarOrganizationSwitcher
          isExpandedView={isExpandedView}
          organizationId={organizationId}
          organizationName={organizationName}
          organizations={organizations.data ?? []}
          isLoading={organizations.isLoading}
          isError={organizations.isError}
          onRetry={() => void organizations.refetch()}
        />
      </div>

      <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
        <nav aria-label={t("navigation")} className="flex flex-col gap-3 pb-3">
          <ul className="flex flex-col gap-0.5">
            {visiblePrimaryItems.map(renderItem)}
          </ul>
          <section
            aria-labelledby="sidebar-administration"
            className="border-t border-gray-200/80 pt-2.5 dark:border-gray-800/80"
          >
            <h2
              id="sidebar-administration"
              className={cn(
                "mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500",
                !isExpandedView && "sr-only",
              )}
            >
              {t("groups.administration")}
            </h2>
            <ul className="flex flex-col gap-0.5">
              {visibleAdministrationItems.map(renderItem)}
            </ul>
          </section>
        </nav>
      </div>

      <SidebarAccountFooter isExpandedView={isExpandedView} />

      {/* Notion / Jira-style Interactive Edge Resizer */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuemin={COLLAPSED_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuenow={currentWidthPx}
        tabIndex={0}
        data-testid="sidebar-resizer"
        title="Drag to resize sidebar (double-click to reset)"
        onMouseDown={handleResizeMouseDown}
        onDoubleClick={handleResizeDoubleClick}
        onKeyDown={handleResizeKeyDown}
        className="group/resizer absolute inset-y-0 -end-1 z-60 hidden w-2.5 cursor-col-resize items-center justify-center focus-visible:outline-none xl:flex"
      >
        <span
          aria-hidden="true"
          className={cn(
            "h-full w-[2px] rounded-full transition-colors duration-150",
            activeIsResizing
              ? "bg-brand-600 dark:bg-brand-400"
              : "bg-transparent group-hover/resizer:bg-brand-500/70 group-focus-visible/resizer:bg-brand-500 dark:group-hover/resizer:bg-brand-400/70",
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-1/2 h-7 w-1 -translate-y-1/2 rounded-full transition-opacity duration-150",
            activeIsResizing
              ? "bg-brand-600 opacity-100 dark:bg-brand-400"
              : "bg-brand-500 opacity-0 group-hover/resizer:opacity-100 group-focus-visible/resizer:opacity-100 dark:bg-brand-400",
          )}
        />
      </div>

      {/* Portaled Jira-style Hover Flyout Menu (renders in document.body to prevent sidebar overflow clipping) */}
      <SidebarFlyoutPortal
        config={activeFlyoutConfig}
        anchorRect={anchorRect}
        flyoutElRef={flyoutElRef}
        pathname={pathname}
        onMouseEnter={handleFlyoutMouseEnter}
        onMouseLeave={handleFlyoutMouseLeave}
        onClose={closeFlyout}
      />
    </aside>
  );
};

export default AppSidebar;
