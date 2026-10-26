"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PlatformProjectsIcon, SearchIcon } from "@/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PlatformPagination from "../PlatformPagination";
import DirectorySelect from "../ui/DirectorySelect";
import EmptyState from "../ui/EmptyState";
import StatusBadge from "../ui/StatusBadge";
import { TableSkeleton } from "../ui/LoadingSkeleton";
import {
  ErrorState,
  QueryRefreshStatus,
  isReadAccessLost,
} from "../PlatformOperationsUi";
import type { PlatformOperationsViewModel } from "../usePlatformOperationsViewModel";
import jira from "../ui/jira.module.css";

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
  } = model;
  const [sort, setSort] = useState("name");
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
  return (
    <section
      className={jira.directory}
      aria-label={t("title")}
      aria-busy={projects.isFetching}
    >
      <div
        className={jira.tabs}
        role="group"
        aria-label={t("visibilityFilter")}
      >
        {["", "PRIVATE", "PUBLIC"].map((value) => (
          <button
            key={value}
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
        <span id="project-sort-note" className="sr-only">
          {t("sortNote")}
        </span>
      </div>
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
        <TableSkeleton rows={5} columns={7} />
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
                  "created",
                  "actions",
                ].map((key) => (
                  <TableCell
                    key={key}
                    isHeader
                    className={
                      key === "actions"
                        ? "sticky end-0 bg-gray-50 dark:bg-gray-800"
                        : ""
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
                  <TableCell>
                    <div className={jira.directoryName}>
                      <PlatformProjectsIcon aria-hidden="true" />
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setSelectedId(project.id)}
                          className="text-start text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400"
                        >
                          {project.name}
                        </button>
                        <span className="block text-theme-xs text-gray-500 dark:text-gray-400">
                          {project.code}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{project.organization.name}</TableCell>
                  <TableCell>
                    <StatusBadge
                      status={project.visibility}
                      label={t(project.visibility)}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={project.status}
                      label={t(project.status)}
                    />
                  </TableCell>
                  <TableCell>
                    {new Intl.NumberFormat(locale).format(project.memberCount)}
                  </TableCell>
                  <TableCell>
                    <time
                      dateTime={project.createdAt}
                      className="whitespace-nowrap"
                    >
                      {date.format(new Date(project.createdAt))}
                    </time>
                  </TableCell>
                  <TableCell className="sticky end-0 bg-white dark:bg-gray-900">
                    <button
                      type="button"
                      onClick={() => setSelectedId(project.id)}
                      aria-label={t("detailsFor", { name: project.name })}
                      className="rounded px-2 py-1 text-brand-600 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:bg-gray-800"
                    >
                      {t("details")}
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          title={t("emptyTitle")}
          body={t(search || status ? "noMatches" : "emptyBody")}
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
