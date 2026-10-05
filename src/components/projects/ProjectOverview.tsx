"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { Project } from "@/lib/queries/projects/useProjects";
import ComponentCard from "@/components/common/ComponentCard";

export default function ProjectOverview({ project }: { project: Project }) {
  const t = useTranslations("projects");
  const format = useFormatter();
  const date = (value: string) =>
    format.dateTime(new Date(value), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    });
  const summary = [
    { label: "code", value: project.code },
    { label: "visibility", value: t(project.visibility) },
    { label: "updatedAt", value: date(project.updatedAt) },
  ];
  const context = [
    { label: "projectId", value: project.id },
    { label: "organizationId", value: project.organizationId },
    { label: "createdBy", value: project.createdBy },
    { label: "createdAt", value: date(project.createdAt) },
  ];
  return (
    <div className="@container min-w-0 space-y-5 sm:space-y-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="max-w-full min-w-0 text-xl font-semibold [overflow-wrap:anywhere] text-gray-800 dark:text-white/90">
            {project.name}
          </h1>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${project.status === "ACTIVE" ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400" : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
          >
            {t(project.status === "ACTIVE" ? "active" : "archived")}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("overviewHint")}
        </p>
      </header>
      <div className="border-b border-gray-200 pb-3 dark:border-gray-800">
        <h2 className="inline-block border-b-2 border-brand-500 pb-3 text-sm font-medium text-brand-600 dark:text-brand-400">
          {t("overview")}
        </h2>
      </div>
      <dl className="grid grid-cols-1 gap-4 @xl:grid-cols-3">
        {summary.map(({ label, value }) => (
          <div
            key={label}
            className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs @xl:p-5 dark:border-gray-800 dark:bg-gray-900"
          >
            <dt className="text-sm text-gray-500 dark:text-gray-400">
              {t(label)}
            </dt>
            <dd className="mt-2 text-base font-semibold [overflow-wrap:anywhere] text-gray-800 dark:text-white/90">
              {label === "updatedAt" ? (
                <time dateTime={project.updatedAt}>{value}</time>
              ) : (
                value
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 @4xl:grid-cols-3 @4xl:gap-6">
        <ComponentCard
          title={t("description")}
          className="min-w-0 @4xl:col-span-2"
        >
          <p className="text-sm leading-6 [overflow-wrap:anywhere] whitespace-pre-wrap text-gray-600 dark:text-gray-300">
            {project.description || t("noDescription")}
          </p>
        </ComponentCard>
        <ComponentCard title={t("projectContext")} className="min-w-0">
          <dl className="space-y-5">
            {context.map(({ label, value }) => (
              <div key={label}>
                <dt className="text-sm text-gray-500 dark:text-gray-400">
                  {t(label)}
                </dt>
                <dd className="mt-1 text-sm font-medium break-all text-gray-800 dark:text-gray-200">
                  {label === "createdAt" ? (
                    <time dateTime={project.createdAt}>{value}</time>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-gray-100 pt-4 text-xs leading-5 text-gray-500 dark:border-gray-800 dark:text-gray-400">
            {t("contextHint")}
          </p>
        </ComponentCard>
      </div>
    </div>
  );
}
