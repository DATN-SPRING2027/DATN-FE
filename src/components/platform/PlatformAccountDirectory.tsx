"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { MailIcon, LockIcon, UserCircleIcon } from "@/icons";
import RoleLabel from "@/components/common/RoleLabel";
import StatusBadge from "./ui/StatusBadge";
import styles from "./PlatformAccountDirectory.module.css";

export default function PlatformAccountDirectory({
  account,
}: {
  account: {
    id: string;
    name: string;
    email: string;
    context: string;
    permissions: readonly string[];
  };
}) {
  const t = useTranslations("platformConsole");
  const id = useId();
  const initials = account.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <section className={styles.profile}>
      <header className={styles.hero}>
        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">
            {initials || "?"}
          </span>
          <div>
            <h2 className={styles.name}>{account.name}</h2>
            <p className={styles.subtitle}>
              <RoleLabel roleCode="PLATFORM_OPERATOR" />
              <span aria-hidden="true">·</span>
              <StatusBadge status="ACTIVE" />
            </p>
          </div>
        </div>
      </header>
      <div className={styles.columns}>
        <aside className={styles.details} aria-labelledby={`${id}-details`}>
          <h2 id={`${id}-details`}>{t("account.identityTitle")}</h2>
          <dl className={styles.detailList}>
            <div>
              <dt>
                <MailIcon aria-hidden="true" />
                {t("account.email")}
              </dt>
              <dd>{account.email}</dd>
            </div>
            <div>
              <dt>
                <UserCircleIcon aria-hidden="true" />
                {t("account.context")}
              </dt>
              <dd>{account.context}</dd>
            </div>
            <div>
              <dt>
                <LockIcon aria-hidden="true" />
                {t("account.sessionStatus")}
              </dt>
              <dd>
                <StatusBadge status="ACTIVE" />
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
