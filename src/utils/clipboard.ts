/**
 * Writes text to the system clipboard and returns `true` ONLY when copy succeeds.
 * Falls back to an off-screen readonly `<textarea>` + `document.execCommand("copy")`
 * when the asynchronous Clipboard API is unavailable or rejected.
 */
export async function writeClipboardText(text: string): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy execCommand("copy") fallback.
    }
  }

  if (typeof document.execCommand !== "function") {
    return false;
  }

  const previousActive =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return Boolean(document.execCommand("copy"));
  } catch {
    return false;
  } finally {
    textarea.remove();
    previousActive?.focus?.({ preventScroll: true });
  }
}
