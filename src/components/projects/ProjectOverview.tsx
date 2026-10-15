"use client";

import { useId, useState } from "react";
import ProjectMembers from "./members/ProjectMembers";
import ProjectSettings from "./ProjectSettings";
import { Link } from "@/i18n/navigation";
import { useFormatter, useTranslations } from "next-intl";
import type { Project } from "@/lib/queries/projects/useProjects";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import { GroupIcon, PlusIcon, SettingsIcon } from "@/icons";

export default function ProjectOverview({ project }: { project: Project }) {
  const t = useTranslations("projects");
  const format = useFormatter();
  const memberLabels = useTranslations("projectMembers");
  const [tab, setTab] = useState<"overview" | "members" | "settings">("overview");
  const [showAddModal, setShowAddModal] = useState(false);
  const tabId = useId();
  const date = (value: string) =>
    format.dateTime(new Date(value), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    });
  const summary = [
    { label: "code", value: project.code },
    { label: "visibility", value: t(project.visibility) },
    { label: "updatedAt", value: date(project.updatedAt) },
  ];
  const context = [
    { label: "projectId", value: project.id },
    { label: "organizationId", value: project.organizationId },
    { label: "createdBy", value: project.createdBy },
    { label: "createdAt", value: date(project.createdAt) },
  ];
  const tabs = ["overview", "members", "settings"] as const;
  const tabLabel = (value: (typeof tabs)[number]) =>
    value === "overview"
      ? t("overview")
      : value === "members"
        ? memberLabels("title")
        : t("settings");
  const adjacentTab = (value: (typeof tabs)[number], direction: -1 | 1) => {
    const index = tabs.indexOf(value);
    return tabs[(index + direction + tabs.length) % tabs.length];
  };
  return (
    <div className="@container min-w-0 space-y-5 sm:space-y-6">
      <nav className="mb-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link
          href="/projects"
          className="hover:text-brand-600 dark:hover:text-brand-400"
        >
          {t("title")}
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-800 dark:text-white/90">
          {project.name}
        </span>
      </nav>
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg font-bold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
          >
            {project.code.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="max-w-full min-w-0 text-2xl font-bold [overflow-wrap:anywhere] text-gray-900 dark:text-white/90">
                {project.name}
              </h1>
              <span
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${project.status === "ACTIVE" ? "border-success-200 bg-success-50 text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-400" : "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300"}`}
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${project.status === "ACTIVE" ? "bg-success-500" : "bg-gray-500"}`}
                ></span>
                {t(project.status === "ACTIVE" ? "active" : "archived")}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {project.description || t("overviewHint")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-hidden="true"
            className="mr-2 flex size-10 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
          >
            <GroupIcon className="size-5" />
          </span>
          <span title={memberLabels("shareUnavailable")}>
            <Button variant="outline" disabled>
              {memberLabels("share")}
            </Button>
          </span>
          <Button
            ariaLabel={memberLabels("openAdd")}
            startIcon={<PlusIcon aria-hidden="true" className="size-4" />}
            onClick={() => {
              setTab("members");
              setShowAddModal(true);
            }}
          >
            {memberLabels("add")}
          </Button>
        </div>
      </header>
      <nav
        aria-label={t("sections")}
        className="min-w-0 overflow-x-auto"
      >
        <div className="flex min-w-max items-center gap-5 border-b border-gray-200 dark:border-gray-800">
          <div
            role="tablist"
            aria-label={project.name}
            className="flex items-center gap-5"
          >
            {tabs.map((value) => (
              <button
                key={value}
                id={`${tabId}-${value}-tab`}
                role="tab"
                type="button"
                aria-selected={tab === value}
                aria-controls={`${tabId}-${value}-panel`}
                tabIndex={tab === value ? 0 : -1}
                onClick={() => setTab(value)}
                onKeyDown={(event) => {
                  let next: (typeof tabs)[number];
                  if (event.key === "ArrowLeft") next = adjacentTab(value, -1);
                  else if (event.key === "ArrowRight") next = adjacentTab(value, 1);
                  else if (event.key === "Home") next = tabs[0];
                  else if (event.key === "End") next = tabs[tabs.length - 1];
                  else return;
                  event.preventDefault();
                  setTab(next);
                  document.getElementById(`${tabId}-${next}-tab`)?.focus();
                }}
                className={`shrink-0 cursor-pointer border-b-2 pb-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${tab === value ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-gray-600 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"}`}
              >
                {value === "settings" && (
                  <SettingsIcon className="me-2 inline size-4" aria-hidden="true" />
                )}
                {tabLabel(value)}
              </button>
            ))}
          </div>
          <Link
            href={`/projects/${encodeURIComponent(project.id)}/work`}
            className="inline-flex shrink-0 cursor-pointer border-b-2 border-transparent pb-3 text-sm font-medium text-gray-600 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:text-brand-400"
          >
            {t("work")}
          </Link>
          <button
            type="button"
            disabled
            title={t("comingSoon")}
            className="inline-flex shrink-0 cursor-not-allowed border-b-2 border-transparent pb-3 text-sm font-medium text-gray-400 opacity-70 dark:text-gray-500"
          >
            {t("activity")}
          </button>
          <button
            type="button"
            disabled
            title={t("comingSoon")}
            className="inline-flex shrink-0 cursor-not-allowed border-b-2 border-transparent pb-3 text-sm font-medium text-gray-400 opacity-70 dark:text-gray-500"
          >
            {t("knowledge")}
          </button>
        </div>
      </nav>
      <div
        id={`${tabId}-overview-panel`}
        role="tabpanel"
        aria-labelledby={`${tabId}-overview-tab`}
        hidden={tab !== "overview"}
        className="space-y-5 sm:space-y-6"
      >
        <dl className="grid grid-cols-1 gap-4 @xl:grid-cols-3">
          {summary.map(({ label, value }) => (
            <div
              key={label}
              className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs @xl:p-5 dark:border-gray-800 dark:bg-gray-900"
            >
              <dt className="text-sm text-gray-500 dark:text-gray-400">
                {t(label)}
              </dt>
              <dd className="mt-2 text-base font-semibold [overflow-wrap:anywhere] text-gray-800 dark:text-white/90">
                {label === "updatedAt" ? (
                  <time dateTime={project.updatedAt}>{value}</time>
                ) : (
                  value
                )}
              </dd>
            </div>
          ))}
        </dl>
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 @4xl:grid-cols-3 @4xl:gap-6">
          <ComponentCard
            title={t("description")}
            className="min-w-0 @4xl:col-span-2"
          >
            <p className="text-sm leading-6 [overflow-wrap:anywhere] whitespace-pre-wrap text-gray-600 dark:text-gray-300">
              {project.description || t("noDescription")}
            </p>
          </ComponentCard>
          <ComponentCard title={t("projectContext")} className="min-w-0">
            <dl className="space-y-5">
              {context.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">
                    {t(label)}
                  </dt>
                  <dd className="mt-1 text-sm font-medium break-all text-gray-800 dark:text-gray-200">
                    {label === "createdAt" ? (
                      <time dateTime={project.createdAt}>{value}</time>
                    ) : (
                      value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="border-t border-gray-100 pt-4 text-xs leading-5 text-gray-500 dark:border-gray-800 dark:text-gray-400">
              {t("contextHint")}
            </p>
          </ComponentCard>
        </div>
      </div>
      {tab === "members" && (
        <div
          id={`${tabId}-members-panel`}
          role="tabpanel"
          aria-labelledby={`${tabId}-members-tab`}
        >
          <ProjectMembers
            projectId={project.id}
            showAddButton={false}
            addModalOpen={showAddModal}
            onCloseAdd={() => setShowAddModal(false)}
          />
        </div>
      )}
      {tab === "settings" && (
        <div
          id={`${tabId}-settings-panel`}
          role="tabpanel"
          aria-labelledby={`${tabId}-settings-tab`}
          tabIndex={0}
          className="space-y-5"
        >
          <ProjectSettings project={project} />
        </div>
      )}
    </div>
  );
}
