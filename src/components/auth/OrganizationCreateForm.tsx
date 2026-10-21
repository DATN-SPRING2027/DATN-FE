"use client";

import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

type OrganizationCreateInput = Readonly<{ name: string; slug: string }>;

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
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="mb-5">
        <h2
          id="organization-create-title"
          className="text-base font-semibold text-gray-900 dark:text-white"
        >
          {t("onboardingCreate")}
        </h2>
        <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-400">
          {t("onboardingCreateDescription")}
        </p>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="organization-name">{t("onboardingName")}</Label>
          <Input
            id="organization-name"
            value={name}
            onChange={(event) => handleNameChange(event.target.value)}
            required
            maxLength={200}
            autoComplete="organization"
          />
        </div>
        <div>
          <Label htmlFor="organization-slug">{t("onboardingSlug")}</Label>
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
          />
          <p
            id="organization-slug-help"
            className="mt-1.5 text-xs text-gray-500 dark:text-gray-400"
          >
            {t("onboardingSlugHint")}
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end dark:border-gray-800">
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={onCancel}
          >
            {t("onboardingCreateCancel")}
          </Button>
          <Button type="submit" disabled={disabled}>
            {t("onboardingCreateAction")}
          </Button>
        </div>
      </form>
    </section>
  );
}
