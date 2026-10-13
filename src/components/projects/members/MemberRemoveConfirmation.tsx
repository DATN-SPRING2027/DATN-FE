"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { TrashBinIcon } from "@/icons";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import type { ProjectMembership } from "@/lib/queries/projects/useProjectMembers";
import MemberError from "./MemberError";

export default function MemberRemoveConfirmation({
  isOpen,
  member,
  error,
  pending,
  disabled,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  member?: ProjectMembership;
  error: unknown;
  pending: boolean;
  disabled: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("projectMembers");
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement;
    heading.current?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, [member?.id, isOpen]);
  const content = (
    <section
      role="region"
      aria-labelledby="member-remove-heading"
      className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
    >
      <h2
        id="member-remove-heading"
        ref={heading}
        tabIndex={-1}
        className="flex items-center gap-3 font-semibold text-gray-800 outline-none dark:text-gray-200"
      >
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-xl bg-error-50 text-error-500 dark:bg-error-500/10 dark:text-error-400"
        >
          <TrashBinIcon className="size-5" />
        </span>
        {t("removeTitle")}
      </h2>
      {member && (
        <>
          <p className="text-sm break-all text-gray-600 dark:text-gray-400">
            {t("confirmHint", { userId: member.userId })}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={disabled}
              onClick={onConfirm}
              className="cursor-pointer bg-error-500! hover:bg-error-600! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-500 disabled:bg-error-300!"
            >
              {t(pending ? "removing" : "confirm")}
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={onCancel}
              className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              {t("cancel")}
            </Button>
          </div>
        </>
      )}
      {Boolean(error) && <MemberError error={error} action="remove" />}
    </section>
  );
  if (!isOpen) return content;
  return (
    <div className="[&_.modal>div:first-child]:bg-gray-900/50 [&_.modal>div:first-child]:backdrop-blur-xs">
      <Modal
        isOpen={isOpen}
        onClose={() => {
          if (!pending) onCancel();
        }}
        showCloseButton={false}
        className="m-4 max-w-lg"
      >
        <div
          ref={dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="member-remove-heading"
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const buttons = Array.from(
              dialog.current?.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
              ) ?? [],
            );
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (!first) {
              event.preventDefault();
              return;
            }
            if (
              event.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === heading.current)
            ) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }}
        >
          {content}
        </div>
      </Modal>
    </div>
  );
}
