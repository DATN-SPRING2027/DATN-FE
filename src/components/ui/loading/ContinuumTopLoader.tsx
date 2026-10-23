"use client";

import { useEffect, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { usePathname } from "@/i18n/navigation";

/**
 * Enterprise SaaS Top Progress Bar + Apple Dynamic Island Status Pill.
 * - Uses a 120ms anti-flash threshold on network activity so ultra-fast calls
 *   never cause visual flicker.
 * - Displays a sleek Dynamic Island pill at the top center with a mini
 *   Continuum AI bot indicator while syncing, then briefly morphs to a green
 *   "Synced" checkmark before dismissing.
 */
export default function ContinuumTopLoader() {
  const pathname = usePathname();
  const fetchingCount = useIsFetching();
  const mutatingCount = useIsMutating();
  const isBusy = fetchingCount > 0 || mutatingCount > 0;

  const [islandState, setIslandState] = useState<"idle" | "syncing" | "synced">(
    "idle",
  );
  const [routePulsePath, setRoutePulsePath] = useState<string | null>(null);
  const [lastPathname, setLastPathname] = useState(pathname);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setRoutePulsePath(pathname);
  }

  useEffect(() => {
    if (!routePulsePath) return;
    const timer = window.setTimeout(() => {
      setRoutePulsePath(null);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [routePulsePath]);

  useEffect(() => {
    if (isBusy) {
      const showTimer = window.setTimeout(() => {
        setIslandState("syncing");
      }, 120);
      return () => window.clearTimeout(showTimer);
    }

    if (islandState === "syncing") {
      const doneTimer = window.setTimeout(() => {
        setIslandState("synced");
      }, 60);
      return () => window.clearTimeout(doneTimer);
    }

    if (islandState === "synced") {
      const hideTimer = window.setTimeout(() => {
        setIslandState("idle");
      }, 420);
      return () => window.clearTimeout(hideTimer);
    }
  }, [isBusy, islandState]);

  const showTopBar = islandState === "syncing" || routePulsePath !== null;
  const showIsland = islandState !== "idle" || routePulsePath !== null;

  if (!showTopBar && !showIsland) return null;

  const isSyncedPhase = islandState === "synced" && routePulsePath === null;

  return (
    <div
      aria-hidden="true"
      data-testid="continuum-top-loader"
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999]"
    >
      {/* 2px Linear/Vercel Glowing Edge Bar */}
      {showTopBar && (
        <div className="h-0.5 w-full overflow-hidden bg-brand-500/15 dark:bg-brand-400/15">
          <div className="continuum-top-loader h-full w-full origin-left bg-gradient-to-r from-transparent via-brand-500 to-brand-400 shadow-[0_0_8px_var(--color-brand-500)]" />
        </div>
      )}

      {/* Apple Dynamic Island Floating Pill (positioned right below the 56px top header bar) */}
      {showIsland && (
        <div className="continuum-island-enter fixed top-16 left-1/2 -translate-x-1/2">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold tracking-tight shadow-lg ring-1 backdrop-blur-md transition-all duration-200 ${
              isSyncedPhase
                ? "bg-gray-900/95 text-emerald-300 ring-emerald-400/30 dark:bg-gray-800/95 dark:text-emerald-300"
                : "bg-gray-900/95 text-white ring-white/15 dark:bg-gray-800/95 dark:text-white"
            }`}
          >
            {isSyncedPhase ? (
              <>
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <svg
                    viewBox="0 0 14 14"
                    fill="none"
                    className="h-3 w-3"
                  >
                    <path
                      d="M3 7.2L5.6 9.8L11 4.4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>Workspace synced</span>
              </>
            ) : (
              <>
                {/* Mini Continuum Bot Visor Icon */}
                <span className="relative inline-flex h-4 w-5 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-brand-500 shadow-inner">
                  <span className="continuum-bot-eyes flex items-center gap-1">
                    <span className="h-1.5 w-1 rounded-full bg-cyan-200" />
                    <span className="h-1.5 w-1 rounded-full bg-cyan-200" />
                  </span>
                </span>
                <span className="text-white/90">Continuum AI</span>
                <span className="h-1 w-1 rounded-full bg-brand-400 animate-ping" />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
