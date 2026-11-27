"use client";

import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import SessionRecoveryPanel from "@/components/auth/SessionRecoveryPanel";
import AdminSessionLoadingShell from "@/components/auth/AdminSessionLoadingShell";
import ContinuumAiCompanion from "@/components/ai-companion/ContinuumAiCompanion";
import FloatingChatDock from "@/components/chat/floating/FloatingChatDock";
import { BackgroundRefreshError, UpdatingStatus } from "@/components/ui/loading/AsyncStatus";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  ApiError,
  getAuthContextHint,
  subscribeAuthContextHint,
} from "@/lib/api-client";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useTranslations } from "next-intl";
import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";

export function resolveAdminPageTransitionKey(pathname: string): string {
  const workRouteMatch = pathname.match(
    /^((?:\/(?:en|vi))?\/projects\/[^/]+\/work)(?:\/.*)?$/,
  );
  return workRouteMatch?.[1] ?? pathname;
}

export default function AdminLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isMobileOpen, sidebarWidth, isResizing, isHelpOpen } =
    useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const common = useTranslations("common");
  const locale = common("localeCode") === "vi" ? "vi" : "en";
  const isAiChat =
    pathname === "/ai-chat" || pathname.startsWith("/ai-chat/");
  const isHumanChat =
    pathname === "/chat" || pathname.startsWith("/chat/");
  const isKnowledge = pathname === "/knowledge" || pathname.startsWith("/knowledge/");
  const isChat = isHumanChat || isAiChat || isKnowledge;
  const hasPlatformContextHint = useSyncExternalStore(
    subscribeAuthContextHint,
    () => getAuthContextHint() === "PLATFORM",
    () => false,
  );

  const shell = useRef<HTMLDivElement>(null);
  const currentUser = useCurrentUserQuery({
    enabled: !hasPlatformContextHint,
  });
  const [isRetrying, setIsRetrying] = useState(false);
  const unauthorized =
    currentUser.error instanceof ApiError && currentUser.error.status === 401;
  const sessionRecoveryFailed =
    currentUser.error instanceof ApiError &&
    currentUser.error.sessionRecoveryFailed;
  const invalidSession =
    currentUser.error instanceof ApiError &&
    ([401, 403, 404].includes(currentUser.error.status) ||
      sessionRecoveryFailed);

  useEffect(() => {
    const shellEl = shell.current;
    if (!isChat || !window.visualViewport) {
      if (shellEl) shellEl.style.height = "";
      return;
    }
    const viewport = window.visualViewport;
    const resize = () => {
      if (shell.current) shell.current.style.height = `${viewport.height}px`;
    };
    resize();
    viewport.addEventListener("resize", resize);
    return () => {
      viewport.removeEventListener("resize", resize);
      if (shellEl) shellEl.style.height = "";
    };
  }, [isChat, currentUser.data, currentUser.isError]);

  const retrySession = async () => {
    if (isRetrying || currentUser.isFetching) return;
    setIsRetrying(true);
    try {
      await currentUser.refetch();
    } finally {
      setIsRetrying(false);
    }
  };

  const rawWidth = Number.isFinite(sidebarWidth) ? Number(sidebarWidth) : 240;
  const resolvedExpandedWidth = Math.min(
    420,
    Math.max(180, Math.round(rawWidth)),
  );
  const desktopSidebarOffsetPx = isExpanded ? resolvedExpandedWidth : 64;

  const isPlatformContext =
    hasPlatformContextHint ||
    (currentUser.data as { context?: string } | undefined)?.context ===
      "PLATFORM";

  useEffect(() => {
    if (isPlatformContext) {
      router.replace("/platform");
    } else if (unauthorized) {
      router.replace("/signin");
    } else if (currentUser.data?.context === "ACCOUNT") {
      router.replace("/onboarding");
    }
  }, [unauthorized, isPlatformContext, currentUser.data?.context, router]);

  if (isPlatformContext) {
    return (
      <div
        className="min-h-screen bg-white dark:bg-gray-900"
        aria-busy="true"
      />
    );
  }

  if (
    !currentUser.data ||
    (currentUser.isError && invalidSession) ||
    (isRetrying && !currentUser.data)
  ) {
    if (!currentUser.data && !currentUser.isError && !isRetrying) {
      return (
        <AdminSessionLoadingShell
          isChat={isChat}
          sidebarOffset={isMobileOpen ? 0 : desktopSidebarOffsetPx}
          sidebarWidth={isExpanded ? resolvedExpandedWidth : 64}
          isMobileOpen={isMobileOpen}
          isHelpOpen={isHelpOpen}
        />
      );
    }
    if ((currentUser.isError && !unauthorized) || isRetrying) {
      return (
        <SessionRecoveryPanel
          state="error"
          isRetrying={isRetrying || currentUser.isFetching}
          onRetry={() => {
            void retrySession();
          }}
        />
      );
    }
    return (
      <SessionRecoveryPanel state={unauthorized ? "redirecting" : "checking"} />
    );
  }

  if (currentUser.data.context === "ACCOUNT" || isPlatformContext) {
    return (
      <div
        className="min-h-screen bg-white dark:bg-gray-900"
        aria-busy="true"
      />
    );
  }

  const mainContentMargin = isMobileOpen
    ? "ms-0"
    : "xl:ms-[var(--sidebar-offset)]";
  const helpContentMargin = isHelpOpen ? "lg:me-80" : "me-0";

  return (
    <div
      ref={shell}
      className={
        isChat
          ? "flex h-dvh flex-col overflow-hidden"
          : "flex min-h-screen flex-col"
      }
    >
      {/* Full-width Top Header */}
      <AppHeader compact={isChat} />

      {/* Non-shifting background refresh indicator (CLS = 0) */}
      {currentUser.data && currentUser.isFetching && (
        <div className="pointer-events-none fixed end-4 top-18 z-30 rounded-full border border-gray-200/90 bg-white/95 px-2.5 py-1 shadow-theme-xs backdrop-blur-xs dark:border-gray-700 dark:bg-gray-900/95">
          <UpdatingStatus>{common("updating")}</UpdatingStatus>
        </div>
      )}

      {/* Workspace Body below Header: Left Sidebar + Right Main Content */}
      <div
        className={
          isChat
            ? "relative flex min-h-0 flex-1 overflow-hidden"
            : "relative flex min-h-0 flex-1"
        }
      >
        <AppSidebar />
        <Backdrop />

        {/* Main Content Area */}
        <div
          style={
            {
              "--sidebar-offset": `${desktopSidebarOffsetPx}px`,
            } as React.CSSProperties
          }
          className={`${isChat ? "flex h-full min-h-0 flex-col" : ""} min-w-0 flex-1 ${isResizing ? "transition-none" : "transition-[margin-inline] duration-200 ease-in-out"} ${mainContentMargin} ${helpContentMargin}`}
        >
          {/* Page Content */}
          <div
            className={
              isChat
                ? "continuum-page-enter flex min-h-0 flex-1 flex-col overflow-hidden"
                : "continuum-page-enter mx-auto max-w-(--breakpoint-2xl) p-4 pb-24 md:p-6 md:pb-28"
            }
          >
            {currentUser.data && currentUser.isRefetchError && (
              <BackgroundRefreshError
                className="mx-4 mt-3"
                retryLabel={common("retry")}
                onRetry={() => void retrySession()}
              >
                {common("updateFailed")}
              </BackgroundRefreshError>
            )}
            {children}
          </div>
        </div>
      </div>
      {!isHumanChat && !isAiChat && <FloatingChatDock />}
      {!isHumanChat && !isAiChat && <ContinuumAiCompanion locale={locale} />}
    </div>
  );
}
