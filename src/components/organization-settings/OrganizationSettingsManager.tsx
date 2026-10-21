"use client";

import { useState, type FormEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ApiError } from "@/lib/api-client";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { canManageOrganizationMemberships } from "@/lib/queries/organization-memberships/organization-membership-permissions";
import {
  isOrganizationResourceId,
  type OrganizationSettingsSummary,
} from "@/lib/queries/organization-memberships/organization-memberships.contract";
import {
  useOrganizationSettingsQuery,
  useUpdateOrganizationSettings,
} from "@/lib/queries/organization-memberships/useOrganizationMemberships";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import RoleLabel from "@/components/common/RoleLabel";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import {
  CheckCircleIcon,
  InfoIcon,
  LockIcon,
  SettingsIcon,
  UserIcon,
} from "@/icons";

function getInitials(name: string, email: string): string {
  const source = name.trim() || email.trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || "MG";
}

function getSettingsErrorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return "networkError";
  if (error.status === 403) return "forbiddenError";
  if (error.status === 409) return "conflictError";
  if (error.status === 422) return "validationError";
  return "saveError";
}

function SettingsForm({
  actorId,
  organizationId,
  settings,
  canEdit,
  onRefetch,
}: {
  actorId: string;
  organizationId: string;
  settings: OrganizationSettingsSummary;
  canEdit: boolean;
  onRefetch: () => void;
}) {
  const t = useTranslations("organizationSettings");
  const format = useFormatter();
  const update = useUpdateOrganizationSettings(actorId, organizationId);
  const { organization, editableFields, managers, availablePermissions } =
    settings;

  const [name, setName] = useState(organization.name);
  const [description, setDescription] = useState(
    organization.description ?? "",
  );
  const [savedNotice, setSavedNotice] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );

  const canEditName = canEdit && editableFields.includes("name");
  const canEditDescription = canEdit && editableFields.includes("description");
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const currentDescription = (organization.description ?? "").trim();
  const isDirty =
    trimmedName !== organization.name ||
    trimmedDescription !== currentDescription;
  const isSoleManager = managers.length <= 1;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavedNotice(false);
    setValidationMessage(null);
    if (!canEdit || update.isPending) return;
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 100) {
      setValidationMessage(t("nameValidation"));
      return;
    }
    if (trimmedDescription.length > 500) {
      setValidationMessage(t("descriptionValidation"));
      return;
    }
    try {
      const updated = await update.mutateAsync({
        expectedUpdatedAt: organization.updatedAt,
        name: trimmedName,
        description: trimmedDescription || null,
      });
      setName(updated.organization.name);
      setDescription(updated.organization.description ?? "");
      setSavedNotice(true);
    } catch {
      // Handled via update.error
    }
  }

  function handleReset() {
    update.reset();
    setValidationMessage(null);
    setSavedNotice(false);
    setName(organization.name);
    setDescription(organization.description ?? "");
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Left Column: Editable Profile Form */}
      <section
        aria-labelledby="org-profile-form-heading"
        className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs sm:p-6 xl:col-span-7 dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4 dark:border-gray-800">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
            >
              <SettingsIcon className="size-5" />
            </span>
            <div>
              <h2
                id="org-profile-form-heading"
                className="text-base font-semibold text-gray-900 dark:text-white/90"
              >
                {t("profileSectionTitle")}
              </h2>
              <p className="mt-1 text-xs text-gray-500 sm:text-sm dark:text-gray-400">
                {t("profileSectionSubtitle")}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center rounded-full border border-success-200 bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-700 dark:border-success-500/25 dark:bg-success-500/10 dark:text-success-400">
            {organization.status}
          </span>
        </div>

        {savedNotice && (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 flex items-center gap-2.5 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300"
          >
            <CheckCircleIcon className="size-4 shrink-0" aria-hidden="true" />
            <span>{t("saveSuccess")}</span>
          </div>
        )}

        {validationMessage && (
          <div className="mt-4" role="alert">
            <Alert
              variant="error"
              title={t("errorTitle")}
              message={validationMessage}
            />
          </div>
        )}

        {update.isError && (
          <div className="mt-4 space-y-2" role="alert">
            <Alert
              variant="error"
              title={t("errorTitle")}
              message={t(getSettingsErrorKey(update.error))}
            />
            <Button size="sm" variant="outline" onClick={onRefetch}>
              {t("reloadLatest")}
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div>
            <Label htmlFor="organization-settings-name">
              {t("nameLabel")}
            </Label>
            <input
              id="organization-settings-name"
              type="text"
              required
              maxLength={100}
              disabled={!canEditName || update.isPending}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSavedNotice(false);
                setValidationMessage(null);
              }}
              placeholder={t("namePlaceholder")}
              className="mt-1.5 h-11 w-full rounded-xl border border-gray-300 bg-white px-3.5 text-sm text-gray-900 shadow-theme-xs transition focus:border-brand-400 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            />
            <div className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{t("nameHelp")}</span>
              <span className="tabular-nums">{name.length}/100</span>
            </div>
          </div>

          <div>
            <Label htmlFor="organization-settings-description">
              {t("descriptionLabel")}
            </Label>
            <textarea
              id="organization-settings-description"
              rows={4}
              maxLength={500}
              disabled={!canEditDescription || update.isPending}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setSavedNotice(false);
                setValidationMessage(null);
              }}
              placeholder={t("descriptionPlaceholder")}
              className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-theme-xs transition focus:border-brand-400 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            />
            <div className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{t("descriptionHelp")}</span>
              <span className="tabular-nums">{description.length}/500</span>
            </div>
          </div>

          {/* Read-only Platform-Governed Fields */}
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-gray-100 bg-gray-50/70 p-4 sm:grid-cols-2 dark:border-gray-800 dark:bg-gray-800/40">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("slugLabel")}
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-gray-800 dark:text-gray-200">
                @{organization.slug}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("planLabel")}
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
                {organization.plan}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("createdAtLabel")}
              </p>
              <p className="mt-1 text-xs font-medium text-gray-700 tabular-nums dark:text-gray-300">
                {format.dateTime(new Date(organization.createdAt), {
                  dateStyle: "medium",
                  timeZone: "UTC",
                })}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("updatedAtLabel")}
              </p>
              <p className="mt-1 text-xs font-medium text-gray-700 tabular-nums dark:text-gray-300">
                {format.dateTime(new Date(organization.updatedAt), {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "UTC",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-gray-200 bg-gray-50/80 px-3.5 py-3 text-xs leading-5 text-gray-600 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-300">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-gray-500 dark:text-gray-400"
              aria-hidden="true"
            />
            <p>{t("platformGovernedFieldsNote")}</p>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
              <Button
                type="button"
                variant="outline"
                disabled={!isDirty || update.isPending}
                onClick={handleReset}
              >
                {t("discardChanges")}
              </Button>
              <Button type="submit" disabled={!isDirty || update.isPending}>
                {update.isPending ? t("saving") : t("saveChanges")}
              </Button>
            </div>
          )}
        </form>
      </section>

      {/* Right Column: Active Managers & Governance Permissions */}
      <div className="space-y-6 xl:col-span-5">
        <section
          aria-labelledby="org-settings-managers-heading"
          className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
            <div>
              <h2
                id="org-settings-managers-heading"
                className="text-base font-semibold text-gray-900 dark:text-white/90"
              >
                {t("managersSectionTitle")}
              </h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("managersSectionSubtitle")}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 tabular-nums dark:bg-brand-500/15 dark:text-brand-300">
              <UserIcon className="size-3.5" aria-hidden="true" />
              <span>{managers.length}</span>
            </span>
          </div>

          {isSoleManager && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-warning-200 bg-warning-50/70 px-3.5 py-2.5 text-xs leading-5 text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
              <LockIcon
                className="mt-0.5 size-4 shrink-0 text-warning-600 dark:text-warning-400"
                aria-hidden="true"
              />
              <p>{t("soleManagerWarning")}</p>
            </div>
          )}

          <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
            {managers.map((manager) => (
              <li
                key={manager.userId}
                className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                  >
                    {getInitials(manager.fullName, manager.email)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white/90">
                      {manager.fullName || manager.email}
                    </p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {manager.email}
                    </p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  <RoleLabel roleCode="ADMIN" />
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="org-settings-permissions-heading"
          className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900"
        >
          <h2
            id="org-settings-permissions-heading"
            className="text-base font-semibold text-gray-900 dark:text-white/90"
          >
            {t("permissionsSectionTitle")}
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t("permissionsSectionSubtitle")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {availablePermissions.map((permission) => (
              <span
                key={permission}
                className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 font-mono text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                {permission}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function OrganizationSettingsManager() {
  const t = useTranslations("organizationSettings");
  const currentUser = useCurrentUserQuery();
  const user = currentUser.data;
  const organizationId = user?.organizationId ?? "";
  const canManage = canManageOrganizationMemberships(user);
  const validOrg = Boolean(
    user && organizationId && isOrganizationResourceId(organizationId),
  );
  const settings = useOrganizationSettingsQuery(
    user?.id ?? "",
    organizationId,
    validOrg && canManage,
  );

  if (currentUser.isPending || (validOrg && canManage && settings.isPending)) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-gray-200 bg-white px-5 py-8 text-center text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
      >
        {t("loading")}
      </div>
    );
  }

  if (!validOrg) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-warning-200 bg-warning-50 px-5 py-8 text-sm text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300"
      >
        {t("noOrganization")}
      </div>
    );
  }

  if (!canManage) {
    return (
      <div role="alert" className="space-y-4">
        <Alert
          variant="error"
          title={t("errorTitle")}
          message={t("forbiddenError")}
        />
      </div>
    );
  }

  if (settings.isError || !settings.data) {
    return (
      <div role="alert" className="space-y-3">
        <Alert
          variant="error"
          title={t("errorTitle")}
          message={t(getSettingsErrorKey(settings.error))}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void settings.refetch();
          }}
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageBreadcrumb
        pageTitle={t("title")}
        homeLabel={t("home")}
        breadcrumbLabel={t("breadcrumbLabel")}
        items={[{ label: t("organizationBreadcrumb") }]}
        showTitle={false}
      />

      <header className="border-b border-gray-200 pb-5 dark:border-gray-800">
        <p className="text-sm font-medium text-brand-600 dark:text-brand-400">
          {t("organizationScope")}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white/90">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">
          {t("description")}
        </p>
      </header>

      <SettingsForm
        key={settings.data.organization.id}
        actorId={user!.id}
        organizationId={organizationId}
        settings={settings.data}
        canEdit={canManage}
        onRefetch={() => {
          void settings.refetch();
        }}
      />
    </div>
  );
}
