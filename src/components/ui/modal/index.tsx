"use client";

import { CloseIcon } from "@/icons";
import { useTranslations } from "next-intl";
import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

export const MODAL_BACKDROP_CLASS =
  "bg-gray-950/40 backdrop-blur-[3px] dark:bg-gray-950/60";

const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

// Module-level modal stack and ref-counted body scroll lock for nested modals.
const openModalStack: string[] = [];
let lockedBodyCount = 0;
let previousBodyOverflow = "";

function lockBodyScroll(): void {
  if (typeof document === "undefined") return;
  if (lockedBodyCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockedBodyCount += 1;
}

function unlockBodyScroll(): void {
  if (typeof document === "undefined") return;
  if (lockedBodyCount <= 0) return;
  lockedBodyCount -= 1;
  if (lockedBodyCount === 0) {
    document.body.style.overflow = previousBodyOverflow || "unset";
  }
}

function pushModalToStack(id: string): void {
  const existingIndex = openModalStack.indexOf(id);
  if (existingIndex !== -1) {
    openModalStack.splice(existingIndex, 1);
  }
  openModalStack.push(id);
}

function removeModalFromStack(id: string): void {
  const existingIndex = openModalStack.indexOf(id);
  if (existingIndex !== -1) {
    openModalStack.splice(existingIndex, 1);
  }
}

function isTopMostModal(id: string): boolean {
  return (
    openModalStack.length > 0 &&
    openModalStack[openModalStack.length - 1] === id
  );
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackdropClick?: () => void;
  onEscape?: () => void;
  className?: string;
  backdropClassName?: string;
  children: React.ReactNode;
  showCloseButton?: boolean; // New prop to control close button visibility
  closeLabel?: string;
  isFullscreen?: boolean; // Default to false for backwards compatibility
  ariaLabel?: string;
  ariaLabelledBy?: string;
}

function DefaultCloseLabel() {
  const t = useTranslations("common");
  return <span className="sr-only">{t("close")}</span>;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onBackdropClick,
  onEscape,
  children,
  className,
  backdropClassName = MODAL_BACKDROP_CLASS,
  showCloseButton = true, // Default to true for backwards compatibility
  closeLabel,
  isFullscreen = false,
  ariaLabel,
  ariaLabelledBy,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const modalId = useId();

  useLayoutEffect(() => {
    const surface = modalRef.current;
    if (!isOpen || !surface) return;
    const nestedDialog = surface.querySelector(
      '[role="dialog"], [role="alertdialog"]',
    );
    if (nestedDialog) {
      surface.removeAttribute("role");
      surface.removeAttribute("aria-modal");
    } else {
      surface.setAttribute("role", "dialog");
      surface.setAttribute("aria-modal", "true");
    }
  }, [isOpen, children]);

  useEffect(() => {
    if (!isOpen) return;

    pushModalToStack(modalId);
    lockBodyScroll();

    const active =
      typeof document !== "undefined" ? document.activeElement : null;
    previousActiveElementRef.current =
      active instanceof HTMLElement ? active : null;

    const surface = modalRef.current;
    if (surface && !surface.contains(document.activeElement)) {
      surface.focus({ preventScroll: true });
    }

    return () => {
      removeModalFromStack(modalId);
      unlockBodyScroll();

      const previous = previousActiveElementRef.current;
      previousActiveElementRef.current = null;
      if (previous && previous.isConnected && typeof previous.focus === "function") {
        previous.focus({ preventScroll: true });
      }
    };
  }, [isOpen, modalId]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopMostModal(modalId)) return;

      if (event.key === "Escape") {
        event.stopPropagation();
        (onEscape ?? onBackdropClick ?? onClose)();
        return;
      }

      if (event.key === "Tab" && modalRef.current) {
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);

        if (focusables.length === 0) {
          event.preventDefault();
          modalRef.current.focus({ preventScroll: true });
          return;
        }

        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        const active = document.activeElement;

        if (event.shiftKey) {
          if (active === first || !modalRef.current.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else if (active === last || !modalRef.current.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, modalId, onBackdropClick, onClose, onEscape]);

  if (!isOpen) return null;

  const contentClasses = isFullscreen
    ? "relative z-10 w-full h-full outline-none"
    : "relative z-10 my-auto w-full max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl bg-white outline-none dark:bg-gray-900";

  const modalContent = (
    <div
      className={`modal fixed inset-0 z-99999 flex items-start justify-center overflow-y-auto overscroll-contain ${
        isFullscreen ? "" : "p-3 sm:p-4"
      }`}
    >
      {!isFullscreen && (
        <div
          aria-hidden="true"
          data-testid="modal-backdrop"
          className={`fixed inset-0 z-0 h-full w-full transition-opacity ${backdropClassName}`}
          onClick={onBackdropClick ?? onClose}
        ></div>
      )}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        className={`${contentClasses} ${className ?? ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="inset-e-3 sm:inset-e-6 absolute top-3 z-999 flex h-9.5 w-9.5 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:top-6 sm:h-11 sm:w-11 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            <CloseIcon aria-hidden="true" className="size-5" />
            {closeLabel === undefined && <DefaultCloseLabel />}
          </button>
        )}
        <div>{children}</div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
};
