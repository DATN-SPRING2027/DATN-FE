"use client";

import { useSidebar } from "@/context/SidebarContext";
import { Link } from "@/i18n/navigation";
import { ChatIcon, FolderIcon, SearchIcon } from "@/icons";
import { cn } from "@/utils";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type HelpLinkItem = {
  id: string;
  label: string;
  href?: string;
  icon: ReactNode;
  onClick?: () => void;
};

export default function HeaderHelpDrawer() {
  const t = useTranslations("header");
  const { isHelpOpen, setIsHelpOpen } = useSidebar();
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<"shortcuts" | null>(null);

  const isOpen =
    typeof setIsHelpOpen === "function" ? Boolean(isHelpOpen) : fallbackOpen;

  const updateOpen = (nextOpen: boolean) => {
    if (typeof setIsHelpOpen === "function") {
      setIsHelpOpen(nextOpen);
    } else {
      setFallbackOpen(nextOpen);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (typeof setIsHelpOpen === "function") {
          setIsHelpOpen(false);
        } else {
          setFallbackOpen(false);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, setIsHelpOpen]);

  const handleClose = () => {
    updateOpen(false);
    setActivePanel(null);
  };

  const helpItems: HelpLinkItem[] = [
    {
      id: "projects",
      label: t("helpDrawer.projects"),
      href: "/projects",
      icon: (
        <FolderIcon
          viewBox="-2 -3 24 24"
          preserveAspectRatio="xMidYMid meet"
          className="size-[18px] shrink-0"
          aria-hidden="true"
        />
      ),
    },
    {
      id: "chat",
      label: t("helpDrawer.chat"),
      href: "/chat",
      icon: (
        <ChatIcon
          viewBox="1 1.1 22 22"
          preserveAspectRatio="xMidYMid meet"
          className="size-[18px] shrink-0"
          aria-hidden="true"
        />
      ),
    },
    {
      id: "keyboard-shortcuts",
      label: t("helpDrawer.keyboardShortcuts"),
      onClick: () =>
        setActivePanel((prev) => (prev === "shortcuts" ? null : "shortcuts")),
      icon: (
        <SearchIcon
          viewBox="0 0 24 24"
          preserveAspectRatio="xMidYMid meet"
          className="size-[18px] shrink-0"
          aria-hidden="true"
        />
      ),
    },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t("help")}
        title={t("help")}
        aria-expanded={isOpen}
        onClick={() => updateOpen(!isOpen)}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
          isOpen
            ? "border-2 border-brand-500 bg-brand-50 text-brand-600 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-400"
            : "border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white",
        )}
      >
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
      </button>

      {isOpen && (
        <aside
          aria-label={t("helpDrawer.title")}
          className="fixed top-14 bottom-0 end-0 z-30 flex h-[calc(100dvh-3.5rem)] w-80 flex-col border-s border-gray-200 bg-white shadow-theme-lg lg:shadow-none dark:border-gray-800 dark:bg-gray-900"
        >
          {/* Top Header Bar */}
          <div className="relative flex items-center justify-center border-b border-gray-200 bg-gray-100/90 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/80">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {t("helpDrawer.title")}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              aria-label={t("helpDrawer.close")}
              className="inset-e-3 absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200/70 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            >
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Scrollable Help Links */}
          <div className="custom-scrollbar flex-1 overflow-y-auto px-3 py-3">
            <ul className="flex flex-col gap-1">
              {helpItems.map((item) => (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={handleClose}
                      className="group flex h-9 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] leading-5 font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center text-gray-500 group-hover:text-gray-800 dark:text-gray-400 dark:group-hover:text-white">
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={item.onClick}
                      className={cn(
                        "group flex h-9 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-[13px] leading-5 font-medium transition-colors",
                        item.id === "keyboard-shortcuts" &&
                        activePanel === "shortcuts"
                          ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
                          : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center",
                          item.id === "keyboard-shortcuts" &&
                            activePanel === "shortcuts"
                            ? "text-brand-600 dark:text-brand-400"
                            : "text-gray-500 group-hover:text-gray-800 dark:text-gray-400 dark:group-hover:text-white",
                        )}
                      >
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {/* Inline Keyboard Shortcuts Panel */}
            {activePanel === "shortcuts" && (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-white/3">
                <p className="mb-2 text-xs font-semibold text-gray-800 dark:text-gray-200">
                  {t("helpDrawer.keyboardShortcuts")}
                </p>
                <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                  <div className="hidden items-center justify-between xl:flex">
                    <span>{t("helpDrawer.shortcutSearch")}</span>
                    <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold dark:border-gray-700 dark:bg-gray-800">
                      Ctrl + K
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t("helpDrawer.shortcutResize")}</span>
                    <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold dark:border-gray-700 dark:bg-gray-800">
                      ← / →
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t("helpDrawer.shortcutClose")}</span>
                    <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold dark:border-gray-700 dark:bg-gray-800">
                      Esc
                    </kbd>
                  </div>
                </div>
              </div>
            )}

          </div>
        </aside>
      )}
    </div>
  );
}
