"use client";

import BrandLogo from "@/components/common/BrandLogo";
import { Link } from "@/i18n/navigation";
import {
  AlertIcon,
  BoltIcon,
  ChevronDownIcon,
  FolderIcon,
  GridIcon,
  GroupIcon,
  LockIcon,
  LogOutIcon,
  PlugInIcon,
  ShootingStarIcon,
  TableIcon,
  TaskIcon,
  UserCircleIcon,
  UserIcon,
} from "@/icons/index";
import { useTranslations } from "next-intl";
import { ComponentType, SVGProps } from "react";
import { cn } from "@/utils";

type NavItem = {
  id: string;
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

type PlatformSidebarProps = {
  activeSection: string;
  operatorName?: string;
  operatorEmail?: string;
  onSignOut?: () => void;
  isSigningOut?: boolean;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
};

export default function PlatformSidebar({
  activeSection,
  operatorName = "Admin",
  operatorEmail,
  onSignOut,
  isSigningOut = false,
  isOpenMobile = false,
  onCloseMobile,
}: PlatformSidebarProps) {
  const t = useTranslations("platformConsole");

  const navigationGroups: NavGroup[] = [
    {
      title: t("navigation.dashboardGroup"),
      items: [
        {
          id: "dashboard",
          href: "/platform",
          label: t("navigation.dashboard"),
          icon: GridIcon,
        },
      ],
    },
    {
      title: t("navigation.administrationGroup"),
      items: [
        {
          id: "organizations",
          href: "/platform/organizations",
          label: t("navigation.organizations"),
          icon: GroupIcon,
        },
        {
          id: "users",
          href: "/platform/users",
          label: t("navigation.users"),
          icon: UserIcon,
        },
        {
          id: "memberships",
          href: "/platform/memberships",
          label: t("navigation.memberships"),
          icon: GroupIcon,
        },
        {
          id: "projects",
          href: "/platform/projects",
          label: t("navigation.projects"),
          icon: FolderIcon,
        },
      ],
    },
    {
      title: t("navigation.securityGroup"),
      items: [
        {
          id: "security",
          href: "/platform/security",
          label: t("navigation.security"),
          icon: LockIcon,
        },
      ],
    },
    {
      title: t("navigation.operationsGroup"),
      items: [
        {
          id: "services",
          href: "/platform/services",
          label: t("navigation.services"),
          icon: BoltIcon,
        },
        {
          id: "jobs",
          href: "/platform/jobs",
          label: t("navigation.jobs"),
          icon: TaskIcon,
        },
        {
          id: "ai",
          href: "/platform/ai",
          label: t("navigation.ai"),
          icon: ShootingStarIcon,
        },
        {
          id: "integrations",
          href: "/platform/integrations",
          label: t("navigation.integrations"),
          icon: PlugInIcon,
        },
        {
          id: "incidents",
          href: "/platform/incidents",
          label: t("navigation.incidents"),
          icon: AlertIcon,
        },
      ],
    },
    {
      title: t("navigation.supportGroup"),
      items: [
        {
          id: "diagnostics",
          href: "/platform/diagnostics",
          label: t("navigation.diagnostics"),
          icon: BoltIcon,
        },
      ],
    },
    {
      title: t("navigation.auditGroup"),
      items: [
        {
          id: "audit",
          href: "/platform/audit",
          label: t("navigation.audit"),
          icon: TableIcon,
        },
      ],
    },
    {
      title: t("navigation.accountGroup"),
      items: [
        {
          id: "account",
          href: "/platform/account",
          label: t("navigation.account"),
          icon: UserCircleIcon,
        },
      ],
    },
  ];

  const initials =
    operatorName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "PO";

  const sidebarContent = (
    <div className="no-scrollbar flex h-full flex-col justify-between overflow-y-auto px-4 py-5">
      {/* Top: Logo & Scope Selector */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <BrandLogo className="h-8" priority />
          {isOpenMobile && onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 lg:hidden dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label="Close navigation"
            >
              <svg
                className="size-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Compact Scope Selector (Do not imply tenant membership) */}
        <div className="group dark:bg-gray-850/60 relative flex items-center gap-3 rounded-xl border border-gray-200/80 bg-gray-50/70 p-2.5 transition-colors hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-600 ring-1 ring-brand-500/20 dark:bg-brand-500/15 dark:text-brand-400">
            PL
          </span>
          <div className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500">
              PLATFORM
            </span>
            <span className="block truncate text-xs font-semibold text-gray-800 dark:text-gray-100">
              All organizations
            </span>
          </div>
          <ChevronDownIcon className="size-4 shrink-0 text-gray-400" />
        </div>

        {/* Navigation list */}
        <nav aria-label={t("navigation.title")} className="space-y-5 pt-1">
          {navigationGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="px-2.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeSection === item.id;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      onClick={onCloseMobile}
                      className={cn(
                        "group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
                        isActive
                          ? "bg-brand-50 text-brand-700 shadow-xs dark:bg-brand-500/10 dark:text-brand-300"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          isActive
                            ? "text-brand-600 dark:text-brand-400"
                            : "text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300",
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom: Operator Profile & Security Note */}
      <div className="space-y-3 border-t border-gray-100 pt-4 dark:border-gray-800/80">
        <div className="dark:bg-gray-850/60 flex items-center justify-between gap-2 rounded-xl bg-gray-50/70 p-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 text-xs font-bold text-white">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-gray-800 dark:text-gray-100">
                {operatorName}
              </p>
              <p className="truncate text-[10px] text-gray-400">
                {operatorEmail}
              </p>
            </div>
          </div>
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              disabled={isSigningOut}
              aria-label={t("signOut")}
              title={t("signOut")}
              className="flex size-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <LogOutIcon className="size-3.5" />
            </button>
          )}
        </div>

        <p className="px-1 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
          {t("securityNote")}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="fixed inset-y-0 start-0 z-20 hidden w-[260px] border-e border-gray-200/80 bg-white lg:block dark:border-gray-800 dark:bg-gray-900">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isOpenMobile && (
        <div
          role="presentation"
          onClick={onCloseMobile}
          className="animate-in fade-in fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-xs duration-200 lg:hidden"
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-50 w-[270px] border-e border-gray-200 bg-white transition-transform duration-200 ease-in-out lg:hidden dark:border-gray-800 dark:bg-gray-900",
          isOpenMobile ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
