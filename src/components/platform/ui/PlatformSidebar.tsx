"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { PlatformPermission } from "@/lib/queries/platform/usePlatformConsole";
import {
  PlatformHomeIcon,
  PlatformBuildingIcon,
  PlatformUsersIcon,
  PlatformProjectsIcon,
  PlatformServerIcon,
  GridIcon,
  GroupIcon,
  BoltIcon,
  PlugInIcon,
  AlertIcon,
  SettingsIcon,
  ListIcon,
  TimeIcon,
} from "@/icons";
import PlatformWorkspaceSwitcher from "./PlatformWorkspaceSwitcher";
import {
  buildPlatformWorkspaceHref,
  useOrganizationUrlFilter,
} from "./organizationUrlFilter";
import styles from "./jira.module.css";

const groups = [
  {
    label: null,
    items: [
      { id: "dashboard", icon: PlatformHomeIcon },
      { id: "organizations", icon: PlatformBuildingIcon },
      { id: "users", icon: PlatformUsersIcon },
    ],
  },
  {
    label: "Workspace",
    items: [
      { id: "projects", icon: PlatformProjectsIcon },
      { id: "memberships", icon: GroupIcon },
    ],
  },
  {
    label: "Platform",
    items: [
      { id: "services", icon: PlatformServerIcon },
      { id: "jobs", icon: TimeIcon },
      { id: "ai", icon: BoltIcon },
      { id: "integrations", icon: PlugInIcon },
    ],
  },
  {
    label: "Administration",
    items: [
      { id: "incidents", icon: AlertIcon },
      { id: "diagnostics", icon: GridIcon },
      { id: "audit", icon: ListIcon },
      { id: "account", icon: SettingsIcon },
    ],
  },
] as const;
type NavigationSection = (typeof groups)[number]["items"][number]["id"];
const permissionBySection: Record<NavigationSection, PlatformPermission> = {
  dashboard: "platform.dashboard.summary.read",
  organizations: "platform.organizations.organization.read",
  users: "platform.users.account.read",
  projects: "platform.projects.project.read",
  memberships: "platform.memberships.membership.read",
  services: "platform.services.service.read",
  jobs: "platform.jobs.job.read",
  ai: "platform.ai.operations.read",
  integrations: "platform.integrations.integration.read",
  incidents: "platform.incidents.incident.read",
  diagnostics: "platform.diagnostics.trace.read",
  audit: "platform.audit.read",
  account: "platform.sessions.session.read",
};
export default function PlatformSidebar({
  activeSection,
  permissions,
}: {
  activeSection: string;
  permissions: readonly PlatformPermission[];
}) {
  const t = useTranslations("platformConsole");
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter(({ id }) =>
        permissions.includes(permissionBySection[id]),
      ),
    }))
    .filter((group) => group.items.length > 0);
  const hasWorkspaceGroup = visibleGroups.some(
    (group) => group.label === "Workspace",
  );
  const selectedOrgId = useOrganizationUrlFilter(hasWorkspaceGroup);

  if (visibleGroups.length === 0) return null;

  return (
    <aside className={styles.sidebar}>
      <nav aria-label={t("operatorDesign.navigation")}>
        {visibleGroups.map((group) => {
          const isWorkspace = group.label === "Workspace";
          const links = group.items.map(({ id, icon: Icon }) => {
            const baseHref =
              id === "dashboard" ? "/platform" : `/platform/${id}`;
            const href = isWorkspace
              ? buildPlatformWorkspaceHref(baseHref, {
                  organizationId: selectedOrgId,
                })
              : baseHref;
            return (
              <Link
                key={id}
                href={href as never}
                aria-current={activeSection === id ? "page" : undefined}
              >
                <Icon aria-hidden="true" />
                <span>{t(`navigation.${id}`)}</span>
              </Link>
            );
          });

          return (
            <div
              key={group.label ?? "primary"}
              className={
                isWorkspace
                  ? `${styles.sidebarGroup} ${styles.sidebarGroupWorkspace}`
                  : styles.sidebarGroup
              }
            >
              {group.label && (
                <h2 className={styles.sidebarGroupLabel}>{group.label}</h2>
              )}
              {isWorkspace && (
                <PlatformWorkspaceSwitcher
                  activeSection={activeSection}
                  permissions={permissions}
                />
              )}
              {isWorkspace ? (
                <div className={styles.workspaceLinksRow}>{links}</div>
              ) : (
                links
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
