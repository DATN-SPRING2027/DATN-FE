"use client";

import { Link, useRouter } from "@/i18n/navigation";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import { useTranslations } from "next-intl";
import ProjectCreateForm from "./ProjectCreateForm";
import ProjectState from "./ProjectState";
import { BackgroundRefreshError, UpdatingStatus } from "@/components/ui/loading/AsyncStatus";

export default function ProjectCreate() {
  const t = useTranslations("projects");
  const common = useTranslations("common");
  const user = useCurrentUserQuery();
  const userAccessLost = isAccessOrResourceUnavailableError(user.error);
  const visibleUser = userAccessLost ? undefined : user.data;
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

      {!userAccessLost && visibleUser && user.isFetching && (
        <UpdatingStatus>{common("updating")}</UpdatingStatus>
      )}
      {!userAccessLost && visibleUser && user.isRefetchError && (
        <BackgroundRefreshError
          retryLabel={common("retry")}
          onRetry={() => void user.refetch()}
        >
          {common("updateFailed")}
        </BackgroundRefreshError>
      )}
      {user.isPending && !visibleUser ? (
        <ProjectState />
      ) : user.isError && !visibleUser ? (
        <ProjectState
          error={user.error}
          retry={() => {
            void user.refetch();
          }}
        />
      ) : visibleUser?.organizationId ? (
        <ProjectCreateForm
          key={`${visibleUser.id}:${visibleUser.organizationId}`}
          organizationId={visibleUser.organizationId}
          currentUserId={visibleUser.id}
          currentUserName={visibleUser.name || visibleUser.email}
          currentUserEmail={visibleUser.email}
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
