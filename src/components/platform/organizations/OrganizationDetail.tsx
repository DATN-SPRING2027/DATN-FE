"use client";
import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import { TableSkeleton } from "../ui/LoadingSkeleton";
import type { PlatformOrganizationsViewProps } from "./types";
import type { PlatformOrganization } from "@/lib/queries/platform/usePlatformConsole";

export default function OrganizationDetail({
  organization,
  organizationId,
  canManage,
  onEdit,
}: {
  organization: PlatformOrganizationsViewProps["organization"];
  organizationId: string;
  canManage: boolean;
  onEdit: (org: PlatformOrganization) => void;
}) {
  const t = useTranslations("platformConsole");
  const locale = useLocale();
  const record =
    organization.data?.id === organizationId ? organization.data : undefined;
  const handledEdit = useRef("");
  useEffect(() => {
    if (
      canManage &&
      record &&
      !organization.isFetching &&
      !organization.isError &&
      window.location.hash === "#edit" &&
      handledEdit.current !== organizationId
    ) {
      handledEdit.current = organizationId;
      onEdit(record);
    }
  }, [
    canManage,
    record,
    organization.isFetching,
    organization.isError,
    organizationId,
    onEdit,
  ]);
  return (
    <section
      className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
      aria-busy={organization.isFetching}
    >
      <Link
        href="/platform/organizations"
        className="text-sm text-brand-600 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400"
      >
        {t("organizations.back")}
      </Link>
      {organization.isPending ? (
        <TableSkeleton rows={3} columns={2} />
      ) : organization.isError || !record ? (
        <p role="alert" className="text-error-600 dark:text-error-400">
          {t("errors.organizationDetail")}
        </p>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {record.name}
          </h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {[
              [t("organizations.slug"), record.slug],
              [t("organizations.plan"), record.plan],
              [t("organizations.id"), record.id],
              [
                t("organizations.created"),
                new Date(record.createdAt).toLocaleString(locale),
              ],
              [
                t("organizations.updated"),
                new Date(record.updatedAt).toLocaleString(locale),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                <dd className="mt-1 break-words text-gray-900 dark:text-white">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {canManage && (
            <Button
              disabled={organization.isFetching}
              onClick={() => onEdit(record)}
            >
              {t("organizations.edit")}
            </Button>
          )}
        </>
      )}
      <Button
        variant="outline"
        disabled={organization.isFetching}
        onClick={() => void organization.refetch()}
      >
        {t(organization.isFetching ? "refreshing" : "refresh")}
      </Button>
    </section>
  );
}
