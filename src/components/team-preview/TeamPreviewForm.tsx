"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import type { PreviewSaveResult, TeamPreviewItem } from "./team-preview.model";

export default function TeamPreviewForm({
  initial,
  result,
  onSave,
  onCancel,
}: {
  initial?: TeamPreviewItem;
  result: PreviewSaveResult;
  onSave: (value: Pick<TeamPreviewItem, "name" | "code" | "description">) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("teamPreview");
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState({
    name: initial?.name ?? "",
    code: initial?.code ?? "",
    description: initial?.description ?? "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "code", string>>
  >({});
  const [outcome, setOutcome] = useState<PreviewSaveResult | null>(null);
  const pending = outcome === "pending";

  function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    // Demonstrate required-field UX only, without assuming candidate API limits.
    const nextErrors: typeof errors = {};
    if (!draft.name.trim()) nextErrors.name = t("required");
    if (!draft.code.trim()) nextErrors.code = t("required");
    if (!Object.keys(nextErrors).length && result === "validation")
      nextErrors.name = t("validation");
    setErrors(nextErrors);
    const nextOutcome = Object.keys(nextErrors).length ? "validation" : result;
    setOutcome(nextOutcome);
    if (nextOutcome === "success") onSave(draft);
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid)
      form.current
        ?.querySelector<HTMLInputElement>(`[name="${firstInvalid}"]`)
        ?.focus();
  }

  return (
    <form
      ref={form}
      noValidate
      onSubmit={submit}
      aria-busy={pending}
      className="space-y-5"
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t("formHint")}
      </p>
      {outcome && !["success", "pending"].includes(outcome) && (
        <p role="alert" className="text-sm text-error-600 dark:text-error-400">
          {t(outcome)}
        </p>
      )}
      <fieldset disabled={pending || outcome === "success"} className="space-y-4">
        {(["name", "code"] as const).map((field) => (
          <div
            key={field}
            className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center"
          >
            <Label htmlFor={`${id}-${field}`} className="sm:mb-0">
              {t(field)}
            </Label>
            <Input
              id={`${id}-${field}`}
              data-dialog-autofocus-field={field === "name" ? "true" : undefined}
              className="text-base! sm:text-sm!"
              name={field}
              value={draft[field]}
              readOnly={field === "code" && !!initial}
              aria-invalid={!!errors[field]}
              aria-describedby={
                errors[field] ? `${id}-${field}-error` : undefined
              }
              error={!!errors[field]}
              onChange={(event) => {
                setDraft({ ...draft, [field]: event.target.value });
                setOutcome(null);
                setErrors({});
              }}
            />
            {errors[field] && (
              <p
                id={`${id}-${field}-error`}
                className="mt-2 text-sm text-error-600 dark:text-error-400"
              >
                {errors[field]}
              </p>
            )}
          </div>
        ))}
        <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
          <Label htmlFor={`${id}-description`} className="sm:pt-3 sm:mb-0">
            {t("description")}
          </Label>
          <textarea
            id={`${id}-description`}
            rows={4}
            value={draft.description}
            onChange={(event) => {
              setDraft({ ...draft, description: event.target.value });
              setOutcome(null);
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none sm:text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
      </fieldset>
      {outcome === "success" && (
        <p
          role="status"
          className="text-sm text-success-700 dark:text-success-400"
        >
          {t("previewSaved", { name: draft.name })}
        </p>
      )}
      {pending && (
        <p role="status" className="text-sm text-gray-600 dark:text-gray-400">
          {t("pendingHint")}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end dark:border-gray-800">
        {outcome === "success" ? (
          <Button type="button" onClick={onCancel}>
            {t("close")}
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {t(pending ? "pending" : "previewChanges")}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
