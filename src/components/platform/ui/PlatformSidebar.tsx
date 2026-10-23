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
  LockIcon,
  BoltIcon,
  PlugInIcon,
  AlertIcon,
  SettingsIcon,
  ListIcon,
  TimeIcon,
} from "@/icons";
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
      { id: "security", icon: LockIcon },
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
  security: "platform.sessions.session.read",
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

  if (visibleGroups.length === 0) return null;

  return (
    <aside className={styles.sidebar}>
      <nav aria-label={t("operatorDesign.navigation")}>
        {visibleGroups.map((group) => (
          <div key={group.label ?? "primary"} className={styles.sidebarGroup}>
            {group.label && (
              <h2 className={styles.sidebarGroupLabel}>{group.label}</h2>
            )}
            {group.items.map(({ id, icon: Icon }) => (
              <Link
                key={id}
                href={
                  (id === "dashboard"
                    ? "/platform"
                    : `/platform/${id}`) as never
                }
                aria-current={activeSection === id ? "page" : undefined}
              >
                <Icon aria-hidden="true" />
                <span>{t(`navigation.${id}`)}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
