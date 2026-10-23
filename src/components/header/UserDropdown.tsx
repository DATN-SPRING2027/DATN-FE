"use client";

import UserAvatar from "@/components/common/UserAvatar";
import Alert from "@/components/ui/alert/Alert";
import { useTheme } from "@/context/ThemeContext";
import { useClickOutside } from "@/hooks/useClickOutside";
import { getLanguage, languages } from "@/i18n/languages";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  useCurrentUserQuery,
  useLogoutMutation,
} from "@/lib/queries/auth/useAuth";
import { useUserQuery } from "@/lib/queries/users/useUsers";
import { cn } from "@/utils";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";

type ThemeOption = "light" | "dark" | "auto";

function useSafeTheme() {
  try {
    return useTheme();
  } catch {
    return {
      theme: "light" as const,
      themeMode: "light" as ThemeOption,
      setThemeMode: () => {},
      toggleTheme: () => {},
    };
  }
}

export default function UserDropdown() {
  const t = useTranslations("userDropdown");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const { themeMode, setThemeMode } = useSafeTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubDropdownOpen, setIsSubDropdownOpen] = useState(false);
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const user = useCurrentUserQuery();
  const organizationId =
    user.data?.context === "ACCOUNT" ? "" : (user.data?.organizationId ?? "");
  const directory = useUserQuery(organizationId, user.data?.id ?? "");
  const directoryUser =
    directory.data?.id === user.data?.id ? directory.data : undefined;
  const displayName = directoryUser?.fullName || user.data?.name || "";
  const logout = useLogoutMutation();
  const subDropdownRef = useRef<HTMLLIElement>(null);
  const themeDropdownRef = useRef<HTMLLIElement>(null);

  const currentLang = getLanguage(locale);
  const CurrentFlagIcon = currentLang.FlagIcon;

  useClickOutside(subDropdownRef, () => {
    setIsSubDropdownOpen(false);
  });

  useClickOutside(themeDropdownRef, () => {
    setIsThemeDropdownOpen(false);
  });

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (isOpen) {
      setIsSubDropdownOpen(false);
      setIsThemeDropdownOpen(false);
    }
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setIsSubDropdownOpen(false);
    setIsThemeDropdownOpen(false);
  };

  const handleSelectLanguage = (id: Locale) => {
    router.replace(pathname, { locale: id });
    setIsSubDropdownOpen(false);
  };

  const handleSelectTheme = (mode: ThemeOption) => {
    setThemeMode(mode);
    setIsThemeDropdownOpen(false);
  };

  const handleSwitchAccount = () => {
    closeDropdown();
    router.replace("/signin");
  };

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
      closeDropdown();
      router.replace("/signin");
    } catch {
      // Keep the menu open so the error and retry action remain visible.
    }
  };

  const themeOptions: { id: ThemeOption; label: string }[] = [
    { id: "light", label: t("themeLight") },
    { id: "dark", label: t("themeDark") },
    { id: "auto", label: t("themeSystem") },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleDropdown}
        className="dropdown-toggle flex items-center rounded-full text-gray-700 transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400"
      >
        <UserAvatar
          name={displayName}
          avatarUrl={directoryUser?.avatarUrl}
          alt=""
          className="size-9 text-xs ring-2 ring-transparent transition-all hover:ring-gray-200 dark:hover:ring-gray-700"
        />
        <span className="sr-only">{displayName}</span>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute inset-e-0 mt-3 flex w-72 flex-col rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        {/* User summary card (matches Image 3) */}
        <div className="flex items-center gap-3.5 rounded-xl bg-gray-100/80 px-3.5 py-3 dark:bg-white/5">
          <UserAvatar
            name={displayName}
            avatarUrl={directoryUser?.avatarUrl}
            alt=""
            className="size-12 shrink-0 text-sm"
          />
          <div className="min-w-0 flex-1">
            <span className="block truncate text-theme-sm font-semibold text-gray-900 dark:text-white">
              {displayName}
            </span>
            <span className="mt-0.5 block truncate text-theme-xs text-gray-500 dark:text-gray-400">
              {user.data?.email}
            </span>
          </div>
        </div>

        <ul className="mt-1.5 flex flex-col gap-0.5 border-b border-gray-200 pb-1.5 dark:border-gray-800">
          {/* Profile */}
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              href="/profile"
              className="group flex items-center gap-3 rounded-lg px-3! py-2.5 text-theme-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <svg
                aria-hidden="true"
                className="text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white"
                width="20"
                height="20"
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
              {t("profile")}
            </DropdownItem>
          </li>

          {/* Account settings */}
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              href="/profile"
              className="group flex items-center gap-3 rounded-lg px-3! py-2.5 text-theme-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <svg
                aria-hidden="true"
                className="text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              {t("accountSettings")}
            </DropdownItem>
          </li>

          {/* Theme (with half-circle icon and right chevron) */}
          <li className="relative" ref={themeDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsThemeDropdownOpen((prev) => !prev);
                setIsSubDropdownOpen(false);
              }}
              className={cn(
                "group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-theme-sm font-medium transition-colors",
                isThemeDropdownOpen
                  ? "bg-gray-100 text-gray-900 dark:bg-white/5 dark:text-white"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white",
              )}
            >
              <span className="flex items-center gap-3 text-theme-sm">
                <svg
                  aria-hidden="true"
                  className="text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M12 3a9 9 0 0 1 0 18V3z"
                    fill="currentColor"
                  />
                </svg>
                <span>{t("theme")}</span>
              </span>

              <svg
                aria-hidden="true"
                className="size-4 text-gray-500 rtl:rotate-180 dark:text-gray-400"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m7.5 5 5 5-5 5" />
              </svg>
            </button>

            {isThemeDropdownOpen && (
              <div className="absolute top-11 z-50 w-52 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg md:top-0 ltr:-left-2 ltr:md:right-[calc(100%+14px)] ltr:md:left-auto rtl:-right-2 rtl:md:right-auto rtl:md:left-[calc(100%+14px)] dark:border-gray-800 dark:bg-gray-dark">
                <ul className="flex flex-col gap-1">
                  {themeOptions.map((option) => {
                    const isSelected = themeMode === option.id;
                    return (
                      <li key={option.id}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectTheme(option.id);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-start text-theme-sm font-medium transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white",
                            isSelected
                              ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
                              : "text-gray-700 hover:bg-gray-100 dark:hover:bg-white/5",
                          )}
                        >
                          <span className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full transition-opacity",
                                isSelected
                                  ? "bg-brand-500 opacity-100 dark:bg-brand-400"
                                  : "opacity-0",
                              )}
                            />
                            <span>{option.label}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </li>

          {/* Language (kept right below Theme as requested) */}
          <li className="relative" ref={subDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsSubDropdownOpen((prev) => !prev);
                setIsThemeDropdownOpen(false);
              }}
              className={cn(
                "group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-theme-sm font-medium transition-colors",
                isSubDropdownOpen
                  ? "bg-gray-100 text-gray-900 dark:bg-white/5 dark:text-white"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white",
              )}
            >
              <span className="flex items-center gap-3 text-theme-sm">
                <svg
                  aria-hidden="true"
                  className="text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M12.001 2.75C17.1091 2.75 21.2501 6.89178 21.2501 11.9999C21.2501 17.108 17.1091 21.2498 12.001 21.2498M12.001 2.75C6.89289 2.75 2.75195 6.89178 2.75195 11.9999C2.75195 17.108 6.8929 21.2498 12.001 21.2498M12.001 2.75C14.2097 2.75 16.0005 6.8914 16.0005 11.9993C16.0005 17.1073 14.2098 21.2498 12.001 21.2498M12.001 2.75C9.79226 2.75 8.00195 6.89141 8.00195 11.9994C8.00195 17.1073 9.79226 21.2498 12.001 21.2498M3.24561 8.99976H20.7544M3.24561 14.9998H20.7544"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                <span>{t("language")}</span>
              </span>

              <span className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-theme-xs font-medium text-gray-700 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300">
                <span>{currentLang.shortName}</span>
                <CurrentFlagIcon className="size-3.5 shrink-0 overflow-hidden rounded-full" />
              </span>
            </button>

            {isSubDropdownOpen && (
              <div className="absolute top-11 z-50 w-62.5 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg md:top-0 ltr:-left-2 ltr:md:right-[calc(100%+14px)] ltr:md:left-auto rtl:-right-2 rtl:md:right-auto rtl:md:left-[calc(100%+14px)] dark:border-gray-800 dark:bg-gray-dark">
                <ul className="flex flex-col gap-1">
                  {languages.map((language) => {
                    const isSelected = locale === language.id;
                    const FlagIcon = language.FlagIcon;

                    return (
                      <li key={language.id}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectLanguage(language.id);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-start text-theme-sm font-medium transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white",
                            isSelected
                              ? "bg-brand-50 dark:bg-brand-500/15"
                              : "hover:bg-gray-100 dark:hover:bg-white/5",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full transition-opacity",
                                isSelected
                                  ? "bg-brand-500 opacity-100 dark:bg-brand-400"
                                  : "opacity-0",
                              )}
                            />
                            <FlagIcon className="size-5 shrink-0 overflow-hidden rounded-full" />
                            <span className="truncate">{language.name}</span>
                          </span>

                          {language.badge && (
                            <span className="rounded bg-warning-50 px-1.5 py-0.5 text-theme-xs font-semibold text-warning-600 dark:bg-warning-500/15 dark:text-warning-400">
                              {language.badge}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </li>
        </ul>

        {logout.isError && (
          <div role="alert" className="mt-2">
            <Alert
              variant="error"
              title={t("signOutErrorTitle")}
              message={t("signOutErrorMessage")}
            />
          </div>
        )}

        <div className="mt-1.5 flex flex-col gap-0.5">
          {/* Switch account */}
          <button
            type="button"
            onClick={handleSwitchAccount}
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white"
          >
            <svg
              aria-hidden="true"
              className="text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white"
              width="20"
              height="20"
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
            <span>{t("switchAccount")}</span>
          </button>

          {/* Log out */}
          <button
            type="button"
            onClick={handleLogout}
            disabled={logout.isPending}
            aria-busy={logout.isPending}
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-wait disabled:opacity-50 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white"
          >
            {logout.isPending ? (
              <span
                aria-hidden="true"
                className="size-5 rounded-full border-2 border-gray-300 border-t-brand-500 motion-safe:animate-spin dark:border-gray-600 dark:border-t-brand-400"
              />
            ) : (
              <svg
                aria-hidden="true"
                className="text-gray-600 group-hover:text-gray-900 rtl:rotate-180 dark:text-gray-400 dark:group-hover:text-white"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            )}
            <span aria-live="polite">
              {logout.isPending ? t("signingOut") : t("signOut")}
            </span>
          </button>
        </div>
      </Dropdown>
    </div>
  );
}
