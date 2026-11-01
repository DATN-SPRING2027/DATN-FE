"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  FolderIcon,
  SearchIcon,
} from "@/icons/index";
import type { Project } from "@/lib/queries/projects/useProjects";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { cn } from "@/utils";

function getProjectBadgeCode(project: Project): string {
  const code = project.code?.trim();
  if (code) {
    const segments = code.split(/[-_\s]+/).filter(Boolean);
    if (segments.length >= 2) {
      const lastSegment = segments[segments.length - 1] ?? "";
      if (lastSegment.length === 2) {
        return lastSegment.toUpperCase();
      }
      return `${segments[0]?.[0] ?? ""}${lastSegment[0] ?? ""}`.toUpperCase();
    }
    return code.slice(0, 2).toUpperCase();
  }
  return project.name.trim().slice(0, 2).toUpperCase() || "PR";
}

type SidebarProjectSwitcherProps = {
  isExpandedView: boolean;
  organizationName?: string;
  projects: readonly Project[];
  activeProject: Project | null;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onSelectProject: (project: Project) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function SidebarProjectSwitcher({
  isExpandedView,
  organizationName,
  projects,
  activeProject,
  isLoading = false,
  isError = false,
  onRetry,
  onSelectProject,
  isOpen: controlledOpen,
  onOpenChange,
}: SidebarProjectSwitcherProps) {
  const t = useTranslations("sidebar");
  const prefersReducedMotion = useReducedMotion();
  const [internalOpen, setInternalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const isOpen = controlledOpen ?? internalOpen;

  const setIsOpen = useCallback(
    (nextOpen: boolean | ((prev: boolean) => boolean)) => {
      const resolved =
        typeof nextOpen === "function" ? nextOpen(isOpen) : nextOpen;
      if (!resolved) {
        setSearchQuery("");
      }
      if (onOpenChange) {
        onOpenChange(resolved);
      } else {
        setInternalOpen(resolved);
      }
    },
    [isOpen, onOpenChange],
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, setIsOpen]);

  const filteredProjects = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return projects;
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(normalized) ||
        project.code.toLowerCase().includes(normalized),
    );
  }, [projects, searchQuery]);

  const displayName = activeProject
    ? activeProject.name
    : isLoading
      ? t("projectsLoading")
      : projects.length === 0
        ? t("projectUnavailable")
        : t("projectSelectPlaceholder");

  const label = `${t("projectLabel")}: ${displayName}`;

  const handleSelect = (project: Project) => {
    setIsOpen(false);
    onSelectProject(project);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("projectSwitcherLabel")}
        aria-expanded={isOpen}
        aria-controls={isOpen ? "sidebar-project-options" : undefined}
        title={!isExpandedView ? label : undefined}
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "group flex min-h-8.5 w-full cursor-pointer items-center gap-2 rounded-md border border-gray-200/75 bg-white px-2 py-1 text-start transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-gray-300 hover:bg-gray-50/90 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none active:scale-[0.985] dark:border-gray-800 dark:bg-gray-900/70 dark:hover:border-gray-700 dark:hover:bg-white/[0.04]",
          isOpen &&
            "border-brand-300/80 bg-brand-50/35 ring-2 ring-brand-500/15 dark:border-brand-500/40 dark:bg-brand-500/[0.08] dark:ring-brand-400/15",
          !isExpandedView && "justify-center px-1.5",
        )}
      >
        {activeProject ? (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-[4px] border border-brand-200/80 bg-brand-50/80 font-mono text-[10px] font-bold text-brand-700 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300">
            {getProjectBadgeCode(activeProject)}
          </span>
        ) : (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-[4px] border border-gray-200 bg-gray-50 text-gray-500 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            <FolderIcon
              viewBox="-2 -3 24 24"
              aria-hidden="true"
              className="size-3.5 shrink-0"
            />
          </span>
        )}
        {isExpandedView && (
          <span className="min-w-0 flex-1">
            <span className="block text-[9px] leading-3 font-medium tracking-wider text-gray-400 uppercase dark:text-gray-500">
              {t("projectLabel")}
            </span>
            <span className="block truncate text-xs leading-4 font-semibold text-gray-800 transition-colors group-hover:text-gray-900 dark:text-gray-100 dark:group-hover:text-white">
              {displayName}
            </span>
          </span>
        )}
        {isExpandedView && (
          <ChevronDownIcon
            viewBox="0 0 20 20"
            aria-hidden="true"
            className={cn(
              "size-3.5 shrink-0 text-gray-400 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:text-gray-600 dark:group-hover:text-gray-300",
              isOpen && "rotate-180 text-brand-600 dark:text-brand-400",
            )}
          />
        )}
      </button>

      {isOpen && (
        <motion.section
          id="sidebar-project-options"
          aria-label={t("projectListLabel")}
          initial={
            prefersReducedMotion
              ? false
              : { opacity: 0, y: -6, scale: 0.96, filter: "blur(4px)" }
          }
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 460, damping: 32, mass: 0.6 }
          }
          className="absolute start-0 top-[calc(100%+0.375rem)] z-[60] w-full min-w-56 origin-top rounded-lg border border-gray-200 bg-white/95 p-1.5 shadow-lg ring-1 ring-black/5 backdrop-blur-md dark:border-gray-700 dark:bg-gray-900/95"
        >
          <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-1.5">
            <span className="text-xs font-semibold text-gray-900 dark:text-white">
              {t("projectListLabel")}
            </span>
            {organizationName && (
              <span className="max-w-32 truncate text-[10px] font-medium text-gray-400 dark:text-gray-500">
                {organizationName}
              </span>
            )}
          </div>

          {projects.length > 0 && (
            <div className="relative mb-1.5 px-1">
              <SearchIcon
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("searchProjectsPlaceholder")}
                aria-label={t("searchProjectsPlaceholder")}
                className="h-7.5 w-full rounded-md border border-gray-200 bg-gray-50/70 ps-7 pe-2 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-brand-400 dark:focus:bg-gray-900"
              />
            </div>
          )}

          {isLoading ? (
            <p
              role="status"
              className="px-2.5 py-3 text-xs text-gray-500 dark:text-gray-400"
            >
              {t("projectsLoading")}
            </p>
          ) : isError ? (
            <div className="space-y-1.5 px-2.5 py-2.5">
              <p
                role="alert"
                className="text-xs text-error-600 dark:text-error-400"
              >
                {t("projectsLoadError")}
              </p>
              <button
                type="button"
                onClick={() => onRetry?.()}
                className="cursor-pointer text-xs font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400"
              >
                {t("projectsRetry")}
              </button>
            </div>
          ) : projects.length > 0 ? (
            <>
              <p className="px-2 pt-0.5 pb-1 text-[10px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                {t("recentProjectsHeading")}
              </p>
              {filteredProjects.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-gray-500 dark:text-gray-400">
                  {t("noProjectsMatchSearch")}
                </p>
              ) : (
                <ul className="max-h-52 space-y-0.5 overflow-y-auto">
                  {filteredProjects.map((project) => {
                    const isCurrent = activeProject?.id === project.id;
                    return (
                      <li key={project.id}>
                        <button
                          type="button"
                          aria-pressed={isCurrent}
                          onClick={() => handleSelect(project)}
                          className={cn(
                            "group/option flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-[5px] px-2 py-1.5 text-start transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:translate-x-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-[0.985]",
                            isCurrent
                              ? "bg-brand-50/90 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                              : "text-gray-700 hover:bg-gray-100/80 dark:text-gray-200 dark:hover:bg-white/[0.06]",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-[4px] border font-mono text-[10px] font-semibold transition-transform duration-150 group-hover/option:scale-105",
                              isCurrent
                                ? "border-brand-200 bg-white text-brand-700 dark:border-brand-500/40 dark:bg-gray-900 dark:text-brand-300"
                                : "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
                            )}
                          >
                            {getProjectBadgeCode(project)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium">
                              {project.name}
                            </span>
                            {isCurrent && (
                              <span className="block text-[10px] leading-3.5 font-medium text-brand-600 dark:text-brand-300">
                                {t("activeProjectStatus")}
                              </span>
                            )}
                          </span>
                          {isCurrent && (
                            <CheckCircleIcon
                              viewBox="0 0 24 24"
                              aria-label={t("currentProject")}
                              className="size-3.5 shrink-0 text-brand-600 dark:text-brand-400"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <p className="px-2.5 py-2 text-xs text-gray-500 dark:text-gray-400">
              {t("projectsEmpty")}
            </p>
          )}

          <div className="mt-1.5 flex flex-col gap-0.5 border-t border-gray-100 pt-1.5 dark:border-gray-800">
            <Link
              href="/projects/new"
              onClick={() => setIsOpen(false)}
              className="flex min-h-8 w-full items-center gap-2 rounded-[5px] px-2 py-1.5 text-xs font-semibold text-brand-600 transition-[color,background-color,transform] duration-150 hover:translate-x-0.5 hover:bg-brand-50/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-[0.985] dark:text-brand-400 dark:hover:bg-brand-500/10"
            >
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center rounded-[4px] bg-brand-50 text-sm font-bold leading-none text-brand-600 dark:bg-brand-500/20 dark:text-brand-300"
              >
                +
              </span>
              <span className="truncate">{t("createProject")}</span>
            </Link>
            <Link
              href="/projects"
              onClick={() => setIsOpen(false)}
              className="flex min-h-7 w-full items-center rounded-[5px] px-2 py-1 text-[11px] font-medium text-gray-500 transition-[color,background-color,transform] duration-150 hover:translate-x-0.5 hover:bg-gray-100/80 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-[0.985] dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
            >
              <span className="truncate">{t("viewAllProjects")}</span>
            </Link>
          </div>
        </motion.section>
      )}
    </div>
  );
}
