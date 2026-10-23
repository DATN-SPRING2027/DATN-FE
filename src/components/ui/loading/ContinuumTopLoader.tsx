"use client";

import { useEffect, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { usePathname } from "@/i18n/navigation";

/**
 * Enterprise SaaS Top Progress Bar (Linear / Vercel / Stripe style).
 * Uses a 120ms anti-flash threshold on network activity so sub-100ms responses
 * never cause visual flicker, while slower requests or route changes display
 * a sleek 2px glowing progress indicator across the top viewport edge.
 */
export default function ContinuumTopLoader() {
  const pathname = usePathname();
  const fetchingCount = useIsFetching();
  const mutatingCount = useIsMutating();
  const isBusy = fetchingCount > 0 || mutatingCount > 0;

  const [visible, setVisible] = useState(false);
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
    }, 240);
    return () => window.clearTimeout(timer);
  }, [routePulsePath]);

  useEffect(() => {
    if (!isBusy) {
      const hideTimer = window.setTimeout(() => {
        setVisible(false);
      }, 120);
      return () => window.clearTimeout(hideTimer);
    }

    const showTimer = window.setTimeout(() => {
      setVisible(true);
    }, 120);

    return () => window.clearTimeout(showTimer);
  }, [isBusy]);

  const active = visible || routePulsePath !== null;
  if (!active) return null;

  return (
    <div
      aria-hidden="true"
      data-testid="continuum-top-loader"
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-0.5 overflow-hidden bg-brand-500/15 dark:bg-brand-400/15"
    >
      <div className="continuum-top-loader h-full w-full origin-left bg-gradient-to-r from-transparent via-brand-500 to-brand-400 shadow-[0_0_8px_var(--color-brand-500)]" />
    </div>
  );
}
