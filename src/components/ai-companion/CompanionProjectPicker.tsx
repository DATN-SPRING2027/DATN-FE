"use client";

import { useTranslations } from "next-intl";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useActiveOrganizationProjects } from "@/lib/queries/projects/useActiveOrganizationProjects";

export default function CompanionProjectPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const t = useTranslations("aiCompanionNotifications");
  const user = useCurrentUserQuery();
  const organizationId = user.isError ? "" : (user.data?.organizationId ?? "");
  const projects = useActiveOrganizationProjects(organizationId);
  return (
    <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
      <label className="flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-300">
        {t("projectLabel")}
        <select
          value={
            projects.projects.some((project) => project.id === value)
              ? value
              : ""
          }
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || !organizationId || projects.isPending}
          className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="">
            {projects.isPending ? t("projectsLoading") : t("chooseProject")}
          </option>
          {projects.projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      {(user.isError || projects.isError) && (
        <div
          role="alert"
          className="mt-2 text-xs text-error-600 dark:text-error-400"
        >
          {t("projectsError")}{" "}
          <button
            type="button"
            onClick={() => {
              void user.refetch();
              void projects.refetch();
            }}
            className="rounded underline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            {t("retry")}
          </button>
        </div>
      )}
      {!projects.isPending &&
        !projects.isError &&
        projects.projects.length === 0 && (
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            {t("noProjects")}
          </p>
        )}
    </div>
  );
}
