"use client";

import { createPortal } from "react-dom";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useTranslations } from "next-intl";
import { HorizontaLDots } from "@/icons";
import jira from "./ui/jira.module.css";
import type { PlatformUserRecord } from "@/lib/queries/platform/usePlatformOperations";

export type PlatformUserAction =
  | "view-details"
  | "edit-profile"
  | "suspend"
  | "reactivate"
  | "archive"
  | "restore";

type PlatformUserActionsMenuProps = Readonly<{
  user: PlatformUserRecord;
  operatorId: string;
  canManage: boolean;
  disabled?: boolean;
  onAction: (
    action: PlatformUserAction,
    user: PlatformUserRecord,
    trigger: HTMLButtonElement,
  ) => void;
}>;

const menuItemClassName =
  "block w-full cursor-pointer px-2.5 py-1.5 text-start text-xs text-gray-700 transition-colors hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none dark:text-gray-200 dark:hover:bg-gray-800 dark:focus-visible:bg-gray-800";

export default function PlatformUserActionsMenu({
  user,
  operatorId,
  canManage,
  disabled = false,
  onAction,
}: PlatformUserActionsMenuProps) {
  const t = useTranslations("platformUserActions");
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const isArchived = Boolean(user.archivedAt);
  const canManageOtherUser = canManage && user.id !== operatorId;
  const actions: ReadonlyArray<
    Readonly<{ id: PlatformUserAction; label: string; destructive?: boolean }>
  > = [
    { id: "view-details", label: "View details" },
    ...(!isArchived && canManage
      ? [{ id: "edit-profile" as const, label: "Edit profile" }]
      : []),
    ...(!isArchived && canManageOtherUser && user.status === "ACTIVE"
      ? [{ id: "suspend" as const, label: "Suspend account" }]
      : []),
    ...(!isArchived && canManageOtherUser && user.status === "SUSPENDED"
      ? [{ id: "reactivate" as const, label: "Reactivate account" }]
      : []),
    ...(!isArchived &&
    canManageOtherUser &&
    ["ACTIVE", "SUSPENDED"].includes(user.status)
      ? [{ id: "archive" as const, label: "Archive user", destructive: true }]
      : []),
    ...(isArchived && canManageOtherUser && user.status === "SUSPENDED"
      ? [{ id: "restore" as const, label: t("restore") }]
      : []),
  ];

  useLayoutEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;

      const triggerBounds = trigger.getBoundingClientRect();
      const menuBounds = menu.getBoundingClientRect();
      const viewportPadding = 8;
      const gap = 4;
      const opensAbove =
        triggerBounds.bottom + menuBounds.height + gap >
          window.innerHeight - viewportPadding &&
        triggerBounds.top > menuBounds.height + gap;
      const maxTop = Math.max(
        viewportPadding,
        window.innerHeight - menuBounds.height - viewportPadding,
      );
      const top = opensAbove
        ? triggerBounds.top - menuBounds.height - gap
        : Math.min(triggerBounds.bottom + gap, maxTop);
      const maxLeft = Math.max(
        viewportPadding,
        window.innerWidth - menuBounds.width - viewportPadding,
      );
      const left = Math.min(
        Math.max(triggerBounds.right - menuBounds.width, viewportPadding),
        maxLeft,
      );

      setPosition({ top, left });
    };

    updatePosition();
    itemRefs.current[0]?.focus();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !menuRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isOpen]);

  function closeAndRestoreFocus() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeAndRestoreFocus();
      return;
    }

    if (event.key === "Tab") {
      const focusableElements = Array.from(
        document.querySelectorAll<HTMLElement>(
          'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, object, embed, [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          !menuRef.current?.contains(element) &&
          element.tabIndex >= 0 &&
          element.getClientRects().length > 0 &&
          !element.closest('[inert], [aria-hidden="true"]'),
      );
      const triggerIndex = focusableElements.indexOf(
        triggerRef.current as HTMLButtonElement,
      );
      const nextElement =
        focusableElements[triggerIndex + (event.shiftKey ? -1 : 1)];
      setIsOpen(false);
      if (nextElement) {
        event.preventDefault();
        nextElement.focus();
      }
      return;
    }

    const enabledItems = itemRefs.current.filter(
      (item): item is HTMLButtonElement => Boolean(item && !item.disabled),
    );
    const currentIndex = enabledItems.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        (currentIndex + direction + enabledItems.length) % enabledItems.length;
      enabledItems[nextIndex]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      enabledItems[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      enabledItems[enabledItems.length - 1]?.focus();
    }
  }

  function selectAction(action: PlatformUserAction) {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setIsOpen(false);
    trigger.focus();
    onAction(action, user, trigger);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Actions for ${user.fullName}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-xl leading-none text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
      >
        <HorizontaLDots aria-hidden="true" className="size-5" />
      </button>
      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={`Actions for ${user.fullName}`}
              onKeyDown={handleMenuKeyDown}
              style={{
                top: position?.top ?? -1000,
                left: position?.left ?? -1000,
              }}
              className={`${jira.portalMenu} fixed z-99999 max-h-[min(20rem,calc(100vh-1rem))] w-44 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-sm border border-gray-200 bg-white p-1 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900`}
            >
              {actions.map((action, index) => (
                <button
                  key={action.id}
                  ref={(element) => {
                    itemRefs.current[index] = element;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => selectAction(action.id)}
                  className={`${menuItemClassName} ${action.destructive ? "text-rose-700 hover:bg-rose-50 focus-visible:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40 dark:focus-visible:bg-rose-950/40" : ""}`}
                >
                  {action.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
