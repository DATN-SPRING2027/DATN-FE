"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { CloseLineIcon } from "@/icons";
import styles from "./recordModal.module.css";

export default function PlatformRecordModal({
  title,
  icon,
  closeLabel,
  triggerRef,
  initialFocusRef,
  onClose,
  pending = false,
  className = "",
  children,
}: {
  title: string;
  icon?: ReactNode;
  closeLabel: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  initialFocusRef?: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  pending?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previousFocus =
      triggerRef.current ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    (initialFocusRef?.current ?? closeRef.current)?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      queueMicrotask(() => {
        if (previousFocus?.isConnected) previousFocus.focus();
        else document.getElementById("operator-content")?.focus();
      });
    };
  }, [triggerRef, initialFocusRef]);
  return (
    <dialog
      ref={dialogRef}
      className={`${styles.dialog} ${className}`}
      aria-labelledby={titleId}
      aria-modal="true"
      aria-busy={pending || undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      onClose={() => {
        if (!pending) onClose();
      }}
      onClick={(event) => {
        if (pending || event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <header className={styles.header}>
        <h2 id={titleId}>
          {icon && (
            <span className={styles.icon} aria-hidden="true">
              {icon}
            </span>
          )}
          {title}
        </h2>
        <button
          ref={closeRef}
          type="button"
          className={styles.close}
          aria-label={closeLabel}
          disabled={pending}
          onClick={onClose}
        >
          <CloseLineIcon aria-hidden="true" />
        </button>
      </header>
      <div className={styles.content}>{children}</div>
    </dialog>
  );
}
