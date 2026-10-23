"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOrganizationOptionsQuery } from "@/lib/queries/auth/useAccountOnboarding";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectsQuery } from "@/lib/queries/projects/useProjects";
import { Link, usePathname } from "@/i18n/navigation";
import { useSidebar } from "@/context/SidebarContext";
import {
  BookOpenIcon,
  CalenderIcon,
  ChatIcon,
  DocsIcon,
  FolderIcon,
  GridIcon,
  GroupIcon,
  HandShakeIcon,
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
  { key: "overview", path: "/dashboard", icon: GridIcon },
  { key: "projects", path: "/projects", icon: FolderIcon },
  { key: "chat", path: "/chat", icon: ChatIcon },
  { key: "workNotes", icon: DocsIcon },
  { key: "knowledge", icon: BookOpenIcon },
  { key: "aiSearch", icon: ShootingStarIcon },
  { key: "handover", icon: HandShakeIcon },
  { key: "calendar", path: "/calendar", icon: CalenderIcon },
] as const;

const administrationItems = [
  { key: "members", path: "/organization/members", icon: GroupIcon },
  { key: "integrations", icon: PlugInIcon },
  { key: "settings", path: "/organization/settings", icon: SettingsIcon },
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
    pageSize: 20,
    status: "ACTIVE",
  });
  const activeProjects = projectsQuery.data?.data ?? [];

  const [fallbackWidth, setFallbackWidth] = useState(DEFAULT_WIDTH);
  const [fallbackExpanded, setFallbackExpanded] = useState<boolean | null>(null);
  const [fallbackIsResizing, setFallbackIsResizing] = useState(false);
  const cleanupResizeRef = useRef<(() => void) | null>(null);

  const resolvedExpandedWidth = safeClampWidth(
    sidebarWidth ?? fallbackWidth,
  );
  const resolvedIsExpanded = setIsExpanded
    ? isExpanded
    : (fallbackExpanded ?? isExpanded);
  const activeIsResizing = isResizing ?? fallbackIsResizing;

  const updateExpanded = useCallback(
    (nextExpanded: boolean) => {
      if (setIsExpanded) {
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
      if (setSidebarWidth) {
        setSidebarWidth(clamped);
      } else {
        setFallbackWidth(clamped);
      }
    },
    [setSidebarWidth],
  );

  const updateResizing = useCallback(
    (nextResizing: boolean) => {
      if (setIsResizing) {
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
      if (resetSidebarWidth) {
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
      projects: {
        key: "projects",
        title: t("items.projects"),
        subtitle: "Recent & active project workspaces",
        primaryHref: "/projects",
        primaryCtaLabel: "View all",
        projects: activeProjects,
        isLoadingProjects: Boolean(projectsQuery.isLoading),
        secondaryCta: {
          label: "Create project",
          href: "/projects/new",
        },
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
      calendar: {
        key: "calendar",
        title: t("items.calendar"),
        subtitle: "Milestones, schedules & delivery dates",
        primaryHref: "/calendar",
        primaryCtaLabel: "Open",
        quickLinks: [
          {
            id: "org-calendar",
            label: "Workspace Calendar",
            description: "View upcoming milestones and scheduled events",
            href: "/calendar",
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
    [activeProjects, organizationName, projectsQuery.isLoading, t],
  );

  const activeFlyoutConfig =
    activeKey && !activeIsResizing ? (flyoutConfigs[activeKey] ?? null) : null;

  const renderItem = (
    item: (typeof primaryItems)[number] | (typeof administrationItems)[number],
  ) => {
    const label = t(`items.${item.key}`);
    const Icon = item.icon;
    const iconViewBox = item.key === "projects" ? "0 0 20 18" : "0 0 24 24";
    const hasFlyout = "path" in item && Boolean(flyoutConfigs[item.key]);
    const isFlyoutOpen = activeKey === item.key && !activeIsResizing;

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
              <Icon viewBox={iconViewBox} className="size-4 shrink-0" />
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
              <Icon viewBox={iconViewBox} className="size-4 shrink-0" />
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
            {primaryItems.map(renderItem)}
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
