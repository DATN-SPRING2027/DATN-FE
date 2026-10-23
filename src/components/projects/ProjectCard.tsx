"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Folder, Globe, Lock, MoreVertical, Tag } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { TimeIcon, ArrowRightIcon } from "@/icons";
import type { Project } from "@/lib/queries/projects/useProjects";
import {
  getProjectInitials,
  MemberAvatarWithHoverCard,
  ProjectDirectoryRow,
  renderExplicitProjectIcon,
} from "./ProjectVisualIdentity";

export default function ProjectCard({
  project,
  layout = "grid",
  index,
}: {
  project: Project;
  layout?: "grid" | "list";
  index?: number;
}) {
  const t = useTranslations("projects");
  const format = useFormatter();
  const isList = layout === "list";
  const isActive = project.status === "ACTIVE";
  const isPrivate = project.visibility === "PRIVATE";
  const category = project.category?.trim() || null;
  const formattedUpdated = format.dateTime(new Date(project.updatedAt), {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  const detailHref = `/projects/${encodeURIComponent(project.id)}`;
  const isLeaderless =
    Boolean(project.requiresLeaderRecovery) ||
    (isActive && project.effectiveLeaderCount === 0);
  const primaryLeader = project.leaders?.[0];
  const memberPreviews = project.memberPreviews ?? project.leaders ?? [];
  const memberCount = project.activeMemberCount ?? memberPreviews.length;
  const visibleMembers = memberPreviews.slice(0, 3);
  const remainingMembers = Math.max(0, memberCount - visibleMembers.length);

  if (isList) {
    return (
      <ProjectDirectoryRow
        project={project}
        index={index}
        statusLabel={t(isActive ? "active" : "archived")}
        visibilityLabel={t(project.visibility)}
        memberCountLabel={t("membersCountBadge", { count: memberCount })}
        actionHref={isLeaderless ? `${detailHref}/members` : detailHref}
        actionAriaLabel={
          isLeaderless
            ? t("recoverLeaderCta")
            : `${t("overview")} ${project.name}`
        }
        leaderlessBadgeLabel={
          isLeaderless ? t("zeroEffectiveLeaderBadge") : undefined
        }
      />
    );
  }

  const explicitIcon = renderExplicitProjectIcon(
    project.icon,
    project.category,
    "size-5",
  );

  const visibilityBadge = (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 whitespace-nowrap dark:bg-gray-800 dark:text-gray-300">
      {isPrivate ? (
        <Lock aria-hidden="true" className="h-3 w-3 shrink-0" />
      ) : (
        <Globe aria-hidden="true" className="h-3 w-3 shrink-0" />
      )}
      {t(project.visibility)}
    </span>
  );

  const statusBadge = (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
        isActive
          ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400"
          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
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

  return (
    <article
      className={`group relative flex h-full min-w-0 flex-col justify-between rounded-2xl border bg-white p-5 shadow-theme-xs transition-all duration-200 hover:border-brand-300 hover:shadow-theme-md dark:bg-gray-900 dark:hover:border-brand-500/60 ${
        isLeaderless
          ? "border-error-200/90 dark:border-error-500/30"
          : "border-gray-200/90 dark:border-gray-800"
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Row: Rounded Icon Tile + Visibility & Status Pills + 3-dots Ornament */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            {project.coverImageUrl?.trim() ? (
              <span
                aria-hidden="true"
                className="relative flex size-12 shrink-0 overflow-hidden rounded-2xl border border-gray-200/80 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={project.coverImageUrl.trim()}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
              >
                {explicitIcon ?? <Folder aria-hidden="true" className="size-5" />}
              </span>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              {visibilityBadge}
              {statusBadge}
              {category && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 whitespace-nowrap dark:bg-gray-800 dark:text-gray-300">
                  <Tag aria-hidden="true" className="h-3 w-3 shrink-0" />
                  {category}
                </span>
              )}
            </div>
          </div>

          <MoreVertical
            aria-hidden="true"
            className="mt-1 size-4 shrink-0 text-gray-400 dark:text-gray-500"
          />
        </div>

        {/* Project Name & Description */}
        <div className="mt-4 min-w-0">
          <h3 className="text-lg font-bold tracking-tight [overflow-wrap:anywhere]">
            <Link
              href={detailHref}
              className="cursor-pointer rounded-sm text-gray-900 transition-colors group-hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500 dark:text-white/90 dark:group-hover:text-brand-400"
            >
              {project.name}
            </Link>
          </h3>
          <span className="sr-only">{project.code}</span>
          <p className="mt-1 line-clamp-1 text-sm text-gray-500 dark:text-gray-400">
            {project.description || t("noDescription")}
          </p>
        </div>

        {/* 2-Column Governance Split: Leader (Left) | Members (Right) */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-y border-gray-100 py-3.5 dark:border-gray-800">
          {/* Left: Leader */}
          <div className="min-w-0 border-r border-gray-100 pr-3 dark:border-gray-800">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500">
              {t("cardLeaderLabel")}
            </p>
            <div className="mt-2 flex min-w-0 items-center gap-2">
              {isLeaderless ? (
                <Link
                  href={`${detailHref}/members`}
                  className="inline-flex items-center gap-1 rounded-lg border border-error-200 bg-error-50 px-2 py-1 text-[11px] font-semibold text-error-700 transition-colors hover:bg-error-100 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-300"
                >
                  <span>{t("recoverLeaderCta")}</span>
                  <ArrowRightIcon
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="h-3 w-3 shrink-0 rtl:rotate-180"
                  />
                </Link>
              ) : primaryLeader ? (
                <>
                  <MemberAvatarWithHoverCard
                    userId={primaryLeader.userId}
                    fullName={primaryLeader.fullName || primaryLeader.email}
                    email={primaryLeader.email}
                    avatarUrl={primaryLeader.avatarUrl}
                    roleCode={primaryLeader.roleCode ?? "TEAM_LEADER"}
                    size="sm"
                  />
                  <span className="truncate text-xs font-semibold text-gray-700 dark:text-gray-200">
                    {primaryLeader.fullName || primaryLeader.email}
                  </span>
                </>
              ) : (
                <>
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {getProjectInitials(project.code, project.name)}
                  </span>
                  <span className="truncate text-xs font-medium text-gray-600 dark:text-gray-300">
                    {t("leadersCountBadge", {
                      count: project.effectiveLeaderCount ?? 1,
                    })}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: Members */}
          <div className="min-w-0 pl-1">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500">
              {t("cardMembersLabel")}
            </p>
            <div className="mt-2 flex min-w-0 items-center gap-1.5">
              {visibleMembers.length > 0 && (
                <div className="flex -space-x-2">
                  {visibleMembers.map((member, idx) => (
                    <MemberAvatarWithHoverCard
                      key={member.userId}
                      userId={member.userId}
                      fullName={member.fullName || member.email}
                      email={member.email}
                      avatarUrl={member.avatarUrl}
                      roleCode={member.roleCode}
                      index={idx}
                      size="sm"
                    />
                  ))}
                </div>
              )}
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-gray-200 bg-gray-50 px-2 text-[11px] font-semibold text-gray-600 tabular-nums dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                +{remainingMembers}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Updated Date + Work & Overview Buttons */}
      <div className="mt-3.5 flex items-center justify-between gap-2 text-xs">
        <div className="inline-flex min-w-0 items-center gap-1.5 text-gray-500 tabular-nums dark:text-gray-400">
          <TimeIcon
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="h-3.5 w-3.5 shrink-0 text-gray-400"
          />
          <time
            dateTime={project.updatedAt}
            className="truncate whitespace-nowrap tabular-nums"
          >
            {t("updatedShort", { date: formattedUpdated })}
          </time>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`${detailHref}/work`}
            className="inline-flex h-8 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-2xs transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {t("work")}
          </Link>
          <Link
            href={detailHref}
            className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50/70 px-3 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-100/80 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
          >
            <span>{t("overview")}</span>
            <ArrowRightIcon
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-3.5 w-3.5 shrink-0 rtl:rotate-180"
            />
          </Link>
        </div>
      </div>
    </article>
  );
}
