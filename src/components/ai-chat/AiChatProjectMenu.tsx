"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckLineIcon, SearchIcon } from "@/icons";
import type { Project } from "@/lib/queries/projects/useProjects";
import { cn } from "@/utils";

export interface AiChatProjectMenuProps {
  projects: readonly Project[];
  selectedProjectId: string;
  placement: "top" | "bottom";
  onSelectProject: (project: Project) => void;
  testId?: string;
}

export default function AiChatProjectMenu({
  projects,
  selectedProjectId,
  placement,
  onSelectProject,
  testId,
}: AiChatProjectMenuProps) {
  const t = useTranslations("AiChat");
  const [projectFilter, setProjectFilter] = useState("");

  const trimmedFilter = projectFilter.trim().toLowerCase();
  const filteredProjects = trimmedFilter
    ? projects.filter(
        (proj) =>
          proj.name.toLowerCase().includes(trimmedFilter) ||
          proj.code.toLowerCase().includes(trimmedFilter),
      )
    : projects;

  return (
    <div
      role="listbox"
      aria-label={t("projectMenuAriaLabel")}
      data-testid={testId}
      className={cn(
        "absolute end-0 z-50 w-68 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-theme-lg dark:border-white/10 dark:bg-gpt-popover",
        placement === "top" ? "bottom-11" : "top-10",
      )}
    >
      {projects.length > 5 && (
        <div className="relative mb-1.5 flex items-center p-1">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute start-3 size-3.5 text-gray-400"
          />
          <input
            type="search"
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                if (filteredProjects.length > 0) {
                  onSelectProject(filteredProjects[0]);
                }
              }
            }}
            placeholder={t("projectSearchPlaceholder")}
            aria-label={t("projectSearchPlaceholder")}
            className="h-8 w-full rounded-xl border border-gray-200 bg-gray-50 ps-8 pe-2 text-xs text-gray-900 focus:border-brand-500 focus:outline-none dark:border-white/10 dark:bg-gpt-composer dark:text-gray-100"
          />
        </div>
      )}

      <div className="custom-scrollbar max-h-[min(16rem,50dvh)] space-y-0.5 overflow-y-auto">
        {filteredProjects.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
            {t("projectSearchEmpty")}
          </p>
        ) : (
          filteredProjects.map((proj) => {
            const isSelected = proj.id === selectedProjectId;
            return (
              <button
                key={proj.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelectProject(proj)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-start text-xs transition-colors duration-150",
                  isSelected
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{proj.name}</div>
                  <div
                    className={cn(
                      "mt-0.5 flex items-center gap-1.5 text-xs",
                      isSelected
                        ? "text-brand-600/85 dark:text-brand-300/80"
                        : "text-gray-500 dark:text-gray-400",
                    )}
                  >
                    <span>{proj.code}</span>
                    <span>·</span>
                    <span>
                      {proj.visibility === "PRIVATE"
                        ? t("visibilityPrivate")
                        : t("visibilityPublic")}
                    </span>
                  </div>
                </div>
                {isSelected && (
                  <CheckLineIcon
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-brand-600 dark:text-brand-400"
                  />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
