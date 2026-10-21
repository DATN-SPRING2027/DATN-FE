"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import { ApiError } from "@/lib/api-client";
import {
  type Project,
  useUpdateProjectMutation,
} from "@/lib/queries/projects/useProjects";
import { useProjectSettingsAccess } from "@/lib/queries/projects/useProjectSettings";
import { SettingsIcon } from "@/icons";
import ProjectVisibility from "./ProjectVisibility";

const inputClassName =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-theme-xs transition-colors outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-100 dark:disabled:bg-gray-800/30 dark:disabled:text-gray-500";

function ProjectDetailsForm({ project }: { project: Project }) {
  const t = useTranslations("projects.settingsPanel");
  const projectText = useTranslations("projects");
  const id = useId();
  const access = useProjectSettingsAccess(
    project.organizationId,
    project.id,
    project.status === "ACTIVE",
  );
  const mutation = useUpdateProjectMutation(project.organizationId, project.id);
  const [baseline, setBaseline] = useState({
    name: project.name,
    description: project.description ?? "",
    updatedAt: project.updatedAt,
  });
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [success, setSuccess] = useState(false);
  const canEdit =
    access.data === true &&
    access.isSuccess &&
    !access.isFetching &&
    !access.isError;
  const remoteChanged = baseline.updatedAt !== project.updatedAt;
  const dirty =
    name.trim() !== baseline.name || description !== baseline.description;
  const nameError =
    !name.trim() || name.trim().length > 200
      ? t(!name.trim() ? "nameRequired" : "nameTooLong")
      : undefined;
  const descriptionError =
    description.length > 2000 ? t("descriptionTooLong") : undefined;
  const formError = mutation.error;

  function errorMessage(error: unknown) {
    if (error instanceof ApiError) {
      if (error.status === 403) return t("errorPermission");
      if (error.status === 404) return t("errorNotFound");
      if (error.status === 409) return t("errorConflict");
      if (error.status === 422) return t("errorValidation");
    }
    return t("errorGeneric");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !canEdit ||
      remoteChanged ||
      !dirty ||
      nameError ||
      descriptionError ||
      mutation.isPending
    )
      return;

    const input: { name?: string; description?: string | null } = {};
    if (name.trim() !== baseline.name) input.name = name.trim();
    if (description !== baseline.description)
      input.description = description.trim() ? description : null;

    setSuccess(false);
    try {
      const updated = await mutation.mutateAsync(input);
      setName(updated.name);
      setDescription(updated.description ?? "");
      setBaseline({
        name: updated.name,
        description: updated.description ?? "",
        updatedAt: updated.updatedAt,
      });
      setSuccess(true);
    } catch {
      // The mutation error is mapped below and remains available for retry.
    }
  }

  function cancel() {
    const nextBaseline = remoteChanged
      ? {
          name: project.name,
          description: project.description ?? "",
          updatedAt: project.updatedAt,
        }
      : baseline;
    setBaseline(nextBaseline);
    setName(nextBaseline.name);
    setDescription(nextBaseline.description);
    setSuccess(false);
    mutation.reset();
  }

  const accessMessage =
    project.status !== "ACTIVE"
      ? t("archivedReadOnly")
      : remoteChanged
        ? t("remoteChanged")
        : access.isPending
          ? t("checkingAccess")
          : access.data === false
            ? t("errorPermission")
            : access.isError
              ? t("accessUnavailable")
              : null;

  return (
    <form onSubmit={save} noValidate>
      <div className="grid grid-cols-1 gap-5 @xl:grid-cols-2">
        <label
          htmlFor={`${id}-name`}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {projectText("name")}
          <input
            id={`${id}-name`}
            className={inputClassName}
            maxLength={200}
            value={name}
            disabled={!canEdit || mutation.isPending}
            aria-invalid={Boolean(nameError)}
            aria-describedby={`${id}-name-error`}
            onChange={(event) => {
              setName(event.target.value);
              setSuccess(false);
              mutation.reset();
            }}
          />
          {nameError && canEdit && (
            <span
              id={`${id}-name-error`}
              role="alert"
              className="mt-1.5 block text-xs text-error-600 dark:text-error-400"
            >
              {nameError}
            </span>
          )}
        </label>

        <div>
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {projectText("code")}
          </span>
          <div className="mt-1.5 flex min-h-11 w-full items-center justify-between rounded-xl border border-gray-200/80 bg-gray-50/80 px-3.5 py-2.5 font-mono text-sm font-semibold text-gray-600 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300">
            <span>{project.code}</span>
            <span className="rounded bg-gray-200/70 px-2 py-0.5 font-sans text-[11px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
              Immutable
            </span>
          </div>
        </div>

        <label
          htmlFor={`${id}-description`}
          className="block text-sm font-medium text-gray-700 @xl:col-span-2 dark:text-gray-300"
        >
          {projectText("description")}
          <textarea
            id={`${id}-description`}
            className={`${inputClassName} min-h-28 resize-y`}
            maxLength={2000}
            rows={4}
            value={description}
            disabled={!canEdit || mutation.isPending}
            placeholder={projectText("noDescription")}
            aria-invalid={Boolean(descriptionError)}
            aria-describedby={`${id}-description-error`}
            onChange={(event) => {
              setDescription(event.target.value);
              setSuccess(false);
              mutation.reset();
            }}
          />
          {descriptionError && canEdit && (
            <span
              id={`${id}-description-error`}
              role="alert"
              className="mt-1.5 block text-xs text-error-600 dark:text-error-400"
            >
              {descriptionError}
            </span>
          )}
        </label>
      </div>
      <div className="mt-5 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
        <div className="min-h-6 flex-1">
          {accessMessage && (
            <div
              role={access.data === false ? "note" : "status"}
              className="text-sm text-gray-500 dark:text-gray-400"
            >
              {accessMessage}
              {(access.isError || remoteChanged) && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ms-3"
                  onClick={() => {
                    if (remoteChanged) cancel();
                    else void access.refetch();
                  }}
                >
                  {t("refreshAccess")}
                </Button>
              )}
            </div>
          )}
          {formError && (
            <p
              role="alert"
              className="text-sm text-error-700 dark:text-error-300"
            >
              {errorMessage(formError)}
            </p>
          )}
          {success && (
            <p
              role="status"
              className="text-sm font-medium text-success-700 dark:text-success-400"
            >
              {t("saveSuccess")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!dirty || mutation.isPending}
            onClick={cancel}
          >
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={
              !canEdit ||
              remoteChanged ||
              !dirty ||
              Boolean(nameError || descriptionError) ||
              mutation.isPending
            }
          >
            {mutation.isPending ? t("savingChanges") : t("saveChanges")}
          </Button>
        </div>
      </div>
    </form>
  );
}

export default function ProjectSettings({ project }: { project: Project }) {
  const t = useTranslations("projects.settingsPanel");
  const projectText = useTranslations("projects");
  const id = useId();
  const isPrivate = project.visibility === "PRIVATE";

  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-5">
      <header className="flex items-start gap-3.5 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-500/15 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/20">
          <SettingsIcon className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2
            id={`${id}-heading`}
            className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white/90"
          >
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("description")}
          </p>
        </div>
      </header>

      <ComponentCard title={t("detailsTitle")}>
        <ProjectDetailsForm
          key={`${project.organizationId}:${project.id}`}
          project={project}
        />
      </ComponentCard>

      <ComponentCard title={t("visibilityTitle")}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
              {t("visibilityDescription")}
            </p>
            {project.status === "ACTIVE" ? (
              <ProjectVisibility
                key={`${project.organizationId}:${project.id}`}
                project={project}
              />
            ) : (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                {t("visibilityArchived")}
              </p>
            )}
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap ${
              !isPrivate
                ? "border-blue-light-200 bg-blue-light-50/70 text-blue-light-700 dark:border-blue-light-500/20 dark:bg-blue-light-500/10 dark:text-blue-light-300"
                : "border-warning-200 bg-warning-50/70 text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-300"
            }`}
          >
            {isPrivate ? (
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
            ) : (
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
            )}
            {projectText(project.visibility)}
          </span>
        </div>
      </ComponentCard>

      <section
        aria-labelledby={`${id}-danger-zone-heading`}
        className="rounded-2xl border border-error-200/90 bg-error-50/20 p-5 shadow-theme-xs sm:p-6 dark:border-error-500/25 dark:bg-error-500/5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3
              id={`${id}-danger-zone-heading`}
              className="text-base font-semibold text-gray-900 dark:text-white/90"
            >
              {t("dangerZoneTitle")}
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">
              {t("deleteUnavailable")}
            </p>
          </div>
          <Button
            variant="outline"
            disabled
            startIcon={
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                className="h-4 w-4 shrink-0"
              >
                <path
                  d="M3 4.5h10M6.25 4.5V3.25a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 .75.75V4.5m-5 0v8a1 1 0 0 0 1 1h4.5a1 1 0 0 0 1-1v-8"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          >
            {t("deleteProject")}
          </Button>
        </div>
      </section>
    </section>
  );
}
