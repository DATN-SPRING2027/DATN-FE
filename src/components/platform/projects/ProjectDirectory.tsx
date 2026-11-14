"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertIcon,
  CheckCircleIcon,
  LockIcon,
  PlatformProjectsIcon,
  SearchIcon,
} from "@/icons";
import Button from "@/components/ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PlatformProjectRecord } from "@/lib/queries/platform/usePlatformOperations";
import PlatformPagination from "../PlatformPagination";
import DirectorySelect from "../ui/DirectorySelect";
import EmptyState from "../ui/EmptyState";
import StatusBadge from "../ui/StatusBadge";
import { TableSkeleton } from "../ui/LoadingSkeleton";
import {
  ErrorState,
  QueryRefreshStatus,
  input,
  isReadAccessLost,
} from "../PlatformOperationsUi";
import type { PlatformOperationsViewModel } from "../usePlatformOperationsViewModel";
import jira from "../ui/jira.module.css";
import styles from "./ProjectDirectory.module.css";

const PROJECT_ERROR_CODES = new Set([
  "PROJECT_LOCKED",
  "LAST_PROJECT_LEADER_REQUIRED",
  "PROJECT_MEMBER_ALREADY_EXISTS",
  "PROJECT_MEMBER_ELIGIBILITY_REQUIRED",
  "PROJECT_CODE_CONFLICT",
  "PROJECT_VERSION_STALE",
]);

export default function ProjectDirectory({
  model,
}: {
  model: PlatformOperationsViewModel;
}) {
  const t = useTranslations("platformProjectDirectory");
  const locale = useLocale();
  const {
    projects,
    search,
    setSearch,
    status,
    setStatus,
    setPage,
    setSelectedId,
    canManageProjects,
    canFilterUserOrganizations,
    filterOrganizations,
    projectOrganizationId = "",
    setProjectOrganizationId,
    projectVisibility = "",
    setProjectVisibility,
    changeProject,
    runOperation,
    formMessage,
    lastErrorCode,
    selectedId,
  } = model;
  const [sort, setSort] = useState("name");
  const [lockTarget, setLockTarget] = useState<PlatformProjectRecord | null>(
    null,
  );
  const [lockReasonCode, setLockReasonCode] = useState<
    "ACCESS_REVIEW" | "SECURITY_INCIDENT"
  >("ACCESS_REVIEW");

  const organizationOptions = filterOrganizations?.data?.data ?? [];
  const showOrganizationFilter =
    Boolean(canFilterUserOrganizations) || Boolean(filterOrganizations);

  const collator = new Intl.Collator(locale, {
    numeric: true,
    sensitivity: "base",
  });
  const rows = [...(projects.data?.data ?? [])].sort((a, b) => {
    const order =
      sort === "created"
        ? Date.parse(b.createdAt) - Date.parse(a.createdAt)
        : collator.compare(
            sort === "organization" ? a.organization.name : a.name,
            sort === "organization" ? b.organization.name : b.name,
          );
    return order || a.id.localeCompare(b.id);
  });
  const date = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
  const accessLost = isReadAccessLost(projects.error);
  const hasActiveFilters = Boolean(
    search || status || projectOrganizationId || projectVisibility,
  );

  const directoryFeedback =
    !selectedId && formMessage
      ? lastErrorCode && PROJECT_ERROR_CODES.has(lastErrorCode)
        ? t(`error${lastErrorCode}` as Parameters<typeof t>[0])
        : formMessage
      : "";

  async function confirmLockToggle() {
    if (!lockTarget || !changeProject || !runOperation) return;
    const target = lockTarget;
    const nextStatus = target.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
    const ok = await runOperation(() =>
      changeProject.mutateAsync({
        projectId: target.id,
        status: nextStatus,
        expectedUpdatedAt: target.updatedAt,
        reasonCode: lockReasonCode,
      }),
    );
    if (ok) {
      setLockTarget(null);
    }
  }

  return (
    <section
      className={jira.directory}
      aria-label={t("title")}
      aria-busy={projects.isFetching}
    >
      <div className={jira.tabs} role="group" aria-label={t("statusFilter")}>
        {(["", "ACTIVE", "ARCHIVED"] as const).map((value) => (
          <button
            key={value || "all"}
            type="button"
            aria-pressed={status === value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
          >
            {value ? t(value) : t("allProjects")}
          </button>
        ))}
      </div>

      <div className={jira.toolbar}>
        <label className={jira.searchField}>
          <SearchIcon aria-hidden="true" />
          <span className="sr-only">{t("search")}</span>
          <input
            type="search"
            placeholder={t("searchPlaceholder")}
            value={search}
            maxLength={100}
            onPointerDown={(event) => {
              event.currentTarget.dataset.pointerFocus = "true";
            }}
            onBlur={(event) => {
              delete event.currentTarget.dataset.pointerFocus;
            }}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>

        {showOrganizationFilter && (
          <DirectorySelect
            aria-label={t("organizationFilter")}
            value={projectOrganizationId}
            onChange={(event) => {
              setProjectOrganizationId?.(event.target.value);
            }}
          >
            <option value="">{t("allOrganizations")}</option>
            {organizationOptions.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.slug})
              </option>
            ))}
          </DirectorySelect>
        )}

        <DirectorySelect
          aria-label={t("visibilityFilter")}
          value={projectVisibility}
          onChange={(event) => {
            setProjectVisibility?.(
              event.target.value as "" | "PUBLIC" | "PRIVATE",
            );
          }}
        >
          <option value="">{t("allVisibilities")}</option>
          <option value="PRIVATE">{t("PRIVATE")}</option>
          <option value="PUBLIC">{t("PUBLIC")}</option>
        </DirectorySelect>

        <DirectorySelect
          aria-label={t("sortBy")}
          aria-describedby="project-sort-note"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="name">{t("sortName")}</option>
          <option value="organization">{t("sortOrganization")}</option>
          <option value="created">{t("sortCreated")}</option>
        </DirectorySelect>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatus("");
              setProjectOrganizationId?.("");
              setProjectVisibility?.("");
              setPage(1);
            }}
            className="rounded border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t("clearFilters")}
          </button>
        )}

        <span id="project-sort-note" className="sr-only">
          {t("sortNote")}
        </span>
      </div>

      {lockTarget && (
        <div
          role="region"
          aria-label={
            lockTarget.status === "ACTIVE"
              ? t("confirmLockTitle")
              : t("confirmUnlockTitle")
          }
          className="mb-3 rounded-lg border border-amber-300 bg-amber-50/90 p-4 text-xs text-gray-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-gray-100"
        >
          <div className="flex items-start gap-2.5">
            <AlertIcon
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-semibold">
                {lockTarget.status === "ACTIVE"
                  ? t("confirmLockTitle")
                  : t("confirmUnlockTitle")}
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                {lockTarget.status === "ACTIVE"
                  ? t("confirmLockDescription", { name: lockTarget.name })
                  : t("confirmUnlockDescription", { name: lockTarget.name })}
              </p>
              <div className="flex flex-wrap items-end gap-3 pt-1">
                <label className="grid gap-1 text-xs font-medium">
                  {t("reasonCodeLabel")}
                  <select
                    value={lockReasonCode}
                    onChange={(event) =>
                      setLockReasonCode(
                        event.target.value as
                          | "ACCESS_REVIEW"
                          | "SECURITY_INCIDENT",
                      )
                    }
                    className={`${input} h-8 rounded-md px-2.5 text-xs`}
                  >
                    <option value="ACCESS_REVIEW">
                      {t("reasonAccessReview")}
                    </option>
                    <option value="SECURITY_INCIDENT">
                      {t("reasonSecurityIncident")}
                    </option>
                  </select>
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      lockTarget.status === "ACTIVE" ? "danger" : "primary"
                    }
                    disabled={Boolean(changeProject?.isPending)}
                    onClick={() => void confirmLockToggle()}
                  >
                    {lockTarget.status === "ACTIVE"
                      ? t("confirmLockButton")
                      : t("confirmUnlockButton")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setLockTarget(null)}
                  >
                    {t("cancel")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {directoryFeedback && (
        <p
          role="status"
          className="mb-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-200"
        >
          {directoryFeedback}
        </p>
      )}

      {projects.data !== undefined &&
        !accessLost &&
        (projects.isFetching || projects.isRefetchError) && (
          <div className="mb-3">
            <QueryRefreshStatus
              hasData
              isFetching={projects.isFetching}
              isRefetchError={projects.isRefetchError}
              onRetry={() => void projects.refetch()}
            />
          </div>
        )}

      {projects.isPending && !projects.data ? (
        <TableSkeleton rows={5} columns={8} />
      ) : projects.isError && (!projects.data || accessLost) ? (
        <ErrorState retry={() => void projects.refetch()} />
      ) : rows.length ? (
        <div
          className={jira.tableFrame}
          role="region"
          tabIndex={0}
          aria-label={t("title")}
        >
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "project",
                  "organization",
                  "visibility",
                  "status",
                  "members",
                  "teams",
                  "created",
                  "actions",
                ].map((key) => (
                  <TableCell
                    key={key}
                    isHeader
                    className={
                      key === "actions"
                        ? "whitespace-nowrap text-end!"
                        : key === "members" || key === "teams"
                          ? "whitespace-nowrap text-end!"
                          : "whitespace-nowrap"
                    }
                  >
                    {t(key)}
                  </TableCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="min-w-[180px]">
                    <div className={jira.directoryName}>
                      <PlatformProjectsIcon aria-hidden="true" />
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setSelectedId(project.id)}
                          className="text-start font-medium text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400"
                        >
                          {project.name}
                        </button>
                        <span className="block font-mono text-theme-xs text-gray-500 dark:text-gray-400">
                          {project.code}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[155px]">
                    <div className="min-w-0">
                      <span className="block font-medium">
                        {project.organization.name}
                      </span>
                      <span className="block text-theme-xs text-gray-500 dark:text-gray-400">
                        {project.organization.slug}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={project.visibility}
                      label={t(project.visibility)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="inline-flex items-center gap-1.5">
                      <StatusBadge
                        status={project.status}
                        label={t(project.status)}
                      />
                      {project.status === "ARCHIVED" && (
                        <LockIcon
                          aria-hidden="true"
                          className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400"
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-end!">
                    <span className="tabular-nums">
                      {new Intl.NumberFormat(locale).format(project.memberCount)}
                    </span>
                  </TableCell>
                  <TableCell className="text-end!">
                    <span className="tabular-nums">
                      {new Intl.NumberFormat(locale).format(
                        project.teamCount ?? 0,
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <time
                      dateTime={project.createdAt}
                      className="whitespace-nowrap tabular-nums"
                    >
                      {date.format(new Date(project.createdAt))}
                    </time>
                  </TableCell>
                  <TableCell className={styles.actionsCell}>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(project.id)}
                        aria-label={t("detailsFor", { name: project.name })}
                        className={`${styles.actionButton} text-brand-600 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:bg-gray-800`}
                      >
                        {t("details")}
                      </button>
                      {canManageProjects && (
                        <button
                          type="button"
                          onClick={() => setLockTarget(project)}
                          aria-label={
                            project.status === "ACTIVE"
                              ? t("lockFor", { name: project.name })
                              : t("unlockFor", { name: project.name })
                          }
                          className={
                            project.status === "ACTIVE"
                              ? `${styles.actionButton} text-amber-700 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-amber-300 dark:hover:bg-amber-950/50`
                              : `${styles.actionButton} text-emerald-700 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-emerald-300 dark:hover:bg-emerald-950/50`
                          }
                        >
                          {project.status === "ACTIVE" ? (
                            <LockIcon
                              aria-hidden="true"
                              className={styles.actionIcon}
                            />
                          ) : (
                            <CheckCircleIcon
                              aria-hidden="true"
                              className={styles.actionIcon}
                            />
                          )}
                          <span
                            className={styles.actionLabel}
                            data-alt={
                              project.status === "ACTIVE"
                                ? t("unlockAction")
                                : t("lockAction")
                            }
                          >
                            <span>
                              {project.status === "ACTIVE"
                                ? t("lockAction")
                                : t("unlockAction")}
                            </span>
                          </span>
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          title={t("emptyTitle")}
          body={t(hasActiveFilters ? "noMatches" : "emptyBody")}
        />
      )}

      {projects.data && !accessLost && (
        <PlatformPagination
          alwaysShow
          ariaLabel={t("title")}
          {...projects.data.pagination}
          returnedItems={rows.length}
          onPageChange={setPage}
        />
      )}
    </section>
  );
}
