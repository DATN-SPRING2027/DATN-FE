"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import dialog from "../ui/platformDialog.module.css";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import OrganizationDialog from "./OrganizationDialog";
import type { PlatformOrganizationsViewProps } from "./types";

export default function CreateOrganizationDialog(
  p: PlatformOrganizationsViewProps,
) {
  const t = useTranslations("platformConsole");
  const [failed, setFailed] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);
  const selected =
    p.selectedUser?.email.toLowerCase() === p.lookupEmail.trim().toLowerCase()
      ? p.selectedUser
      : null;
  const pending = p.createOrganizationPending || p.lookupPending;
  return (
    <OrganizationDialog
      title={t("organizations.createTitle")}
      pending={pending}
      onClose={() => p.setIsCreateModalOpen(false)}
    >
      <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
        {t("organizations.createHelp")}
      </p>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setFailed(false);
          const success = await p.runCreateOrganization(event);
          if (success) p.setIsCreateModalOpen(false);
          else setFailed(true);
        }}
      >
        {failed && (
          <p
            role="alert"
            className="text-sm text-error-600 dark:text-error-400"
          >
            {t("errors.organizationCreate")}
          </p>
        )}
        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="platform-org-name">{t("organizations.name")}</Label>
            <Input
              id="platform-org-name"
              value={p.organizationName}
              maxLength={200}
              required
              onChange={(event) => p.setOrganizationName(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="platform-org-slug">{t("organizations.slug")}</Label>
            <Input
              id="platform-org-slug"
              value={p.organizationSlug}
              maxLength={100}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
              onChange={(event) =>
                p.setOrganizationSlug(event.target.value.toLowerCase())
              }
            />
          </div>
          <div>
            <Label htmlFor="platform-org-plan">{t("organizations.plan")}</Label>
            <select
              id="platform-org-plan"
              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-800 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              value={p.organizationPlan}
              onChange={(event) =>
                p.setOrganizationPlan(
                  event.target.value as "FREE" | "ENTERPRISE",
                )
              }
            >
              <option value="FREE">FREE</option>
              <option value="ENTERPRISE">ENTERPRISE</option>
            </select>
          </div>
        </fieldset>
        {p.canLookupUsers ? (
          <fieldset
            disabled={pending}
            className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800"
          >
            <legend className="text-sm text-gray-900 dark:text-white">
              {t("organizations.firstAdminLabel")}
            </legend>
            <Label htmlFor="first-admin-email">
              {t("organizations.firstAdminEmail")}
            </Label>
            <Input
              id="first-admin-email"
              type="email"
              maxLength={254}
              required
              value={p.lookupEmail}
              onChange={(event) => {
                p.setLookupEmail(event.target.value);
                p.setSelectedUser(null);
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={
                pending ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.lookupEmail.trim())
              }
              onClick={async () => {
                setLookupFailed(false);
                setLookupFailed(!(await p.runLookup()));
              }}
            >
              {t(
                p.lookupPending ? "lookingUp" : "organizations.findFirstAdmin",
              )}
            </Button>
            {lookupFailed && (
              <p
                role="alert"
                className="text-sm text-error-600 dark:text-error-400"
              >
                {t("errors.userLookup")}
              </p>
            )}
            {selected && (
              <p
                role="status"
                className="text-sm text-success-700 dark:text-success-400"
              >
                {t("organizations.selectedAdmin", {
                  name: selected.fullName,
                  email: selected.email,
                })}
              </p>
            )}
          </fieldset>
        ) : (
          <p role="status" className="text-sm text-gray-500 dark:text-gray-400">
            {t("users.accountLookupPermissionNeeded")}
          </p>
        )}
        <footer className={dialog.footer}>
          <Button
            type="submit"
            disabled={
              !p.canLookupUsers ||
              !selected ||
              pending ||
              !p.organizationName.trim() ||
              !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.organizationSlug)
            }
          >
            {t(
              p.createOrganizationPending
                ? "organizations.creating"
                : "organizations.create",
            )}
          </Button>
        </footer>
      </form>
    </OrganizationDialog>
  );
}
