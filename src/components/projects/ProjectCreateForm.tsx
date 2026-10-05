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
}: {
  organizationId: string;
  onCreated: (project: Project) => void;
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
      className="space-y-4 rounded-xl border border-brand-200 bg-brand-50/30 p-5 dark:border-brand-500/30 dark:bg-brand-500/5"
    >
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white/90">
          {t("create")}
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t("createHint")}
        </p>
      </div>
      <div>
        <Label htmlFor="project-name">{t("name")}</Label>
        <Input
          id="project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={200}
          disabled={mutation.isPending}
        />
      </div>
      <div>
        <Label htmlFor="project-code">{t("code")}</Label>
        <Input
          id="project-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          maxLength={32}
          disabled={mutation.isPending}
          hint={t("codeHint")}
        />
      </div>
      <div>
        <Label htmlFor="project-description">{t("description")}</Label>
        <textarea
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          rows={4}
          id="project-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          disabled={mutation.isPending}
        />
      </div>
      {invalid && (
        <p role="alert" className="text-sm text-error-500 dark:text-error-400">
          {t("validation")}
        </p>
      )}
      {mutation.isError && <ProjectState error={mutation.error} />}
      <Button
        className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        disabled={mutation.isPending || !organizationId}
      >
        {t(mutation.isPending ? "creating" : "create")}
      </Button>
    </form>
  );
}
