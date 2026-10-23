"use client";
import type { ReactNode } from "react";
import styles from "./jira.module.css";
export default function PageHeader({
  title,
  description,
  badge,
  actions,
  hideTitle = false,
}: {
  title: string;
  hideTitle?: boolean;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div className={hideTitle ? "sr-only" : "space-y-2"}>
        <div className="flex items-center gap-3">
          <h1 className={styles.pageTitle}>{title}</h1>
          {badge}
        </div>
        {description && <p className="sr-only">{description}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
