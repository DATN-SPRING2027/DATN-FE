"use client";

import { useSidebar } from "@/context/SidebarContext";
import { Link } from "@/i18n/navigation";
import { cn } from "@/utils";
import { useTranslations } from "next-intl";
import type React from "react";
import { useEffect, useRef, useState } from "react";

type HelpLinkItem = {
  id: string;
  label: string;
  href?: string;
  showExternal?: boolean;
  icon: React.ReactNode;
  onClick?: () => void;
};

export default function HeaderHelpDrawer() {
  const t = useTranslations("header");
  const { isHelpOpen, setIsHelpOpen } = useSidebar();
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<
    "shortcuts" | "feedback" | null
  >(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

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

  const handleFeedbackSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!feedbackText.trim()) return;
    setFeedbackSent(true);
    setFeedbackText("");
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = setTimeout(() => {
      setFeedbackSent(false);
      setActivePanel(null);
      feedbackTimerRef.current = null;
    }, 2000);
  };

  const externalIcon = (
    <svg
      aria-hidden="true"
      className="size-3.5 shrink-0 text-gray-500 group-hover:text-gray-800 rtl:-scale-x-100 dark:text-gray-400 dark:group-hover:text-gray-200"
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
  );

  const helpItems: HelpLinkItem[] = [
    {
      id: "whats-changed",
      label: t("helpDrawer.whatsChanged"),
      href: "/dashboard",
      showExternal: true,
      icon: (
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
        </svg>
      ),
    },
    {
      id: "new-navigation",
      label: t("helpDrawer.newNavigation"),
      href: "/projects",
      showExternal: true,
      icon: (
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="13" y2="17" />
        </svg>
      ),
    },
    {
      id: "documentation",
      label: t("helpDrawer.documentation"),
      href: "/projects",
      showExternal: true,
      icon: (
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        </svg>
      ),
    },
    {
      id: "learning",
      label: t("helpDrawer.learning"),
      href: "/projects",
      showExternal: true,
      icon: (
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M9 7h6" />
          <path d="M9 11h6" />
          <path d="M9 15h4" />
        </svg>
      ),
    },
    {
      id: "community",
      label: t("helpDrawer.community"),
      href: "/chat",
      showExternal: true,
      icon: (
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M8 9h8" />
          <path d="M8 13h5" />
        </svg>
      ),
    },
    {
      id: "contact-support",
      label: t("helpDrawer.contactSupport"),
      href: "/profile",
      showExternal: true,
      icon: (
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    {
      id: "give-feedback",
      label: t("helpDrawer.giveFeedback"),
      onClick: () =>
        setActivePanel((prev) => (prev === "feedback" ? null : "feedback")),
      icon: (
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M12 7v4" />
          <path d="M12 14h.01" />
        </svg>
      ),
    },
    {
      id: "keyboard-shortcuts",
      label: t("helpDrawer.keyboardShortcuts"),
      onClick: () =>
        setActivePanel((prev) => (prev === "shortcuts" ? null : "shortcuts")),
      icon: (
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M6 8h.01" />
          <path d="M10 8h.01" />
          <path d="M14 8h.01" />
          <path d="M18 8h.01" />
          <path d="M8 12h.01" />
          <path d="M12 12h.01" />
          <path d="M16 12h.01" />
          <path d="M7 16h10" />
        </svg>
      ),
    },
    {
      id: "mobile-app",
      label: t("helpDrawer.mobileApp"),
      href: "/dashboard",
      showExternal: true,
      icon: (
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
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
          <div className="relative flex items-center justify-center border-b border-gray-200 bg-gray-100/90 px-4 py-3.5 dark:border-gray-800 dark:bg-gray-800/80">
            <h2 className="text-theme-sm font-semibold text-gray-800 dark:text-gray-100">
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
                      className="group flex items-center gap-3 rounded-lg px-3 py-2 text-theme-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white"
                    >
                      <span className="shrink-0 text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white">
                        {item.icon}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span>{item.label}</span>
                        {item.showExternal && externalIcon}
                      </span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={item.onClick}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-theme-xs font-medium transition-colors",
                        (item.id === "give-feedback" &&
                          activePanel === "feedback") ||
                          (item.id === "keyboard-shortcuts" &&
                            activePanel === "shortcuts")
                          ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
                          : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white",
                      )}
                    >
                      <span className="shrink-0 text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {/* Inline Keyboard Shortcuts Panel */}
            {activePanel === "shortcuts" && (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-white/3">
                <p className="mb-2 text-theme-xs font-semibold text-gray-800 dark:text-gray-200">
                  {t("helpDrawer.keyboardShortcuts")}
                </p>
                <div className="space-y-2 text-theme-xs text-gray-600 dark:text-gray-300">
                  <div className="flex items-center justify-between">
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

            {/* Inline Feedback Panel */}
            {activePanel === "feedback" && (
              <form
                onSubmit={handleFeedbackSubmit}
                className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-white/3"
              >
                {feedbackSent ? (
                  <p className="text-theme-xs font-medium text-success-600 dark:text-success-400">
                    {t("helpDrawer.feedbackSent")}
                  </p>
                ) : (
                  <>
                    <textarea
                      rows={3}
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder={t("helpDrawer.feedbackPlaceholder")}
                      className="w-full rounded-lg border border-gray-200 bg-white p-2 text-theme-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                    <button
                      type="submit"
                      className="mt-2 w-full rounded-lg bg-brand-500 py-1.5 text-theme-xs font-semibold text-white transition-colors hover:bg-brand-600"
                    >
                      {t("helpDrawer.feedbackSubmit")}
                    </button>
                  </>
                )}
              </form>
            )}
          </div>

          {/* Bottom Sticky Footer */}
          <div className="border-t border-gray-200 bg-gray-100/80 px-4 py-3.5 text-center dark:border-gray-800 dark:bg-gray-800/60">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-medium text-gray-600 dark:text-gray-400">
              <Link
                href="/dashboard"
                onClick={handleClose}
                className="hover:text-gray-900 hover:underline dark:hover:text-white"
              >
                {t("helpDrawer.about")}
              </Link>
              <Link
                href="/dashboard"
                onClick={handleClose}
                className="hover:text-gray-900 hover:underline dark:hover:text-white"
              >
                {t("helpDrawer.terms")}
              </Link>
              <Link
                href="/dashboard"
                onClick={handleClose}
                className="hover:text-gray-900 hover:underline dark:hover:text-white"
              >
                {t("helpDrawer.privacy")}
              </Link>
            </div>
            <div className="mt-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-400">
              <Link
                href="/dashboard"
                onClick={handleClose}
                className="hover:text-gray-900 hover:underline dark:hover:text-white"
              >
                {t("helpDrawer.notice")}
              </Link>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
