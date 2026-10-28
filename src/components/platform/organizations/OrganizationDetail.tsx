"use client";
import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import dialog from "../ui/platformDialog.module.css";
import Button from "@/components/ui/button/Button";
import { TableSkeleton } from "../ui/LoadingSkeleton";
import type { PlatformOrganizationsViewProps } from "./types";
import type { PlatformOrganization } from "@/lib/queries/platform/usePlatformConsole";
import {
  isReadAccessLost,
  QueryRefreshStatus,
} from "@/components/platform/PlatformOperationsUi";

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
  const accessLost = isReadAccessLost(organization.error);
  const handledEdit = useRef("");
  useEffect(() => {
    if (
      canManage &&
      record &&
      !organization.isFetching &&
      !organization.isError &&
      !accessLost &&
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
    accessLost,
    organizationId,
    onEdit,
  ]);
  return (
    <section
      className={dialog.organizationDetail}
      aria-busy={organization.isFetching}
    >
      <Link
        href="/platform/organizations"
        className="text-sm text-brand-600 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400"
      >
        {t("organizations.back")}
      </Link>
      {record &&
        !accessLost &&
        (organization.isFetching || organization.isRefetchError) && (
          <div className="my-3">
            <QueryRefreshStatus
              hasData
              isFetching={organization.isFetching}
              isRefetchError={organization.isRefetchError ?? false}
              onRetry={() => void organization.refetch()}
            />
          </div>
        )}
      {organization.isPending && !record ? (
        <TableSkeleton rows={3} columns={2} />
      ) : (organization.isError && (!record || accessLost)) || !record ? (
        <p role="alert" className="text-error-600 dark:text-error-400">
          {t("errors.organizationDetail")}
        </p>
      ) : (
        <div className={dialog.detailGrid}>
          <div className={dialog.detailMain}>
            <h2 className={dialog.recordTitle}>{record.name}</h2>
            <h3>{t("organizations.slug")}</h3>
            <p className={dialog.descriptionBlock}>{record.slug}</p>
            <div className={dialog.detailActions}>
              {canManage && (
                <Button
                  disabled={organization.isFetching}
                  onClick={() => onEdit(record)}
                >
                  {t("organizations.edit")}
                </Button>
              )}{" "}
            </div>
          </div>
          <aside className={dialog.detailAside}>
            <h3>{t("organizations.details")}</h3>
            <dl className={dialog.detailList}>
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
          </aside>
        </div>
      )}
    </section>
  );
}
