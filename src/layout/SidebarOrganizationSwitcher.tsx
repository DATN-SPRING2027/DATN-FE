"use client";

import type {
  OrganizationOption,
  SelectOrganizationResponse,
} from "@/lib/queries/auth/useAccountOnboarding";
import { useSelectOrganizationMutation } from "@/lib/queries/auth/useAccountOnboarding";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { CheckCircleIcon, ChevronDownIcon } from "@/icons/index";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/utils";

function resolveSwitchDestination(
  pathname: string | undefined,
  user?: SelectOrganizationResponse["user"],
): string {
  if (!pathname || pathname === "/") return "/dashboard";
  if (pathname === "/projects" || pathname.startsWith("/projects/")) {
    return "/projects";
  }
  if (
    pathname === "/organization/members" ||
    pathname === "/organization/settings" ||
    pathname === "/users"
  ) {
    if (Array.isArray(user?.roles) && !user.roles.includes("ADMIN")) {
      return "/dashboard";
    }
    return pathname;
  }
  if (pathname === "/dashboard" || pathname === "/calendar" || pathname === "/profile") {
    return pathname;
  }
  return "/dashboard";
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0]?.toLocaleUpperCase() ?? "")
    .join("");
}

type SidebarOrganizationSwitcherProps = {
  isExpandedView: boolean;
  organizationId?: string;
  organizationName?: string;
  organizations: readonly OrganizationOption[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
};

export default function SidebarOrganizationSwitcher({
  isExpandedView,
  organizationId,
  organizationName,
  organizations,
  isLoading = false,
  isError = false,
  onRetry,
}: SidebarOrganizationSwitcherProps) {
  const t = useTranslations("sidebar");
  const pathname = usePathname();
  const router = useRouter();
  const select = useSelectOrganizationMutation();
  const [isOpen, setIsOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const name = organizationName || t("organizationUnavailable");
  const label = `${t("organizationLabel")}: ${name}`;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = async (nextOrganizationId: string) => {
    if (nextOrganizationId === organizationId || select.isPending) {
      setIsOpen(false);
      return;
    }

    select.reset();
    setSwitchingId(nextOrganizationId);
    try {
      const result = await select.mutateAsync(nextOrganizationId);
      setIsOpen(false);
      router.replace(resolveSwitchDestination(pathname, result?.user));
    } catch {
      // Keep the menu open so the switch failure and retry choice remain visible.
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("organizationSwitcherLabel")}
        aria-expanded={isOpen}
        aria-controls={isOpen ? "sidebar-organization-options" : undefined}
        title={!isExpandedView ? label : undefined}
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "group flex min-h-14 w-full items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-2 text-start transition-colors hover:border-brand-200 hover:bg-brand-50/60 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/5",
          !isExpandedView && "justify-center px-2",
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
          {getInitials(organizationName || "?") || "?"}
        </span>
        {isExpandedView && (
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-medium tracking-[0.12em] text-gray-400 uppercase dark:text-gray-500">
              {t("organizationLabel")}
            </span>
            <span className="block truncate text-theme-sm font-semibold text-gray-800 group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
              {name}
            </span>
          </span>
        )}
        {isExpandedView && (
          <ChevronDownIcon
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 text-gray-500 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        )}
      </button>

      {isOpen && (
        <section
          id="sidebar-organization-options"
          aria-label={t("organizationListLabel")}
          className="absolute start-0 top-[calc(100%+0.5rem)] z-[60] max-h-80 w-full min-w-56 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {isLoading ? (
            <p
              role="status"
              className="px-3 py-4 text-theme-xs text-gray-500 dark:text-gray-400"
            >
              {t("organizationLoading")}
            </p>
          ) : isError ? (
            <div className="space-y-2 px-3 py-3">
              <p
                role="alert"
                className="text-theme-xs text-error-600 dark:text-error-400"
              >
                {t("organizationLoadError")}
              </p>
              <button
                type="button"
                onClick={() => onRetry?.()}
                className="text-theme-xs font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400"
              >
                {t("organizationRetry")}
              </button>
            </div>
          ) : organizations.length > 0 ? (
            <ul className="space-y-1">
              {organizations.map((organization) => {
                const isCurrent = organization.id === organizationId;
                const isSwitchingTarget =
                  select.isPending && switchingId === organization.id;
                return (
                  <li key={organization.id}>
                    <button
                      type="button"
                      aria-pressed={isCurrent}
                      aria-busy={isSwitchingTarget}
                      disabled={select.isPending || isCurrent}
                      onClick={() => void handleSelect(organization.id)}
                      className={cn(
                        "flex min-h-12 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-default",
                        isCurrent
                          ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                          : isSwitchingTarget
                            ? "bg-brand-50/70 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                            : "text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:text-gray-200 dark:hover:bg-white/5",
                      )}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {getInitials(organization.name)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-theme-sm font-medium">
                        {organization.name}
                      </span>
                      {isCurrent && (
                        <CheckCircleIcon
                          aria-label={t("currentOrganization")}
                          className="size-4 shrink-0 text-brand-600 dark:text-brand-400"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-3 py-3">
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                {t("noOrganizations")}
              </p>
              <Link
                href="/select-organization"
                onClick={() => setIsOpen(false)}
                className="mt-2 inline-flex text-theme-xs font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400"
              >
                {t("manageOrganizations")}
              </Link>
            </div>
          )}
          {select.isError && (
            <p
              role="alert"
              className="mt-2 border-t border-gray-100 px-3 pt-2 text-theme-xs text-error-600 dark:border-gray-800 dark:text-error-400"
            >
              {t("organizationSelectError")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
