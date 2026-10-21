"use client";
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
  const t = useTranslations("platformConsole");
  const [editing, setEditing] = useState<PlatformOrganization | null>(null);
  return (
    <div className="space-y-6">
      {p.canReadOrganizations &&
        (p.routeOrganizationId ? (
          p.hasValidRouteOrganizationId ? (
            <OrganizationDetail
              organization={p.organization}
              organizationId={p.routeOrganizationId}
              canManage={p.canManageOrganizations}
              onEdit={setEditing}
            />
          ) : (
            <p role="alert" className="text-error-600 dark:text-error-400">
              {t("errors.invalidOrganizationId")}
            </p>
          )
        ) : (
          <OrganizationDirectory
            organizations={p.organizations}
            canManage={p.canManageOrganizations}
            setOrganizationPage={p.setOrganizationPage}
          />
        ))}
      {p.canCreateOrganization && p.isCreateModalOpen && (
        <CreateOrganizationDialog {...p} />
      )}
      {p.canManageOrganizations && editing && (
        <EditOrganizationDialog
          key={editing.id}
          target={editing}
          mutation={p.changeOrganizationMetadata}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            p.setOperationMessage(t("results.organizationUpdated"));
            void p.organization.refetch();
          }}
        />
      )}
    </div>
  );
}
