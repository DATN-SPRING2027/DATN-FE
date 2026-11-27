import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClientStateStore } from "@/stores/client-state";
import {
  clearAllClientSessionCaches,
  registerSessionCacheCleanup,
} from "./session-cleanup";

describe("session-cleanup (FE-SEC-001)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useClientStateStore.getState().reset();
  });

  it("clears Zustand client state, registered module caches, and user-scoped localStorage keys on session reset", () => {
    const cacheCleaner = vi.fn();
    const unregister = registerSessionCacheCleanup(cacheCleaner);

    useClientStateStore.setState({
      activeProjectId: "project-secret-1",
      selectedProjectByOrg: { "org-1": "project-secret-1" },
    });
    window.localStorage.setItem(
      "continuum.aiChat.activeThread.org-1",
      "thread-secret",
    );
    window.localStorage.setItem(
      "continuum:work-annotations:user-a:task-1",
      '[{"id":"note-1"}]',
    );
    window.localStorage.setItem("theme", "dark");

    clearAllClientSessionCaches({ clearStorage: true });

    expect(cacheCleaner).toHaveBeenCalledTimes(1);
    expect(useClientStateStore.getState().activeProjectId).toBeNull();
    expect(useClientStateStore.getState().selectedProjectByOrg).toEqual({});
    expect(
      window.localStorage.getItem("continuum.aiChat.activeThread.org-1"),
    ).toBeNull();
    expect(
      window.localStorage.getItem("continuum:work-annotations:user-a:task-1"),
    ).toBeNull();
    // Unrelated user UI preferences (like dark theme) remain preserved
    expect(window.localStorage.getItem("theme")).toBe("dark");

    unregister();
  });

  it("continues cleaning remaining caches even if one registered cleaner throws", () => {
    const throwingCleaner = vi.fn(() => {
      throw new Error("boom");
    });
    const healthyCleaner = vi.fn();

    const u1 = registerSessionCacheCleanup(throwingCleaner);
    const u2 = registerSessionCacheCleanup(healthyCleaner);

    expect(() => clearAllClientSessionCaches()).not.toThrow();
    expect(throwingCleaner).toHaveBeenCalledTimes(1);
    expect(healthyCleaner).toHaveBeenCalledTimes(1);

    u1();
    u2();
  });
});
