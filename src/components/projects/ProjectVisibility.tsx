"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import Button from "@/components/ui/button/Button";
import { useModal } from "@/hooks/useModal";
import { ApiError } from "@/lib/api-client";
import { projectKeys, type Project } from "@/lib/queries/projects/useProjects";
import {
  useChangeProjectVisibility,
  useProjectVisibilityAccess,
} from "@/lib/queries/projects/useProjectVisibility";
import ProjectPublicationDialog from "./ProjectPublicationDialog";

export default function ProjectVisibility({ project }: { project: Project }) {
  const t = useTranslations("projectVisibility");
  const access = useProjectVisibilityAccess(
    project.organizationId,
    project.id,
    project.status === "ACTIVE",
  );
  const mutation = useChangeProjectVisibility(
    project.organizationId,
    project.id,
  );
  const client = useQueryClient();
  const modal = useModal();
  const submitted = useRef(false);
  const [target, setTarget] = useState<Project["visibility"]>("PUBLIC");
  const error = mutation.error ?? access.error;
  const denied =
    access.data === false ||
    (error instanceof ApiError && error.status === 403);
  const errorKey = denied
    ? "denied"
    : error instanceof ApiError
      ? ((
          {
            401: "session",
            404: "unavailable",
            409: "conflict",
            422: "invalid",
            429: "rateLimit",
          } as Record<number, string>
        )[error.status] ?? "unknown")
      : "unknown";
  if (project.status !== "ACTIVE") return null;
  const isPrivate = project.visibility === "PRIVATE";
  return (
    <div className="mt-4 space-y-3 border-t border-gray-100 pt-4 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {isPrivate
            ? "Switch to organization-wide read access"
            : "Restrict back to invited members only"}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={
            access.data !== true ||
            access.isFetching ||
            access.isError ||
            mutation.isPending ||
            mutation.isError
          }
          onClick={() => {
            setTarget(project.visibility === "PRIVATE" ? "PUBLIC" : "PRIVATE");
            modal.openModal();
          }}
          startIcon={
            isPrivate ? (
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                className="h-3.5 w-3.5 shrink-0"
              >
                <circle
                  cx="8"
                  cy="8"
                  r="5.75"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M2.5 8h11M8 2.25c1.6 1.55 2.4 3.47 2.4 5.75S9.6 12.2 8 13.75c-1.6-1.55-2.4-3.47-2.4-5.75S6.4 3.8 8 2.25Z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                className="h-3.5 w-3.5 shrink-0"
              >
                <rect
                  x="3.25"
                  y="7.25"
                  width="9.5"
                  height="6.5"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M5.25 7.25V5.25a2.75 2.75 0 1 1 5.5 0v2"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            )
          }
        >
          {t(project.visibility === "PRIVATE" ? "publish" : "makePrivate")}
        </Button>
      </div>
      {access.isFetching && (
        <p role="status" className="text-xs text-gray-500 dark:text-gray-400">
          {t("checkingAccess")}
        </p>
      )}
      {(denied || error != null) && (
        <div
          role="alert"
          className="space-y-2 rounded-xl border border-error-200 bg-error-50/60 px-3.5 py-2.5 text-xs text-error-700 dark:border-error-500/25 dark:bg-error-500/10 dark:text-error-300"
        >
          <p>{t(errorKey)}</p>
          {!denied && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void client.invalidateQueries({
                  queryKey: projectKeys.scope(project.organizationId),
                });
                void access.refetch();
              }}
            >
              {t("refresh")}
            </Button>
          )}
        </div>
      )}
      <ProjectPublicationDialog
        name={project.name}
        target={target}
        isOpen={modal.isOpen}
        pending={mutation.isPending}
        confirmDisabled={
          access.data !== true || access.isFetching || access.isError
        }
        onClose={() => {
          if (!submitted.current) modal.closeModal();
        }}
        onConfirm={() => {
          if (
            submitted.current ||
            access.data !== true ||
            access.isFetching ||
            access.isError ||
            mutation.isError
          )
            return;
          submitted.current = true;
          void mutation
            .mutateAsync(target)
            .catch(() => undefined)
            .finally(() => {
              submitted.current = false;
              modal.closeModal();
            });
        }}
      />
    </div>
  );
}
