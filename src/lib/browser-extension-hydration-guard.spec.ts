import { describe, expect, it } from "vitest";
import {
  BROWSER_EXTENSION_HYDRATION_GUARD_SCRIPT,
  isBrowserExtensionError,
  isExtensionInjectedAttribute,
  sanitizeSubtreeExtensionAttributes,
} from "./browser-extension-hydration-guard";

describe("browser-extension-hydration-guard", () => {
  it("identifies known extension-injected attributes such as bis_skin_checked", () => {
    expect(isExtensionInjectedAttribute("bis_skin_checked")).toBe(true);
    expect(isExtensionInjectedAttribute("bis_register")).toBe(true);
    expect(isExtensionInjectedAttribute("data-bis-config")).toBe(true);
    expect(isExtensionInjectedAttribute("__processed_123")).toBe(true);
    expect(isExtensionInjectedAttribute("data-auth-route")).toBe(false);
    expect(isExtensionInjectedAttribute("class")).toBe(false);
  });

  it("strips extension-injected attributes from an element tree while preserving app attributes", () => {
    const container = document.createElement("div");
    container.setAttribute("data-auth-route", "/select-organization");
    container.setAttribute("bis_skin_checked", "1");

    const child = document.createElement("div");
    child.setAttribute("class", "h-8 w-40");
    child.setAttribute("bis_skin_checked", "1");
    child.setAttribute("bis_register", "W10=");
    container.appendChild(child);

    sanitizeSubtreeExtensionAttributes(container);

    expect(container.getAttribute("data-auth-route")).toBe("/select-organization");
    expect(container.hasAttribute("bis_skin_checked")).toBe(false);
    expect(child.getAttribute("class")).toBe("h-8 w-40");
    expect(child.hasAttribute("bis_skin_checked")).toBe(false);
    expect(child.hasAttribute("bis_register")).toBe(false);
  });

  it("identifies uncaught errors originating from browser extensions (including M_ID)", () => {
    expect(
      isBrowserExtensionError({
        filename: "chrome-extension://eppiocemhmnlbhjplcgkofciiegomcon/executors/200.js",
        message: "Cannot read properties of undefined (reading 'M_ID')",
        stack:
          "TypeError: Cannot read properties of undefined (reading 'M_ID')\n    at Y (chrome-extension://eppiocemhmnlbhjplcgkofciiegomcon/executors/200.js:1:761)",
      }),
    ).toBe(true);

    expect(
      isBrowserExtensionError({
        filename: "http://localhost:3000/_next/static/chunks/app.js",
        message: "TypeError: Failed to fetch",
        stack: "TypeError: Failed to fetch\n    at fetchUser (http://localhost:3000/_next/static/chunks/app.js:10:5)",
      }),
    ).toBe(false);
  });

  it("blocks setAttribute('bis_skin_checked', '1') when the inline guard script executes", () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("bis_skin_checked", "1");
    document.body.appendChild(wrapper);

    // Execute the inline guard script in the current jsdom window
    window.eval(BROWSER_EXTENSION_HYDRATION_GUARD_SCRIPT);

    expect(wrapper.hasAttribute("bis_skin_checked")).toBe(false);

    // Subsequent attempts by an extension to set bis_skin_checked are ignored
    wrapper.setAttribute("bis_skin_checked", "1");
    wrapper.setAttribute("data-testid", "kept");
    expect(wrapper.hasAttribute("bis_skin_checked")).toBe(false);
    expect(wrapper.getAttribute("data-testid")).toBe("kept");

    wrapper.remove();
  });
});
