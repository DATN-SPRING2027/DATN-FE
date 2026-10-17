"use client";

import { ReactNode, useState } from "react";
import PlatformHeader from "./PlatformHeader";
import PlatformSidebar from "./PlatformSidebar";

type PlatformShellProps = {
  activeSection: string;
  operatorName?: string;
  operatorEmail?: string;
  isSigningOut?: boolean;
  onSignOut: () => void;
  children: ReactNode;
};

export default function PlatformShell({
  activeSection,
  operatorName,
  operatorEmail,
  isSigningOut,
  onSignOut,
  children,
}: PlatformShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50/50 text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
      {/* Fixed Sidebar */}
      <PlatformSidebar
        activeSection={activeSection}
        operatorName={operatorName}
        operatorEmail={operatorEmail}
        onSignOut={onSignOut}
        isSigningOut={isSigningOut}
        isOpenMobile={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Main Layout Area */}
      <div className="flex min-h-screen flex-col lg:ps-[260px]">
        {/* Sticky Header */}
        <PlatformHeader
          userName={operatorName}
          userEmail={operatorEmail}
          isSigningOut={isSigningOut}
          onSignOut={onSignOut}
          onToggleSidebar={() => setIsMobileNavOpen((prev) => !prev)}
        />

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
