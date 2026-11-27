import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  BROWSER_EXTENSION_HYDRATION_GUARD_SCRIPT,
  installBrowserExtensionHydrationGuard,
  teardownBrowserExtensionHydrationGuard,
} from "./browser-extension-hydration-guard";

describe("browser-extension-hydration-guard (FE-PERF-001)", () => {
  const nativeSetAttribute = Element.prototype.setAttribute;

  beforeEach(() => {
    teardownBrowserExtensionHydrationGuard();
    window.__continuumExtHydrationGuardInstalled = false;
    window.__continuumExtHydrationGuardActive = false;
    Element.prototype.setAttribute = nativeSetAttribute;
  });

  afterEach(() => {
    teardownBrowserExtensionHydrationGuard();
    window.__continuumExtHydrationGuardInstalled = false;
    window.__continuumExtHydrationGuardActive = false;
    Element.prototype.setAttribute = nativeSetAttribute;
  });

  it("strips extension attributes during hydration and restores native Element.prototype.setAttribute on teardown", () => {
    const el = document.createElement("div");
    el.setAttribute("bis_skin_checked", "1");
    document.body.appendChild(el);

    installBrowserExtensionHydrationGuard();
    expect(el.hasAttribute("bis_skin_checked")).toBe(false);
    expect(window.__continuumExtHydrationGuardActive).toBe(true);
    expect(Element.prototype.setAttribute).not.toBe(nativeSetAttribute);

    // Extension attribute injection is blocked while guard is active
    el.setAttribute("bis_skin_checked", "1");
    expect(el.hasAttribute("bis_skin_checked")).toBe(false);

    // Teardown restores native prototype and disconnects observer cleanly
    teardownBrowserExtensionHydrationGuard();
    expect(window.__continuumExtHydrationGuardActive).toBe(false);
    expect(Element.prototype.setAttribute).toBe(nativeSetAttribute);

    // Native setAttribute works normally post-hydration
    el.setAttribute("data-test", "ok");
    expect(el.getAttribute("data-test")).toBe("ok");

    el.remove();
  });

  it("cleans bis_skin_checked on hidden metadata boundary nodes via the synchronous <head> inline script and tears down cleanly", () => {
    const metadataBoundaryDiv = document.createElement("div");
    metadataBoundaryDiv.hidden = true;
    metadataBoundaryDiv.setAttribute("bis_skin_checked", "1");
    document.body.appendChild(metadataBoundaryDiv);

    window.eval(BROWSER_EXTENSION_HYDRATION_GUARD_SCRIPT);

    expect(metadataBoundaryDiv.hasAttribute("bis_skin_checked")).toBe(false);
    metadataBoundaryDiv.setAttribute("bis_skin_checked", "1");
    expect(metadataBoundaryDiv.hasAttribute("bis_skin_checked")).toBe(false);

    teardownBrowserExtensionHydrationGuard();
    expect(Element.prototype.setAttribute).toBe(nativeSetAttribute);

    metadataBoundaryDiv.remove();
  });
});
