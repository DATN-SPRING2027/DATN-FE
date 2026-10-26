"use client";

import { useEffect } from "react";

/** Keep pointer focus visually stable while retaining keyboard navigation cues. */
export default function InputFocusPolicy() {
  useEffect(() => {
    const root = document.documentElement;
    const pointer = () => {
      delete root.dataset.keyboardNavigation;
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Tab") root.dataset.keyboardNavigation = "true";
    };
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("keydown", keyboard, true);
      delete root.dataset.keyboardNavigation;
    };
  }, []);
  return null;
}
