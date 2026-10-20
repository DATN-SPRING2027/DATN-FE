"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MoreDotIcon } from "@/icons";

export type OrganizationActionMenuItem = Readonly<{
  key: string;
  label: string;
  onSelect: () => void;
}>;

export default function OrganizationActionMenu({
  label,
  items,
  disabled = false,
}: {
  label: string;
  items: readonly OrganizationActionMenuItem[];
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusLastItemOnOpen = useRef(false);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      const items = menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not(:disabled)");
      const target = focusLastItemOnOpen.current ? items?.[items.length - 1] : items?.[0];
      focusLastItemOnOpen.current = false;
      target?.focus();
    });
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [isOpen]);

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const menuItems = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not(:disabled)") ?? [])];
    if (event.key === "Tab") {
      setIsOpen(false);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (!menuItems.length) return;
    const currentIndex = menuItems.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex: number | undefined;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % menuItems.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + menuItems.length) % menuItems.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = menuItems.length - 1;
    if (nextIndex !== undefined) {
      event.preventDefault();
      menuItems[nextIndex]?.focus();
    }
  }

  function selectItem(item: OrganizationActionMenuItem) {
    setIsOpen(false);
    triggerRef.current?.focus();
    item.onSelect();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const menuItems = menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not(:disabled)");
    if (isOpen && menuItems?.length) {
      (event.key === "ArrowUp" ? menuItems[menuItems.length - 1] : menuItems[0])?.focus();
      return;
    }
    focusLastItemOnOpen.current = event.key === "ArrowUp";
    setIsOpen(true);
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex size-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white/90"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        title={label}
        disabled={disabled || items.length === 0}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={onTriggerKeyDown}
      >
        <MoreDotIcon aria-hidden="true" className="size-5" />
      </button>
      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className="absolute end-0 top-full z-50 mt-2 min-w-44 rounded-xl border border-gray-200 bg-white p-1 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className="block w-full rounded-lg px-3 py-2 text-start text-sm text-gray-700 transition hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-200 dark:hover:bg-gray-800"
              onClick={() => selectItem(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
