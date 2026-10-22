"use client";

import BrandLogo from "@/components/common/BrandLogo";
import { useOrganizationOptionsQuery } from "@/lib/queries/auth/useAccountOnboarding";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
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
