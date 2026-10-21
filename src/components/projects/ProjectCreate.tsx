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
    <div className="@container min-w-0 space-y-5 sm:space-y-6">
      <nav
        aria-label={t("breadcrumb")}
        className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
      >
        <Link
          href="/projects"
          className="font-medium text-gray-500 transition-colors hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
        >
          {t("title")}
        </Link>
        <span aria-hidden="true" className="text-gray-300 dark:text-gray-600">
          /
        </span>
        <span className="font-semibold text-gray-800 dark:text-white/90">
          {t("createNew")}
        </span>
      </nav>

      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs sm:flex-row sm:items-center sm:p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex min-w-0 items-start gap-4 sm:items-center">
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-500/15 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/20"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              className="h-5 w-5"
            >
              <path
                d="M8 3.25v9.5M3.25 8h9.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <div className="min-w-0">
            <h1 className="max-w-full min-w-0 text-xl font-bold tracking-tight [overflow-wrap:anywhere] text-gray-900 sm:text-2xl dark:text-white/90">
              {t("create")}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("createPageHint")}
            </p>
          </div>
        </div>
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
