"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  PlatformBuildingIcon,
  PlatformUsersIcon,
  PlatformProjectsIcon,
} from "@/icons";
import styles from "../ui/jira.module.css";
const icons = {
  organizations: PlatformBuildingIcon,
  users: PlatformUsersIcon,
  projects: PlatformProjectsIcon,
  memberships: PlatformUsersIcon,
};
export default function DeliveriesCard({
  metrics,
}: {
  metrics: readonly { id: keyof typeof icons; value: number }[];
}) {
  const t = useTranslations("platformConsole");
  const locale = useLocale();
  return (
    <section className={styles.summary} aria-label={t("dashboard.summary")}>
      <dl>
        {metrics.map((metric) => {
          const Icon = icons[metric.id];
          return (
            <div key={metric.id} className={styles.metric}>
              <Icon aria-hidden="true" />
              <div>
                <dt>{t(`dashboard.${metric.id}`)}</dt>
                <dd>{metric.value.toLocaleString(locale)}</dd>
              </div>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
