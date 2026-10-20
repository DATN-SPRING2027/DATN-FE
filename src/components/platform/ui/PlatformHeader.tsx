"use client";

import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import { useRoleDisplayLabel } from "@/components/common/RoleLabel";
import { LogOutIcon, SearchIcon } from "@/icons/index";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/button/Button";

type PlatformHeaderProps = {
  userName?: string;
  userEmail?: string;
  isSigningOut?: boolean;
  onSignOut: () => void;
  onToggleSidebar?: () => void;
};

export default function PlatformHeader({
  userName = "Admin",
  userEmail = "operator@continuum.test",
  isSigningOut = false,
  onSignOut,
  onToggleSidebar,
}: PlatformHeaderProps) {
  const t = useTranslations("platformConsole");
  const roleLabel = useRoleDisplayLabel();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isUserMenuOpen]);

  const initials = userName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "AD";

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-gray-200/80 bg-white/95 px-4 backdrop-blur-md sm:px-6 dark:border-gray-800 dark:bg-gray-900/95">
      {/* Left: Sidebar Toggle & Global Search */}
      <div className="flex items-center gap-3 sm:gap-4 flex-1 max-w-xl">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
            className="flex size-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <div className="relative w-full max-w-md">
          <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-gray-400">
            <SearchIcon className="size-4" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search or type command..."
            className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50/70 ps-9 pe-14 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-800 dark:bg-gray-850/60 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-brand-500 dark:focus:bg-gray-900"
          />
          <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-2.5">
            <kbd className="inline-flex items-center rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-400 shadow-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              ⌘ K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right: Actions, Theme, Status, Profile */}
      <div className="flex items-center gap-3">
        {/* Session Status Dot */}
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50/80 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] font-semibold">{t("sessionActive")}</span>
        </div>

        {/* Theme Toggle Button */}
        <ThemeToggleButton />

        {/* User Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            aria-expanded={isUserMenuOpen}
            aria-label="User profile menu"
            className="flex items-center gap-2.5 rounded-full p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 text-xs font-bold text-white shadow-xs">
              {initials}
            </span>
            <div className="hidden text-start md:block">
              <p className="text-xs font-semibold text-gray-800 leading-tight dark:text-gray-100">{userName}</p>
              <p className="text-[10px] font-medium text-gray-400 leading-tight">Platform Scope</p>
            </div>
          </button>

          {isUserMenuOpen && (
            <div className="absolute end-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900 animate-in fade-in zoom-in-95 duration-100">
              <div className="border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
                <p className="text-xs font-semibold text-gray-900 dark:text-white">{userName}</p>
                <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{userEmail}</p>
                <span className="mt-1.5 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                  {roleLabel("PLATFORM_OPERATOR")}
                </span>
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSigningOut}
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onSignOut();
                  }}
                  className="w-full justify-center text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-500/10"
                >
                  <LogOutIcon className="size-3.5 me-1.5" />
                  {isSigningOut ? t("signOutPending") : t("signOut")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
