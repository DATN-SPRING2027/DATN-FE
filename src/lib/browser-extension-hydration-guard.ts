const EXTENSION_ATTRIBUTE_NAMES = [
  "bis_skin_checked",
  "bis_register",
  "bis_id",
  "bis_size",
  "data-bis-config",
] as const;

const EXTENSION_ATTRIBUTE_PREFIXES = ["bis_", "__processed_", "data-bis-"] as const;

export function isExtensionInjectedAttribute(attrName: string): boolean {
  const normalized = attrName.trim().toLowerCase();
  if (!normalized) return false;
  if ((EXTENSION_ATTRIBUTE_NAMES as readonly string[]).includes(normalized)) {
    return true;
  }
  return EXTENSION_ATTRIBUTE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function sanitizeElementExtensionAttributes(element: Element): void {
  if (!element || typeof element.getAttributeNames !== "function") return;
  for (const attr of element.getAttributeNames()) {
    if (isExtensionInjectedAttribute(attr)) {
      element.removeAttribute(attr);
    }
  }
}

export function sanitizeSubtreeExtensionAttributes(root: ParentNode | Element): void {
  if ("getAttributeNames" in root) {
    sanitizeElementExtensionAttributes(root as Element);
  }
  if ("querySelectorAll" in root && typeof root.querySelectorAll === "function") {
    const descendants = root.querySelectorAll("*");
    for (const node of descendants) {
      sanitizeElementExtensionAttributes(node);
    }
  }
}

export function isBrowserExtensionError(input: {
  filename?: string | null;
  stack?: string | null;
  message?: string | null;
}): boolean {
  const filename = input.filename ?? "";
  const stack = input.stack ?? "";
  const message = input.message ?? "";
  const combined = `${filename}\n${stack}`;
  if (
    combined.includes("chrome-extension://") ||
    combined.includes("moz-extension://") ||
    combined.includes("safari-web-extension://")
  ) {
    return true;
  }
  if (message.includes("reading 'M_ID'") && combined.includes("executors/")) {
    return true;
  }
  return false;
}

/**
 * Synchronous pre-hydration inline script placed in <head> to:
 * 1. Strip DOM attributes injected by third-party browser extensions (e.g. `bis_skin_checked="1"`)
 *    before and during React hydration so Next.js/React 19 does not throw hydration mismatch errors.
 * 2. Intercept uncaught errors and unhandled promise rejections thrown by browser extension
 *    content scripts (`chrome-extension://...`, e.g. `reading 'M_ID'`) in capture phase before
 *    the Next.js Dev Overlay catches them.
 */
export const BROWSER_EXTENSION_HYDRATION_GUARD_SCRIPT = `(function(){
  if (typeof window === "undefined" || typeof document === "undefined") return;
  var prefixes = ["bis_", "__processed_", "data-bis-"];
  function isExtAttr(name) {
    if (!name || typeof name !== "string") return false;
    var n = name.toLowerCase();
    for (var i = 0; i < prefixes.length; i++) {
      if (n.indexOf(prefixes[i]) === 0) return true;
    }
    return false;
  }
  function cleanEl(el) {
    if (!el || el.nodeType !== 1 || typeof el.getAttributeNames !== "function") return;
    var names = el.getAttributeNames();
    for (var i = 0; i < names.length; i++) {
      if (isExtAttr(names[i])) {
        el.removeAttribute(names[i]);
      }
    }
  }
  function cleanTree(root) {
    if (!root) return;
    cleanEl(root);
    if (typeof root.querySelectorAll === "function") {
      var all = root.querySelectorAll("[bis_skin_checked],[bis_register],[bis_id],[bis_size],[data-bis-config]");
      for (var i = 0; i < all.length; i++) {
        cleanEl(all[i]);
      }
    }
  }
  function isExtError(src, stack, msg) {
    var s = String(src || "") + "\\n" + String(stack || "");
    var m = String(msg || "");
    if (
      s.indexOf("chrome-extension://") !== -1 ||
      s.indexOf("moz-extension://") !== -1 ||
      s.indexOf("safari-web-extension://") !== -1
    ) {
      return true;
    }
    if (m.indexOf("reading 'M_ID'") !== -1) return true;
    return false;
  }
  window.addEventListener("error", function(e) {
    var src = e && e.filename;
    var stack = e && e.error && e.error.stack;
    var msg = e && e.message;
    if (isExtError(src, stack, msg)) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return false;
    }
  }, true);
  window.addEventListener("unhandledrejection", function(e) {
    var r = e && e.reason;
    var stack = r && r.stack;
    var msg = (r && r.message) || String(r || "");
    if (isExtError("", stack, msg)) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return false;
    }
  }, true);
  try {
    var origSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
      if (isExtAttr(name)) return;
      return origSetAttribute.call(this, name, value);
    };
  } catch (_) {}
  cleanTree(document.documentElement);
  if (typeof MutationObserver !== "undefined" && document.documentElement) {
    var obs = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === "attributes" && isExtAttr(m.attributeName)) {
          cleanEl(m.target);
        } else if (m.type === "childList" && m.addedNodes) {
          for (var j = 0; j < m.addedNodes.length; j++) {
            cleanTree(m.addedNodes[j]);
          }
        }
      }
    });
    obs.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true
    });
  }
})();`;

declare global {
  interface Window {
    __continuumExtHydrationGuardInstalled?: boolean;
  }
}

export function installBrowserExtensionHydrationGuard(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  sanitizeSubtreeExtensionAttributes(document.documentElement);
  if (window.__continuumExtHydrationGuardInstalled) return;
  window.__continuumExtHydrationGuardInstalled = true;

  window.addEventListener(
    "error",
    (event: ErrorEvent) => {
      if (
        isBrowserExtensionError({
          filename: event.filename,
          stack: event.error instanceof Error ? event.error.stack : undefined,
          message: event.message,
        })
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true,
  );

  window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
      const reason = event.reason as { stack?: string; message?: string } | undefined;
      if (
        isBrowserExtensionError({
          filename: "",
          stack: reason?.stack,
          message: reason?.message ?? String(reason ?? ""),
        })
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true,
  );

  try {
    const origSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name: string, value: string) {
      if (isExtensionInjectedAttribute(name)) return;
      origSetAttribute.call(this, name, value);
    };
  } catch {
    // Ignore read-only prototype environments
  }

  if (typeof MutationObserver !== "undefined" && document.documentElement) {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName &&
          isExtensionInjectedAttribute(mutation.attributeName) &&
          mutation.target instanceof Element
        ) {
          sanitizeElementExtensionAttributes(mutation.target);
        } else if (mutation.type === "childList") {
          for (const node of mutation.addedNodes) {
            if (node instanceof Element) {
              sanitizeSubtreeExtensionAttributes(node);
            }
          }
        }
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
    });
  }
}
