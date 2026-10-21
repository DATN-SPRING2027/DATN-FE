"use client";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import PlatformPagination from "../PlatformPagination";
import { TableSkeleton } from "../ui/LoadingSkeleton";
import EmptyState from "../ui/EmptyState";
import styles from "../ui/operator.module.css";
import type { PlatformOrganizationsViewProps } from "./types";

export default function OrganizationDirectory({
  organizations,
  setOrganizationPage,
  canManage = false,
  onPageSizeChange,
}: Pick<
  PlatformOrganizationsViewProps,
  "organizations" | "setOrganizationPage"
> & { canManage?: boolean; onPageSizeChange?: (size: number) => void }) {
  const t = useTranslations("platformConsole");
  const locale = useLocale();
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
      className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
      aria-label={t("organizations.directory")}
      aria-busy={organizations.isFetching}
    >
      <header className="space-y-4 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white">
          {t("organizations.directory")}
        </h2>
        <p className="sr-only">{t("organizations.directoryHelp")}</p>
        {!organizations.isPending &&
          !organizations.isError &&
          organizations.data && (
            <div className={styles.directorySummary}>
              <dl aria-describedby="organization-filter-note">
                {[
                  [
                    t("referenceCharts.total"),
                    organizations.data.pagination.totalItems,
                  ],
                  [
                    t("referenceCharts.freePage"),
                    organizations.data.data.filter((row) => row.plan === "FREE")
                      .length,
                  ],
                  [
                    t("referenceCharts.enterprisePage"),
                    organizations.data.data.filter(
                      (row) => row.plan === "ENTERPRISE",
                    ).length,
                  ],
                ].map(([label, value], index) => (
                  <div
                    key={label}
                    className={
                      [
                        styles.totalTone,
                        styles.primaryTone,
                        styles.secondaryTone,
                      ][index]
                    }
                  >
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className={styles.statBars} aria-hidden="true">
                {["TOTAL", "FREE", "ENTERPRISE"].map((value, index) => {
                  const total = organizations.data!.pagination.totalItems;
                  const count =
                    value === "TOTAL"
                      ? total
                      : organizations.data!.data.filter(
                          (row) => row.plan === value,
                        ).length;
                  const denominator =
                    value === "TOTAL" ? total : organizations.data!.data.length;
                  return (
                    <span
                      key={value}
                      className={
                        [
                          styles.totalTrack,
                          styles.primaryTrack,
                          styles.secondaryTrack,
                        ][index]
                      }
                    >
                      <i
                        style={{
                          width: `${denominator ? (count / denominator) * 100 : 0}%`,
                        }}
                      />
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        <div className={styles.directoryToolbar}>
          <div className={`${styles.directorySearch} [&>label]:sr-only`}>
            <Label htmlFor="organization-search">
              {t("organizations.search")}
            </Label>
            <Input
              id="organization-search"
              placeholder={t("organizations.search")}
              aria-describedby="organization-filter-note"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div
            className={styles.filterTabs}
            role="group"
            aria-label={t("organizations.plan")}
            title={t("organizations.pageFilterNote")}
          >
            {["ALL", "FREE", "ENTERPRISE"].map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={plan === value}
                onClick={() => setPlan(value)}
              >
                {value === "ALL" ? t("referenceCharts.all") : value}
              </button>
            ))}
          </div>
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
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm text-gray-700 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {["name", "slug", "plan", "updated"].map((key) => (
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
                    <Link
                      href={`/platform/organizations/${row.id}` as never}
                      className="font-normal text-brand-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-5 py-4">{row.slug}</td>
                  <td className="px-5 py-4">{row.plan}</td>
                  <td className="px-5 py-4">
                    <time dateTime={row.updatedAt}>
                      {new Date(row.updatedAt).toLocaleDateString(locale, {
                        year: "2-digit",
                        month: "2-digit",
                        day: "2-digit",
                      })}
                    </time>
                  </td>
                  <td className="px-3 py-4">
                    <details
                      className={styles.rowActions}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.currentTarget.open = false;
                          event.currentTarget.querySelector("summary")?.focus();
                        }
                      }}
                    >
                      <summary
                        aria-label={t("organizations.rowActions", {
                          name: row.name,
                        })}
                      >
                        ⋮
                      </summary>
                      <div>
                        <Link
                          href={`/platform/organizations/${row.id}` as never}
                        >
                          {t("organizations.view")}
                        </Link>
                        {canManage && (
                          <Link
                            href={
                              `/platform/organizations/${row.id}#edit` as never
                            }
                          >
                            {t("organizations.editAction")}
                          </Link>
                        )}
                      </div>
                    </details>
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
