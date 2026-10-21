"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import {
  useCreateProjectMutation,
  type Project,
} from "@/lib/queries/projects/useProjects";
import ProjectState from "./ProjectState";

export default function ProjectCreateForm({
  organizationId,
  onCreated,
  onCancel,
}: {
  organizationId: string;
  onCreated: (project: Project) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("projects");
  const mutation = useCreateProjectMutation(organizationId);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [invalid, setInvalid] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (mutation.isPending || !organizationId) return;
    if (
      !name.trim() ||
      name.length > 200 ||
      !/^[A-Z][A-Z0-9_-]{1,31}$/.test(code) ||
      description.length > 2000
    ) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    mutation.mutate(
      { name, code, ...(description ? { description } : {}) },
      { onSuccess: onCreated },
    );
  }

  const previewMonogram = (
    code.trim().slice(0, 2) ||
    name.trim().slice(0, 2) ||
    "PR"
  ).toUpperCase();

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={t("create")}
      className="w-full min-w-0"
    >
      <div className="grid min-w-0 grid-cols-1 items-start gap-5 @4xl:grid-cols-3 @4xl:gap-6">
        {/* Left 8-Col: Primary Configuration Card + Action Footer */}
        <div className="min-w-0 space-y-5 @4xl:col-span-2">
          <section
            aria-labelledby="project-details-heading"
            className="space-y-6 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs sm:p-6 @3xl:p-7 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="border-b border-gray-100 pb-4 dark:border-gray-800">
              <h3
                id="project-details-heading"
                className="text-base font-semibold text-gray-900 dark:text-white/90"
              >
                {t("detail")}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t("detailsHint")}
              </p>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-5 @xl:grid-cols-2">
              <div>
                <Label htmlFor="project-name">
                  {t("name")}{" "}
                  <span aria-hidden="true" className="text-error-500">
                    *
                  </span>
                </Label>
                <Input
                  id="project-name"
                  aria-label={t("name")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={200}
                  disabled={mutation.isPending}
                  placeholder={t("namePlaceholder")}
                  aria-invalid={invalid && (!name.trim() || name.length > 200)}
                  aria-describedby={invalid ? "project-validation" : undefined}
                />
              </div>

              <div>
                <Label htmlFor="project-code">
                  {t("code")}{" "}
                  <span aria-hidden="true" className="text-error-500">
                    *
                  </span>
                </Label>
                <Input
                  id="project-code"
                  aria-label={t("code")}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  maxLength={32}
                  disabled={mutation.isPending}
                  placeholder={t("codePlaceholder")}
                  className="font-mono"
                  aria-invalid={invalid && !/^[A-Z][A-Z0-9_-]{1,31}$/.test(code)}
                  aria-describedby={
                    invalid ? "project-validation" : "project-code-hint"
                  }
                />
                <p
                  id="project-code-hint"
                  className="mt-2 text-xs text-gray-500 dark:text-gray-400"
                >
                  {t("codeHint")}
                </p>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <Label htmlFor="project-description" className="mb-0">
                  {t("description")}
                </Label>
                <span className="text-xs tabular-nums text-gray-400 dark:text-gray-500">
                  {description.length}/2000
                </span>
              </div>
              <textarea
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 shadow-theme-xs transition-colors placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                rows={4}
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                disabled={mutation.isPending}
                placeholder={t("descriptionPlaceholder")}
                aria-invalid={invalid && description.length > 2000}
                aria-describedby={invalid ? "project-validation" : undefined}
              />
            </div>

            {invalid && (
              <p
                id="project-validation"
                role="alert"
                className="rounded-xl border border-error-200 bg-error-50/60 px-4 py-3 text-sm text-error-600 dark:border-error-500/25 dark:bg-error-500/10 dark:text-error-400"
              >
                {t("validation")}
              </p>
            )}
            {mutation.isError && <ProjectState error={mutation.error} />}
          </section>

          <footer className="flex flex-col gap-4 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-theme-xs @xl:flex-row @xl:items-center @xl:justify-between @xl:p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("requiredHint")}
            </p>
            <div className="flex w-full flex-col gap-3 @sm:flex-row @xl:w-auto">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={mutation.isPending}
                  className="cursor-pointer rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {t("cancel")}
                </button>
              )}
              <Button
                className="flex-1 cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 @xl:flex-none"
                disabled={mutation.isPending || !organizationId}
              >
                {t(mutation.isPending ? "creating" : "create")}
              </Button>
            </div>
          </footer>
        </div>

        {/* Right 4-Col: Workspace Blueprint & Visibility Governance Card */}
        <aside className="min-w-0 space-y-5 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 pb-4 dark:border-gray-800">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">
              {t("createSummaryTitle")}
            </h3>
            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
              {t("createSummaryHint")}
            </p>
          </div>

          {/* Live Card Preview */}
          <div className="rounded-xl border border-gray-200/80 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/40">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xs font-bold tracking-tight text-brand-600 ring-1 ring-brand-500/15 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/20"
              >
                {previewMonogram}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white/90">
                  {name.trim() || t("namePlaceholder")}
                </p>
                <span className="mt-1 inline-flex items-center rounded border border-gray-200/80 bg-white px-2 py-0.5 font-mono text-[11px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  {code.trim() || "PROJECT_CODE"}
                </span>
              </div>
            </div>
          </div>

          {/* Visibility Policy Box */}
          <div>
            <h4 className="mb-2.5 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
              {t("visibility")}
            </h4>
            <div className="rounded-xl border border-warning-200 bg-warning-50/50 p-4 dark:border-warning-500/25 dark:bg-warning-500/10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white/90">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="h-3.5 w-3.5 text-warning-600 dark:text-warning-400"
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
                  {t("PRIVATE")}
                </span>
                <span className="rounded-md bg-warning-100 px-2 py-0.5 text-xs font-medium text-warning-800 dark:bg-warning-500/20 dark:text-warning-300">
                  {t("defaultVisibility")}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-gray-600 dark:text-gray-300">
                {t("privateHint")}
              </p>
            </div>
          </div>

          {/* Blueprint Specs */}
          <dl className="space-y-3 border-t border-gray-100 pt-4 text-xs dark:border-gray-800">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-gray-500 dark:text-gray-400">
                {t("createBlueprintScopeLabel")}
              </dt>
              <dd className="font-semibold text-gray-800 dark:text-gray-200">
                {t("createBlueprintScopeValue")}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-gray-500 dark:text-gray-400">
                {t("createBlueprintLifecycleLabel")}
              </dt>
              <dd className="inline-flex items-center gap-1.5 font-semibold text-success-700 dark:text-success-400">
                <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                {t("createBlueprintLifecycleValue")}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-gray-500 dark:text-gray-400">
                {t("createBlueprintCodeLabel")}
              </dt>
              <dd className="font-mono font-medium text-gray-700 dark:text-gray-300">
                {t("createBlueprintCodeValue")}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </form>
  );
}
