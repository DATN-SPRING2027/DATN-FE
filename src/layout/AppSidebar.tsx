"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useOrganizationOptionsQuery } from "@/lib/queries/auth/useAccountOnboarding";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import {
  useProjectsQuery,
  type Project,
} from "@/lib/queries/projects/useProjects";
import { useProjectManagementAccess } from "@/lib/queries/projects/useProjectSettings";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useSidebar } from "@/context/SidebarContext";
import {
  BookOpenIcon,
  BoxCubeIcon,
  ChatIcon,
  FileIcon,
  FolderIcon,
  GridIcon,
  GroupIcon,
  PlugInIcon,
  SettingsIcon,
  ShootingStarIcon,
  TaskIcon,
} from "@/icons/index";
import { useTranslations } from "next-intl";
import { cn } from "@/utils";
import { isSidebarPathActive } from "@/utils/sidebar-active";
import { canReadOrganizationMemberships } from "@/lib/queries/organization-memberships/organization-membership-permissions";
import SidebarAccountFooter from "./SidebarAccountFooter";
import SidebarOrganizationSwitcher from "./SidebarOrganizationSwitcher";
import SidebarProjectSwitcher from "./SidebarProjectSwitcher";

const primaryItems = [
  { key: "overview", path: "/dashboard", icon: GridIcon, viewBox: "1.5 1.5 21 21" },
  { key: "projects", path: "/projects", icon: FolderIcon, viewBox: "-2 -3 24 24" },
  { key: "chat", path: "/chat", icon: ChatIcon, viewBox: "1 1.1 22 22" },
  { key: "knowledge", icon: BookOpenIcon, viewBox: "0.5 1.5 23 23" },
  { key: "aiSearch", icon: ShootingStarIcon, viewBox: "0.5 -0.8 23 23" },
] as const;

const administrationItems = [
  { key: "members", path: "/organization/members", icon: GroupIcon, viewBox: "0.5 0.5 23 23" },
  { key: "integrations", icon: PlugInIcon, viewBox: "0.5 0.5 23 23" },
  { key: "settings", path: "/organization/settings", icon: SettingsIcon, viewBox: "0 0 24 24" },
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

function resolveProjectSwitchDestination(
  pathname: string,
  nextProjectId: string,
): string {
  const encodedId = encodeURIComponent(nextProjectId);
  const match = /^\/projects\/([^/]+)(?:\/([^/?#]+))?/.exec(pathname);
  const currentProjectId = match?.[1];
  const subSection = match?.[2];

  if (
    currentProjectId &&
    currentProjectId !== "new" &&
    (subSection === "overview" ||
      subSection === "members" ||
      subSection === "work" ||
      subSection === "work-notes" ||
      subSection === "settings")
  ) {
    return `/projects/${encodedId}/${subSection}`;
  }

  return `/projects/${encodedId}/overview`;
}

function ProjectSettingsNavigation({
  organizationId,
  projectId,
  active,
  children,
}: {
  organizationId: string;
  projectId: string;
  active: boolean;
  children: ReactNode;
}) {
  const access = useProjectManagementAccess(organizationId, projectId, active);
  return access.canAccessSettings ? children : null;
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
  const router = useRouter();
  const t = useTranslations("sidebar");
  const currentUser = useCurrentUserQuery();
  const visibleUser = isAccessOrResourceUnavailableError(currentUser.error)
    ? undefined
    : currentUser.data;
  const organizationId = visibleUser?.organizationId;
  const organizations = useOrganizationOptionsQuery(Boolean(currentUser.data));
  const organizationName = organizations.data?.find(
    (organization) => organization.id === organizationId,
  )?.name;

  // Mutual exclusion between Organization selector and Project selector (Rule 11)
  const [openSelector, setOpenSelector] = useState<
    "organization" | "project" | null
  >(null);

  const projectRouteMatch = /^\/projects\/([^/]+)/.exec(pathname);
  const rawProjectSegment = projectRouteMatch?.[1]
    ? decodeURIComponent(projectRouteMatch[1])
    : null;
  const activeProjectIdFromPath =
    rawProjectSegment && rawProjectSegment !== "new"
      ? rawProjectSegment
      : null;

  const projectsQuery = useProjectsQuery(
    organizationId ?? "",
    {
      page: 1,
      pageSize: 20,
      status: "ACTIVE",
    },
    {
      enabled: Boolean(organizationId),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  );

  const sidebarProjects = useMemo(() => {
    if (!organizationId) return [];
    const list = projectsQuery.data?.data ?? [];
    return list.filter(
      (project) =>
        !project.organizationId || project.organizationId === organizationId,
    );
  }, [organizationId, projectsQuery.data?.data]);

  const [selectedProjectByOrg, setSelectedProjectByOrg] = useState<
    Record<string, string>
  >({});

  const activeProject = useMemo<Project | null>(() => {
    if (!organizationId || sidebarProjects.length === 0) return null;
    if (activeProjectIdFromPath) {
      const fromPath = sidebarProjects.find(
        (project) => project.id === activeProjectIdFromPath,
      );
      if (fromPath) return fromPath;
    }
    const rememberedId = selectedProjectByOrg[organizationId];
    if (rememberedId) {
      const remembered = sidebarProjects.find(
        (project) => project.id === rememberedId,
      );
      if (remembered) return remembered;
    }
    return sidebarProjects[0] ?? null;
  }, [
    activeProjectIdFromPath,
    organizationId,
    selectedProjectByOrg,
    sidebarProjects,
  ]);

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

  // Do NOT expand on mouse hover; only show text labels when expanded (dragged >= 140px) or on mobile drawer
  const isExpandedView = resolvedIsExpanded || isMobileOpen;
  const currentWidthPx = isExpandedView
    ? resolvedExpandedWidth
    : COLLAPSED_WIDTH;

  const handleSelectProject = useCallback(
    (project: Project) => {
      if (organizationId) {
        setSelectedProjectByOrg((prev) => ({
          ...prev,
          [organizationId]: project.id,
        }));
      }
      const destination = resolveProjectSwitchDestination(pathname, project.id);
      if (typeof router.push === "function") {
        router.push(destination);
      } else {
        router.replace(destination);
      }
    },
    [organizationId, pathname, router],
  );

  const handleResizeMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      setOpenSelector(null);

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

  const canViewMembers = canReadOrganizationMemberships(visibleUser);
  const visiblePrimaryItems = primaryItems.filter(
    (item) => item.key !== "overview" || canViewMembers,
  );
  const visibleAdministrationItems = administrationItems.filter(
    (item) =>
      (item.key !== "members" && item.key !== "settings") || canViewMembers,
  );

  const projectSubItems = useMemo(() => {
    if (!activeProject) return [];
    const projectBasePath = `/projects/${activeProject.id}`;
    const projectOverviewPath = `${projectBasePath}/overview`;
    const projectMembersPath = `${projectBasePath}/members`;
    const projectWorkPath = `${projectBasePath}/work`;
    const projectWorkNotesPath = `${projectBasePath}/work-notes`;
    const projectSettingsPath = `${projectBasePath}/settings`;

    const isThisProjectInPath = activeProjectIdFromPath === activeProject.id;
    const isProjectWorkActive =
      isThisProjectInPath &&
      (pathname === projectWorkPath ||
        pathname.startsWith(`${projectWorkPath}/`));
    const isProjectWorkNotesActive =
      isThisProjectInPath &&
      (pathname === projectWorkNotesPath ||
        pathname.startsWith(`${projectWorkNotesPath}/`));
    const activeSyncedTab =
      isThisProjectInPath &&
      syncedProjectTab?.pathnameAtSync === pathname &&
      syncedProjectTab.projectId === activeProject.id &&
      !isProjectWorkActive &&
      !isProjectWorkNotesActive
        ? syncedProjectTab.tab
        : null;
    const isProjectMembersActive = isThisProjectInPath
      ? activeSyncedTab
        ? activeSyncedTab === "members"
        : pathname === projectMembersPath ||
          pathname.startsWith(`${projectMembersPath}/`)
      : false;
    const isProjectSettingsActive = isThisProjectInPath
      ? activeSyncedTab
        ? activeSyncedTab === "settings"
        : pathname === projectSettingsPath ||
          pathname.startsWith(`${projectSettingsPath}/`)
      : false;
    const isProjectOverviewActive = isThisProjectInPath
      ? activeSyncedTab
        ? activeSyncedTab === "overview"
        : pathname === projectBasePath ||
          pathname === projectOverviewPath ||
          pathname.startsWith(`${projectOverviewPath}/`)
      : false;

    return [
      {
        key: "overview",
        label: t("items.projectOverview"),
        href: projectOverviewPath,
        isActive: isProjectOverviewActive,
        icon: BoxCubeIcon,
        viewBox: "1.5 1.5 21 21",
        tab: "overview" as const,
      },
      {
        key: "members",
        label: t("items.projectMembers"),
        href: projectMembersPath,
        isActive: isProjectMembersActive,
        icon: GroupIcon,
        viewBox: "0.5 0.5 23 23",
        tab: "members" as const,
      },
      {
        key: "workspace",
        label: t("items.workspace"),
        href: projectWorkPath,
        isActive: isProjectWorkActive,
        icon: TaskIcon,
        viewBox: "0.5 0.5 23 23",
      },
      {
        key: "workNotes",
        label: t("items.projectWorkNotes"),
        href: projectWorkNotesPath,
        isActive: isProjectWorkNotesActive,
        icon: FileIcon,
        viewBox: "1 0.5 23 23",
      },
      {
        key: "settings",
        label: t("items.projectSettings"),
        href: projectSettingsPath,
        isActive: isProjectSettingsActive,
        icon: SettingsIcon,
        viewBox: "0 0 24 24",
        tab: "settings" as const,
      },
    ];
  }, [activeProject, activeProjectIdFromPath, pathname, syncedProjectTab, t]);

  const renderItem = (
    item: (typeof primaryItems)[number] | (typeof administrationItems)[number],
  ) => {
    const label =
      item.key === "overview" ? t("items.dashboard") : t(`items.${item.key}`);
    const Icon = item.icon;
    const iconViewBox = item.viewBox;
    const isItemActive =
      "path" in item
        ? item.key === "projects"
          ? pathname === "/projects" || pathname === "/projects/new"
          : isSidebarPathActive(item.path, pathname)
        : false;

    return (
      <li key={item.key}>
        {"path" in item ? (
          <Link
            href={item.path}
            aria-label={label}
            aria-current={isItemActive ? "page" : undefined}
            title={!isExpandedView ? label : undefined}
            onClick={() => setOpenSelector(null)}
            className={cn(
              "group menu-item h-8 min-h-8 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-gray-900",
              isItemActive ? "menu-item-active" : "menu-item-inactive",
              !isExpandedView && "justify-center px-1.5",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "menu-item-icon",
                isItemActive
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
              <span className="menu-item-text flex-1 truncate">{label}</span>
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
      {/* Context Selectors: Organization Selector -> Project Selector */}
      <div className="shrink-0 space-y-1.5 pb-2.5">
        <SidebarOrganizationSwitcher
          isExpandedView={isExpandedView}
          organizationId={organizationId}
          organizationName={organizationName}
          organizations={organizations.data ?? []}
          isLoading={organizations.isLoading}
          isError={organizations.isError}
          onRetry={() => void organizations.refetch()}
          isOpen={openSelector === "organization"}
          onOpenChange={(nextOpen) => {
            setOpenSelector((prev) =>
              nextOpen ? "organization" : prev === "organization" ? null : prev,
            );
          }}
        />
        <SidebarProjectSwitcher
          isExpandedView={isExpandedView}
          organizationName={organizationName}
          projects={sidebarProjects}
          activeProject={activeProject}
          isLoading={projectsQuery.isLoading}
          isError={projectsQuery.isError}
          onRetry={() => void projectsQuery.refetch()}
          onSelectProject={handleSelectProject}
          isOpen={openSelector === "project"}
          onOpenChange={(nextOpen) => {
            setOpenSelector((prev) =>
              nextOpen ? "project" : prev === "project" ? null : prev,
            );
          }}
        />
      </div>

      <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* Current Project Navigation (Only renders for the currently selected project) */}
        {activeProject && (
          <nav
            aria-label={t("projectNavigation")}
            className="mb-2.5 border-b border-gray-200/80 pb-2.5 dark:border-gray-800/80"
          >
            <h2
              id="sidebar-project-group"
              className={cn(
                "mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500",
                !isExpandedView && "sr-only",
              )}
            >
              {t("groups.project")}
            </h2>
            <ul
              role="group"
              aria-label={t("projectActionsLabel", {
                name: activeProject.name,
              })}
              className="flex flex-col gap-0.5"
            >
              {projectSubItems.map((subItem) => {
                const SubIcon = subItem.icon;
                const navigationItem = (
                  <li key={subItem.key}>
                    <Link
                      href={subItem.href}
                      aria-label={subItem.label}
                      aria-current={subItem.isActive ? "page" : undefined}
                      title={!isExpandedView ? subItem.label : undefined}
                      onClick={() => {
                        setOpenSelector(null);
                        if (subItem.tab) {
                          setSyncedProjectTab({
                            pathnameAtSync: pathname,
                            projectId: activeProject.id,
                            tab: subItem.tab,
                          });
                          window.dispatchEvent(
                            new CustomEvent("continuum:project-tab-change", {
                              detail: {
                                projectId: activeProject.id,
                                tab: subItem.tab,
                              },
                            }),
                          );
                        }
                      }}
                      className={cn(
                        "group menu-item h-8 min-h-8 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-gray-900",
                        subItem.isActive
                          ? "menu-item-active"
                          : "menu-item-inactive",
                        !isExpandedView && "justify-center px-1.5",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "menu-item-icon",
                          subItem.isActive
                            ? "menu-item-icon-active"
                            : "menu-item-icon-inactive",
                        )}
                      >
                        <SubIcon
                          viewBox={subItem.viewBox}
                          preserveAspectRatio="xMidYMid meet"
                          className="size-[18px] shrink-0"
                        />
                      </span>
                      {isExpandedView && (
                        <span className="menu-item-text flex-1 truncate">
                          {subItem.label}
                        </span>
                      )}
                    </Link>
                  </li>
                );

                return subItem.key === "settings" ? (
                  <ProjectSettingsNavigation
                    key={subItem.key}
                    organizationId={organizationId ?? ""}
                    projectId={activeProject.id}
                    active={
                      activeProject.status === "ACTIVE" && Boolean(visibleUser)
                    }
                  >
                    {navigationItem}
                  </ProjectSettingsNavigation>
                ) : (
                  navigationItem
                );
              })}
            </ul>
          </nav>
        )}

        <nav aria-label={t("navigation")} className="flex flex-col gap-3 pb-3">
          <section aria-labelledby="sidebar-workspace">
            <h2
              id="sidebar-workspace"
              className={cn(
                "mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500",
                !isExpandedView && "sr-only",
              )}
            >
              {t("groups.workspace")}
            </h2>
            <ul className="flex flex-col gap-0.5">
              {visiblePrimaryItems.map(renderItem)}
            </ul>
          </section>
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
    </aside>
  );
};

export default AppSidebar;
