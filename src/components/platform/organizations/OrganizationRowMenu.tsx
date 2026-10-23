"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import jira from "../ui/jira.module.css";

export default function OrganizationRowMenu({
  id,
  name,
  canManage,
}: {
  id: string;
  name: string;
  canManage: boolean;
}) {
  const t = useTranslations("platformConsole.organizations");
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: -1000, left: -1000 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open || !trigger.current || !menu.current) return;
    const bounds = trigger.current.getBoundingClientRect();
    const size = menu.current.getBoundingClientRect();
    setPosition({
      left: Math.max(
        8,
        Math.min(bounds.right - size.width, window.innerWidth - size.width - 8),
      ),
      top: Math.max(
        8,
        bounds.bottom + size.height + 4 > window.innerHeight
          ? bounds.top - size.height - 4
          : bounds.bottom + 4,
      ),
    });
    menu.current.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menu.current?.contains(event.target) &&
        !trigger.current?.contains(event.target)
      )
        close();
    };
    const focusOutside = (event: FocusEvent) => {
      if (
        event.target instanceof Node &&
        !menu.current?.contains(event.target) &&
        !trigger.current?.contains(event.target)
      )
        close();
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", focusOutside);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", focusOutside);
      window.removeEventListener("resize", close);
    };
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={t("rowActions", { name })}
        aria-expanded={open}
        aria-haspopup="menu"
        className={jira.rowMenuTrigger}
        onClick={() => setOpen((value) => !value)}
      >
        ⋯
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={t("rowActions", { name })}
            className={`${jira.portalMenu} ${jira.compactRowMenu}`}
            style={position}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
                trigger.current?.focus({ preventScroll: true });
              }
              if (event.key === "Tab") setOpen(false);
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                const items = Array.from(
                  menu.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [],
                );
                const current = items.indexOf(
                  document.activeElement as HTMLAnchorElement,
                );
                items[
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? items.length - 1
                      : (current +
                          (event.key === "ArrowUp" ? -1 : 1) +
                          items.length) %
                        items.length
                ]?.focus({ preventScroll: true });
              }
            }}
          >
            <Link
              role="menuitem"
              href={`/platform/organizations/${id}` as never}
              onClick={() => setOpen(false)}
            >
              {t("view")}
            </Link>
            {canManage && (
              <Link
                role="menuitem"
                href={`/platform/organizations/${id}#edit` as never}
                onClick={() => setOpen(false)}
              >
                {t("editAction")}
              </Link>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
