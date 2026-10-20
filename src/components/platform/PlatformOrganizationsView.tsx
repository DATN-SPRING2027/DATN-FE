"use client";

import { useTranslations } from "next-intl";
import { FormEvent, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import PlatformPagination from "@/components/platform/PlatformPagination";
import StatusBadge from "@/components/platform/ui/StatusBadge";
import EmptyState from "@/components/platform/ui/EmptyState";
import { TableSkeleton } from "@/components/platform/ui/LoadingSkeleton";
import { ApiError } from "@/lib/api-client";
import type {
  PlatformOrganization,
  PlatformPage,
} from "@/lib/queries/platform/usePlatformConsole";

const AVATAR_PALETTES = [
  { bg: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  { bg: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
  { bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  { bg: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  { bg: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  { bg: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
];
const EMPTY_ORGANIZATION_ROWS: PlatformOrganization[] = [];

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

type PlatformOrganizationsViewProps = {
  // Queries
  organizations: {
    data?: PlatformPage<PlatformOrganization>;
    isPending: boolean;
    isError: boolean;
    isFetching: boolean;
    refetch: () => Promise<unknown>;
  };
  setOrganizationPage: (page: number) => void;

  // Permissions
  canReadOrganizations: boolean;
  canManageOrganizations: boolean;
  canCreateOrganization: boolean;
  canLookupUsers: boolean;

  // Selection & Details
  selectedOrganizationId: string;
  routeOrganizationId: string;
  hasValidRouteOrganizationId: boolean;

  // Create form state & mutations
  organizationName: string;
  setOrganizationName: (name: string) => void;
  organizationSlug: string;
  setOrganizationSlug: (slug: string) => void;
  organizationPlan: "FREE" | "ENTERPRISE";
  setOrganizationPlan: (plan: "FREE" | "ENTERPRISE") => void;
  lookupEmail: string;
  setLookupEmail: (email: string) => void;
  selectedUser: { id: string; email: string; fullName: string } | null;
  setSelectedUser: (
    user: { id: string; email: string; fullName: string } | null,
  ) => void;
  runLookup: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  runCreateOrganization: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  createOrganizationPending: boolean;
  lookupPending: boolean;

  // Detail view & Metadata edit
  organization: {
    data?: PlatformOrganization;
    isPending: boolean;
    isError: boolean;
    isFetching: boolean;
    refetch: () => Promise<unknown>;
  };
  changeOrganizationMetadata: {
    mutateAsync: (input: {
      organizationId: string;
      name?: string;
      slug?: string;
      expectedUpdatedAt: string;
      reasonCode: "SECURITY_INCIDENT" | "ACCESS_REVIEW";
    }) => Promise<unknown>;
    isPending: boolean;
  };
  // Modals & Messages
  setOperationMessage: (msg: string) => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
};

export default function PlatformOrganizationsView({
  organizations,
  setOrganizationPage,
  canReadOrganizations,
  canManageOrganizations,
  canCreateOrganization,
  canLookupUsers,
  selectedOrganizationId,
  routeOrganizationId,
  hasValidRouteOrganizationId,
  organizationName,
  setOrganizationName,
  organizationSlug,
  setOrganizationSlug,
  organizationPlan,
  setOrganizationPlan,
  lookupEmail,
  setLookupEmail,
  selectedUser,
  setSelectedUser,
  runLookup,
  runCreateOrganization,
  createOrganizationPending,
  lookupPending,
  organization,
  changeOrganizationMetadata,
  setOperationMessage,
  isCreateModalOpen,
  setIsCreateModalOpen,
}: PlatformOrganizationsViewProps) {
  const t = useTranslations("platformConsole");

  // Local search & filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState<"ALL" | "FREE" | "ENTERPRISE">("ALL");
  const [detailModalOrg, setDetailModalOrg] = useState<PlatformOrganization | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<PlatformOrganization | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [now] = useState(() => Date.now());

  const organizationRows = organizations.data?.data ?? EMPTY_ORGANIZATION_ROWS;

  // Filtered rows for directory table
  const filteredRows = useMemo(() => {
    return organizationRows.filter((org) => {
      const matchesSearch =
        !searchTerm.trim() ||
        org.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        org.slug.toLowerCase().includes(searchTerm.toLowerCase().trim());
      const matchesPlan =
        planFilter === "ALL" || org.plan.toUpperCase() === planFilter;
      return matchesSearch && matchesPlan;
    });
  }, [organizationRows, searchTerm, planFilter]);

  // Active selected organization
  const activeSelectedOrg = useMemo(() => {
    if (routeOrganizationId) {
      const found = organizationRows.find((o) => o.id === routeOrganizationId);
      if (found) return found;
      if (organization.data) return organization.data;
    }
    if (selectedOrganizationId) {
      const found = organizationRows.find((o) => o.id === selectedOrganizationId);
      if (found) return found;
    }
    return organizationRows[0] ?? organization.data ?? null;
  }, [organizationRows, selectedOrganizationId, routeOrganizationId, organization.data]);

  // Stats calculations
  const totalOrganizations =
    organizations.data?.pagination?.totalItems ?? organizationRows.length;
  const enterpriseCount = useMemo(() => {
    return organizationRows.filter((o) => o.plan.toUpperCase() === "ENTERPRISE")
      .length;
  }, [organizationRows]);

  const enterprisePercent = organizationRows.length
    ? Math.round((enterpriseCount / organizationRows.length) * 100)
    : 0;

  const recentlyUpdatedCount = useMemo(() => {
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    return organizationRows.filter((o) => {
      const updatedTime = new Date(o.updatedAt).getTime();
      return !isNaN(updatedTime) && updatedTime >= thirtyDaysAgo;
    }).length;
  }, [organizationRows, now]);

  const handleOpenEditModal = (org: PlatformOrganization) => {
    setEditingOrg(org);
    setEditName(org.name);
    setEditSlug(org.slug);
    setIsEditModalOpen(true);
  };

  const handleSaveMetadata = async (e: FormEvent) => {
    e.preventDefault();
    const target = editingOrg ?? activeSelectedOrg;
    if (!target) return;
    try {
      await changeOrganizationMetadata.mutateAsync({
        organizationId: target.id,
        name: editName.trim(),
        slug: editSlug.trim().toLowerCase(),
        expectedUpdatedAt: new Date(target.updatedAt).toISOString(),
        reasonCode: "ACCESS_REVIEW",
      });
      setOperationMessage("Organization metadata updated and audit state refreshed.");
      setIsEditModalOpen(false);
      void organizations.refetch();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        setOperationMessage(
          "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại tại /platform/signin.",
        );
      } else {
        setOperationMessage(
          t("errors.organizationUpdate") ||
            "Could not update Organization metadata. Review the details and retry.",
        );
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP METRICS CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total organizations */}
        <div className="flex items-center gap-4 rounded-2xl border border-gray-200/80 bg-white p-5 shadow-theme-xs transition-all hover:shadow-theme-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <svg
              className="size-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Total organizations
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {totalOrganizations}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-gray-400">Across all plans</p>
          </div>
        </div>

        {/* Enterprise plan */}
        <div className="flex items-center gap-4 rounded-2xl border border-gray-200/80 bg-white p-5 shadow-theme-xs transition-all hover:shadow-theme-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
            <svg
              className="size-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Enterprise plan
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {enterpriseCount}
              </span>
              <span className="inline-flex items-center rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600 dark:bg-purple-500/15 dark:text-purple-400">
                {enterprisePercent}%
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-gray-400">
              Of organizations on this page
            </p>
          </div>
        </div>

        {/* Recently updated */}
        <div className="flex items-center gap-4 rounded-2xl border border-gray-200/80 bg-white p-5 shadow-theme-xs transition-all hover:shadow-theme-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            <svg
              className="size-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Recently updated
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {recentlyUpdatedCount}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-gray-400">
              On this page · last 30 days
            </p>
          </div>
        </div>
      </div>

      {/* 2. DIRECTORY TABLE (Full Width) */}
      <div className="space-y-6">
        {canReadOrganizations && (
          <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            {/* Header with Search & Filter */}
            <div className="flex flex-col gap-4 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                  <svg
                    className="size-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </span>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    {t("organizations.directory")}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("organizations.directoryHelp")}
                  </p>
                </div>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <svg
                    className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search organizations..."
                    className="h-9 w-44 rounded-xl border border-gray-200 bg-gray-50/50 ps-9 pe-3 text-xs text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none sm:w-56 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute end-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Plan Filter Dropdown */}
                <select
                  value={planFilter}
                  onChange={(e) =>
                    setPlanFilter(
                      e.target.value as "ALL" | "FREE" | "ENTERPRISE",
                    )
                  }
                  aria-label="Filter by plan"
                  className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-colors focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  <option value="ALL">All plans</option>
                  <option value="ENTERPRISE">Enterprise</option>
                  <option value="FREE">Free</option>
                </select>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={organizations.isFetching}
                  onClick={() => void organizations.refetch()}
                  className="h-9 text-xs"
                >
                  {organizations.isFetching ? t("refreshing") : t("refresh")}
                </Button>
              </div>
            </div>

            {/* Table */}
            {organizations.isError ? (
              <div className="p-6 text-center text-xs text-rose-600">
                {t("errors.organizationList")}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void organizations.refetch()}
                  className="mt-2 text-xs"
                >
                  {t("refresh")}
                </Button>
              </div>
            ) : organizations.isPending ? (
              <div className="p-5">
                <TableSkeleton rows={4} columns={5} />
              </div>
            ) : filteredRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="border-b border-gray-100 bg-gray-50/75 text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
                    <tr>
                      <th className="px-5 py-3 text-start">NAME</th>
                      <th className="px-5 py-3 text-start">URL SLUG</th>
                      <th className="px-5 py-3 text-start">PLAN</th>
                      <th className="px-5 py-3 text-start">UPDATED</th>
                      <th className="px-5 py-3 text-start">STATUS</th>
                      <th className="px-5 py-3 text-end">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredRows.map((row, index) => {
                      const palette =
                        AVATAR_PALETTES[index % AVATAR_PALETTES.length];
                      return (
                        <tr
                          key={row.id}
                          onClick={() => setDetailModalOrg(row)}
                          className="cursor-pointer border-s-4 border-s-transparent transition-colors hover:border-s-blue-500 hover:bg-gray-50/70 dark:hover:border-s-blue-500 dark:hover:bg-white/[0.02]"
                        >
                          {/* Name + Avatar */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <span
                                className={`flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${palette.bg}`}
                              >
                                {getInitials(row.name)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-gray-900 dark:text-gray-100">
                                  {row.name}
                                </p>
                                <p className="font-mono text-[10px] text-gray-400">
                                  {row.slug}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* URL Slug */}
                          <td className="px-5 py-3.5 font-mono text-gray-600 dark:text-gray-300">
                            {row.slug}
                          </td>

                          {/* Plan Badge */}
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                                row.plan.toUpperCase() === "ENTERPRISE"
                                  ? "border border-purple-200/60 bg-purple-50 text-purple-700 dark:border-purple-500/20 dark:bg-purple-500/15 dark:text-purple-300"
                                  : "border border-blue-200/60 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/15 dark:text-blue-300"
                              }`}
                            >
                              {row.plan}
                            </span>
                          </td>

                          {/* Updated */}
                          <td className="px-5 py-3.5">
                            <p className="text-gray-800 dark:text-gray-200">
                              {formatDate(row.updatedAt)}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {index % 2 === 0 ? "by Admin" : "by system"}
                            </p>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-3.5">
                            <StatusBadge status="ACTIVE" size="sm" />
                          </td>

                          {/* Actions */}
                          <td
                            className="px-5 py-3.5 text-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setDetailModalOrg(row)}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-theme-xs transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:bg-blue-500/10 dark:hover:text-blue-400"
                              >
                                <svg
                                  className="size-3.5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                  />
                                </svg>
                                Detail
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(row)}
                                title="Edit organization metadata"
                                className="flex size-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                              >
                                •••
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title={t("organizations.emptyTitle")}
                body={t("organizations.emptyBody")}
              />
            )}

            {/* Table Footer */}
            <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Showing {filteredRows.length ? 1 : 0}-
                {filteredRows.length} of {totalOrganizations} organizations
              </p>
              {organizations.data?.pagination && (
                <PlatformPagination
                  ariaLabel={t("organizations.directory")}
                  page={organizations.data.pagination.page}
                  totalPages={organizations.data.pagination.totalPages}
                  totalItems={organizations.data.pagination.totalItems}
                  onPageChange={setOrganizationPage}
                />
              )}
            </div>
          </section>
        )}
      </div>

      {routeOrganizationId && !hasValidRouteOrganizationId && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {t("errors.invalidOrganizationId")}
        </div>
      )}



      {/* 4. MODAL: CREATE A NEW ORGANIZATION */}
      {canCreateOrganization && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          className="max-w-2xl p-6 sm:p-7"
        >
          <div className="space-y-6">
            {/* Modal Header */}
            <div className="flex items-start gap-3.5 border-b border-gray-100 pb-4 dark:border-gray-800">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <svg
                  className="size-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </span>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {t("organizations.createTitle")}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {t("organizations.createHelp")}
                </p>
              </div>
            </div>

            {/* Inputs & Form */}
            <form
              onSubmit={async (e) => {
                await runCreateOrganization(e);
                setIsCreateModalOpen(false);
              }}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="platform-org-name">
                    {t("organizations.name")}
                  </Label>
                  <Input
                    id="platform-org-name"
                    placeholder="e.g. Continuum Labs"
                    value={organizationName}
                    maxLength={200}
                    required
                    onChange={(e) => {
                      setOrganizationName(e.target.value);
                      if (!organizationSlug) {
                        setOrganizationSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-+|-+$/g, ""),
                        );
                      }
                    }}
                  />
                  <p className="mt-1 text-[10px] text-gray-400">
                    A unique display name for the organization.
                  </p>
                </div>

                <div>
                  <Label htmlFor="platform-org-slug">
                    {t("organizations.slug")}
                  </Label>
                  <Input
                    id="platform-org-slug"
                    placeholder="e.g. continuum-labs"
                    value={organizationSlug}
                    maxLength={100}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    required
                    onChange={(e) => setOrganizationSlug(e.target.value)}
                  />
                  <p className="mt-1 text-[10px] text-gray-400">
                    Used in URLs and must be unique.
                  </p>
                </div>

                <div>
                  <Label htmlFor="platform-org-plan">
                    {t("organizations.plan")}
                  </Label>
                  <select
                    id="platform-org-plan"
                    value={organizationPlan}
                    onChange={(e) =>
                      setOrganizationPlan(
                        e.target.value as "FREE" | "ENTERPRISE",
                      )
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-800 transition-colors focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="FREE">FREE</option>
                    <option value="ENTERPRISE">ENTERPRISE</option>
                  </select>
                  <p className="mt-1 text-[10px] text-gray-400">
                    Select the subscription plan.
                  </p>
                </div>
              </div>

              {/* Initial Organization Manager lookup card */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/50">
                <div className="mb-3">
                  <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    {t("organizations.firstAdminLabel")}
                  </h4>
                  <p className="text-[11px] text-gray-500">
                    Search for an existing active user account to assign as the
                    primary Organization Manager.
                  </p>
                </div>

                {canLookupUsers ? (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
                      <div className="min-w-0 flex-1">
                        <Label htmlFor="first-admin-email">
                          {t("organizations.firstAdminEmail")}
                        </Label>
                        <Input
                          id="first-admin-email"
                          type="email"
                          placeholder="operator@datn.local"
                          maxLength={254}
                          value={lookupEmail}
                          required
                          onChange={(e) => {
                            setLookupEmail(e.target.value);
                            setSelectedUser(null);
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={lookupPending}
                        onClick={() => {
                          const fakeEvent = {
                            preventDefault: () => {},
                          } as FormEvent<HTMLFormElement>;
                          void runLookup(fakeEvent);
                        }}
                        className="h-11 text-xs"
                      >
                        {lookupPending
                          ? t("lookingUp")
                          : t("organizations.findFirstAdmin")}
                      </Button>
                    </div>

                    {selectedUser && (
                      <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                          ✓
                        </span>
                        <span>
                          {t("organizations.selectedAdmin", {
                            name: selectedUser.fullName,
                            email: selectedUser.email,
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p
                    role="status"
                    className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
                  >
                    {t("users.accountLookupPermissionNeeded")}
                  </p>
                )}
              </div>

              {/* Note callout */}
              <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                <svg
                  className="size-4 shrink-0 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{t("users.lookupCreateNote")}</span>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="h-10 px-4 text-xs"
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={!selectedUser || createOrganizationPending}
                  className="h-10 rounded-xl bg-blue-600 px-5 text-xs font-semibold text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  {createOrganizationPending
                    ? t("organizations.creating")
                    : t("organizations.create")}
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* 5. MODAL: EDIT METADATA */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        className="max-w-lg p-6"
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <svg
                className="size-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Edit Organization Metadata
            </h3>
          </div>

          <form onSubmit={handleSaveMetadata} className="space-y-4">
            <div>
              <Label htmlFor="edit-org-name">Display Name</Label>
              <Input
                id="edit-org-name"
                value={editName}
                maxLength={200}
                required
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-org-slug">URL Slug</Label>
              <Input
                id="edit-org-slug"
                value={editSlug}
                maxLength={100}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
                onChange={(e) => setEditSlug(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditModalOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={changeOrganizationMetadata.isPending}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {changeOrganizationMetadata.isPending ? t("saving") : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* 6. MODAL: ORGANIZATION DETAILS & QUICK ACTIONS */}
      {detailModalOrg && (
        <Modal
          isOpen={!!detailModalOrg}
          onClose={() => setDetailModalOrg(null)}
          className="max-w-2xl p-6 sm:p-7"
        >
          <div className="space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-5 dark:border-gray-800">
              <div className="flex items-center gap-4">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-lg font-bold text-blue-700 shadow-sm dark:bg-blue-900/40 dark:text-blue-300">
                  {getInitials(detailModalOrg.name)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {detailModalOrg.name}
                    </h3>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                        detailModalOrg.plan.toUpperCase() === "ENTERPRISE"
                          ? "border border-purple-200/60 bg-purple-50 text-purple-700 dark:border-purple-500/20 dark:bg-purple-500/15 dark:text-purple-300"
                          : "border border-blue-200/60 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/15 dark:text-blue-300"
                      }`}
                    >
                      {detailModalOrg.plan}
                    </span>
                    <StatusBadge status="ACTIVE" size="sm" />
                  </div>
                  <p className="mt-1 font-mono text-xs text-gray-400">
                    Slug: <span className="text-gray-700 dark:text-gray-300">{detailModalOrg.slug}</span> · ID: <span className="text-gray-500">{detailModalOrg.id}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Overview Stat Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3.5 dark:border-gray-800 dark:bg-gray-800/40">
                <p className="text-[11px] font-medium text-gray-400">Plan</p>
                <p className="mt-1 text-sm font-bold text-blue-600 dark:text-blue-400">
                  {detailModalOrg.plan}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3.5 dark:border-gray-800 dark:bg-gray-800/40">
                <p className="text-[11px] font-medium text-gray-400">Status</p>
                <p className="mt-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  Active
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3.5 dark:border-gray-800 dark:bg-gray-800/40">
                <p className="text-[11px] font-medium text-gray-400">Created at</p>
                <p className="mt-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {formatDate(detailModalOrg.createdAt)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3.5 dark:border-gray-800 dark:bg-gray-800/40">
                <p className="text-[11px] font-medium text-gray-400">Last updated</p>
                <p className="mt-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {formatDate(detailModalOrg.updatedAt)}
                </p>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold tracking-wider text-gray-400 uppercase">
                Quick actions
              </h4>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {/* Action 1: Memberships */}
                <Link
                  href="/platform/memberships"
                  onClick={() => setDetailModalOrg(null)}
                  className="group flex items-center justify-between rounded-xl border border-gray-200/80 bg-white p-3.5 transition-all hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400">
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-gray-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                        View memberships
                      </p>
                      <p className="text-[11px] text-gray-400">Manage organization members</p>
                    </div>
                  </div>
                  <svg className="size-4 text-gray-400 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>

                {/* Action 2: Projects */}
                <Link
                  href="/platform/projects"
                  onClick={() => setDetailModalOrg(null)}
                  className="group flex items-center justify-between rounded-xl border border-gray-200/80 bg-white p-3.5 transition-all hover:border-amber-300 hover:bg-amber-50/30 hover:shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400">
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-gray-900 group-hover:text-amber-600 dark:text-white dark:group-hover:text-amber-400">
                        View projects
                      </p>
                      <p className="text-[11px] text-gray-400">Inspect associated projects</p>
                    </div>
                  </div>
                  <svg className="size-4 text-gray-400 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>

                {/* Action 3: Audit history */}
                <Link
                  href="/platform/audit"
                  onClick={() => setDetailModalOrg(null)}
                  className="group flex items-center justify-between rounded-xl border border-gray-200/80 bg-white p-3.5 transition-all hover:border-purple-300 hover:bg-purple-50/30 hover:shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 dark:hover:border-purple-500/30 dark:hover:bg-purple-500/5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-100 dark:bg-purple-500/10 dark:text-purple-400">
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-gray-900 group-hover:text-purple-600 dark:text-white dark:group-hover:text-purple-400">
                        View audit history
                      </p>
                      <p className="text-[11px] text-gray-400">Recent organization events</p>
                    </div>
                  </div>
                  <svg className="size-4 text-gray-400 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>

                {/* Action 4: Edit metadata */}
                <button
                  type="button"
                  onClick={() => {
                    const target = detailModalOrg;
                    setDetailModalOrg(null);
                    handleOpenEditModal(target);
                  }}
                  disabled={!canManageOrganizations}
                  className="group flex items-center justify-between rounded-xl border border-gray-200/80 bg-white p-3.5 text-start transition-all hover:border-emerald-300 hover:bg-emerald-50/30 hover:shadow-theme-xs disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400">
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-gray-900 group-hover:text-emerald-600 dark:text-white dark:group-hover:text-emerald-400">
                        Edit metadata
                      </p>
                      <p className="text-[11px] text-gray-400">Update organization information</p>
                    </div>
                  </div>
                  <svg className="size-4 text-gray-400 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-end border-t border-gray-100 pt-4 dark:border-gray-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDetailModalOrg(null)}
                className="h-9 px-4 text-xs"
              >
                {t("cancel") || "Close"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
