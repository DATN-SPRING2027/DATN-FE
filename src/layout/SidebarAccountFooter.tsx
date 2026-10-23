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
import { useRoleDisplayLabel } from "@/components/common/RoleLabel";

function getInitials(name?: string) {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export default function SidebarAccountFooter({
  isExpandedView,
}: {
  isExpandedView: boolean;
}) {
  const t = useTranslations("sidebar.account");
  const roleLabel = useRoleDisplayLabel();
  const router = useRouter();
  const user = useCurrentUserQuery();
  const logout = useLogoutMutation();
  const [hasLogoutError, setHasLogoutError] = useState(false);
  const name = user.data?.name || user.data?.email || t("defaultName");
  const role = user.data?.roles?.[0]
    ? roleLabel(user.data.roles[0])
    : t("defaultRole");

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
    <div className="shrink-0 border-t border-gray-200/80 py-2 dark:border-gray-800">
      <div
        className={cn(
          "flex min-h-9 items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-gray-100/70 dark:hover:bg-white/[0.04]",
          !isExpandedView && "justify-center px-0",
        )}
      >
        <Link
          href="/profile"
          aria-label={t("profile", { name })}
          title={!isExpandedView ? name : undefined}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-[5px] focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none",
            !isExpandedView && "flex-none",
          )}
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-[5px] bg-gray-200/90 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            {getInitials(name)}
          </span>
          {isExpandedView && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] leading-4 font-medium text-gray-800 dark:text-gray-100">
                {name}
              </span>
              <span className="block truncate text-[10px] leading-3.5 text-gray-500 dark:text-gray-400">
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
          className="flex size-7 shrink-0 items-center justify-center rounded-[5px] text-gray-500 transition-colors hover:bg-gray-200/70 hover:text-gray-800 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          {logout.isPending ? (
            <span
              aria-hidden="true"
              className="size-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-500"
            />
          ) : (
            <LogOutIcon
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="size-3.5"
            />
          )}
        </button>
      </div>
      {hasLogoutError && isExpandedView && (
        <p
          role="alert"
          className="px-1 pt-1.5 text-xs text-error-600 dark:text-error-400"
        >
          {t("signOutError")}
        </p>
      )}
    </div>
  );
}
