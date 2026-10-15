"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import { SettingsIcon, TrashBinIcon } from "@/icons";
import type { Project } from "@/lib/queries/projects/useProjects";
import ProjectVisibility from "./ProjectVisibility";

const fieldClassName =
  "mt-1.5 block min-h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300";

export default function ProjectSettings({ project }: { project: Project }) {
  const t = useTranslations("projects.settingsPanel");
  const projectText = useTranslations("projects");
  const id = useId();

  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-5">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          <SettingsIcon className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2
            id={`${id}-heading`}
            className="text-lg font-semibold text-gray-900 dark:text-white/90"
          >
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("description")}
          </p>
        </div>
      </header>

      <div
        role="note"
        className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm leading-6 text-warning-800 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-300"
      >
        {t("apiNotice")}
      </div>

      <ComponentCard title={t("detailsTitle")}>
        <div className="grid grid-cols-1 gap-5 @xl:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {projectText("name")}
            <input
              aria-describedby={`${id}-details-api-note`}
              className={fieldClassName}
              readOnly
              value={project.name}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 @xl:col-span-2">
            {projectText("description")}
            <textarea
              aria-describedby={`${id}-details-api-note`}
              className={`${fieldClassName} min-h-28 resize-y`}
              readOnly
              value={project.description ?? ""}
              placeholder={projectText("noDescription")}
              rows={4}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <p id={`${id}-details-api-note`} className="text-sm text-gray-500 dark:text-gray-400">
            {t("detailsUnavailable")}
          </p>
          <Button disabled>{t("saveChanges")}</Button>
        </div>
      </ComponentCard>

      <ComponentCard title={t("visibilityTitle")}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
              {t("visibilityDescription")}
            </p>
            {project.status === "ACTIVE" ? (
              <ProjectVisibility
                key={`${project.organizationId}:${project.id}`}
                project={project}
              />
            ) : (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                {t("visibilityArchived")}
              </p>
            )}
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${project.visibility === "PUBLIC" ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300" : "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
          >
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${project.visibility === "PUBLIC" ? "bg-brand-500" : "bg-gray-400"}`}
            />
            {projectText(project.visibility)}
          </span>
        </div>
      </ComponentCard>

      <section
        aria-labelledby={`${id}-danger-zone-heading`}
        className="rounded-2xl border border-error-200 bg-white p-5 shadow-theme-xs dark:border-error-500/20 dark:bg-gray-900"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3
              id={`${id}-danger-zone-heading`}
              className="font-semibold text-gray-900 dark:text-white/90"
            >
              {t("dangerZoneTitle")}
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
              {t("deleteUnavailable")}
            </p>
          </div>
          <Button
            variant="outline"
            disabled
            startIcon={<TrashBinIcon className="size-4" aria-hidden="true" />}
          >
            {t("deleteProject")}
          </Button>
        </div>
      </section>
    </section>
  );
}
