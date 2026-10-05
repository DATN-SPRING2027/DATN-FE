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
    <form onSubmit={submit} noValidate className="space-y-4">
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
        <Input
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
      <Button disabled={mutation.isPending || !organizationId}>
        {t(mutation.isPending ? "creating" : "create")}
      </Button>
    </form>
  );
}
