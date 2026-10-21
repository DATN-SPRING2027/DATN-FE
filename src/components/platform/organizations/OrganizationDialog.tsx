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
import Button from "@/components/ui/button/Button";

export default function OrganizationDialog({
  title,
  pending,
  onClose,
  children,
}: {
  title: string;
  pending: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("platformConsole");
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = requestAnimationFrame(() =>
      ref.current?.querySelector<HTMLInputElement>("input")?.focus(),
    );
    return () => {
      cancelAnimationFrame(frame);
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    if (pending) ref.current?.focus();
  }, [pending]);
  function trap(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const nodes = ref.current?.querySelectorAll<HTMLElement>(
      "input:not(:disabled), select:not(:disabled), button:not(:disabled), a[href]",
    );
    if (!nodes?.length) {
      event.preventDefault();
      return;
    }
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
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!pending) onClose();
      }}
      showCloseButton={false}
      className="mx-4 max-h-[90vh] max-w-2xl overflow-y-auto p-6"
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={pending}
        onKeyDown={trap}
      >
        <header className="mb-5 flex items-center justify-between gap-4">
          <h2
            id={titleId}
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            {title}
          </h2>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={onClose}
          >
            {t("cancel")}
          </Button>
        </header>
        {children}
      </div>
    </Modal>
  );
}
