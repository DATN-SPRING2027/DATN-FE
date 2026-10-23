"use client";
import DirectorySelect from "./ui/DirectorySelect";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SearchIcon } from "@/icons";
import PlatformPageControls from "./ui/PlatformPageControls";
import jira from "./ui/jira.module.css";
import EmptyState from "./ui/EmptyState";
import { TableSkeleton } from "./ui/LoadingSkeleton";
import MembershipTable from "./memberships/MembershipTable";
import styles from "./memberships/MembershipDirectory.module.css";
import {
  usePlatformMembershipDirectoryQuery,
  type PlatformMembership,
} from "@/lib/queries/platform/usePlatformConsole";

type Props = Readonly<{
  canReadMemberships: boolean;
  canSuspendMemberships: boolean;
  currentUserId: string;
  onSuspend: (membership: PlatformMembership) => void;
}>;

const statuses = [
  "",
  "ACTIVE",
  "SUSPENDED",
  "PENDING_INVITE",
  "REMOVED",
] as const;

export default function PlatformMembershipDirectory(props: Props) {
  const t = useTranslations("platformConsole");
  const locale = useLocale();
  const [sort, setSort] = useState("name");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PlatformMembership["status"] | "">("");
  // Keep a page scoped to its filters; changing scope cannot reuse the previous page.
  const scope = JSON.stringify([search, status]);
  const [pageState, setPageState] = useState({ scope, page: 1 });
  const page = pageState.scope === scope ? pageState.page : 1;
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const memberships = usePlatformMembershipDirectoryQuery(
    { page, search, status, organizationId: "" },
    props.canReadMemberships,
  );
  const pagination = memberships.data?.pagination;
  const collator = new Intl.Collator(locale, {
    numeric: true,
    sensitivity: "base",
  });
  const rows = [...(memberships.data?.data ?? [])].sort((a, b) => {
    const byName = collator.compare(
      a.user?.fullName ?? "",
      b.user?.fullName ?? "",
    );
    const order =
      sort === "updated"
        ? Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
        : sort === "email"
          ? collator.compare(a.user?.email ?? "", b.user?.email ?? "")
          : byName;
    return (
      order ||
      byName ||
      collator.compare(
        a.organization?.name ?? "",
        b.organization?.name ?? "",
      ) ||
      a.id.localeCompare(b.id)
    );
  });

  return (
    <section
      className={`${jira.directory} ${styles.directory}`}
      aria-labelledby="membership-directory-title"
    >
      <header className="sr-only">
        <h1 id="membership-directory-title">{t("pages.memberships.title")}</h1>
      </header>

      <div
        className={jira.tabs}
        role="group"
        aria-label={t("memberships.statusFilter")}
      >
        {statuses.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {value ? t(`membershipStatus.${value}`) : t("memberships.all")}
          </button>
        ))}
      </div>

      {props.canReadMemberships && (
        <div className={`${jira.toolbar} ${styles.toolbar}`}>
          <label className={jira.searchField}>
            <SearchIcon aria-hidden="true" />
            <span className="sr-only">{t("memberships.search")}</span>
            <input
              type="search"
              onPointerDown={(event) => {
                event.currentTarget.dataset.pointerFocus = "true";
              }}
              onBlur={(event) => {
                delete event.currentTarget.dataset.pointerFocus;
              }}
              value={searchInput}
              maxLength={100}
              placeholder={t("memberships.searchPlaceholder")}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>
          <DirectorySelect
            aria-label={t("memberships.sortBy")}
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="name">{t("memberships.sortName")}</option>
            <option value="email">{t("memberships.sortEmail")}</option>
            <option value="updated">{t("memberships.sortUpdated")}</option>
          </DirectorySelect>
        </div>
      )}

      <div
        className={styles.tableFrame}
        aria-busy={props.canReadMemberships && memberships.isFetching}
      >
        {!props.canReadMemberships ? (
          <p className={styles.message} role="status">
            {t("memberships.readPermissionNeeded")}
          </p>
        ) : memberships.isError ? (
          <div className={styles.message} role="alert">
            <p>{t("errors.membershipList")}</p>
            <button type="button" onClick={() => void memberships.refetch()}>
              {t("retry")}
            </button>
          </div>
        ) : memberships.isPending ? (
          <>
            <p role="status" className="sr-only">
              {t("loadingMemberships")}
            </p>
            <TableSkeleton rows={6} columns={6} />
          </>
        ) : rows.length ? (
          <MembershipTable
            rows={rows}
            canSuspend={props.canSuspendMemberships}
            currentUserId={props.currentUserId}
            onSuspend={props.onSuspend}
          />
        ) : (
          <EmptyState
            title={t("memberships.emptyTitle")}
            body={t("memberships.emptyBody")}
          />
        )}
        {props.canReadMemberships && !memberships.isError && pagination && (
          <nav aria-label={t("memberships.title")} className={jira.pagination}>
            <span aria-live="polite">
              {t("pagination.range", {
                from:
                  pagination.totalItems && rows.length
                    ? (page - 1) * pagination.pageSize + 1
                    : 0,
                to: rows.length
                  ? Math.min(
                      (page - 1) * pagination.pageSize + rows.length,
                      pagination.totalItems,
                    )
                  : 0,
                total: pagination.totalItems,
              })}
            </span>
            <PlatformPageControls
              page={page}
              totalPages={pagination.totalPages}
              disabled={memberships.isFetching}
              onPageChange={(next) => setPageState({ scope, page: next })}
            />
          </nav>
        )}
      </div>
    </section>
  );
}
