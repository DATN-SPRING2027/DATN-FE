"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePlatformOrganizationsQuery } from "@/lib/queries/platform/usePlatformConsole";
import OrganizationDirectory from "../organizations/OrganizationDirectory";
import styles from "../ui/operator.module.css";
export default function OverviewOrganizations({
  allowed,
  canManage = false,
}: {
  allowed: boolean;
  canManage?: boolean;
}) {
  const t = useTranslations("platformConsole");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const query = usePlatformOrganizationsQuery(allowed, page, pageSize);
  return (
    <div className={styles.orgPanel}>
      {allowed ? (
        <OrganizationDirectory
          organizations={query}
          canManage={canManage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          setOrganizationPage={setPage}
        />
      ) : (
        <>
          <h2 className={styles.heading}>{t("dashboard.organizations")}</h2>
          <p role="status" className={styles.empty}>
            {t("pages.organizations.readPermissionNeeded")}
          </p>
        </>
      )}
    </div>
  );
}
