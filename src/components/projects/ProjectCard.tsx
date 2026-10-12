"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FolderIcon } from "@/icons";
import type { Project } from "@/lib/queries/projects/useProjects";

export default function ProjectCard({
  project,
  layout = "grid",
}: {
  project: Project;
  layout?: "grid" | "list";
}) {
  const t = useTranslations("projects");
  const isList = layout === "list";
  return (
    <article className={`group flex h-full min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-theme-md sm:p-5 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500 ${isList ? "flex-col gap-3 @md:flex-row @md:items-center @md:gap-5" : "flex-col"}`}>
      <div className={`flex flex-wrap items-center justify-between gap-2 ${isList ? "@md:w-16 @md:shrink-0 @md:flex-col" : "mb-4"}`}>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
          <FolderIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${project.status === "ACTIVE" ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400" : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
        >
          {t(project.status === "ACTIVE" ? "active" : "archived")}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold [overflow-wrap:anywhere]">
          <Link
            href={`/projects/${encodeURIComponent(project.id)}`}
            className="cursor-pointer rounded-sm text-gray-900 transition-colors hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500 dark:text-white/90 dark:hover:text-brand-400"
          >
            {project.name}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-sm [overflow-wrap:anywhere] text-gray-600 dark:text-gray-400">
          {project.description || t("noDescription")}
        </p>
      </div>
      <div className={`flex items-center gap-3 text-xs ${isList ? "w-full @md:w-72 @md:shrink-0 @md:border-s @md:border-gray-100 @md:border-t-0 @md:pt-0 @md:ps-4 dark:border-gray-800" : "mt-auto border-t border-gray-100 pt-4 dark:border-gray-800"}`}>
        <div
          role="progressbar"
          aria-label={t("projectProgress")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={t("taskDataUnavailable")}
          className="h-2 min-w-0 flex-1 rounded-full bg-gray-100 dark:bg-gray-800"
          title={t("taskDataUnavailable")}
        />
        <span className="shrink-0 font-medium text-gray-500 dark:text-gray-400">
          {t("taskDataUnavailable")}
        </span>
        <span
          className="shrink-0 text-gray-400 dark:text-gray-500"
          title={t("memberDataUnavailable")}
          aria-label={t("memberDataUnavailable")}
        >
          —
        </span>
      </div>
    </article>
  );
}
