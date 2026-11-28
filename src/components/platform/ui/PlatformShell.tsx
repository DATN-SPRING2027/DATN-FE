"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import PlatformHeader from "./PlatformHeader";
import jira from "./jira.module.css";
import operations from "./platformOperations.module.css";
import PlatformSidebar from "./PlatformSidebar";
import type { PlatformPermission } from "@/lib/queries/platform/usePlatformConsole";

export default function PlatformShell({
  activeSection,
  permissions,
  operatorName,
  operatorEmail,
  isSigningOut,
  onSignOut,
  contentStyle = "platform",
  children,
}: {
  activeSection: string;
  permissions: readonly PlatformPermission[];
  operatorName?: string;
  operatorEmail?: string;
  isSigningOut?: boolean;
  onSignOut: () => void;
  contentStyle?: "platform" | "custom";
  children: ReactNode;
}) {
  const t = useTranslations("platformConsole");
  const isOperationsPage = [
    "services",
    "jobs",
    "ai",
    "integrations",
    "security",
    "incidents",
    "diagnostics",
    "audit",
    "account",
  ].includes(activeSection);
  const useOperationsContentStyle =
    isOperationsPage && contentStyle === "platform";
  return (
    <div
      className={`${jira.console} ${activeSection === "dashboard" ? "" : jira.compact}`}
    >
      <a
        href="#operator-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-99999 focus:bg-white focus:p-3 focus:text-gray-900 dark:focus:bg-gray-900 dark:focus:text-white"
      >
        {t("operatorDesign.skip")}
      </a>
      <PlatformHeader
        activeSection={activeSection}
        userName={operatorName}
        userEmail={operatorEmail}
        isSigningOut={isSigningOut}
        onSignOut={onSignOut}
      />
      <div
        className={`${jira.body} ${contentStyle === "custom" ? jira.traceBody : ""}`}
      >
        <PlatformSidebar
          activeSection={activeSection}
          permissions={permissions}
        />
        <main
          id="operator-content"
          className={`${jira.main} ${isOperationsPage ? jira.directory : ""} ${useOperationsContentStyle ? operations.workspace : ""}`}
          tabIndex={-1}
        >
          {isOperationsPage && (
            <div
              className={
                activeSection === "account" || contentStyle === "custom"
                  ? "sr-only"
                  : jira.tabs
              }
            >
              <h1 className={operations.activeTab}>
                {t(`operations.tabs.${activeSection}`)}
              </h1>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
