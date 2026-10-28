"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { SearchIcon, MailIcon, LockIcon, UserCircleIcon } from "@/icons";
import { Link } from "@/i18n/navigation";
import RoleLabel from "@/components/common/RoleLabel";
import PlatformPagination from "./PlatformPagination";
import useDirectoryPagination from "./useDirectoryPagination";
import StatusBadge from "./ui/StatusBadge";
import EmptyState from "./ui/EmptyState";
import PlatformAccountActivity from "./PlatformAccountActivity";
import jira from "./ui/jira.module.css";
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
  const profile = useTranslations("platformConsole.profile");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("permissions");
  const id = useId();
  const canReadActivity = account.permissions.includes("platform.audit.read");
  const tabs = canReadActivity ? ["permissions", "activity"] : ["permissions"];
  const selectedTab = tabs.includes(activeTab) ? activeTab : "permissions";
  const permissions = account.permissions.filter((permission) =>
    permission.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const pagination = useDirectoryPagination(permissions, search);
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
        {account.permissions.includes("platform.sessions.session.read") && (
          <Link href="/platform/security" className={styles.sessionsLink}>
            {profile("viewSessions")}
          </Link>
        )}
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
            <div>
              <dt>
                <LockIcon aria-hidden="true" />
                {t("account.permissionCount")}
              </dt>
              <dd>{account.permissions.length}</dd>
            </div>
          </dl>
        </aside>
        <div className={styles.workspace}>
          <div
            className={styles.tabs}
            role="tablist"
            aria-label={profile("sections")}
          >
            {tabs.map((tab, index) => (
              <button
                key={tab}
                id={`${id}-${tab}-tab`}
                type="button"
                role="tab"
                aria-selected={selectedTab === tab}
                tabIndex={selectedTab === tab ? 0 : -1}
                aria-controls={`${id}-${tab}-panel`}
                onClick={() => setActiveTab(tab)}
                onKeyDown={(event) => {
                  let next: string | undefined;
                  if (event.key === "ArrowLeft")
                    next = tabs[(index - 1 + tabs.length) % tabs.length];
                  if (event.key === "ArrowRight")
                    next = tabs[(index + 1) % tabs.length];
                  if (event.key === "Home") next = tabs[0];
                  if (event.key === "End") next = tabs[tabs.length - 1];
                  if (next) {
                    event.preventDefault();
                    setActiveTab(next);
                    document.getElementById(`${id}-${next}-tab`)?.focus();
                  }
                }}
              >
                {profile(tab)}
              </button>
            ))}
          </div>
          {selectedTab === "permissions" ? (
            <div
              role="tabpanel"
              id={`${id}-permissions-panel`}
              aria-labelledby={`${id}-permissions-tab`}
            >
              <h2 className="sr-only">{t("account.permissionTitle")}</h2>
              <div className={`${jira.toolbar} ${styles.search}`}>
                <label className={jira.searchField}>
                  <SearchIcon aria-hidden="true" />
                  <span className="sr-only">
                    {t("operations.searchPermissions")}
                  </span>
                  <input
                    type="search"
                    maxLength={100}
                    placeholder={t("operations.searchPermissions")}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
              </div>
              {pagination.rows.length ? (
                <ul className={styles.permissions}>
                  {pagination.rows.map((permission) => (
                    <li key={permission}>
                      <LockIcon aria-hidden="true" />
                      <span>{permission}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title={t("operations.noPermissions")} />
              )}
              <PlatformPagination
                {...pagination}
                alwaysShow
                ariaLabel={t("account.permissionTitle")}
                returnedItems={pagination.rows.length}
              />
            </div>
          ) : (
            <div
              role="tabpanel"
              id={`${id}-activity-panel`}
              aria-labelledby={`${id}-activity-tab`}
            >
              <PlatformAccountActivity operatorId={account.id} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
