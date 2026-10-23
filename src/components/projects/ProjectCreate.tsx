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
      <div className="space-y-2">
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
            {t("create")}
          </span>
        </nav>

        <header>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white/90">
            {t("createNew")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("createPageHint")}
          </p>
        </header>
      </div>

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
          currentUserId={user.data.id}
          currentUserName={user.data.name || user.data.email}
          currentUserEmail={user.data.email}
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
