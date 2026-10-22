"use client";

import { Modal } from "@/components/ui/modal";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, type ReactNode } from "react";

export default function ChatDialog({
  title,
  onClose,
  children,
  side = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  side?: boolean;
}) {
  const t = useTranslations("chat");
  const titleId = useId();
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusable = () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>("*") ?? [],
      ).filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(":disabled") &&
          !element.hidden &&
          element.getAttribute("type") !== "hidden",
      );
    (
      panel.current?.querySelector<HTMLElement>("input:not(:disabled)") ??
      focusable()[0] ??
      panel.current
    )?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = focusable();
      if (!controls.length) {
        event.preventDefault();
        panel.current?.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault();
        controls.at(-1)?.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === controls.at(-1)
      ) {
        event.preventDefault();
        controls[0].focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  return (
    <Modal
      isOpen
      onClose={onClose}
      showCloseButton={false}
      backdropClassName="bg-gray-950/35"
      className={
        side
          ? "!ms-auto !h-dvh !w-full !max-w-sm !rounded-none border-s border-gray-200 dark:border-gray-800"
          : "mx-4 max-h-[85dvh] max-w-lg !rounded-2xl border border-gray-200 dark:border-gray-800"
      }
    >
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`flex flex-col overflow-hidden text-gray-900 outline-none dark:text-gray-100 ${side ? "h-dvh" : "max-h-[85dvh]"}`}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-lg px-3 text-sm text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {t("close")}
          </button>
        </header>
        <div className="min-h-0 space-y-5 overflow-y-auto p-5">{children}</div>
      </section>
    </Modal>
  );
}
