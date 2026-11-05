import { afterEach, describe, expect, it, vi } from "vitest";
import {
  subscribeToAuthSessionChanges,
  syncCurrentAuthSessionCookie,
} from "./session-sync";

describe("session-sync", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("notifies listeners when __Host-csrf changes externally on window focus", () => {
    let cookieValue = "__Host-csrf=csrf-initial";
    vi.spyOn(document, "cookie", "get").mockImplementation(() => cookieValue);
    const onChange = vi.fn();
    const unsubscribe = subscribeToAuthSessionChanges(onChange);

    try {
      cookieValue = "__Host-csrf=csrf-external-rotation";
      window.dispatchEvent(new Event("focus"));

      expect(onChange).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it("does not trigger a full-session reset on focus when syncCurrentAuthSessionCookie is called after in-tab rotation", () => {
    let cookieValue = "__Host-csrf=csrf-before-select-org";
    vi.spyOn(document, "cookie", "get").mockImplementation(() => cookieValue);
    const onChange = vi.fn();
    const unsubscribe = subscribeToAuthSessionChanges(onChange);

    try {
      // Simulate in-tab rotation during /auth/select-organization or /api/v1/auth/refresh
      cookieValue = "__Host-csrf=csrf-after-select-org";
      syncCurrentAuthSessionCookie();

      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));

      expect(onChange).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });
});
