"use client";
import DirectorySelect from "../ui/DirectorySelect";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import OrganizationRowMenu from "./OrganizationRowMenu";
import { SearchIcon, PlatformBuildingIcon } from "@/icons";
import Button from "@/components/ui/button/Button";
import PlatformPagination from "../PlatformPagination";
import { TableSkeleton } from "../ui/LoadingSkeleton";
import EmptyState from "../ui/EmptyState";
import jira from "../ui/jira.module.css";
import type { PlatformOrganizationsViewProps } from "./types";

export default function OrganizationDirectory({
  organizations,
  setOrganizationPage,
  canManage = false,
  onCreate,
  onPageSizeChange,
}: Pick<
  PlatformOrganizationsViewProps,
  "organizations" | "setOrganizationPage"
> & {
  canManage?: boolean;
  onCreate?: () => void;
  onPageSizeChange?: (size: number) => void;
}) {
  const t = useTranslations("platformConsole");
  const locale = useLocale();
  const [sort, setSort] = useState("name");
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("ALL");
  const rows = useMemo(() => {
    const collator = new Intl.Collator(locale, {
      numeric: true,
      sensitivity: "base",
    });
    return [...(organizations.data?.data ?? [])]
      .filter(
        (row) =>
          `${row.name} ${row.slug}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()) &&
          (plan === "ALL" || row.plan === plan),
      )
      .sort((a, b) => {
        const order =
          sort === "created"
            ? Date.parse(b.createdAt) - Date.parse(a.createdAt)
            : collator.compare(
                sort === "slug" ? a.slug : a.name,
                sort === "slug" ? b.slug : b.name,
              );
        return order || a.id.localeCompare(b.id);
      });
  }, [organizations.data, search, plan, sort, locale]);
  const changePage = (page: number) => {
    setSearch("");
    setPlan("ALL");
    setOrganizationPage(page);
  };
  return (
    <section
      className={jira.directory}
      aria-label={t("organizations.directory")}
      aria-busy={organizations.isFetching}
    >
      <header>
        <h1 className="sr-only">{t("pages.organizations.title")}</h1>
        <div
          className={jira.tabs}
          role="group"
          aria-label={t("organizations.plan")}
        >
          {["ALL", "FREE", "ENTERPRISE"].map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={plan === value}
              onClick={() => setPlan(value)}
              aria-describedby="organization-filter-note"
            >
              {value === "ALL" ? t("referenceCharts.all") : value}
            </button>
          ))}
        </div>
        <div className={jira.toolbar}>
          <label className={jira.searchField}>
            <SearchIcon aria-hidden="true" />
            <span className="sr-only">{t("organizations.search")}</span>
            <input
              type="search"
              onPointerDown={(event) => {
                event.currentTarget.dataset.pointerFocus = "true";
              }}
              onBlur={(event) => {
                delete event.currentTarget.dataset.pointerFocus;
              }}
              id="organization-search"
              placeholder={t("organizations.search")}
              aria-describedby="organization-filter-note"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <DirectorySelect
            aria-label={t("organizations.sortBy")}
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="name">{t("organizations.sortName")}</option>
            <option value="slug">{t("organizations.sortSlug")}</option>
            <option value="created">{t("organizations.sortCreated")}</option>
          </DirectorySelect>
          {onCreate && (
            <button
              type="button"
              onClick={onCreate}
              className={jira.createOrganization}
            >
              {t("organizations.create")}
            </button>
          )}
        </div>
        <p id="organization-filter-note" className="sr-only">
          {t("organizations.pageFilterNote")}
        </p>
      </header>
      {organizations.isError ? (
        <div role="alert" className="p-5 text-error-600 dark:text-error-400">
          {t("errors.organizationList")}
          <Button
            variant="outline"
            disabled={organizations.isFetching}
            onClick={() => void organizations.refetch()}
          >
            {t("retry")}
          </Button>
        </div>
      ) : organizations.isPending ? (
        <TableSkeleton rows={4} columns={5} />
      ) : rows.length ? (
        <div className={jira.tableFrame}>
          <table className="w-full text-start text-sm text-gray-700 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {["name", "slug", "plan", "created"].map((key) => (
                  <th key={key} scope="col" className="px-5 py-3 text-start">
                    {t(`organizations.${key}`)}
                  </th>
                ))}
                <th
                  scope="col"
                  className="sticky end-0 bg-gray-50 px-3 py-3 dark:bg-gray-800"
                >
                  {t("organizations.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-gray-100 dark:border-gray-800"
                >
                  <td className="px-5 py-4">
                    <span className={jira.directoryName}>
                      <PlatformBuildingIcon aria-hidden="true" />
                      <Link
                        href={`/platform/organizations/${row.id}` as never}
                        className="font-normal text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400"
                      >
                        {row.name}
                      </Link>
                    </span>
                  </td>
                  <td className="px-5 py-4">{row.slug}</td>
                  <td className="px-5 py-4">{row.plan}</td>
                  <td className="px-5 py-4">
                    <time dateTime={row.createdAt}>
                      {new Date(row.createdAt).toLocaleString(locale, {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </td>
                  <td className="sticky end-0 bg-white px-3 py-4 dark:bg-gray-900">
                    <OrganizationRowMenu
                      id={row.id}
                      name={row.name}
                      canManage={canManage}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={t("organizations.emptyTitle")}
          body={t(
            search || plan !== "ALL"
              ? "organizations.noMatches"
              : "organizations.emptyBody",
          )}
        />
      )}
      {organizations.data && !organizations.isError && (
        <div>
          <p role="status" className="sr-only">
            {t("organizations.total", {
              count: organizations.data.pagination.totalItems,
            })}
          </p>
          <PlatformPagination
            returnedItems={organizations.data.data.length}
            alwaysShow
            onPageSizeChange={
              onPageSizeChange
                ? (size) => {
                    setSearch("");
                    setPlan("ALL");
                    onPageSizeChange(size);
                  }
                : undefined
            }
            ariaLabel={t("organizations.directory")}
            {...organizations.data.pagination}
            onPageChange={changePage}
          />
        </div>
      )}
    </section>
  );
}
