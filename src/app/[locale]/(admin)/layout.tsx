"use client";

import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import Alert from "@/components/ui/alert/Alert";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useTranslations } from "next-intl";
import React, { useEffect } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const router = useRouter();
  const currentUser = useCurrentUserQuery();
  const t = useTranslations("auth");
  const unauthorized = currentUser.error instanceof ApiError && currentUser.error.status === 401;

  useEffect(() => {
    if (unauthorized) {
      router.replace("/signin");
    }
  }, [unauthorized, router]);

  if (currentUser.isError || !currentUser.data) {
    if (currentUser.isError && !unauthorized) {
      return (
        <div className="mx-auto mt-10 max-w-md space-y-4">
          <Alert variant="error" title={t("sessionUnavailable")} message={t("sessionUnavailableMessage")} />
          <button type="button" onClick={() => currentUser.refetch()} className="text-sm font-medium text-brand-500 hover:text-brand-600">{t("tryAgain")}</button>
        </div>
      );
    }
    return <div className="min-h-screen bg-white dark:bg-gray-900" aria-busy="true" />;
  }

  // Dynamic class for main content margin based on sidebar state
  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
    ? "lg:ml-[290px]"
    : "lg:ml-[90px]";

  return (
    <div className="min-h-screen xl:flex">
      {/* Sidebar and Backdrop */}
      <AppSidebar />
      <Backdrop />
      {/* Main Content Area */}
      <div
        className={`flex-1 transition-all  duration-300 ease-in-out ${mainContentMargin}`}
      >
        {/* Header */}
        <AppHeader />
        {/* Page Content */}
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">{children}</div>
      </div>
    </div>
  );
}
