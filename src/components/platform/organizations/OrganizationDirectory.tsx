"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import OrganizationRowMenu from "./OrganizationRowMenu";
import { SearchIcon, PlatformBuildingIcon } from "@/icons";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
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
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("ALL");
  const rows = useMemo(
    () =>
      (organizations.data?.data ?? []).filter(
        (row) =>
          `${row.name} ${row.slug}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()) &&
          (plan === "ALL" || row.plan === plan),
      ),
    [organizations.data, search, plan],
  );
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
          <Label htmlFor="organization-search" className="sr-only">
            {t("organizations.search")}
          </Label>
          <div className={jira.searchField}>
            <SearchIcon aria-hidden="true" />{" "}
            <Input
              id="organization-search"
              placeholder={t("organizations.search")}
              aria-describedby="organization-filter-note"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            aria-label={t("organizations.plan")}
            value={plan}
            onChange={(event) => setPlan(event.target.value)}
            aria-describedby="organization-filter-note"
          >
            <option value="ALL">{t("organizations.allPlans")}</option>
            <option value="FREE">FREE</option>
            <option value="ENTERPRISE">ENTERPRISE</option>
          </select>
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
                <th scope="col" className="px-3 py-3">
                  <span className="sr-only">{t("organizations.actions")}</span>
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
                        className="font-normal text-brand-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400"
                      >
                        {row.name}
                      </Link>
                    </span>
                  </td>
                  <td className="px-5 py-4">{row.slug}</td>
                  <td className="px-5 py-4">{row.plan}</td>
                  <td className="px-5 py-4">
                    <time dateTime={row.createdAt}>
                      {new Date(row.createdAt).toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </td>
                  <td className="px-3 py-4">
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
        <div className="space-y-3 p-3">
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
