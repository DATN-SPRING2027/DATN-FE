"use client";

import { useState, type FormEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
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
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  InfoIcon,
  LockIcon,
  UserIcon,
} from "@/icons";

function getInitials(name: string, fallback = "OR"): string {
  const source = name.trim();
  const words = source.split(/[\s-_]+/).filter(Boolean);
  if (words.length > 1) {
    return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || fallback;
}

function getSettingsErrorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return "networkError";
  if (error.status === 403) return "forbiddenError";
  if (error.status === 409) return "conflictError";
  if (error.status === 422) return "validationError";
  return "saveError";
}

const PERMISSION_LABEL_KEYS: Record<string, string> = {
  "organization.memberships.read": "permOrgMembersRead",
  "org:read": "permOrgMembersRead",
  "organization.memberships.manage": "permOrgMembersManage",
  "org:update": "permOrgMembersManage",
  "member:invite": "permOrgMembersManage",
  "member:remove": "permOrgMembersManage",
  "role:assign": "permOrgMembersManage",
  "project.leader.manage": "permProjectLeaderManage",
  "project:create": "permProjectLeaderManage",
  "project.visibility.manage": "permProjectVisibilityManage",
  "project.members.list": "permProjectMembersList",
  "project.members.add": "permProjectMembersAdd",
  "project.members.remove": "permProjectMembersRemove",
};

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
  onRefetch: () => Promise<OrganizationSettingsSummary | undefined>;
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

  const formatTimestamp = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return format.dateTime(parsed, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const resetForm = () => {
    setName(organization.name);
    setDescription(organization.description ?? "");
    setValidationMessage(null);
    setSavedNotice(false);
    update.reset();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavedNotice(false);
    setValidationMessage(null);

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      setValidationMessage(t("nameValidation"));
      return;
    }

    if (trimmedDescription.length > 500) {
      setValidationMessage(t("descriptionValidation"));
      return;
    }

    try {
      const updated = await update.mutateAsync({
        name: trimmedName,
        description: trimmedDescription ? trimmedDescription : null,
        expectedUpdatedAt: organization.updatedAt,
      });
      setName(updated.organization.name);
      setDescription(updated.organization.description ?? "");
      setSavedNotice(true);
    } catch {
      // Mutation error banner renders below.
    }
  };

  const isConflict =
    update.isError &&
    update.error instanceof ApiError &&
    update.error.status === 409;

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
      {/* Card 1: Organization Profile + Compact Metadata Strip */}
      <section
        aria-labelledby="org-profile-form-heading"
        className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs sm:p-6 xl:col-span-7 dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-start gap-3.5">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm font-semibold text-brand-600 ring-1 ring-brand-500/15 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/20"
          >
            {getInitials(organization.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id="org-profile-form-heading"
                className="text-base font-semibold tracking-tight text-gray-900 dark:text-white"
              >
                {t("profileSectionTitle")}
              </h2>
              <span className="inline-flex items-center rounded-full border border-success-200 bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-700 dark:border-success-500/25 dark:bg-success-500/10 dark:text-success-300">
                {organization.status}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {t("profileSectionSubtitle")}
            </p>
          </div>
        </div>

        {/* Compact Read-Only Identity & Timestamps Strip */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3.5 py-2 dark:border-gray-800 dark:bg-gray-800/40">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md border border-gray-200/90 bg-white px-2 py-0.5 font-mono text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              @{organization.slug}
            </span>
            <span className="inline-flex items-center rounded-md border border-gray-200/90 bg-white px-2 py-0.5 text-[11px] font-semibold tracking-wide text-gray-700 uppercase dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              {organization.plan}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 tabular-nums dark:text-gray-400">
            <span>
              {t("createdAtLabel")}{" "}
              <strong className="font-medium text-gray-700 dark:text-gray-300">
                {formatTimestamp(organization.createdAt)}
              </strong>
            </span>
            <span
              aria-hidden="true"
              className="text-gray-300 dark:text-gray-700"
            >
              •
            </span>
            <span>
              {t("updatedAtLabel")}{" "}
              <strong className="font-medium text-gray-700 dark:text-gray-300">
                {formatTimestamp(organization.updatedAt)}
              </strong>
            </span>
          </div>
        </div>

        {savedNotice && (
          <div className="mt-4" role="status">
            <Alert
              variant="success"
              title={t("saveSuccess")}
              message={t("updatedAtLabel") + ": " + formatTimestamp(organization.updatedAt)}
            />
          </div>
        )}

        {validationMessage && (
          <div className="mt-4" role="alert">
            <Alert
              variant="warning"
              title={t("errorTitle")}
              message={validationMessage}
            />
          </div>
        )}

        {update.isError && (
          <div className="mt-4 space-y-3" role="alert">
            <Alert
              variant="error"
              title={t("errorTitle")}
              message={t(getSettingsErrorKey(update.error))}
            />
            {isConflict && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  const latest = await onRefetch();
                  if (latest) {
                    setName(latest.organization.name);
                    setDescription(latest.organization.description ?? "");
                    update.reset();
                  }
                }}
              >
                {t("reloadLatest")}
              </Button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="organization-name">{t("nameLabel")}</Label>
              <span className="mb-1.5 text-xs text-gray-400 tabular-nums dark:text-gray-500">
                {trimmedName.length}/100
              </span>
            </div>
            <input
              id="organization-name"
              name="name"
              type="text"
              required
              minLength={2}
              maxLength={100}
              disabled={!canEditName || update.isPending}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSavedNotice(false);
              }}
              placeholder={t("namePlaceholder")}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:disabled:bg-gray-800/60"
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {t("nameHelp")}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="organization-description">
                {t("descriptionLabel")}
              </Label>
              <span className="mb-1.5 text-xs text-gray-400 tabular-nums dark:text-gray-500">
                {trimmedDescription.length}/500
              </span>
            </div>
            <textarea
              id="organization-description"
              name="description"
              rows={3}
              maxLength={500}
              disabled={!canEditDescription || update.isPending}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setSavedNotice(false);
              }}
              placeholder={t("descriptionPlaceholder")}
              className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:disabled:bg-gray-800/60"
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {t("descriptionHelp")}
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
            <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <LockIcon
                viewBox="0 0 20 20"
                className="size-3.5 shrink-0 text-gray-400"
                aria-hidden="true"
              />
              <span>{t("platformGovernedFieldsNote")}</span>
            </p>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!isDirty || update.isPending}
                onClick={resetForm}
              >
                {t("discardChanges")}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!canEdit || !isDirty || update.isPending}
              >
                {update.isPending ? t("saving") : t("saveChanges")}
              </Button>
            </div>
          </div>
        </form>
      </section>

      {/* Card 2: Organization Managers + Collapsible Role Permissions */}
      <section
        aria-labelledby="org-managers-heading"
        className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs sm:p-6 xl:col-span-5 dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="org-managers-heading"
                className="text-base font-semibold tracking-tight text-gray-900 dark:text-white"
              >
                {t("managersSectionTitle")}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-600/15 ring-inset tabular-nums dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/25">
                <UserIcon
                  viewBox="0 0 20 20"
                  className="size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>{managers.length}</span>
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("managersSectionSubtitle")}
            </p>
          </div>

          <Link
            href="/organization/members"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold whitespace-nowrap text-gray-700 shadow-theme-xs transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <span>{t("manageMembersLink")}</span>
            <ArrowRightIcon
              viewBox="0 0 20 20"
              className="size-3.5 shrink-0 rtl:rotate-180"
              aria-hidden="true"
            />
          </Link>
        </div>

        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {managers.map((manager) => {
            const isSelf = manager.userId === actorId;
            return (
              <li
                key={manager.userId}
                className="flex items-center justify-between gap-3 py-3.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600 ring-1 ring-brand-500/15 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/20"
                  >
                    {getInitials(manager.fullName || manager.email, "MG")}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white/90">
                        {manager.fullName || manager.email}
                      </p>
                      {isSelf && (
                        <span className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                          {t("youBadge")}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {manager.email}
                    </p>
                  </div>
                </div>

                <span className="inline-flex shrink-0 items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  <RoleLabel roleCode="ADMIN" />
                </span>
              </li>
            );
          })}
        </ul>

        {isSoleManager && (
          <div className="mt-1 flex items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-800/40">
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-200/90 bg-white px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              <LockIcon
                viewBox="0 0 20 20"
                className="size-3 shrink-0 text-gray-500 dark:text-gray-400"
                aria-hidden="true"
              />
              <span>{t("soleManagerBadge")}</span>
            </span>
            <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
              {t("soleManagerWarning")}
            </p>
          </div>
        )}

        {availablePermissions.length > 0 && (
          <details className="group mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg py-1 text-xs font-medium text-gray-600 transition select-none hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
              <span className="tabular-nums">
                {t("permissionsSectionTitle", {
                  count: availablePermissions.length,
                })}
              </span>
              <ChevronDownIcon
                viewBox="0 0 20 20"
                className="size-4 shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>

            <div className="mt-2.5 space-y-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-800/30">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("permissionsSectionSubtitle")}
              </p>
              <ul className="space-y-1.5">
                {availablePermissions.map((permission) => {
                  const labelKey = PERMISSION_LABEL_KEYS[permission];
                  return (
                    <li
                      key={permission}
                      className="flex items-start justify-between gap-2 text-xs"
                    >
                      <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                        <CheckCircleIcon
                          viewBox="0 0 24 24"
                          className="size-3.5 shrink-0 text-success-600 dark:text-success-400"
                          aria-hidden="true"
                        />
                        <span>{labelKey ? t(labelKey) : permission}</span>
                      </span>
                      <code className="shrink-0 rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-gray-500 ring-1 ring-gray-200/80 dark:bg-gray-900 dark:text-gray-400 dark:ring-gray-700">
                        {permission}
                      </code>
                    </li>
                  );
                })}
              </ul>
            </div>
          </details>
        )}
      </section>
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

  const renderHeader = () => (
    <>
      <PageBreadcrumb
        pageTitle={t("title")}
        homeLabel={t("home")}
        breadcrumbLabel={t("breadcrumbLabel")}
        items={[{ label: t("organizationBreadcrumb") }]}
        showTitle={false}
      />

      <header className="border-b border-gray-200 pb-4 dark:border-gray-800">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl dark:text-white">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t("description")}
        </p>
      </header>
    </>
  );

  if (currentUser.isLoading || (validOrg && canManage && settings.isLoading)) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
        {t("loading")}
      </div>
    );
  }

  if (!user || !validOrg) {
    return (
      <div className="space-y-5">
        {renderHeader()}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
          <InfoIcon
            viewBox="0 0 24 24"
            className="mx-auto size-8 text-gray-400"
          />
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {t("noOrganization")}
          </p>
        </div>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="space-y-5">
        {renderHeader()}
        <div role="alert">
          <Alert
            variant="warning"
            title={t("errorTitle")}
            message={t("forbiddenError")}
          />
        </div>
      </div>
    );
  }

  if (settings.isError || !settings.data) {
    return (
      <div className="space-y-5">
        {renderHeader()}
        <div className="space-y-4" role="alert">
          <Alert
            variant="error"
            title={t("errorTitle")}
            message={t(getSettingsErrorKey(settings.error))}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => settings.refetch()}
          >
            {t("retry")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {renderHeader()}
      <SettingsForm
        key={settings.data.organization.id}
        actorId={user.id}
        organizationId={organizationId}
        settings={settings.data}
        canEdit={canManage}
        onRefetch={async () => {
          const refreshed = await settings.refetch();
          return refreshed.data;
        }}
      />
    </div>
  );
}
