"use client";

import {
  useCurrentUserQuery,
  useLogoutMutation,
} from "@/lib/queries/auth/useAuth";
import { Link, useRouter } from "@/i18n/navigation";
import { LogOutIcon } from "@/icons/index";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/utils";

function getInitials(name?: string) {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function formatRole(roles?: readonly string[]) {
  const role = roles?.[0];
  if (!role) return "";
  if (role === "ADMIN") return "Administrator";
  return role
    .toLowerCase()
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function SidebarAccountFooter({
  isExpandedView,
}: {
  isExpandedView: boolean;
}) {
  const t = useTranslations("sidebar.account");
  const router = useRouter();
  const user = useCurrentUserQuery();
  const logout = useLogoutMutation();
  const [hasLogoutError, setHasLogoutError] = useState(false);
  const name = user.data?.name || user.data?.email || t("defaultName");
  const role = formatRole(user.data?.roles) || t("defaultRole");

  const handleLogout = async () => {
    setHasLogoutError(false);
    try {
      await logout.mutateAsync();
      router.replace("/signin");
    } catch {
      setHasLogoutError(true);
    }
  };

  return (
    <div className="shrink-0 border-t border-gray-200 pt-4 pb-2 dark:border-gray-800">
      <div
        className={cn(
          "flex min-h-12 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/70 p-1.5 dark:border-gray-800 dark:bg-gray-900/60",
          !isExpandedView &&
            "justify-center border-transparent bg-transparent p-0 dark:bg-transparent",
        )}
      >
        <Link
          href="/profile"
          aria-label={t("profile", { name })}
          title={!isExpandedView ? name : undefined}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none",
            !isExpandedView && "flex-none",
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-100">
            {getInitials(name)}
          </span>
          {isExpandedView && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-theme-xs font-semibold text-gray-800 dark:text-white">
                {name}
              </span>
              <span className="block truncate text-[10px] text-gray-500 dark:text-gray-400">
                {role}
              </span>
            </span>
          )}
        </Link>
        <button
          type="button"
          aria-label={logout.isPending ? t("signingOut") : t("signOut")}
          title={!isExpandedView ? t("signOut") : undefined}
          disabled={logout.isPending}
          onClick={handleLogout}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {logout.isPending ? (
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-gray-300 border-t-brand-500"
            />
          ) : (
            <LogOutIcon aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>
      {hasLogoutError && isExpandedView && (
        <p
          role="alert"
          className="px-1 pt-2 text-theme-xs text-error-600 dark:text-error-400"
        >
          {t("signOutError")}
        </p>
      )}
    </div>
  );
}
