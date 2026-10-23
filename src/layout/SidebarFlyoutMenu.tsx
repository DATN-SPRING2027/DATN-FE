"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "@/i18n/navigation";
import { ArrowRightIcon, DocsIcon, FolderIcon, GroupIcon, PlusIcon, SettingsIcon } from "@/icons/index";
import type { Project } from "@/lib/queries/projects/useProjects";
import { cn } from "@/utils";

export interface Point2D {
  x: number;
  y: number;
}

export interface FlyoutQuickLink {
  id: string;
  label: string;
  description?: string;
  href: string;
  badge?: string;
}

export interface FlyoutItemConfig {
  key: string;
  title: string;
  subtitle: string;
  primaryHref: string;
  primaryCtaLabel: string;
  secondaryCta?: {
    label: string;
    href: string;
  };
  quickLinks?: readonly FlyoutQuickLink[];
  projects?: readonly Project[];
  isLoadingProjects?: boolean;
}

/**
 * Pure geometric test: checks whether point P lies inside triangle ABC.
 * Used to implement Jira's "Safe Triangular Path" when moving the cursor
 * diagonally from a sidebar navigation item into the floating flyout panel.
 */
export function isPointInSafeTriangle(
  p: Point2D,
  a: Point2D,
  b: Point2D,
  c: Point2D,
): boolean {
  const sign = (p1: Point2D, p2: Point2D, p3: Point2D): number =>
    (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);

  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);

  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;

  return !(hasNeg && hasPos);
}

interface UseSidebarFlyoutControllerOptions {
  openDelayMs?: number;
  closeDelayMs?: number;
}

/**
 * Centralized controller for Sidebar Hover Flyout:
 * - Guarantees at most 1 active flyout at any time (`activeKey`).
 * - Applies 150ms–200ms hover intent delay (`openDelayMs`, default 175ms) before opening.
 * - Maintains a Safe Triangular Path from the cursor exit coordinate to the flyout panel.
 * - Closes automatically on outside click, Escape key, or route change.
 */
export function useSidebarFlyoutController({
  openDelayMs = 175,
  closeDelayMs = 180,
}: UseSidebarFlyoutControllerOptions = {}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const triggerElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const flyoutElRef = useRef<HTMLDivElement | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitPointRef = useRef<Point2D | null>(null);
  const isInsideFlyoutRef = useRef(false);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current !== null) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeFlyout = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    isInsideFlyoutRef.current = false;
    exitPointRef.current = null;
    setActiveKey(null);
    setAnchorRect(null);
  }, [clearCloseTimer, clearOpenTimer]);

  const registerTrigger = useCallback(
    (key: string, element: HTMLElement | null) => {
      if (element) {
        triggerElementsRef.current.set(key, element);
      } else {
        triggerElementsRef.current.delete(key);
      }
    },
    [],
  );

  const updateAnchorPosition = useCallback((key: string | null) => {
    if (!key) return;
    const triggerEl = triggerElementsRef.current.get(key);
    if (triggerEl) {
      setAnchorRect(triggerEl.getBoundingClientRect());
    }
  }, []);

  const handleTriggerMouseEnter = useCallback(
    (key: string) => {
      clearCloseTimer();
      clearOpenTimer();

      openTimerRef.current = setTimeout(() => {
        const triggerEl = triggerElementsRef.current.get(key);
        if (triggerEl) {
          setAnchorRect(triggerEl.getBoundingClientRect());
        }
        setActiveKey(key);
      }, openDelayMs);
    },
    [clearCloseTimer, clearOpenTimer, openDelayMs],
  );

  const scheduleClose = useCallback(
    (delay = closeDelayMs) => {
      clearCloseTimer();
      closeTimerRef.current = setTimeout(() => {
        if (!isInsideFlyoutRef.current) {
          setActiveKey(null);
          setAnchorRect(null);
          exitPointRef.current = null;
        }
      }, delay);
    },
    [clearCloseTimer, closeDelayMs],
  );

  const handleTriggerMouseLeave = useCallback(
    (key: string, event: React.MouseEvent<HTMLElement>) => {
      clearOpenTimer();
      if (activeKey !== key) return;

      exitPointRef.current = { x: event.clientX, y: event.clientY };
      scheduleClose(closeDelayMs);
    },
    [activeKey, clearOpenTimer, closeDelayMs, scheduleClose],
  );

  const handleFlyoutMouseEnter = useCallback(() => {
    isInsideFlyoutRef.current = true;
    clearOpenTimer();
    clearCloseTimer();
  }, [clearCloseTimer, clearOpenTimer]);

  const handleFlyoutMouseLeave = useCallback(() => {
    isInsideFlyoutRef.current = false;
    exitPointRef.current = null;
    scheduleClose(140);
  }, [scheduleClose]);

  // Track diagonal movement within the Safe Triangle between trigger exit point and flyout rect
  useEffect(() => {
    if (!activeKey) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (isInsideFlyoutRef.current) return;
      const exitPoint = exitPointRef.current;
      const flyoutEl = flyoutElRef.current;
      if (!exitPoint || !flyoutEl) return;

      const rect = flyoutEl.getBoundingClientRect();
      const currentPoint: Point2D = { x: event.clientX, y: event.clientY };
      const triangleApex: Point2D = { x: exitPoint.x - 8, y: exitPoint.y };
      const topCorner: Point2D = { x: rect.left + 6, y: rect.top - 18 };
      const bottomCorner: Point2D = { x: rect.left + 6, y: rect.bottom + 18 };

      if (
        isPointInSafeTriangle(
          currentPoint,
          triangleApex,
          topCorner,
          bottomCorner,
        )
      ) {
        // Cursor is moving along the diagonal safe corridor toward the flyout: extend timer
        scheduleClose(closeDelayMs + 100);
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const flyoutEl = flyoutElRef.current;
      const triggerEl = triggerElementsRef.current.get(activeKey);
      if (flyoutEl?.contains(target) || triggerEl?.contains(target)) {
        return;
      }
      closeFlyout();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const triggerEl = triggerElementsRef.current.get(activeKey);
        closeFlyout();
        triggerEl?.focus();
      }
    };

    const handleViewportChange = () => {
      updateAnchorPosition(activeKey);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [activeKey, closeDelayMs, closeFlyout, scheduleClose, updateAnchorPosition]);

  useEffect(() => {
    return () => {
      clearOpenTimer();
      clearCloseTimer();
    };
  }, [clearCloseTimer, clearOpenTimer]);

  return {
    activeKey,
    anchorRect,
    flyoutElRef,
    registerTrigger,
    handleTriggerMouseEnter,
    handleTriggerMouseLeave,
    handleFlyoutMouseEnter,
    handleFlyoutMouseLeave,
    closeFlyout,
  };
}

interface SidebarFlyoutPortalProps {
  config: FlyoutItemConfig | null;
  anchorRect: DOMRect | null;
  flyoutElRef: React.RefObject<HTMLDivElement | null>;
  pathname: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: () => void;
}

export function SidebarFlyoutPortal({
  config,
  anchorRect,
  flyoutElRef,
  pathname,
  onMouseEnter,
  onMouseLeave,
  onClose,
}: SidebarFlyoutPortalProps) {
  useLayoutEffect(() => {
    const flyoutEl = flyoutElRef.current;
    if (!config || !anchorRect || !flyoutEl) return;
    const panelHeight = flyoutEl.offsetHeight || 320;
    const viewportHeight =
      typeof window !== "undefined" ? window.innerHeight : 800;

    const desiredLeft = Math.round(anchorRect.right + 6);
    const maxTop = Math.max(12, viewportHeight - panelHeight - 12);
    const desiredTop = Math.min(
      Math.max(12, Math.round(anchorRect.top - 4)),
      maxTop,
    );

    flyoutEl.style.top = `${desiredTop}px`;
    flyoutEl.style.left = `${desiredLeft}px`;
  }, [anchorRect, config, flyoutElRef]);

  if (typeof document === "undefined" || !config || !anchorRect) {
    return null;
  }

  const initialLeft = Math.round(anchorRect.right + 6);
  const initialTop = Math.max(12, Math.round(anchorRect.top - 4));
  const hasProjectsList = config.key === "projects";
  const projects = config.projects ?? [];

  return createPortal(
    <div
      ref={flyoutElRef}
      role="dialog"
      aria-label={`${config.title} flyout menu`}
      data-testid={`sidebar-flyout-${config.key}`}
      style={{
        top: `${initialTop}px`,
        left: `${initialLeft}px`,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-70 w-76 rounded-lg border border-gray-200 bg-white p-2.5 text-gray-900 shadow-lg ring-1 ring-black/5 transition-opacity duration-150 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
    >
      {/* Invisible Hover Bridge on the left edge so diagonal/horizontal cursor crossings never drop hover */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 -left-3 w-3 bg-transparent"
      />

      {/* Flyout Header */}
      <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-1 pb-2 dark:border-gray-800">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wider text-gray-900 uppercase dark:text-white">
            {config.title}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
            {config.subtitle}
          </p>
        </div>
        <Link
          href={config.primaryHref}
          onClick={onClose}
          className="inline-flex shrink-0 items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-xs font-medium text-brand-600 transition hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/15"
        >
          <span>{config.primaryCtaLabel}</span>
          <ArrowRightIcon
            viewBox="0 0 20 20"
            className="h-3 w-3 shrink-0"
            aria-hidden="true"
          />
        </Link>
      </div>

      {/* Projects Flyout Body (Jira-style recent/active projects + quick module jumps) */}
      {hasProjectsList ? (
        <div className="mt-2 space-y-1.5">
          {config.isLoadingProjects ? (
            <div className="space-y-1 py-1.5">
              {Array.from({ length: 3 }, (_, idx) => (
                <div
                  key={idx}
                  className="h-9 animate-pulse rounded-md bg-gray-100 dark:bg-gray-800"
                />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-200 bg-gray-50/70 px-3 py-3.5 text-center text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
              No active projects in this organization yet.
            </div>
          ) : (
            <ul
              aria-label="Recent active projects"
              className="max-h-72 space-y-1 overflow-y-auto pr-0.5"
            >
              {projects.slice(0, 6).map((project) => {
                const detailHref = `/projects/${encodeURIComponent(project.id)}`;
                const workHref = `${detailHref}/work`;
                const membersHref = `${detailHref}/members`;
                const settingsHref = `${detailHref}/settings`;
                const isCurrentProject =
                  pathname === detailHref ||
                  pathname.startsWith(`${detailHref}/`);

                return (
                  <li
                    key={project.id}
                    className={cn(
                      "rounded-md border p-1.5 transition",
                      isCurrentProject
                        ? "border-brand-200 bg-brand-50/50 dark:border-brand-500/30 dark:bg-brand-500/10"
                        : "border-gray-100 bg-gray-50/40 hover:border-gray-200 hover:bg-gray-50 dark:border-gray-800/80 dark:bg-gray-800/30 dark:hover:border-gray-700",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={detailHref}
                        onClick={onClose}
                        className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px] font-semibold text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-300"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] bg-brand-500/10 font-mono text-[10px] font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                          {project.code.slice(0, 3)}
                        </span>
                        <span className="truncate">{project.name}</span>
                      </Link>
                      <span className="shrink-0 rounded-[4px] bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-500 ring-1 ring-gray-200/80 dark:bg-gray-900 dark:text-gray-400 dark:ring-gray-700">
                        {project.code}
                      </span>
                    </div>

                    {/* Quick Sub-navigation pills inside each Project */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1 border-t border-gray-200/60 pt-1.5 dark:border-gray-700/60">
                      <Link
                        href={workHref}
                        onClick={onClose}
                        className="inline-flex items-center gap-1 rounded-[4px] bg-white px-1.5 py-0.5 text-[11px] font-medium text-gray-700 ring-1 ring-gray-200/70 transition hover:text-brand-600 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700 dark:hover:text-brand-300"
                      >
                        <DocsIcon viewBox="0 0 24 24" className="h-3 w-3 shrink-0" />
                        <span>Work</span>
                      </Link>
                      <Link
                        href={detailHref}
                        onClick={onClose}
                        className="inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium text-gray-600 transition hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white"
                      >
                        <FolderIcon viewBox="0 0 20 18" className="h-3 w-3 shrink-0" />
                        <span>Overview</span>
                      </Link>
                      <Link
                        href={membersHref}
                        onClick={onClose}
                        className="inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium text-gray-600 transition hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white"
                      >
                        <GroupIcon viewBox="0 0 24 24" className="h-3 w-3 shrink-0" />
                        <span>Members</span>
                      </Link>
                      <Link
                        href={settingsHref}
                        onClick={onClose}
                        className="inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium text-gray-600 transition hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white"
                      >
                        <SettingsIcon viewBox="0 0 24 24" className="h-3 w-3 shrink-0" />
                        <span>Settings</span>
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        config.quickLinks &&
        config.quickLinks.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {config.quickLinks.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className="group flex items-start justify-between gap-2 rounded-[5px] px-2 py-1.5 transition hover:bg-gray-100/80 dark:hover:bg-white/[0.06]"
                >
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-gray-800 group-hover:text-brand-600 dark:text-gray-200 dark:group-hover:text-brand-300">
                      {item.label}
                    </p>
                    {item.description && (
                      <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                        {item.description}
                      </p>
                    )}
                  </div>
                  {item.badge && (
                    <span className="shrink-0 rounded-[4px] bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )
      )}

      {/* Optional Footer CTA */}
      {config.secondaryCta && (
        <div className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-800">
          <Link
            href={config.secondaryCta.href}
            onClick={onClose}
            className="flex w-full items-center justify-center gap-1.5 rounded-[5px] bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
          >
            <PlusIcon viewBox="0 0 12 12" className="h-3 w-3 shrink-0" />
            <span>{config.secondaryCta.label}</span>
          </Link>
        </div>
      )}
    </div>,
    document.body,
  );
}
