"use client";

import { CloseIcon } from "@/icons";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackdropClick?: () => void;
  className?: string;
  backdropClassName?: string;
  children: React.ReactNode;
  showCloseButton?: boolean; // New prop to control close button visibility
  closeLabel?: string;
  isFullscreen?: boolean; // Default to false for backwards compatibility
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onBackdropClick,
  children,
  className,
  backdropClassName = "bg-gray-950/40 backdrop-blur-[2px] dark:bg-gray-950/65",
  showCloseButton = true, // Default to true for backwards compatibility
  closeLabel = "Close",
  isFullscreen = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        (onBackdropClick ?? onClose)();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onBackdropClick, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const contentClasses = isFullscreen
    ? "relative z-10 w-full h-full"
    : "relative z-10 my-auto w-full rounded-3xl bg-white dark:bg-gray-900";

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
