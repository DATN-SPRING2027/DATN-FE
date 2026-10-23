"use client";
import { useRouter } from "@/i18n/navigation";
import OrganizationDialog from "./organizations/OrganizationDialog";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { PlatformOrganization } from "@/lib/queries/platform/usePlatformConsole";
import OrganizationDirectory from "./organizations/OrganizationDirectory";
import OrganizationDetail from "./organizations/OrganizationDetail";
import CreateOrganizationDialog from "./organizations/CreateOrganizationDialog";
import EditOrganizationDialog from "./organizations/EditOrganizationDialog";
import type { PlatformOrganizationsViewProps } from "./organizations/types";

export default function PlatformOrganizationsView(
  p: PlatformOrganizationsViewProps,
) {
  const router = useRouter();
  const t = useTranslations("platformConsole");
  const [editing, setEditing] = useState<PlatformOrganization | null>(null);
  return (
    <div className="space-y-6">
      {p.canReadOrganizations && (
        <OrganizationDirectory
          organizations={p.organizations}
          canManage={p.canManageOrganizations}
          onCreate={
            p.canCreateOrganization
              ? () => p.setIsCreateModalOpen(true)
              : undefined
          }
          setOrganizationPage={p.setOrganizationPage}
        />
      )}
      {p.canReadOrganizations &&
        p.routeOrganizationId &&
        (p.hasValidRouteOrganizationId ? (
          !editing && (
            <OrganizationDialog
              detail
              title={t("organizations.view")}
              pending={false}
              onClose={() => router.replace("/platform/organizations")}
            >
              <OrganizationDetail
                organization={p.organization}
                organizationId={p.routeOrganizationId}
                canManage={p.canManageOrganizations}
                onEdit={setEditing}
              />
            </OrganizationDialog>
          )
        ) : (
          <p role="alert" className="text-error-600 dark:text-error-400">
            {t("errors.invalidOrganizationId")}
          </p>
        ))}
      {!p.canReadOrganizations &&
        p.canCreateOrganization &&
        !p.routeOrganizationId && (
          <button
            type="button"
            className="ml-auto block rounded border border-gray-200 bg-transparent px-3 py-1.5 text-sm dark:border-gray-700"
            onClick={() => p.setIsCreateModalOpen(true)}
          >
            {t("organizations.create")}
          </button>
        )}
      {p.canCreateOrganization && p.isCreateModalOpen && (
        <CreateOrganizationDialog {...p} />
      )}
      {p.canManageOrganizations && editing && (
        <EditOrganizationDialog
          key={editing.id}
          target={editing}
          mutation={p.changeOrganizationMetadata}
          onClose={() => {
            if (p.routeOrganizationId)
              router.replace(
                `/platform/organizations/${p.routeOrganizationId}`,
              );
            setEditing(null);
          }}
          onSaved={() => {
            if (p.routeOrganizationId)
              router.replace(
                `/platform/organizations/${p.routeOrganizationId}`,
              );
            setEditing(null);
            p.setOperationMessage(t("results.organizationUpdated"));
            void p.organization.refetch();
          }}
        />
      )}
    </div>
  );
}
