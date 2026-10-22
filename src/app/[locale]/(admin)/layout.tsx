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
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
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

  // Dynamic class for main content margin based on sidebar state
  const mainContentMargin = isMobileOpen
    ? "ms-0"
    : isExpanded || isHovered
      ? "lg:ms-[290px]"
      : "lg:ms-[90px]";

  return (
    <div
      ref={shell}
      className={
        isChat ? "h-dvh overflow-hidden xl:flex" : "min-h-screen xl:flex"
      }
    >
      {/* Sidebar and Backdrop */}
      <AppSidebar />
      <Backdrop />
      {/* Main Content Area */}
      <div
        className={`${isChat ? "flex h-full min-h-0 flex-col" : ""} min-w-0 flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}
      >
        {/* Header */}
        <AppHeader compact={isChat} />
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
  );
}
