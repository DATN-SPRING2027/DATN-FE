"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
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
      <div className="space-y-5 p-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-12">
          <div className="sm:col-span-7">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor={`${id}-name`}
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {projectText("name")}
              </label>
              <span className="text-xs font-medium tabular-nums text-gray-400 dark:text-gray-500">
                {name.length} / 200
              </span>
            </div>
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
          </div>

          <div className="sm:col-span-5">
            <div className="flex items-center justify-between gap-2">
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {projectText("code")}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 dark:text-gray-500">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="h-3 w-3 shrink-0"
                >
                  <rect
                    x="3.5"
                    y="7.25"
                    width="9"
                    height="6.25"
                    rx="1.25"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <path
                    d="M5.5 7.25V5.25a2.5 2.5 0 1 1 5 0v2"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
                Immutable
              </span>
            </div>
            <div className="mt-1.5 flex min-h-11 w-full items-center justify-between rounded-xl border border-gray-200/80 bg-gray-50/90 px-3.5 py-2.5 font-mono text-sm font-semibold text-gray-700 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300">
              <span className="truncate">{project.code}</span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={`${id}-description`}
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {projectText("description")}
            </label>
            <span className="text-xs font-medium tabular-nums text-gray-400 dark:text-gray-500">
              {description.length} / 2000
            </span>
          </div>
          <textarea
            id={`${id}-description`}
            className={`${inputClassName} min-h-36 resize-y leading-relaxed`}
            maxLength={2000}
            rows={5}
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
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:bg-white/[0.02]">
        <div className="min-h-5 flex-1 space-y-1">
          {accessMessage && (
            <div
              role={access.data === false ? "note" : "status"}
              className="text-xs font-medium text-gray-500 dark:text-gray-400"
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
              className="text-xs font-medium text-error-700 dark:text-error-300"
            >
              {errorMessage(formError)}
            </p>
          )}
          {success && (
            <p
              role="status"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-success-700 dark:text-success-400"
            >
              <span className="size-1.5 rounded-full bg-success-600 dark:bg-success-400" />
              {t("saveSuccess")}
            </p>
          )}
          {!accessMessage && !formError && !success && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {dirty
                ? "Unsaved changes ready to save."
                : "All project details are up to date."}
            </span>
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
    <section
      aria-labelledby={`${id}-heading`}
      className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start"
    >
      {/* Left Column: General Project Details */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 lg:col-span-7">
        <header className="flex items-start gap-3.5 border-b border-gray-100 px-6 py-5 dark:border-gray-800">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-500/15 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/20">
            <SettingsIcon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-semibold tracking-wider text-brand-600 uppercase dark:text-brand-400">
              {t("title")}
            </span>
            <h2
              id={`${id}-heading`}
              className="mt-0.5 text-base font-semibold tracking-tight text-gray-900 dark:text-white/90"
            >
              {t("detailsTitle")}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {t("description")}
            </p>
          </div>
        </header>

        <ProjectDetailsForm
          key={`${project.organizationId}:${project.id}`}
          project={project}
        />
      </div>

      {/* Right Column: Visibility & Lifecycle Controls */}
      <div className="space-y-6 lg:col-span-5">
        <div className="rounded-2xl border border-gray-200/90 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ${
                  isPrivate
                    ? "bg-warning-50 text-warning-600 ring-warning-500/15 dark:bg-warning-500/15 dark:text-warning-300"
                    : "bg-blue-light-50 text-blue-light-600 ring-blue-light-500/15 dark:bg-blue-light-500/15 dark:text-blue-light-300"
                }`}
              >
                {isPrivate ? (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 18 18"
                    fill="none"
                    className="size-4.5"
                  >
                    <rect
                      x="3.75"
                      y="8"
                      width="10.5"
                      height="7.25"
                      rx="1.75"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M6 8V5.75a3 3 0 1 1 6 0V8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 18 18"
                    fill="none"
                    className="size-4.5"
                  >
                    <circle
                      cx="9"
                      cy="9"
                      r="6.25"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M3 9h12M9 2.75c1.75 1.7 2.65 3.8 2.65 6.25S10.75 13.55 9 15.25c-1.75-1.7-2.65-3.8-2.65-6.25S7.25 4.45 9 2.75Z"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                  </svg>
                )}
              </span>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">
                  {t("visibilityTitle")}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Access control & discovery policy
                </p>
              </div>
            </div>

            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap ${
                !isPrivate
                  ? "border-blue-light-200 bg-blue-light-50/70 text-blue-light-700 dark:border-blue-light-500/20 dark:bg-blue-light-500/10 dark:text-blue-light-300"
                  : "border-warning-200 bg-warning-50/70 text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-300"
              }`}
            >
              {projectText(project.visibility)}
            </span>
          </div>

          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/60 p-3.5 dark:border-gray-800 dark:bg-white/[0.02]">
            <p className="text-xs leading-5 text-gray-600 dark:text-gray-300">
              {t("visibilityDescription")}
            </p>
          </div>

          {project.status === "ACTIVE" ? (
            <ProjectVisibility
              key={`${project.organizationId}:${project.id}`}
              project={project}
            />
          ) : (
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              {t("visibilityArchived")}
            </p>
          )}
        </div>

        <section
          aria-labelledby={`${id}-danger-zone-heading`}
          className="rounded-2xl border border-error-200/90 bg-white p-6 shadow-theme-xs dark:border-error-500/25 dark:bg-gray-900"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-error-50 text-error-600 ring-1 ring-error-500/15 dark:bg-error-500/10 dark:text-error-400">
              <svg
                aria-hidden="true"
                viewBox="0 0 18 18"
                fill="none"
                className="size-4.5"
              >
                <path
                  d="M9 6.25v3.25m0 2.5h.007M3.34 14.25h11.32c1.1 0 1.79-1.19 1.24-2.14L10.24 2.4c-.55-.95-1.93-.95-2.48 0L2.1 12.11c-.55.95.14 2.14 1.24 2.14Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3
                  id={`${id}-danger-zone-heading`}
                  className="text-base font-semibold text-gray-900 dark:text-white/90"
                >
                  {t("dangerZoneTitle")}
                </h3>
                <span className="rounded-full border border-error-200 bg-error-50 px-2.5 py-0.5 text-[11px] font-medium text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
                  Protected
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-gray-600 dark:text-gray-400">
                {t("deleteUnavailable")}
              </p>
              <div className="mt-4 flex items-center justify-end border-t border-gray-100 pt-4 dark:border-gray-800">
                <Button
                  size="sm"
                  variant="outline"
                  disabled
                  startIcon={
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="h-3.5 w-3.5 shrink-0"
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
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
