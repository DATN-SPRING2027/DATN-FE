"use client";

import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon } from "@/icons";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

type OrganizationCreateInput = Readonly<{ name: string; slug: string }>;

function previewInitials(name: string) {
  const cleaned = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0]?.toLocaleUpperCase() ?? "")
    .join("");
  return cleaned || "+";
}

export default function OrganizationCreateForm({
  disabled,
  onCreate,
  onCancel,
}: {
  disabled: boolean;
  onCreate: (input: OrganizationCreateInput) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("auth");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  function toSlug(value: string) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100);
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(toSlug(value));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({ name: name.trim(), slug: slug.trim().toLowerCase() });
  }

  return (
    <section
      aria-labelledby="organization-create-title"
      className="rounded-2xl border border-brand-200/80 bg-white p-4 shadow-theme-sm ring-1 ring-brand-500/5 sm:p-5 dark:border-brand-500/30 dark:bg-gray-900"
    >
      <div className="mb-3.5 flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-semibold text-white shadow-2xs ring-1 ring-inset ring-white/20"
        >
          {name.trim() ? (
            previewInitials(name)
          ) : (
            <PlusIcon className="size-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="organization-create-title"
            className="text-sm font-semibold text-gray-900 dark:text-white"
          >
            {t("onboardingCreate")}
          </h2>
          <p className="mt-0.5 text-xs leading-4.5 text-gray-500 dark:text-gray-400">
            {t("onboardingCreateDescription")}
          </p>
        </div>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="organization-name">{t("onboardingName")}</Label>
          <Input
            id="organization-name"
            value={name}
            onChange={(event) => handleNameChange(event.target.value)}
            required
            maxLength={200}
            autoComplete="organization"
            placeholder="e.g. Acme Engineering"
          />
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="organization-slug">{t("onboardingSlug")}</Label>
            <span
              aria-hidden="true"
              className="truncate font-mono text-[11px] text-gray-400 dark:text-gray-500"
            >
              continuum.ai/{slug || "workspace-slug"}
            </span>
          </div>
          <Input
            id="organization-slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            required
            maxLength={100}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            autoComplete="off"
            aria-describedby="organization-slug-help"
            placeholder="acme-engineering"
          />
          <p
            id="organization-slug-help"
            className="mt-1 text-[11px] text-gray-500 dark:text-gray-400"
          >
            {t("onboardingSlugHint")}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          <button
            type="button"
            disabled={disabled}
            onClick={onCancel}
            className="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-xl border border-gray-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {t("onboardingCreateCancel")}
          </button>
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("onboardingCreateAction")}
          </button>
        </div>
      </form>
    </section>
  );
}
