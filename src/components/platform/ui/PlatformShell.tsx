"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import PlatformHeader from "./PlatformHeader";
import PlatformSubheader from "./PlatformSubheader";
import styles from "./operator.module.css";

export default function PlatformShell({
  activeSection,
  operatorName,
  operatorEmail,
  isSigningOut,
  onSignOut,
  children,
}: {
  activeSection: string;
  operatorName?: string;
  operatorEmail?: string;
  isSigningOut?: boolean;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("platformConsole");
  return (
    <div className={styles.shell}>
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
      {activeSection === "dashboard" && <PlatformSubheader />}
      <main id="operator-content" className={styles.main} tabIndex={-1}>
        <div
          className={activeSection === "dashboard" ? undefined : styles.content}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
