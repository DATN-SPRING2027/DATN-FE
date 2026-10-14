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
  return (
    <div className="mt-3 space-y-3 text-sm text-gray-600 dark:text-gray-300">
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
      >
        {t(project.visibility === "PRIVATE" ? "publish" : "makePrivate")}
      </Button>
      {access.isFetching && <p role="status">{t("checkingAccess")}</p>}
      {(denied || error != null) && (
        <div role="alert" className="space-y-2">
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
