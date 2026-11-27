"use client";

import TokenUsageModal from "@/components/token-usage/TokenUsageModal";
import { useTokenUsageModalStore } from "@/components/token-usage/token-usage.store";
import { Dropdown } from "@/components/ui/dropdown/Dropdown";
import { Link, usePathname } from "@/i18n/navigation";
import {
  BellOutlineIcon,
  ExternalLinkIcon,
  MonitorIcon,
  OrbitIcon,
  PieChartIcon,
  SettingsIcon,
  UserIcon,
  UsersOutlineIcon,
} from "@/icons";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import { canReadOrganizationMemberships } from "@/lib/queries/organization-memberships/organization-membership-permissions";
import { useProjectManagementAccess } from "@/lib/queries/projects/useProjectSettings";
import { cn } from "@/utils";
import { useTranslations } from "next-intl";
import type React from "react";
import { useRef, useState } from "react";

type SettingsItem = {
  id: string;
  title: string;
  description: string;
  href?: string;
  icon: React.ReactNode;
  showExternalIcon?: boolean;
};

export default function HeaderSettingsDropdown({
  onFocusSearch,
}: {
  onFocusSearch?: () => void;
}) {
  const t = useTranslations("header");
  const [isOpen, setIsOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const currentUser = useCurrentUserQuery();
  const currentUserAccessLost = isAccessOrResourceUnavailableError(currentUser.error);
  const visibleCurrentUser = currentUserAccessLost ? undefined : currentUser.data;
  const organizationId =
    visibleCurrentUser && "organizationId" in visibleCurrentUser
      ? (visibleCurrentUser.organizationId ?? "")
      : "";
  const isManager = canReadOrganizationMemberships(visibleCurrentUser);
  const pathname = usePathname();
  const projectId = /^\/projects\/([^/]+)/.exec(pathname)?.[1] ?? "";
  const projectAccess = useProjectManagementAccess(organizationId, projectId, isOpen && Boolean(organizationId && projectId));
  const isProjectLeader = !isManager && projectAccess.canUpdateProject;
  const openTokenUsageModal = useTokenUsageModalStore((s) => s.openModal);

  const closeDropdown = () => setIsOpen(false);

  const openUsage = () => {
    settingsButtonRef.current?.focus({ preventScroll: true });
    closeDropdown();
    openTokenUsageModal();
  };

  const handleSearchShortcutClick = () => {
    closeDropdown();
    onFocusSearch?.();
  };

  const personalItems: SettingsItem[] = [
    {
      id: "general",
      title: t("settingsMenu.generalTitle"),
      description: t("settingsMenu.generalDesc"),
      href: "/profile",
      icon: <UserIcon aria-hidden="true" className="size-[17px]" />,
    },
    {
      id: "notifications",
      title: t("settingsMenu.notificationTitle"),
      description: t("settingsMenu.notificationDesc"),
      href: "/notifications",
      icon: <BellOutlineIcon aria-hidden="true" className="size-[17px]" />,
    },
    ...(organizationId
      ? [
          {
            id: "usage",
            title: t("settingsMenu.usageTitle"),
            description: t("settingsMenu.usageDesc"),
            icon: <PieChartIcon aria-hidden="true" className="size-[17px]" />,
          } satisfies SettingsItem,
        ]
      : []),
  ];

  const spacesIcon = <OrbitIcon aria-hidden="true" className="size-[17px]" />;

  const usersIcon = (
    <UsersOutlineIcon aria-hidden="true" className="size-[17px]" />
  );

  const workspaceItems: SettingsItem[] = isManager
    ? [
        {
          id: "system",
          title: t("settingsMenu.systemTitle"),
          description: t("settingsMenu.systemDesc"),
          href: "/organization/settings",
          icon: <MonitorIcon aria-hidden="true" className="size-[17px]" />,
        },
        {
          id: "spaces",
          title: t("settingsMenu.spacesTitle"),
          description: t("settingsMenu.spacesDesc"),
          href: "/projects",
          icon: spacesIcon,
        },
        {
          id: "user-management",
          title: t("settingsMenu.userManagementTitle"),
          description: t("settingsMenu.userManagementDesc"),
          href: "/organization/members",
          showExternalIcon: true,
          icon: usersIcon,
        },
      ]
    : isProjectLeader
      ? [
          {
            id: "spaces",
            title: t("settingsMenu.spacesTitle"),
            description: t("settingsMenu.spacesDesc"),
            href: `/projects/${encodeURIComponent(projectId)}/settings`,
            icon: spacesIcon,
          },
          {
            id: "team-management",
            title: t("settingsMenu.teamManagementTitle"),
            description: t("settingsMenu.teamManagementDesc"),
            href: `/projects/${encodeURIComponent(projectId)}/members`,
            icon: usersIcon,
          },
        ]
      : [
          {
            id: "spaces",
            title: t("settingsMenu.spacesTitle"),
            description: t("settingsMenu.memberSpacesDesc"),
            href: "/projects",
            icon: spacesIcon,
          },
        ];

  const workspaceSectionTitle = isManager
    ? t("settingsMenu.adminHeading")
    : isProjectLeader
      ? t("settingsMenu.leaderHeading")
      : t("settingsMenu.workspaceHeading");

  const renderSettingsRow = (item: SettingsItem) => {
    const rowContent = (
      <>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="shrink-0 text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white">
            {item.icon}
          </span>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[13px] leading-snug font-medium text-gray-900 dark:text-white">
              {item.title}
            </span>
            <span className="block truncate text-[11px] leading-tight text-gray-500 dark:text-gray-400">
              {item.description}
            </span>
          </div>
        </div>

        {item.showExternalIcon && (
          <ExternalLinkIcon
            aria-hidden="true"
            className="size-3.5 shrink-0 text-gray-400 group-hover:text-gray-700 rtl:-scale-x-100 dark:text-gray-500 dark:group-hover:text-gray-300"
          />
        )}
      </>
    );

    return (
      <li key={item.id}>
        {item.id === "usage" ? (
          <button
            type="button"
            data-testid={`header-settings-${item.id}`}
            onClick={openUsage}
            className="group flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors hover:bg-gray-100 dark:hover:bg-white/5"
          >
            {rowContent}
          </button>
        ) : (
          <Link
            href={item.href ?? "/profile"}
            onClick={closeDropdown}
            className="group flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-white/5"
          >
            {rowContent}
          </Link>
        )}
      </li>
    );
  };

  return (
    <div className="relative">
      <button
        ref={settingsButtonRef}
        type="button"
        aria-label={t("settings")}
        title={t("settings")}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "dropdown-toggle relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white",
          isOpen &&
            "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white",
        )}
      >
        <SettingsIcon aria-hidden="true" className="size-[19px] shrink-0" />
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute inset-e-0 mt-3 w-76 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg sm:w-80 dark:border-gray-800 dark:bg-gray-dark"
      >
        {/* Section 1: Personal settings + Search (Ctrl + K) */}
        <div className="flex items-center justify-between gap-2 px-2.5 pt-1 pb-1">
          <span className="text-[11px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            {t("settingsMenu.personalHeading")}
          </span>
          <button
            type="button"
            onClick={handleSearchShortcutClick}
            className="hidden items-center gap-1 rounded-md border border-gray-200 bg-gray-50/80 px-2 py-0.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-100 xl:inline-flex dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <span>{t("settingsMenu.searchLabel")}</span>
            <kbd className="rounded bg-white px-1 py-px text-[10px] font-semibold text-gray-500 shadow-2xs dark:bg-gray-700 dark:text-gray-300">
              Ctrl+K
            </kbd>
          </button>
        </div>
        <ul className="flex flex-col gap-0.5">
          {personalItems.map(renderSettingsRow)}
        </ul>

        {/* Section 2: Role-adapted Essential Settings */}
        <div className="mt-1.5 border-t border-gray-200/80 px-2.5 pt-2 pb-1 dark:border-gray-800">
          <span className="text-[11px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            {workspaceSectionTitle}
          </span>
        </div>
        <ul className="flex flex-col gap-0.5">
          {workspaceItems.map(renderSettingsRow)}
        </ul>
      </Dropdown>
      <TokenUsageModal />
    </div>
  );
}
