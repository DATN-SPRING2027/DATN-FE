"use client";

import { createPortal } from "react-dom";
import styles from "./MemberNotification.module.css";

export default function MemberNotification({ message }: { message: string }) {
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed end-4 top-5 z-99999 ms-4 max-w-sm overflow-hidden rounded-xl border border-success-200 bg-success-50 text-sm text-success-700 shadow-theme-lg sm:end-6 dark:border-success-500/30 dark:bg-gray-900 dark:text-success-400"
    >
      <p className="px-4 py-3">{message}</p>
      <div
        aria-hidden="true"
        className="h-1 bg-success-100 dark:bg-success-500/15"
      >
        <div
          className={`${styles.countdown} h-full bg-success-500 dark:bg-success-400`}
        />
      </div>
    </div>,
    document.body,
  );
}
