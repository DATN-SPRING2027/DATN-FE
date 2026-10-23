"use client";

import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import SessionRecoveryPanel from "@/components/auth/SessionRecoveryPanel";
import { usePathname, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import React, { useEffect, useRef, useState } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isMobileOpen, sidebarWidth, isResizing, isHelpOpen } =
    useSidebar();
  const router = useRouter();
  const isChat = usePathname() === "/chat";
  const shell = useRef<HTMLDivElement>(null);
  const currentUser = useCurrentUserQuery();
  const [isRetrying, setIsRetrying] = useState(false);
  const unauthorized =
    currentUser.error instanceof ApiError && currentUser.error.status === 401;

  useEffect(() => {
    if (!isChat || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const resize = () => {
      if (shell.current) shell.current.style.height = `${viewport.height}px`;
    };
    resize();
    viewport.addEventListener("resize", resize);
    return () => viewport.removeEventListener("resize", resize);
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

  useEffect(() => {
    if (unauthorized) {
      router.replace("/signin");
    } else if (currentUser.data?.context === "ACCOUNT") {
      router.replace("/onboarding");
    }
  }, [unauthorized, currentUser.data?.context, router]);

  if (isRetrying || currentUser.isError || !currentUser.data) {
    if ((isRetrying || currentUser.isError) && !unauthorized) {
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

  if (currentUser.data.context === "ACCOUNT") {
    return (
      <div
        className="min-h-screen bg-white dark:bg-gray-900"
        aria-busy="true"
      />
    );
  }

  const rawWidth = Number.isFinite(sidebarWidth) ? Number(sidebarWidth) : 240;
  const resolvedExpandedWidth = Math.min(
    420,
    Math.max(180, Math.round(rawWidth)),
  );
  const desktopSidebarOffsetPx = isExpanded ? resolvedExpandedWidth : 64;

  const mainContentMargin = isMobileOpen
    ? "ms-0"
    : "lg:ms-[var(--sidebar-offset)]";
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
          className={`${isChat ? "flex h-full min-h-0 flex-col" : ""} min-w-0 flex-1 ${isResizing ? "transition-none" : "transition-all duration-200 ease-in-out"} ${mainContentMargin} ${helpContentMargin}`}
        >
          {/* Page Content */}
          <div
            className={
              isChat
                ? "flex min-h-0 flex-1 flex-col overflow-hidden"
                : "mx-auto max-w-(--breakpoint-2xl) p-4 md:p-6"
            }
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
