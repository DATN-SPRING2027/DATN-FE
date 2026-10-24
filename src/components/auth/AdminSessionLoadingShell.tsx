"use client";

import RouteLoadingSkeleton from "@/components/ui/loading/RouteLoadingSkeleton";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";

function Placeholder({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`continuum-shimmer rounded-lg ${className}`}
    />
  );
}

export default function AdminSessionLoadingShell({
  isChat = false,
  sidebarOffset,
  sidebarWidth,
  isMobileOpen = false,
  isHelpOpen = false,
}: {
  isChat?: boolean;
  sidebarOffset: number;
  sidebarWidth: number;
  isMobileOpen?: boolean;
  isHelpOpen?: boolean;
}) {
  const t = useTranslations("auth");
  const pageMargin = isMobileOpen
    ? "ms-0"
    : "lg:ms-[var(--sidebar-offset)]";

  return (
    <div
      aria-busy="true"
      className={
        isChat
          ? "flex h-dvh flex-col overflow-hidden bg-gray-50 dark:bg-gray-950"
          : "flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950"
      }
    >
      <header
        aria-hidden="true"
        className="sticky top-0 z-50 flex min-h-14 w-full shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-3 dark:border-gray-800 dark:bg-gray-900 xl:px-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Placeholder className="size-8 shrink-0 rounded-md" />
          <Placeholder className="h-7 w-36 max-w-[32vw]" />
        </div>
        <Placeholder className="hidden h-10 w-72 rounded-xl xl:block" />
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Placeholder className="size-9 rounded-xl" />
          <Placeholder className="hidden size-9 rounded-xl sm:block" />
          <Placeholder className="hidden size-9 rounded-xl md:block" />
          <Placeholder className="size-9 rounded-full" />
        </div>
      </header>

      <div
        className={`relative flex min-h-0 flex-1 ${isChat ? "overflow-hidden" : ""}`}
      >
        <aside
          aria-hidden="true"
          style={{ width: `${sidebarWidth}px` }}
          className="fixed top-14 bottom-0 start-0 z-40 hidden h-[calc(100dvh-3.5rem)] flex-col border-e border-gray-200/90 bg-white px-2.5 pt-2.5 dark:border-gray-800 dark:bg-gray-900 xl:flex"
        >
          <Placeholder className="mb-4 h-10 w-full rounded-xl" />
          <div className="space-y-1.5">
            {[0, 1, 2, 3, 4].map((item) => (
              <Placeholder key={item} className="h-8 w-full rounded-lg" />
            ))}
          </div>
          <div className="mt-4 border-t border-gray-200/80 pt-3 dark:border-gray-800/80">
            <Placeholder className="mb-2 ms-2.5 h-3 w-24 rounded-sm" />
            <div className="space-y-1.5">
              {[0, 1, 2].map((item) => (
                <Placeholder key={item} className="h-8 w-full rounded-lg" />
              ))}
            </div>
          </div>
          <div className="mt-auto flex items-center gap-3 border-t border-gray-200/80 px-1 py-3 dark:border-gray-800/80">
            <Placeholder className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Placeholder className="h-3.5 w-28 max-w-full rounded-sm" />
              <Placeholder className="h-3 w-20 max-w-full rounded-sm" />
            </div>
          </div>
        </aside>

        <main
          aria-label={t("checkingSession")}
          style={{
            "--sidebar-offset": `${sidebarOffset}px`,
          } as CSSProperties}
          className={`min-w-0 flex-1 ${pageMargin} ${isHelpOpen ? "lg:me-80" : "me-0"} ${isChat ? "flex h-full min-h-0 flex-col overflow-hidden" : "mx-auto max-w-(--breakpoint-2xl) p-4 md:p-6"}`}
        >
          <RouteLoadingSkeleton
            variant={isChat ? "chat" : "admin"}
            loadingLabel={t("checkingSession")}
          />
        </main>
      </div>
    </div>
  );
}
