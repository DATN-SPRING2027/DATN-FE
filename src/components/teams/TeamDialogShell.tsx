"use client";

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";

export default function TeamDialogShell({
  isOpen,
  onClose,
  title,
  description,
  children,
  destructive = false,
  size = "lg",
  focusField = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  destructive?: boolean;
  size?: "sm" | "md" | "lg";
  focusField?: boolean;
}) {
  const t = useTranslations("teamFoundation");
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const previousFocusFieldRef = useRef(focusField);

  useEffect(() => {
    const entered =
      isOpen &&
      (!wasOpenRef.current || previousFocusFieldRef.current !== focusField);
    if (entered) {
      if (!wasOpenRef.current)
        returnFocusRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      requestAnimationFrame(() => {
        const target =
          (focusField
            ? dialogRef.current?.querySelector<HTMLElement>(
                "[data-dialog-autofocus-field]",
              )
            : dialogRef.current?.querySelector<HTMLElement>(
                "[data-dialog-autofocus]",
              )) ??
          dialogRef.current?.querySelector<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
          ) ??
          dialogRef.current;
        target?.focus();
      });
    } else if (!isOpen && wasOpenRef.current) {
      returnFocusRef.current?.focus();
    }
    wasOpenRef.current = isOpen;
    previousFocusFieldRef.current = focusField;
  }, [focusField, isOpen]);

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
    );
    if (!nodes?.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const maxWidth = {
    sm: "max-w-lg",
    md: "max-w-xl",
    lg: "max-w-2xl",
  }[size];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      backdropClassName="bg-gray-900/40 dark:bg-gray-950/55"
      showCloseButton={false}
      className={`mx-4 max-h-[min(90vh,48rem)] w-full ${maxWidth} overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-900`}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={trapFocus}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white px-5 py-4 pe-14 sm:px-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="min-w-0">
            <h2
              id={titleId}
              data-dialog-autofocus
              tabIndex={-1}
              className={`text-lg font-semibold ${destructive ? "text-error-600 dark:text-error-400" : "text-gray-900 dark:text-white/90"}`}
            >
              {destructive && (
                <span
                  aria-hidden="true"
                  className="me-2 inline-flex size-5 items-center justify-center rounded-full border border-error-500 text-xs leading-none"
                >
                  !
                </span>
              )}
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400"
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("closeDialog")}
            className="absolute end-3 top-3 flex size-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              ×
            </span>
          </button>
        </header>
        <div className="px-5 py-5 sm:px-6">{children}</div>
      </div>
    </Modal>
  );
}
