"use client";

import { useEffect } from "react";

/**
 * Synchronizes `document.title` on the client when dynamic entity data
 * (project name, active AI chat thread, team, handover, document, etc.) resolves.
 */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const normalized = title?.replace(/\s+/g, " ").trim();
    if (!normalized) return;
    if (document.title !== normalized) {
      document.title = normalized;
    }
  }, [title]);
}
