"use client";

import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectQuery } from "@/lib/queries/projects/useProjects";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export type WorkNotesSection = "tasks" | "documents" | "reports";

export default function WorkNotesPageHeader({ projectId, active }: { projectId: string; active: WorkNotesSection }) {
  const t = useTranslations("workNotes");
  const user = useCurrentUserQuery();
  const project = useProjectQuery(user.data?.organizationId ?? "", projectId);
  const projectName = project.data?.name ?? t("projectFallback", { id: projectId.slice(0, 8) });
  const links: readonly Readonly<{ id: WorkNotesSection; href: string; label: string }>[] = [
    { id: "tasks", href: `/projects/${encodeURIComponent(projectId)}/work-notes`, label: t("taskNotesSection") },
    { id: "documents", href: `/projects/${encodeURIComponent(projectId)}/documents`, label: t("documentsSection") },
    { id: "reports", href: `/projects/${encodeURIComponent(projectId)}/work-reports`, label: t("reportsSection") },
  ];

  return (
    <header className="mb-6 space-y-4">
      <div>
        <Link href={`/projects/${encodeURIComponent(projectId)}`} className="text-sm font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400">
          {t("backToProject")}
        </Link>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">{projectName}</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white/90">{t(active === "tasks" ? "taskNotesSection" : active === "documents" ? "documentsSection" : "reportsSection")}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-400">{t(active === "tasks" ? "taskNotes.description" : active === "documents" ? "documents.description" : "reports.description")}</p>
      </div>
      <nav aria-label={t("sectionsLabel")} className="flex max-w-full gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
        {links.map((link) => (
          <Link key={link.id} href={link.href} aria-current={active === link.id ? "page" : undefined} className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${active === link.id ? "border-brand-500 text-brand-700 dark:text-brand-300" : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"}`}>
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
