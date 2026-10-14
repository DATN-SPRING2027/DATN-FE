"use client";

import { useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";

export default function ProjectPublicationDialog({
  name,
  target,
  isOpen,
  pending,
  confirmDisabled = false,
  onClose,
  onConfirm,
}: {
  name: string;
  target: "PRIVATE" | "PUBLIC";
  isOpen: boolean;
  pending: boolean;
  confirmDisabled?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("projectVisibility");
  const titleId = useId();
  const descriptionId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const submitted = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      submitted.current = false;
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [isOpen]);
  return (
    <div className="[&_.modal>div:first-child]:bg-gray-900/35 [&_.modal>div:first-child]:backdrop-blur-none">
      <Modal
        isOpen={isOpen}
        onClose={() => {
          if (!pending) onClose();
        }}
        showCloseButton={false}
        className="max-w-lg p-6"
      >
        <div
          ref={dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          className="text-sm text-gray-600 dark:text-gray-300"
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            );
            if (!buttons?.length) {
              event.preventDefault();
              return;
            }
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }}
        >
          <h2
            id={titleId}
            className="text-lg font-semibold text-gray-900 dark:text-white/90"
          >
            {t(target === "PRIVATE" ? "privateConfirmTitle" : "confirmTitle")}
          </h2>
          <p id={descriptionId} className="my-4">
            {t(target === "PRIVATE" ? "privateConfirmBody" : "confirmBody", {
              name,
            })}
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" disabled={pending} onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button
              disabled={pending || confirmDisabled}
              onClick={() => {
                if (!submitted.current) {
                  submitted.current = true;
                  onConfirm();
                }
              }}
            >
              {t(
                pending
                  ? "pending"
                  : target === "PRIVATE"
                    ? "privateConfirm"
                    : "confirm",
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
