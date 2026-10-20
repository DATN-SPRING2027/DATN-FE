"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MoreDotIcon } from "@/icons";

export interface TeamMenuAction {
  kind: string;
  label: string;
  accessibleLabel?: string;
  destructive?: boolean;
}

export default function TeamActionMenu({
  triggerLabel,
  actions,
  onAction,
}: {
  triggerLabel: string;
  actions: readonly TeamMenuAction[];
  onAction: (kind: string) => void;
}) {
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function pick(kind: string) {
    setOpen(false);
    onAction(kind);
  }

  return (
    <div
      ref={root}
      className="relative inline-block text-start"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        className="flex size-10 items-center justify-center rounded-lg text-gray-500 transition outline-none hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-gray-400 dark:hover:bg-white/5"
      >
        <MoreDotIcon aria-hidden="true" className="size-5" />
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute end-0 z-20 mt-1 min-w-44 rounded-lg border border-gray-200 bg-white p-1 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {actions.map((action) => (
            <ActionItem
              key={action.kind}
              ariaLabel={action.accessibleLabel ?? action.label}
              destructive={action.destructive}
              onClick={() => pick(action.kind)}
            >
              {action.label}
            </ActionItem>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionItem({
  children,
  ariaLabel,
  onClick,
  destructive = false,
}: {
  children: ReactNode;
  ariaLabel: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={`flex min-h-10 w-full items-center rounded-md px-3 text-start text-sm transition focus-visible:outline-2 focus-visible:outline-brand-500 ${destructive ? "text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10" : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"}`}
    >
      {children}
    </button>
  );
}
