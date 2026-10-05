"use client";

import { useRouter } from "@/i18n/navigation";
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
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t("createPageHint")}
      </p>
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
