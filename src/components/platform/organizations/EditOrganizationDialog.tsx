"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { ApiError } from "@/lib/api-client";
import type { PlatformOrganization } from "@/lib/queries/platform/usePlatformConsole";
import type { PlatformOrganizationsViewProps } from "./types";
import OrganizationDialog from "./OrganizationDialog";

export default function EditOrganizationDialog({
  target,
  mutation,
  onClose,
  onSaved,
}: {
  target: PlatformOrganization;
  mutation: PlatformOrganizationsViewProps["changeOrganizationMetadata"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("platformConsole");
  const [name, setName] = useState(target.name);
  const [slug, setSlug] = useState(target.slug);
  const [errorKey, setErrorKey] = useState("");
  const [conflicted, setConflicted] = useState(false);
  const changed = name.trim() !== target.name || slug.trim() !== target.slug;
  return (
    <OrganizationDialog
      title={t("organizations.edit")}
      pending={mutation.isPending}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (mutation.isPending || conflicted || !changed) return;
          setErrorKey("");
          try {
            await mutation.mutateAsync({
              organizationId: target.id,
              name: name.trim(),
              slug: slug.trim(),
              expectedUpdatedAt: target.updatedAt,
              reasonCode: "ACCESS_REVIEW",
            });
            onSaved();
          } catch (error) {
            const conflict = error instanceof ApiError && error.status === 409;
            setConflicted(conflict);
            setErrorKey(
              conflict
                ? "errors.organizationConflict"
                : "errors.organizationUpdate",
            );
          }
        }}
      >
        {errorKey && (
          <p
            role="alert"
            className="text-sm text-error-600 dark:text-error-400"
          >
            {t(errorKey)}
          </p>
        )}
        <fieldset
          className="space-y-4"
          disabled={mutation.isPending || conflicted}
        >
          <div>
            <Label htmlFor="edit-org-name">{t("organizations.name")}</Label>
            <Input
              id="edit-org-name"
              value={name}
              maxLength={200}
              required
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="edit-org-slug">{t("organizations.slug")}</Label>
            <Input
              id="edit-org-slug"
              value={slug}
              maxLength={100}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
              onChange={(event) => setSlug(event.target.value.toLowerCase())}
            />
          </div>
        </fieldset>
        <Button
          type="submit"
          disabled={
            !changed || !name.trim() || mutation.isPending || conflicted
          }
        >
          {t(
            mutation.isPending ? "organizations.saving" : "organizations.save",
          )}
        </Button>
        {conflicted && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("organizations.reloadBeforeEdit")}
          </p>
        )}
      </form>
    </OrganizationDialog>
  );
}
