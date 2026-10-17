"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRightIcon } from "@/icons";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import styles from "./landing.module.css";

interface WorkspaceLinkProps {
  subtle?: boolean;
  compact?: boolean;
}

export default function WorkspaceLink({
  subtle = false,
  compact = false,
}: WorkspaceLinkProps) {
  const t = useTranslations("landingRylo");
  const user = useCurrentUserQuery();
  if (user.isPending) {
    return (
      <span
        className={styles.sessionLoading}
        role="status"
        aria-label={t("sessionLoading")}
        aria-busy="true"
      />
    );
  }
  const href = user.data
    ? user.data.context === "ACCOUNT"
      ? "/onboarding"
      : "/dashboard"
    : "/signin";
  return (
    <Link href={href} className={subtle ? styles.textLink : styles.button}>
      {t(user.data ? (compact ? "workspaceShort" : "workspace") : "signin")}
      <ArrowRightIcon aria-hidden="true" className={styles.arrow} />
    </Link>
  );
}
