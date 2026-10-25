"use client";

import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectQuery } from "@/lib/queries/projects/useProjects";
import { ChevronLeftIcon } from "@/icons";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export type WorkNotesSection = "tasks" | "documents" | "reports";

export default function WorkNotesPageHeader({
  projectId,
  active,
}: {
  projectId: string;
  active: WorkNotesSection;
}) {
  const t = useTranslations("workNotes");
  const user = useCurrentUserQuery();
  const project = useProjectQuery(user.data?.organizationId ?? "", projectId);
  const projectName =
    project.data?.name ?? t("projectFallback", { id: projectId.slice(0, 8) });
  const encodedProjectId = encodeURIComponent(projectId);
  const links: readonly Readonly<{
    id: WorkNotesSection;
    href: string;
    label: string;
  }>[] = [
    {
      id: "tasks",
      href: `/projects/${encodedProjectId}/work-notes`,
      label: t("taskNotesSection"),
    },
    {
      id: "documents",
      href: `/projects/${encodedProjectId}/documents`,
      label: t("documentsSection"),
    },
    {
      id: "reports",
      href: `/projects/${encodedProjectId}/work-reports`,
      label: t("reportsSection"),
    },
  ];

  const headingText =
    active === "tasks"
      ? t("title")
      : active === "documents"
        ? t("documentsSection")
        : t("reportsSection");

  const descriptionText =
    active === "tasks"
      ? t("taskNotes.explorerDescription")
      : active === "documents"
        ? t("documents.description")
        : t("reports.description");

  return (
    <header className="mb-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        <nav aria-label={t("breadcrumb")} className="flex flex-wrap items-center gap-1.5">
          <Link
            href="/projects"
            className="font-medium text-gray-500 transition-colors hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {t("taskNotes.projectsBreadcrumb")}
          </Link>
          <span aria-hidden="true" className="text-gray-300 dark:text-gray-600">
            /
          </span>
          <Link
            href={`/projects/${encodedProjectId}`}
            className="font-medium text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:text-white"
          >
            {projectName}
          </Link>
          <span aria-hidden="true" className="text-gray-300 dark:text-gray-600">
            /
          </span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {t("title")}
          </span>
        </nav>

        <Link
          href={`/projects/${encodedProjectId}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:text-brand-300"
        >
          <ChevronLeftIcon
            className="h-3.5 w-3.5 rtl:rotate-180"
            aria-hidden="true"
          />
          <span>{t("backToProject")}</span>
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl dark:text-white">
          {headingText}
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-400">
          {descriptionText}
        </p>
      </div>

      <nav
        aria-label={t("sectionsLabel")}
        className="flex max-w-full gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800"
      >
        {links.map((link) => (
          <Link
            key={link.id}
            href={link.href}
            aria-current={active === link.id ? "page" : undefined}
            className={`shrink-0 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
              active === link.id
                ? "border-brand-500 text-brand-700 dark:text-brand-300"
                : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
