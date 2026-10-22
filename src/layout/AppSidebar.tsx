"use client";

import { useState } from "react";
import BrandLogo from "@/components/common/BrandLogo";
import { useOrganizationOptionsQuery } from "@/lib/queries/auth/useAccountOnboarding";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectsQuery } from "@/lib/queries/projects/useProjects";
import { Link, usePathname } from "@/i18n/navigation";
import { useSidebar } from "@/context/SidebarContext";
import {
  BookOpenIcon,
  CalenderIcon,
  ChatIcon,
  ChevronDownIcon,
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

const primaryItems = [
  { key: "overview", path: "/dashboard", icon: GridIcon },
  { key: "projects", path: "/projects", icon: FolderIcon },
  { key: "chat", path: "/chat", icon: ChatIcon },
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

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
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

  const isExpandedView = isExpanded || isHovered || isMobileOpen;
  const canViewMembers = canReadOrganizationMemberships(currentUser.data);
  const visibleAdministrationItems = administrationItems.filter(
    (item) =>
      (item.key !== "members" && item.key !== "settings") || canViewMembers,
  );

  const renderItem = (
    item: (typeof primaryItems)[number] | (typeof administrationItems)[number],
  ) => {
    const label = t(`items.${item.key}`);
    const Icon = item.icon;

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
                "group menu-item min-h-11 w-full focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-gray-900",
                isActive
                  ? "menu-item-active shadow-theme-xs"
                  : "menu-item-inactive",
                isExpandedView ? "pe-9" : "justify-center px-2",
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
                <Icon />
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
              className="mt-1.5 ms-4 flex flex-col gap-1 border-s border-gray-200 ps-2.5 dark:border-gray-800"
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
                  const projectWorkPath = `/projects/${project.id}/work`;
                  const isProjectWorkActive =
                    pathname === projectWorkPath ||
                    pathname.startsWith(`${projectWorkPath}/`);
                  const isThisProjectActive =
                    activeProjectIdFromPath === project.id;

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
                          className="ms-3.5 flex flex-col gap-0.5 border-s border-gray-200 ps-2 dark:border-gray-800"
                        >
                          <li>
                            <Link
                              href={projectWorkPath}
                              aria-current={
                                isProjectWorkActive ? "page" : undefined
                              }
                              className={cn(
                                "flex min-h-8 items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none",
                                isProjectWorkActive
                                  ? "bg-brand-50 font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200",
                              )}
                            >
                              <DocsIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">
                                {t("items.workspace")}
                              </span>
                            </Link>
                          </li>
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
      <li key={item.key}>
        {"path" in item ? (
          <Link
            href={item.path}
            aria-label={label}
            aria-current={
              isSidebarPathActive(item.path, pathname) ? "page" : undefined
            }
            title={!isExpandedView ? label : undefined}
            className={cn(
              "group menu-item min-h-11 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-gray-900",
              isSidebarPathActive(item.path, pathname)
                ? "menu-item-active shadow-theme-xs"
                : "menu-item-inactive",
              !isExpandedView && "justify-center px-2",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "menu-item-icon",
                isSidebarPathActive(item.path, pathname)
                  ? "menu-item-icon-active"
                  : "menu-item-icon-inactive",
              )}
            >
              <Icon />
            </span>
            {isExpandedView && <span className="menu-item-text">{label}</span>}
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
              "group menu-item min-h-11 cursor-not-allowed text-start text-gray-500 opacity-75 dark:text-gray-400",
              !isExpandedView && "justify-center px-2",
            )}
          >
            <span
              aria-hidden="true"
              className="menu-item-icon-inactive menu-item-icon"
            >
              <Icon />
            </span>
            {isExpandedView && <span className="menu-item-text">{label}</span>}
          </button>
        )}
      </li>
    );
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 start-0 z-50 flex h-full flex-col border-e border-gray-200 bg-white px-4 text-gray-900 transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100",
        isExpanded || isMobileOpen || isHovered ? "w-72.5" : "w-22.5",
        isMobileOpen
          ? "translate-x-0"
          : "-translate-x-full rtl:translate-x-full",
        "xl:translate-x-0 xl:rtl:translate-x-0",
      )}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn(
          "flex shrink-0 py-6",
          isExpandedView ? "justify-start" : "justify-center",
        )}
      >
        <Link href="/" aria-label={t("brandLabel")} className="inline-flex">
          {isExpandedView ? (
            <BrandLogo className="h-10" priority />
          ) : (
            <BrandLogo variant="mark" className="h-8 w-8" priority />
          )}
        </Link>
      </div>

      <div className="shrink-0 pb-5">
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
        <nav aria-label={t("navigation")} className="flex flex-col gap-6 pb-4">
          <ul className="flex flex-col gap-1.5">
            {primaryItems.map(renderItem)}
          </ul>
          <section aria-labelledby="sidebar-administration">
            <h2
              id="sidebar-administration"
              className={cn(
                "mb-3 px-3 text-theme-xs font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-400",
                !isExpandedView && "sr-only",
              )}
            >
              {t("groups.administration")}
            </h2>
            <ul className="flex flex-col gap-1.5">
              {visibleAdministrationItems.map(renderItem)}
            </ul>
          </section>
        </nav>
      </div>

      <SidebarAccountFooter isExpandedView={isExpandedView} />
    </aside>
  );
};

export default AppSidebar;
