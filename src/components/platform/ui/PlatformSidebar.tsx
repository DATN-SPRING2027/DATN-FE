"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
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
];
export default function PlatformSidebar({
  activeSection,
}: {
  activeSection: string;
}) {
  const t = useTranslations("platformConsole");
  return (
    <aside className={styles.sidebar}>
      <nav aria-label={t("operatorDesign.navigation")}>
        {groups.map((group) => (
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
