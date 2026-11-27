"use client";

import { useChatNavigation } from "@/stores/chat-navigation";
import { useClientStateStore } from "@/stores/client-state";
import { useFloatingChatStore } from "@/stores/floating-chat";

type CleanupCallback = () => void;

const registeredCleanups = new Set<CleanupCallback>();

export function registerSessionCacheCleanup(callback: CleanupCallback): () => void {
  registeredCleanups.add(callback);
  return () => {
    registeredCleanups.delete(callback);
  };
}

const USER_SCOPED_STORAGE_PREFIXES = [
  "continuum.aiChat.pinned.",
  "continuum.aiChat.activeThread.",
  "continuum.aiChat.mindMap.",
  "continuum:work:",
  "continuum:work-annotations:",
  "continuum.work.",
] as const;

export function clearSessionScopedLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (
        key &&
        USER_SCOPED_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
      ) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage access errors in restricted environments.
  }
}

export function clearAllClientSessionCaches(options?: {
  clearStorage?: boolean;
}): void {
  useFloatingChatStore.getState().reset();
  useChatNavigation.getState().clear();
  useClientStateStore.getState().reset();
  for (const cleanup of registeredCleanups) {
    try {
      cleanup();
    } catch {
      // Never allow one cleanup handler to block session reset.
    }
  }
  if (options?.clearStorage) {
    clearSessionScopedLocalStorage();
  }
}
