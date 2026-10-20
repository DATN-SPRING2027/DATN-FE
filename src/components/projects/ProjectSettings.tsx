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
import { SettingsIcon, TrashBinIcon } from "@/icons";
import ProjectVisibility from "./ProjectVisibility";

const inputClassName =
  "mt-1.5 block min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-100 dark:disabled:bg-gray-800/30 dark:disabled:text-gray-500";

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
  const canEdit = access.data === true && !access.isFetching;
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
              className="mt-1 block text-xs text-error-600 dark:text-error-400"
            >
              {nameError}
            </span>
          )}
        </label>
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
              className="mt-1 block text-xs text-error-600 dark:text-error-400"
            >
              {descriptionError}
            </span>
          )}
        </label>
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
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
              className="text-sm text-success-700 dark:text-success-400"
            >
              {t("saveSuccess")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
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

  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-5">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          <SettingsIcon className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2
            id={`${id}-heading`}
            className="text-lg font-semibold text-gray-900 dark:text-white/90"
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
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${project.visibility === "PUBLIC" ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300" : "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
          >
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${project.visibility === "PUBLIC" ? "bg-brand-500" : "bg-gray-400"}`}
            />
            {projectText(project.visibility)}
          </span>
        </div>
      </ComponentCard>

      <section
        aria-labelledby={`${id}-danger-zone-heading`}
        className="rounded-2xl border border-error-200 bg-white p-5 shadow-theme-xs dark:border-error-500/20 dark:bg-gray-900"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3
              id={`${id}-danger-zone-heading`}
              className="font-semibold text-gray-900 dark:text-white/90"
            >
              {t("dangerZoneTitle")}
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
              {t("deleteUnavailable")}
            </p>
          </div>
          <Button
            variant="outline"
            disabled
            startIcon={<TrashBinIcon className="size-4" aria-hidden="true" />}
          >
            {t("deleteProject")}
          </Button>
        </div>
      </section>
    </section>
  );
}
