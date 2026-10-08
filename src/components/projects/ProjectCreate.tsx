"use client";

import { Link, useRouter } from "@/i18n/navigation";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useTranslations } from "next-intl";
import ProjectCreateForm from "./ProjectCreateForm";
import ProjectState from "./ProjectState";

export default function ProjectCreate() {
  const t = useTranslations("projects");
  const user = useCurrentUserQuery();
  const router = useRouter();
  return (
    <div className="@container min-w-0 space-y-5 sm:space-y-8">
      <nav className="mb-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/projects" className="hover:text-brand-600 dark:hover:text-brand-400">{t("title")}</Link>
        <span>&gt;</span>
        <span className="font-medium text-gray-800 dark:text-white/90">Create New Project</span>
      </nav>
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="max-w-full min-w-0 text-3xl font-bold [overflow-wrap:anywhere] text-gray-900 dark:text-white/90">
            {t("create")}
          </h1>
          <span className="shrink-0 flex items-center gap-1.5 rounded-full border border-success-200 bg-success-50 px-3 py-1 text-xs font-medium text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success-500"></span>
            Cluster: us-east-prod-01
          </span>
        </div>
        <p className="text-base text-gray-500 dark:text-gray-400">
          {t("createPageHint")}
        </p>
      </header>
      {user.isPending ? (
        <ProjectState />
      ) : user.isError ? (
        <ProjectState
          error={user.error}
          retry={() => {
            void user.refetch();
          }}
        />
      ) : user.data?.organizationId ? (
        <ProjectCreateForm
          key={`${user.data.id}:${user.data.organizationId}`}
          organizationId={user.data.organizationId}
          onCancel={() => router.push("/projects")}
          onCreated={(project) =>
            router.push(`/projects/${encodeURIComponent(project.id)}`)
          }
        />
      ) : (
        <ProjectState error={new Error("No trusted organization")} />
      )}
    </div>
  );
}
