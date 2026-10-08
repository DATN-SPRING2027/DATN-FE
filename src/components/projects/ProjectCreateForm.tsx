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
  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={t("create")}
      className="mx-auto w-full max-w-5xl min-w-0 space-y-4 sm:space-y-6"
    >
      <section
        aria-labelledby="project-details-heading"
        className="space-y-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs sm:p-6 @3xl:p-8 dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="border-b border-gray-100 pb-4 dark:border-gray-800">
          <h3
            id="project-details-heading"
            className="font-semibold text-gray-900 dark:text-white/90"
          >
            {t("detail")}
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t("detailsHint")}
          </p>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-4 @xl:grid-cols-2 @xl:gap-6">
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
              aria-invalid={invalid && !/^[A-Z][A-Z0-9_-]{1,31}$/.test(code)}
              aria-describedby={
                invalid ? "project-validation" : "project-code-hint"
              }
            />
            <p
              id="project-code-hint"
              className="mt-2 text-xs text-gray-600 dark:text-gray-400"
            >
              {t("codeHint")}
            </p>
          </div>
        </div>
        <div>
          <Label htmlFor="project-description">{t("description")}</Label>
          <textarea
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
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
        <div>
          <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("visibility")}
          </h4>
          <div className="rounded-xl border-2 border-brand-500 bg-brand-50/40 p-4 dark:border-brand-400 dark:bg-brand-500/10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white/90">
                {t("PRIVATE")}
              </span>
              <span className="rounded-md bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                {t("defaultVisibility")}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {t("privateHint")}
            </p>
          </div>
        </div>
        {invalid && (
          <p
            id="project-validation"
            role="alert"
            className="text-sm text-error-500 dark:text-error-400"
          >
            {t("validation")}
          </p>
        )}
        {mutation.isError && <ProjectState error={mutation.error} />}
      </section>
      <footer className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs @xl:flex-row @xl:items-center @xl:justify-between @xl:p-5 dark:border-gray-800 dark:bg-gray-900">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {t("requiredHint")}
        </p>
        <div className="flex w-full flex-col gap-3 @sm:flex-row @xl:w-auto">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={mutation.isPending}
              className="cursor-pointer rounded-lg border border-gray-300 bg-white px-5 py-3.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t("cancel")}
            </button>
          )}
          <Button
            className="flex-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 @xl:flex-none"
            disabled={mutation.isPending || !organizationId}
          >
            {t(mutation.isPending ? "creating" : "create")}
          </Button>
        </div>
      </footer>
    </form>
  );
}
