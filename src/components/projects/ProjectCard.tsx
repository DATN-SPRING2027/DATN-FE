"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { GroupIcon, LockIcon, EyeIcon, TimeIcon, ArrowRightIcon } from "@/icons";
import type { Project } from "@/lib/queries/projects/useProjects";

export default function ProjectCard({
  project,
  layout = "grid",
}: {
  project: Project;
  layout?: "grid" | "list";
}) {
  const t = useTranslations("projects");
  const format = useFormatter();
  const isList = layout === "list";
  const isActive = project.status === "ACTIVE";
  const isPrivate = project.visibility === "PRIVATE";
  const formattedUpdated = format.dateTime(new Date(project.updatedAt), {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  const initials = project.code.slice(0, 2).toUpperCase();
  const detailHref = `/projects/${encodeURIComponent(project.id)}`;
  const hasGovernanceCounts =
    typeof project.activeMemberCount === "number" ||
    typeof project.effectiveLeaderCount === "number";
  const isLeaderless =
    Boolean(project.requiresLeaderRecovery) ||
    (isActive && project.effectiveLeaderCount === 0);
  const leaderNames =
    project.leaders
      ?.map((leader) => leader.fullName || leader.email)
      .filter(Boolean)
      .join(", ") ?? "";

  const visibilityBadge = (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
        isPrivate
          ? "border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-500/25 dark:bg-warning-500/10 dark:text-warning-300"
          : "border-blue-light-200 bg-blue-light-50 text-blue-light-700 dark:border-blue-light-500/25 dark:bg-blue-light-500/10 dark:text-blue-light-300"
      }`}
    >
      {isPrivate ? (
        <LockIcon aria-hidden="true" className="h-3 w-3 shrink-0" />
      ) : (
        <EyeIcon aria-hidden="true" className="h-3 w-3 shrink-0" />
      )}
      {t(project.visibility)}
    </span>
  );

  const statusBadge = (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
        isActive
          ? "border-success-200 bg-success-50 text-success-700 dark:border-success-500/25 dark:bg-success-500/10 dark:text-success-400"
          : "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          isActive ? "bg-success-500" : "bg-gray-400"
        }`}
      />
      {t(isActive ? "active" : "archived")}
    </span>
  );

  const leaderlessBadge = isLeaderless ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-error-200 bg-error-50 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-error-700 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-300">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-error-500" />
      {t("zeroEffectiveLeaderBadge")}
    </span>
  ) : null;

  return (
    <article
      className={`group relative flex h-full min-w-0 rounded-2xl border bg-white p-5 shadow-theme-xs transition-all duration-200 hover:border-brand-300 hover:shadow-theme-md dark:bg-gray-900 dark:hover:border-brand-500/60 ${
        isLeaderless
          ? "border-error-200/90 dark:border-error-500/30"
          : "border-gray-200/90 dark:border-gray-800"
      } ${
        isList
          ? "flex-col gap-4 @xl:flex-row @xl:items-center @xl:justify-between @xl:gap-6 @xl:px-5 @xl:py-4"
          : "flex-col justify-between gap-4"
      }`}
    >
      {/* Top / Left section: Monogram + Title/Code/Badges + Description */}
      <div
        className={`flex min-w-0 flex-1 ${
          isList
            ? "items-start gap-3.5 @xl:items-center @xl:gap-4"
            : "flex-col gap-3.5"
        }`}
      >
        {/* Header row in Grid mode, or Left Avatar in List mode */}
        <div
          className={`flex items-center justify-between gap-2 ${
            isList ? "shrink-0" : ""
          }`}
        >
          <div className="flex shrink-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-100 bg-brand-50/80 text-xs font-bold tracking-wider text-brand-600 dark:border-brand-500/20 dark:bg-brand-500/15 dark:text-brand-300"
            >
              {initials}
            </span>
            {!isList && (
              <span
                title={project.code}
                className="inline-flex max-w-[112px] items-center truncate rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-tight text-gray-700 tabular-nums dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                {project.code}
              </span>
            )}
          </div>

          {/* Badges in Grid mode */}
          {!isList && (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {visibilityBadge}
              {statusBadge}
            </div>
          )}
        </div>

        {/* Title & Description */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight [overflow-wrap:anywhere]">
              <Link
                href={detailHref}
                className="cursor-pointer rounded-sm text-gray-900 transition-colors group-hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500 dark:text-white/90 dark:group-hover:text-brand-400"
              >
                {project.name}
              </Link>
            </h3>
            {isList && (
              <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-xs font-semibold tracking-tight text-gray-700 tabular-nums dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {project.code}
              </span>
            )}
          </div>
          <p
            className={`mt-1 text-sm leading-5 [overflow-wrap:anywhere] text-gray-600 dark:text-gray-400 ${
              isList ? "line-clamp-1" : "line-clamp-2 min-h-[2.5rem]"
            }`}
          >
            {project.description || t("noDescription")}
          </p>

          {/* Leader & Member Governance Summary Strip */}
          {hasGovernanceCounts && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
              {isLeaderless ? (
                leaderlessBadge
              ) : (
                typeof project.effectiveLeaderCount === "number" && (
                  <span
                    title={leaderNames || undefined}
                    className="inline-flex items-center gap-1 rounded-lg border border-brand-200/80 bg-brand-50/60 px-2 py-0.5 font-medium text-brand-700 tabular-nums dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-300"
                  >
                    <span>
                      {t("leadersCountBadge", {
                        count: project.effectiveLeaderCount,
                      })}
                    </span>
                    {leaderNames && (
                      <span className="max-w-36 truncate text-gray-600 dark:text-gray-300">
                        • {leaderNames}
                      </span>
                    )}
                  </span>
                )
              )}
              {typeof project.activeMemberCount === "number" && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 font-medium text-gray-700 tabular-nums dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  <GroupIcon aria-hidden="true" className="h-3 w-3 shrink-0" />
                  <span>
                    {t("membersCountBadge", {
                      count: project.activeMemberCount,
                    })}
                  </span>
                </span>
              )}
              {isLeaderless && (
                <Link
                  href={`${detailHref}/members`}
                  className="inline-flex items-center gap-1 rounded-lg border border-error-200 bg-error-50 px-2 py-0.5 text-xs font-semibold text-error-700 transition-colors hover:bg-error-100 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-300 dark:hover:bg-error-500/25"
                >
                  <span>{t("recoverLeaderCta")}</span>
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rtl:rotate-180"
                  />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom / Right section: Metadata & Quick Navigation */}
      <div
        className={`flex items-center justify-between gap-2 text-xs ${
          isList
            ? "flex-wrap border-t border-gray-100 pt-3 @xl:shrink-0 @xl:flex-nowrap @xl:gap-5 @xl:border-t-0 @xl:pt-0 dark:border-gray-800"
            : "mt-auto border-t border-gray-100 pt-3.5 dark:border-gray-800"
        }`}
      >
        {/* Badges in List mode */}
        {isList && (
          <div className="flex flex-wrap items-center gap-1.5 @xl:justify-end">
            {leaderlessBadge}
            {visibilityBadge}
            {statusBadge}
          </div>
        )}

        {/* Updated timestamp */}
        <div
          className={`inline-flex min-w-0 items-center gap-1.5 text-gray-500 tabular-nums dark:text-gray-400 ${
            isList ? "@xl:w-40 @xl:justify-end" : ""
          }`}
        >
          <TimeIcon
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 text-gray-400"
          />
          <time
            dateTime={project.updatedAt}
            className="truncate whitespace-nowrap tabular-nums"
          >
            {t("updatedShort", { date: formattedUpdated })}
          </time>
        </div>

        {/* Quick links */}
        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href={`${detailHref}/work`}
            className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-gray-200 bg-gray-50/80 px-2 text-xs font-medium text-gray-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
          >
            {t("work")}
          </Link>
          {isList && (
            <Link
              href={`${detailHref}/work-notes`}
              className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-gray-200 bg-gray-50/80 px-2 text-xs font-medium text-gray-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
            >
              {t("workNotes")}
            </Link>
          )}
          <Link
            href={detailHref}
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg bg-brand-50 px-2 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
          >
            <span>{t("overview")}</span>
            <ArrowRightIcon
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 rtl:rotate-180"
            />
          </Link>
        </div>
      </div>
    </article>
  );
}
