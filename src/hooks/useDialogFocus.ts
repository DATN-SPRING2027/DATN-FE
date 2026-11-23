"use client";

import { useEffect, type RefObject } from "react";

const openDialogs: HTMLElement[] = [];
const tabStops = "a[href], button, input, select, textarea, [tabindex]";

export function useDialogFocus(ref: RefObject<HTMLElement | null>, isOpen: boolean) {
  useEffect(() => {
    const dialog = ref.current;
    if (!isOpen || !dialog) return;

    const opener = document.activeElement;
    const isTopDialog = () => openDialogs.at(-1) === dialog;
    const focusDialog = () => dialog.focus({ preventScroll: true });
    openDialogs.push(dialog);
    focusDialog();

    const containFocus = (event: FocusEvent) => {
      if (isTopDialog() && event.target instanceof Node && !dialog.contains(event.target)) {
        focusDialog();
      }
    };

    const wrapTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || event.defaultPrevented || !isTopDialog()) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(tabStops)).filter(
        (control) =>
          control.tabIndex >= 0 &&
          !control.matches(":disabled, input[type=hidden]") &&
          !control.closest("[inert], [hidden]") &&
          control.checkVisibility?.({ visibilityProperty: true }) !== false,
      );
      const current = document.activeElement;
      const first = controls[0];
      const last = controls.at(-1);
      const edge = event.shiftKey ? first : last;
      if (current === edge || !(current instanceof HTMLElement && controls.includes(current))) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    };

    document.addEventListener("keydown", wrapTab);
    document.addEventListener("focusin", containFocus);
    return () => {
      document.removeEventListener("keydown", wrapTab);
      document.removeEventListener("focusin", containFocus);
      const wasTopDialog = isTopDialog();
      openDialogs.splice(openDialogs.indexOf(dialog), 1);
      if (wasTopDialog && opener instanceof HTMLElement && opener.isConnected) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [isOpen, ref]);
}
