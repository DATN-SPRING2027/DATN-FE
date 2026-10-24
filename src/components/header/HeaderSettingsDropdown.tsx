"use client";

import { Dropdown } from "@/components/ui/dropdown/Dropdown";
import { Link } from "@/i18n/navigation";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import { canReadOrganizationMemberships } from "@/lib/queries/organization-memberships/organization-membership-permissions";
import { useProjectsQuery } from "@/lib/queries/projects/useProjects";
import { cn } from "@/utils";
import { useTranslations } from "next-intl";
import type React from "react";
import { useState } from "react";

type SettingsItem = {
  id: string;
  title: string;
  description: string;
  href: string;
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
  const currentUser = useCurrentUserQuery();
  const currentUserAccessLost = isAccessOrResourceUnavailableError(currentUser.error);
  const visibleCurrentUser = currentUserAccessLost ? undefined : currentUser.data;
  const organizationId =
    visibleCurrentUser && "organizationId" in visibleCurrentUser
      ? (visibleCurrentUser.organizationId ?? "")
      : "";
  const roles =
    visibleCurrentUser && "roles" in visibleCurrentUser
      ? (visibleCurrentUser.roles ?? [])
      : [];

  const isManager = canReadOrganizationMemberships(visibleCurrentUser);

  const projectsQuery = useProjectsQuery(
    organizationId,
    {
      page: 1,
      pageSize: 20,
      status: "ACTIVE",
    },
    {
      enabled: isOpen,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  );

  const isProjectLeader =
    !isManager &&
    (roles.includes("TEAM_LEADER") ||
      roles.includes("LEADER") ||
      Boolean(
        !currentUserAccessLost &&
          !isAccessOrResourceUnavailableError(projectsQuery.error) &&
          projectsQuery.data?.data?.some((project) =>
          project.leaders?.some(
            (leader) => leader.userId === visibleCurrentUser?.id,
          ),
        ),
      ));

  const closeDropdown = () => setIsOpen(false);

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
      icon: (
        <svg
          aria-hidden="true"
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
        </svg>
      ),
    },
    {
      id: "notifications",
      title: t("settingsMenu.notificationTitle"),
      description: t("settingsMenu.notificationDesc"),
      href: "/chat",
      icon: (
        <svg
          aria-hidden="true"
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
      ),
    },
  ];

  const spacesIcon = (
    <svg
      aria-hidden="true"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="6" />
      <ellipse
        cx="12"
        cy="12"
        rx="10"
        ry="4"
        transform="rotate(-25 12 12)"
      />
    </svg>
  );

  const usersIcon = (
    <svg
      aria-hidden="true"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );

  const workspaceItems: SettingsItem[] = isManager
    ? [
        {
          id: "system",
          title: t("settingsMenu.systemTitle"),
          description: t("settingsMenu.systemDesc"),
          href: "/organization/settings",
          icon: (
            <svg
              aria-hidden="true"
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="12" rx="2" />
              <path d="M8 20h8" />
              <path d="M12 16v4" />
            </svg>
          ),
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
            href: "/projects",
            icon: spacesIcon,
          },
          {
            id: "team-management",
            title: t("settingsMenu.teamManagementTitle"),
            description: t("settingsMenu.teamManagementDesc"),
            href: "/projects",
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

  const renderSettingsRow = (item: SettingsItem) => (
    <li key={item.id}>
      <Link
        href={item.href}
        onClick={closeDropdown}
        className="group flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-white/5"
      >
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
          <svg
            aria-hidden="true"
            className="size-3.5 shrink-0 text-gray-400 group-hover:text-gray-700 rtl:-scale-x-100 dark:text-gray-500 dark:group-hover:text-gray-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        )}
      </Link>
    </li>
  );

  return (
    <div className="relative">
      <button
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
        <svg
          aria-hidden="true"
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
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
    </div>
  );
}
