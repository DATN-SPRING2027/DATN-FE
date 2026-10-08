"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Project } from "@/lib/queries/projects/useProjects";

export default function ProjectCard({ project }: { project: Project }) {
  const t = useTranslations("projects");
  const format = useFormatter();
  return (
    <article className="flex h-full min-w-0 flex-col rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-brand-300 sm:p-5 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="max-w-full min-w-0 rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold [overflow-wrap:anywhere] text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          {project.code}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${project.status === "ACTIVE" ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400" : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
        >
          {t(project.status === "ACTIVE" ? "active" : "archived")}
        </span>
      </div>
      <h3 className="text-lg font-semibold [overflow-wrap:anywhere]">
        <Link
          href={`/projects/${encodeURIComponent(project.id)}`}
          className="cursor-pointer rounded-sm text-gray-900 transition-colors hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500 dark:text-white/90 dark:hover:text-brand-400"
        >
          {project.name}
        </Link>
      </h3>
      <p className="mt-2 line-clamp-2 text-sm [overflow-wrap:anywhere] text-gray-600 dark:text-gray-400">
        {project.description || t("noDescription")}
      </p>
      <dl className="mt-auto flex flex-wrap justify-between gap-3 border-t border-gray-100 pt-4 text-xs dark:border-gray-800">
        <div className="mt-4">
          <dt className="text-gray-600 dark:text-gray-400">
            {t("visibility")}
          </dt>
          <dd className="mt-1 font-medium text-gray-800 dark:text-gray-200">
            {t(project.visibility)}
          </dd>
        </div>
        <div className="mt-4">
          <dt className="text-gray-600 dark:text-gray-400">{t("updatedAt")}</dt>
          <dd className="mt-1 font-medium text-gray-800 dark:text-gray-200">
            <time dateTime={project.updatedAt}>
              {format.dateTime(new Date(project.updatedAt), {
                year: "numeric",
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })}
            </time>
          </dd>
        </div>
      </dl>
    </article>
  );
}
