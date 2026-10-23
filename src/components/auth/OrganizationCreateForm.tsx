"use client";

import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon } from "@/icons";
import { checkOrganizationSlugAvailability } from "@/lib/queries/auth/useAccountOnboarding";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";

type OrganizationCreateInput = Readonly<{ name: string; slug: string }>;

type SlugAvailabilityState =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "valid_local";

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

function validateSlugFormat(value: string): {
  valid: boolean;
  errorKey: string | null;
} {
  if (value.length === 0) {
    return { valid: false, errorKey: "onboardingSlugErrorEmpty" };
  }
  if (/[A-Z]/.test(value)) {
    return { valid: false, errorKey: "onboardingSlugErrorUppercase" };
  }
  if (!/^[a-z0-9-]+$/.test(value)) {
    return { valid: false, errorKey: "onboardingSlugErrorChars" };
  }
  if (/^-|-$/.test(value)) {
    return { valid: false, errorKey: "onboardingSlugErrorHyphenEdge" };
  }
  if (/--/.test(value)) {
    return { valid: false, errorKey: "onboardingSlugErrorHyphenDouble" };
  }
  if (value.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    return { valid: false, errorKey: "onboardingSlugErrorChars" };
  }
  return { valid: true, errorKey: null };
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
  const [availability, setAvailability] =
    useState<SlugAvailabilityState>("idle");

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

  const formatValidation = validateSlugFormat(slug);
  const showValidationState = slug.length > 0 || slugTouched;
  const hasFormatError = showValidationState && !formatValidation.valid;
  const isTaken = formatValidation.valid && availability === "taken";
  const isChecking = formatValidation.valid && availability === "checking";
  const isSlugValidAndReady =
    formatValidation.valid &&
    (availability === "available" || availability === "valid_local");

  useEffect(() => {
    if (!formatValidation.valid) {
      setAvailability("idle");
      return;
    }

    if (typeof checkOrganizationSlugAvailability !== "function") {
      setAvailability("valid_local");
      return;
    }

    const controller = new AbortController();
    setAvailability("checking");

    const timer = setTimeout(() => {
      Promise.resolve(
        checkOrganizationSlugAvailability(slug, controller.signal),
      )
        .then((result) => {
          if (controller.signal.aborted) return;
          if (!result || typeof result.available !== "boolean") {
            setAvailability("valid_local");
            return;
          }
          if (!result.valid) {
            setAvailability("idle");
            return;
          }
          setAvailability(result.available ? "available" : "taken");
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setAvailability("valid_local");
          }
        });
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [slug, formatValidation.valid]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSlugTouched(true);
    if (!name.trim() || !formatValidation.valid || isTaken) {
      return;
    }
    onCreate({ name: name.trim(), slug: slug.trim().toLowerCase() });
  }

  return (
    <section
      aria-labelledby="organization-create-title"
      className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-sm sm:p-6 dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/80 px-3.5 py-3 dark:border-gray-800 dark:bg-gray-800/50">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-semibold text-white shadow-2xs ring-1 ring-inset ring-white/20"
          >
            {name.trim() ? (
              previewInitials(name)
            ) : (
              <PlusIcon className="size-4" />
            )}
          </span>
          <div className="min-w-0">
            <h2
              id="organization-create-title"
              className="truncate text-sm font-semibold text-gray-900 dark:text-white"
            >
              {name.trim() || t("onboardingCreate")}
            </h2>
            <p className="mt-0.5 truncate font-mono text-[11px] text-gray-500 dark:text-gray-400">
              {t("onboardingSlugPreview", {
                slug: slug || t("onboardingSlugDefault"),
              })}
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/15 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/25">
          {t("onboardingPreviewRole")}
        </span>
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
            placeholder={t("onboardingNamePlaceholder")}
          />
        </div>
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="organization-slug" className="mb-0">
              {t("onboardingSlug")}
            </Label>
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="truncate font-mono text-[11px] text-gray-400 dark:text-gray-500"
              >
                {t("onboardingSlugPreview", {
                  slug: slug || t("onboardingSlugDefault"),
                })}
              </span>

              {showValidationState && (
                <>
                  {isChecking && (
                    <span
                      role="status"
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                    >
                      <span
                        aria-hidden="true"
                        className="size-2.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"
                      />
                      <span>{t("onboardingSlugChecking")}</span>
                    </span>
                  )}
                  {(hasFormatError || isTaken) && (
                    <span
                      role="status"
                      className="inline-flex items-center gap-1 rounded-full bg-error-50 px-2 py-0.5 text-[11px] font-semibold text-error-700 ring-1 ring-inset ring-error-600/20 dark:bg-error-500/15 dark:text-error-300 dark:ring-error-400/25"
                    >
                      <span aria-hidden="true">✕</span>
                      <span>
                        {isTaken
                          ? t("onboardingSlugTakenBadge")
                          : t("onboardingSlugInvalidBadge")}
                      </span>
                    </span>
                  )}
                  {isSlugValidAndReady && (
                    <span
                      role="status"
                      className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700 ring-1 ring-inset ring-success-600/20 dark:bg-success-500/15 dark:text-success-300 dark:ring-success-400/25"
                    >
                      <span aria-hidden="true">✓</span>
                      <span>{t("onboardingSlugValidBadge")}</span>
                    </span>
                  )}
                </>
              )}
            </div>
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
            aria-invalid={hasFormatError || isTaken}
            aria-describedby="organization-slug-help"
            error={hasFormatError || isTaken}
            success={isSlugValidAndReady}
            placeholder={t("onboardingSlugPlaceholder")}
          />
          <p
            id="organization-slug-help"
            role={hasFormatError || isTaken ? "alert" : undefined}
            className={`mt-1.5 text-xs ${
              hasFormatError || isTaken
                ? "font-medium text-error-600 dark:text-error-400"
                : isSlugValidAndReady
                  ? "font-medium text-success-600 dark:text-success-400"
                  : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {hasFormatError && formatValidation.errorKey
              ? t(formatValidation.errorKey)
              : isTaken
                ? t("onboardingSlugTakenError")
                : isSlugValidAndReady
                  ? t("onboardingSlugAvailableHint", { slug })
                  : t("onboardingSlugHint")}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2.5 border-t border-gray-100 pt-4 dark:border-gray-800">
          <button
            type="button"
            disabled={disabled}
            onClick={onCancel}
            className="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-xl border border-gray-200/90 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {t("onboardingCreateCancel")}
          </button>
          <button
            type="submit"
            disabled={
              disabled ||
              !name.trim() ||
              !formatValidation.valid ||
              isTaken
            }
            className="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("onboardingCreateAction")}
          </button>
        </div>
      </form>
    </section>
  );
}
