"use client";

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Modal } from "@/components/ui/modal";
import { CloseLineIcon } from "@/icons";

export interface HandoverDialogShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  closeLabel?: string;
  icon?: ReactNode;
  size?: "md" | "lg" | "xl";
  destructive?: boolean;
  disableClose?: boolean;
  focusField?: boolean;
  children: ReactNode;
}

const SIZE_CLASSES: Record<NonNullable<HandoverDialogShellProps["size"]>, string> = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
};

export default function HandoverDialogShell({
  isOpen,
  onClose,
  title,
  description,
  closeLabel = "Close dialog",
  icon,
  size = "lg",
  destructive = false,
  disableClose = false,
  focusField = false,
  children,
}: HandoverDialogShellProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      const raf = requestAnimationFrame(() => {
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
      wasOpenRef.current = true;
      return () => cancelAnimationFrame(raf);
    }

    if (!isOpen && wasOpenRef.current) {
      returnFocusRef.current?.focus();
      wasOpenRef.current = false;
    }
  }, [focusField, isOpen]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    if (
      document.activeElement instanceof HTMLElement &&
      document.activeElement.closest('[data-handover-listbox-portal="true"]')
    ) {
      return;
    }
    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
    );
    if (!nodes?.length) return;
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const safeClose = () => {
    if (disableClose) return;
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={safeClose}
      showCloseButton={false}
      backdropClassName="bg-gray-950/45 backdrop-blur-xs dark:bg-gray-950/70"
      className={`mx-auto max-h-[min(92vh,52rem)] w-full ${SIZE_CLASSES[size]} overflow-y-auto rounded-2xl border border-gray-200/90 bg-white shadow-theme-xl ring-1 ring-gray-950/5 dark:border-gray-800 dark:bg-gray-900 dark:ring-white/10`}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white/95 px-5 py-4 pe-14 backdrop-blur-xs sm:px-6 sm:py-5 dark:border-gray-800 dark:bg-gray-900/95">
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <div
                aria-hidden="true"
                className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ${
                  destructive
                    ? "bg-error-50 text-error-600 ring-error-200/80 dark:bg-error-500/15 dark:text-error-400 dark:ring-error-500/30"
                    : "bg-brand-50 text-brand-600 ring-brand-200/80 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/30"
                }`}
              >
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h2
                id={titleId}
                data-dialog-autofocus
                tabIndex={-1}
                className={`text-lg font-semibold tracking-tight focus:outline-none sm:text-xl ${
                  destructive
                    ? "text-error-600 dark:text-error-400"
                    : "text-gray-900 dark:text-white"
                }`}
              >
                {title}
              </h2>
              {description && (
                <p
                  id={descriptionId}
                  className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400"
                >
                  {description}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={safeClose}
            disabled={disableClose}
            aria-label={closeLabel}
            className="absolute end-3.5 top-3.5 flex size-9 cursor-pointer items-center justify-center rounded-xl bg-gray-100/90 text-gray-500 transition-colors hover:bg-gray-200/90 hover:text-gray-800 focus-visible:ring-3 focus-visible:ring-brand-500/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:end-5 sm:top-4 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            <CloseLineIcon className="size-4.5" aria-hidden="true" />
          </button>
        </header>

        <div className="px-5 py-5 sm:px-6 sm:py-6">{children}</div>
      </div>
    </Modal>
  );
}
