"use client";
import OverviewOrganizations from "../overview/OverviewOrganizations";
import styles from "../ui/operator.module.css";
export default function InvoicesCard({
  allowed,
  canManage,
}: {
  allowed: boolean;
  canManage: boolean;
}) {
  return (
    <div className={`${styles.dribbbleCard} ${styles.directoryCard}`}>
      <OverviewOrganizations allowed={allowed} canManage={canManage} />
    </div>
  );
}
