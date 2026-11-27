"use client";

import UserAvatar from "@/components/common/UserAvatar";
import Alert from "@/components/ui/alert/Alert";
import { useTheme } from "@/context/ThemeContext";
import { useClickOutside } from "@/hooks/useClickOutside";
import { getLanguage, languages } from "@/i18n/languages";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  ChevronRightIcon,
  ContrastCircleIcon,
  GlobeIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
  UsersOutlineIcon,
} from "@/icons";
import type { Locale } from "@/i18n/routing";
import type { CurrentUserResponse } from "@/lib/queries/auth/useAuth";
import {
  useCurrentUserQuery,
  useLogoutMutation,
} from "@/lib/queries/auth/useAuth";
import type { SignInSession } from "@/lib/queries/auth/sign-in-session";
import { usePlatformLogoutMutation } from "@/lib/queries/platform/usePlatformConsole";
import { useUserQuery } from "@/lib/queries/users/useUsers";
import { useChatNavigation } from "@/stores/chat-navigation";
import { useFloatingChatStore } from "@/stores/floating-chat";
import { resetChatWsCooldown } from "@/components/chat/floating/chat-shared-helpers";
import { cn } from "@/utils";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";

type ThemeOption = "light" | "dark" | "auto";

export type UserDropdownUser = CurrentUserResponse | SignInSession;

export interface UserDropdownProps {
  user?: UserDropdownUser | null;
  className?: string;
}

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

export default function UserDropdown({
  user: initialUser,
  className,
}: UserDropdownProps = {}) {
  const t = useTranslations("userDropdown");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const { themeMode, setThemeMode } = useSafeTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownId = useId();
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null);
  const [isSubDropdownOpen, setIsSubDropdownOpen] = useState(false);
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);

  const isPlatformUser = initialUser?.context === "PLATFORM";
  const user = useCurrentUserQuery({
    enabled: !isPlatformUser,
  });
  const effectiveUser = initialUser ?? user.data;
  const organizationId =
    effectiveUser?.context === "ACCOUNT" ||
    effectiveUser?.context === "PLATFORM"
      ? ""
      : (effectiveUser?.organizationId ?? "");
  const directory = useUserQuery(organizationId, effectiveUser?.id ?? "");
  const directoryUser =
    directory.data?.id === effectiveUser?.id ? directory.data : undefined;
  const displayName =
    directoryUser?.fullName || effectiveUser?.name || "";
  const logout = useLogoutMutation();
  const platformLogout = usePlatformLogoutMutation();
  const isLogoutPending = logout.isPending || platformLogout.isPending;
  const isLogoutError = logout.isError || platformLogout.isError;
  const profileHref = isPlatformUser ? "/platform" : "/profile";

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
    closeDropdown();
  };

  const handleSelectTheme = (mode: ThemeOption) => {
    setThemeMode(mode);
    setIsThemeDropdownOpen(false);
  };

  const handleSwitchAccount = () => {
    resetChatWsCooldown();
    useFloatingChatStore.getState().reset();
    useChatNavigation.getState().clear();
    closeDropdown();
    router.replace("/signin?switch=1" as never);
  };

  const handleLogout = async () => {
    try {
      if (isPlatformUser) {
        await platformLogout.mutateAsync();
      } else {
        await logout.mutateAsync();
      }
      resetChatWsCooldown();
      useFloatingChatStore.getState().reset();
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
    <div
      className={cn("relative", className)}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !isOpen) return;
        event.stopPropagation();
        closeDropdown();
        dropdownTriggerRef.current?.focus();
      }}
    >
      <button
        ref={dropdownTriggerRef}
        type="button"
        aria-label={displayName || t("accountMenu")}
        aria-expanded={isOpen}
        aria-controls={isOpen ? dropdownId : undefined}
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
        id={dropdownId}
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
              {effectiveUser?.email}
            </span>
          </div>
        </div>

        <ul className="mt-1.5 flex flex-col gap-0.5 border-b border-gray-200 pb-1.5 dark:border-gray-800">
          {/* Profile */}
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              href={profileHref}
              className="group flex items-center gap-3 rounded-lg px-3! py-2.5 text-theme-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <UserIcon
                aria-hidden="true"
                className="size-5 shrink-0 text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white"
              />
              {t("profile")}
            </DropdownItem>
          </li>

          {/* Account settings */}
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              href={profileHref}
              className="group flex items-center gap-3 rounded-lg px-3! py-2.5 text-theme-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <SettingsIcon
                aria-hidden="true"
                className="size-5 shrink-0 text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white"
              />
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
                <ContrastCircleIcon
                  aria-hidden="true"
                  className="size-5 shrink-0 text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white"
                />
                <span>{t("theme")}</span>
              </span>

              <ChevronRightIcon
                aria-hidden="true"
                className="size-4 text-gray-500 rtl:rotate-180 dark:text-gray-400"
              />
            </button>

            {isThemeDropdownOpen && (
              <div className="absolute top-11 -start-2 z-50 w-52 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg md:top-0 md:end-[calc(100%+14px)] md:start-auto dark:border-gray-800 dark:bg-gray-dark">
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
                <GlobeIcon
                  aria-hidden="true"
                  className="size-5 shrink-0 text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white"
                />

                <span>{t("language")}</span>
              </span>

              <span className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-theme-xs font-medium text-gray-700 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300">
                <span>{currentLang.shortName}</span>
                <CurrentFlagIcon className="size-3.5 shrink-0 overflow-hidden rounded-full" />
              </span>
            </button>

            {isSubDropdownOpen && (
              <div className="absolute top-11 -start-2 z-50 w-62.5 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg md:top-0 md:end-[calc(100%+14px)] md:start-auto dark:border-gray-800 dark:bg-gray-dark">
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

        {isLogoutError && (
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
            <UsersOutlineIcon
              aria-hidden="true"
              className="size-5 shrink-0 text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white"
            />
            <span>{t("switchAccount")}</span>
          </button>

          {/* Log out */}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLogoutPending}
            aria-busy={isLogoutPending}
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-wait disabled:opacity-50 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white"
          >
            {isLogoutPending ? (
              <span
                aria-hidden="true"
                className="size-5 rounded-full border-2 border-gray-300 border-t-brand-500 motion-safe:animate-spin dark:border-gray-600 dark:border-t-brand-400"
              />
            ) : (
              <LogOutIcon
                aria-hidden="true"
                className="size-5 shrink-0 text-gray-600 group-hover:text-gray-900 rtl:rotate-180 dark:text-gray-400 dark:group-hover:text-white"
              />
            )}
            <span aria-live="polite">
              {isLogoutPending ? t("signingOut") : t("signOut")}
            </span>
          </button>
        </div>
      </Dropdown>
    </div>
  );
}
