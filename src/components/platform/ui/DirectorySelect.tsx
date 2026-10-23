"use client";

import type { SelectHTMLAttributes } from "react";

/** Preserve keyboard focus feedback without adding a ring on pointer clicks. */
export default function DirectorySelect({
  onPointerDown,
  onKeyDown,
  onBlur,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      onPointerDown={(event) => {
        event.currentTarget.dataset.pointerFocus = "true";
        onPointerDown?.(event);
      }}
      onKeyDown={(event) => {
        delete event.currentTarget.dataset.pointerFocus;
        onKeyDown?.(event);
      }}
      onBlur={(event) => {
        delete event.currentTarget.dataset.pointerFocus;
        onBlur?.(event);
      }}
    />
  );
}
