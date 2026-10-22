"use client";

import { useState, type ReactNode, type SVGProps } from "react";
import RoleLabel from "@/components/common/RoleLabel";
import { Link } from "@/i18n/navigation";
import type {
  Project,
  ProjectLeaderSummary,
} from "@/lib/queries/projects/useProjects";

type IconProps = SVGProps<SVGSVGElement>;

function SvgIcon({ children, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

export function BarChart3(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </SvgIcon>
  );
}

export function Briefcase(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </SvgIcon>
  );
}

export function ChevronRight(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="m9 18 6-6-6-6" />
    </SvgIcon>
  );
}

export function Code2(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="m18 16 4-4-4-4" />
      <path d="m6 8-4 4 4 4" />
      <path d="m14.5 4-5 16" />
    </SvgIcon>
  );
}

export function Cpu(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <rect width="16" height="16" x="4" y="4" rx="2" />
      <rect width="6" height="6" x="9" y="9" rx="1" />
      <path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" />
    </SvgIcon>
  );
}

export function FolderKanban(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
      <path d="M8 10v4M12 10v2M16 10v6" />
    </SvgIcon>
  );
}

export function Globe(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </SvgIcon>
  );
}

export function Layers(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </SvgIcon>
  );
}

export function LayoutPanelTop(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <rect width="18" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
    </SvgIcon>
  );
}

export function Lock(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </SvgIcon>
  );
}

export function Mail(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </SvgIcon>
  );
}

export function Palette(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </SvgIcon>
  );
}

export function Tag(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
    </SvgIcon>
  );
}

export interface TailAdminProjectTheme {
  id: "blue" | "emerald" | "amber" | "purple" | "cyan";
  coverBgClass: string;
  wavePrimaryFill: string;
  waveSecondaryFill: string;
  waveStroke: string;
  iconTextClass: string;
  monogramClass: string;
}

const TAILADMIN_PROJECT_THEMES: readonly TailAdminProjectTheme[] = [
  {
    id: "blue",
    coverBgClass:
      "bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 dark:from-sky-600 dark:via-blue-700 dark:to-indigo-800",
    wavePrimaryFill: "rgba(255, 255, 255, 0.24)",
    waveSecondaryFill: "rgba(30, 64, 175, 0.22)",
    waveStroke: "rgba(255, 255, 255, 0.48)",
    iconTextClass: "text-blue-600 dark:text-blue-400",
    monogramClass:
      "border-blue-200/80 bg-blue-50 text-blue-600 dark:border-blue-500/25 dark:bg-blue-500/15 dark:text-blue-300",
  },
  {
    id: "emerald",
    coverBgClass:
      "bg-gradient-to-br from-emerald-200 via-teal-300 to-emerald-500 dark:from-emerald-800 dark:via-teal-700 dark:to-emerald-600",
    wavePrimaryFill: "rgba(255, 255, 255, 0.42)",
    waveSecondaryFill: "rgba(16, 185, 129, 0.24)",
    waveStroke: "rgba(255, 255, 255, 0.65)",
    iconTextClass: "text-emerald-600 dark:text-emerald-400",
    monogramClass:
      "border-emerald-200/80 bg-emerald-50 text-emerald-600 dark:border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    id: "amber",
    coverBgClass:
      "bg-gradient-to-br from-amber-100 via-orange-200 to-amber-300 dark:from-amber-900/85 dark:via-orange-800/80 dark:to-amber-700",
    wavePrimaryFill: "rgba(255, 255, 255, 0.48)",
    waveSecondaryFill: "rgba(245, 158, 11, 0.22)",
    waveStroke: "rgba(255, 255, 255, 0.68)",
    iconTextClass: "text-amber-500 dark:text-amber-400",
    monogramClass:
      "border-amber-200/80 bg-amber-50 text-amber-600 dark:border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    id: "purple",
    coverBgClass:
      "bg-gradient-to-br from-purple-100 via-fuchsia-200 to-violet-400 dark:from-purple-900/85 dark:via-fuchsia-800/75 dark:to-violet-700",
    wavePrimaryFill: "rgba(255, 255, 255, 0.46)",
    waveSecondaryFill: "rgba(139, 92, 246, 0.24)",
    waveStroke: "rgba(255, 255, 255, 0.64)",
    iconTextClass: "text-purple-600 dark:text-purple-400",
    monogramClass:
      "border-purple-200/80 bg-purple-50 text-purple-600 dark:border-purple-500/25 dark:bg-purple-500/15 dark:text-purple-300",
  },
  {
    id: "cyan",
    coverBgClass:
      "bg-gradient-to-br from-cyan-200 via-sky-300 to-indigo-400 dark:from-cyan-900 dark:via-sky-800 dark:to-indigo-700",
    wavePrimaryFill: "rgba(255, 255, 255, 0.42)",
    waveSecondaryFill: "rgba(14, 165, 233, 0.24)",
    waveStroke: "rgba(255, 255, 255, 0.62)",
    iconTextClass: "text-sky-600 dark:text-sky-400",
    monogramClass:
      "border-sky-200/80 bg-sky-50 text-sky-600 dark:border-sky-500/25 dark:bg-sky-500/15 dark:text-sky-300",
  },
] as const;

const AVATAR_PASTEL_PALETTES: readonly string[] = [
  "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getTailAdminProjectTheme(
  seed: string,
  indexFallback?: number,
): TailAdminProjectTheme {
  if (typeof indexFallback === "number" && indexFallback >= 0) {
    return TAILADMIN_PROJECT_THEMES[
      indexFallback % TAILADMIN_PROJECT_THEMES.length
    ];
  }
  const index = hashSeed(seed || "PROJECT") % TAILADMIN_PROJECT_THEMES.length;
  return TAILADMIN_PROJECT_THEMES[index];
}

export function getProjectInitials(code?: string, name?: string): string {
  const cleanCode = (code ?? "").trim();
  if (cleanCode.length > 0) {
    return cleanCode.slice(0, 2).toUpperCase();
  }
  const cleanName = (name ?? "").trim();
  const words = cleanName.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return cleanName.slice(0, 2).toUpperCase() || "PJ";
}

export function getMemberInitials(fullName?: string, email?: string): string {
  const source = (fullName ?? "").trim() || (email ?? "").trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || "MB";
}

/**
 * Renders a project icon ONLY from explicit icon key or explicit category field.
 * Never guesses project type or icon from the project's name.
 */
export function renderExplicitProjectIcon(
  iconKey?: string | null,
  category?: string | null,
  className = "size-4",
  fallbackToDefault = false,
): ReactNode {
  const raw = (iconKey?.trim() || category?.trim() || "").toLowerCase();
  if (!raw) {
    return fallbackToDefault ? (
      <FolderKanban aria-hidden={true} className={className} />
    ) : null;
  }

  if (raw.includes("market") || raw.includes("web") || raw.includes("layout")) {
    return <LayoutPanelTop aria-hidden={true} className={className} />;
  }
  if (raw.includes("data") || raw.includes("analytic") || raw.includes("chart")) {
    return <BarChart3 aria-hidden={true} className={className} />;
  }
  if (raw.includes("design") || raw.includes("brand") || raw.includes("ui")) {
    return <Palette aria-hidden={true} className={className} />;
  }
  if (raw.includes("dev") || raw.includes("code") || raw.includes("eng") || raw.includes("mobile")) {
    return <Code2 aria-hidden={true} className={className} />;
  }
  if (raw.includes("ai") || raw.includes("ml") || raw.includes("tech")) {
    return <Cpu aria-hidden={true} className={className} />;
  }
  if (raw.includes("ops") || raw.includes("business")) {
    return <Briefcase aria-hidden={true} className={className} />;
  }
  if (raw === "layers") {
    return <Layers aria-hidden={true} className={className} />;
  }
  return <FolderKanban aria-hidden={true} className={className} />;
}

/**
 * Unified Project Cover / Fallback Badge for Project Rows.
 * Rules applied:
 * - Has cover image (`coverImageUrl`): displays user-selected image with unified crop (`object-cover`).
 * - No cover image: displays TailAdmin color surface + default project icon or project initials badge.
 */
export function ProjectCoverThumbnail({
  project,
  index,
  badgeMode = "auto",
}: {
  project: Pick<
    Project,
    "id" | "code" | "name" | "coverImageUrl" | "icon" | "category"
  >;
  index?: number;
  badgeMode?: "auto" | "icon" | "initials";
}) {
  const theme = getTailAdminProjectTheme(project.id || project.code, index);
  const coverImageUrl = project.coverImageUrl?.trim() || "";
  const explicitIconNode = renderExplicitProjectIcon(
    project.icon,
    project.category,
    "size-3.5 sm:size-4",
    badgeMode === "icon",
  );
  const initials = getProjectInitials(project.code, project.name);
  const showIcon =
    badgeMode === "icon" ||
    (badgeMode === "auto" && explicitIconNode !== null);

  return (
    <div
      aria-hidden="true"
      className={`relative h-12 w-24 shrink-0 overflow-hidden rounded-xl border border-gray-200/50 sm:h-14 sm:w-28 dark:border-gray-700/60 ${
        coverImageUrl ? "bg-gray-100 dark:bg-gray-800" : theme.coverBgClass
      }`}
    >
      {coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverImageUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover object-center"
        />
      ) : (
        <svg
          viewBox="0 0 160 72"
          fill="none"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <path
            d="M-12 46 C 32 14, 86 68, 172 20 L 172 80 L -12 80 Z"
            fill={theme.wavePrimaryFill}
          />
          <path
            d="M-12 58 C 48 30, 108 18, 172 48 L 172 80 L -12 80 Z"
            fill={theme.waveSecondaryFill}
          />
          <path
            d="M-6 36 C 38 10, 96 52, 166 16"
            stroke={theme.waveStroke}
            strokeWidth="1.5"
          />
        </svg>
      )}

      {/* Corner Identity Badge: Default Icon or Project Initials */}
      <span
        className={`absolute right-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-lg bg-white/95 shadow-2xs ring-1 ring-black/5 backdrop-blur-xs sm:size-7 dark:bg-gray-900/95 dark:ring-white/10 ${theme.iconTextClass}`}
      >
        {showIcon ? (
          explicitIconNode
        ) : (
          <span className="text-[10px] font-bold tracking-tight uppercase sm:text-[11px]">
            {initials}
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * Square Project Avatar for Grid Cards & Detail Headers.
 * Uses user cover image if present (cropped uniformly), otherwise TailAdmin color + initials or default icon.
 */
export function ProjectSquareAvatar({
  project,
  size = "md",
}: {
  project: Pick<
    Project,
    "id" | "code" | "name" | "coverImageUrl" | "icon" | "category"
  >;
  size?: "sm" | "md" | "lg";
}) {
  const theme = getTailAdminProjectTheme(project.id || project.code);
  const coverImageUrl = project.coverImageUrl?.trim() || "";
  const initials = getProjectInitials(project.code, project.name);
  const explicitIconNode = renderExplicitProjectIcon(
    project.icon,
    project.category,
    size === "lg" ? "size-6" : "size-4",
  );

  const sizeClass =
    size === "lg"
      ? "size-14 rounded-2xl text-base"
      : size === "sm"
        ? "size-9 rounded-xl text-xs"
        : "size-10 rounded-xl text-xs";

  if (coverImageUrl) {
    return (
      <span
        aria-hidden="true"
        className={`relative inline-flex shrink-0 overflow-hidden border border-gray-200/80 bg-gray-100 dark:border-gray-700 dark:bg-gray-800 ${sizeClass}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverImageUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover object-center"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center border font-bold tracking-wider uppercase ${sizeClass} ${theme.monogramClass}`}
    >
      {explicitIconNode ?? initials}
    </span>
  );
}

/**
 * Interactive Member Avatar with Floating Member Info Hover Card.
 * Displays full name, email, role badge, and status when hovered or focused.
 */
export function MemberAvatarWithHoverCard({
  userId,
  fullName,
  email,
  avatarUrl,
  roleCode,
  youBadgeLabel,
  size = "sm",
  index = 0,
}: {
  userId: string;
  fullName?: string;
  email?: string;
  avatarUrl?: string | null;
  roleCode?: "TEAM_LEADER" | "MEMBER" | "ADMIN";
  youBadgeLabel?: string;
  size?: "sm" | "lg";
  index?: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const displayName = (fullName ?? "").trim() || (email ?? "").trim() || "Member";
  const displayEmail =
    email && email.trim() && email.trim().toLowerCase() !== displayName.toLowerCase()
      ? email.trim()
      : null;
  const initials = getMemberInitials(fullName, email);
  const palette =
    AVATAR_PASTEL_PALETTES[
      hashSeed(userId || initials || String(index)) %
        AVATAR_PASTEL_PALETTES.length
    ];
  const avatarSizeClass =
    size === "lg" ? "size-11 text-xs" : "size-7 text-[10px]";

  const roleBadgeClass =
    roleCode === "TEAM_LEADER"
      ? "bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300"
      : roleCode === "ADMIN"
        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
        : "bg-slate-100 text-slate-700 dark:bg-gray-800 dark:text-gray-300";

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
    >
      <button
        type="button"
        aria-label={displayName}
        className={`relative flex shrink-0 cursor-pointer items-center justify-center rounded-full font-bold tracking-tight ring-2 ring-white transition-transform duration-150 hover:z-30 hover:scale-105 hover:ring-indigo-300 focus-visible:z-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:ring-gray-900 dark:hover:ring-indigo-500/60 ${avatarSizeClass} ${
          avatarUrl ? "overflow-hidden bg-gray-100 dark:bg-gray-800" : palette
        }`}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={displayName}
            className="size-full rounded-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </button>

      {isHovered && (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2.5 w-max max-w-[260px] min-w-[205px] -translate-x-1/2 rounded-xl border border-gray-200/90 bg-white p-3 text-left shadow-lg ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-900 dark:ring-white/10"
        >
          <div className="flex items-center gap-2.5">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="size-9 shrink-0 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700"
              />
            ) : (
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold tracking-tight ${palette}`}
              >
                {initials}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-xs font-semibold text-gray-900 dark:text-white">
                  {displayName}
                </p>
                {youBadgeLabel && (
                  <span className="inline-flex shrink-0 items-center rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
                    {youBadgeLabel}
                  </span>
                )}
              </div>
              {displayEmail && (
                <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-gray-500 dark:text-gray-400">
                  <Mail aria-hidden="true" className="size-3 shrink-0" />
                  <span className="truncate">{displayEmail}</span>
                </p>
              )}
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${roleBadgeClass}`}
            >
              <RoleLabel roleCode={roleCode ?? "MEMBER"} />
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-emerald-500"
              />
              Active
            </span>
          </div>

          <span
            aria-hidden="true"
            className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 border-r border-b border-gray-200/90 bg-white dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Stacked Member Avatars with +N overflow badge and interactive member info hover cards.
 * Shows the first few members (`maxVisible`, default 3) and groups the rest into `+N`.
 */
export function ProjectMemberAvatarGroup({
  members,
  totalCount,
  fallbackMemberName,
  maxVisible = 3,
}: {
  members?: readonly ProjectLeaderSummary[];
  totalCount: number;
  fallbackMemberName?: string;
  maxVisible?: number;
}) {
  const [isOverflowHovered, setIsOverflowHovered] = useState(false);
  const knownMembers = members && members.length > 0 ? members : [];
  const visibleMembers: Array<{
    key: string;
    fullName: string;
    email?: string;
    avatarUrl?: string | null;
    roleCode?: "TEAM_LEADER" | "MEMBER" | "ADMIN";
  }> =
    knownMembers.length > 0
      ? knownMembers.slice(0, maxVisible).map((member) => ({
          key: member.userId,
          fullName: member.fullName || member.email,
          email: member.email,
          avatarUrl: member.avatarUrl,
          roleCode: member.roleCode,
        }))
      : totalCount > 0 && fallbackMemberName
        ? [
            {
              key: "fallback-primary",
              fullName: fallbackMemberName,
              roleCode: "TEAM_LEADER",
            },
          ]
        : [];

  const overflowMembers =
    knownMembers.length > maxVisible ? knownMembers.slice(maxVisible) : [];
  const remainingCount = Math.max(0, totalCount - visibleMembers.length);

  if (visibleMembers.length === 0 && totalCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5">
      {visibleMembers.length > 0 && (
        <div className="flex -space-x-2">
          {visibleMembers.map((member, idx) => (
            <MemberAvatarWithHoverCard
              key={member.key}
              userId={member.key}
              fullName={member.fullName}
              email={member.email}
              avatarUrl={member.avatarUrl}
              roleCode={member.roleCode}
              index={idx}
              size="sm"
            />
          ))}
        </div>
      )}

      {remainingCount > 0 && (
        <div
          className="relative inline-flex"
          onMouseEnter={() => setIsOverflowHovered(true)}
          onMouseLeave={() => setIsOverflowHovered(false)}
          onFocus={() => setIsOverflowHovered(true)}
          onBlur={() => setIsOverflowHovered(false)}
        >
          <button
            type="button"
            aria-label={`+${remainingCount} more members`}
            className="inline-flex h-6 min-w-6 cursor-pointer items-center justify-center rounded-lg bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600 tabular-nums transition hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            +{remainingCount}
          </button>

          {isOverflowHovered && overflowMembers.length > 0 && (
            <div
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2.5 w-max max-w-[260px] min-w-[200px] -translate-x-1/2 rounded-xl border border-gray-200/90 bg-white p-2.5 text-left shadow-lg ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-900 dark:ring-white/10"
            >
              <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                +{remainingCount} more members
              </p>
              <ul className="space-y-1.5">
                {overflowMembers.map((extra, idx) => {
                  const initials = getMemberInitials(
                    extra.fullName,
                    extra.email,
                  );
                  const palette =
                    AVATAR_PASTEL_PALETTES[
                      hashSeed(extra.userId || initials || String(idx)) %
                        AVATAR_PASTEL_PALETTES.length
                    ];
                  return (
                    <li
                      key={extra.userId}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${palette}`}
                        >
                          {initials}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-gray-900 dark:text-white">
                            {extra.fullName || extra.email}
                          </p>
                          {extra.email &&
                            extra.email !== extra.fullName && (
                              <p className="truncate text-[10px] text-gray-500 dark:text-gray-400">
                                {extra.email}
                              </p>
                            )}
                        </div>
                      </div>
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 dark:bg-gray-800 dark:text-gray-300">
                        <RoleLabel roleCode={extra.roleCode ?? "MEMBER"} />
                      </span>
                    </li>
                  );
                })}
              </ul>
              <span
                aria-hidden="true"
                className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 border-r border-b border-gray-200/90 bg-white dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Single-row Project List Item separated by thin horizontal dividers (`divide-y`).
 * Strictly follows the user's 6 design rules:
 * 1. Cover image if present (`object-cover`), otherwise TailAdmin default icon / initials thumbnail.
 * 2. Category tag shown ONLY when `project.category` actually exists in data (never guessed from name).
 * 3. Core info: Name, Status, Access Scope (`Private` / `Public`), and Member Count.
 * 4. One row per project with thin divider; no bulky outer card per row.
 * 5. Member avatars: first few members shown, remaining grouped as `+N`.
 */
export function ProjectDirectoryRow({
  project,
  index,
  statusLabel,
  visibilityLabel,
  memberCountLabel,
  actionAriaLabel,
  actionHref,
  fallbackMemberName,
  leaderlessBadgeLabel,
}: {
  project: Project;
  index?: number;
  statusLabel: string;
  visibilityLabel: string;
  memberCountLabel: string;
  actionAriaLabel: string;
  actionHref?: string;
  fallbackMemberName?: string;
  leaderlessBadgeLabel?: string;
}) {
  const isActive = project.status === "ACTIVE";
  const isPrivate = project.visibility === "PRIVATE";
  const category = project.category?.trim() || null;
  const memberCount = project.activeMemberCount ?? 0;
  const memberList = project.memberPreviews ?? project.leaders ?? [];
  const detailHref = `/projects/${encodeURIComponent(project.id)}`;
  const targetActionHref = actionHref ?? detailHref;

  return (
    <article className="group flex flex-col gap-3 py-3.5 transition-colors first:pt-1 last:pb-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      {/* Left: Unified Thumbnail + Project Name & Metadata Line */}
      <div className="flex min-w-0 flex-1 items-center gap-3.5 sm:gap-4">
        <Link
          href={detailHref}
          tabIndex={-1}
          aria-hidden="true"
          className="shrink-0 rounded-xl transition-transform group-hover:scale-[1.01]"
        >
          <ProjectCoverThumbnail project={project} index={index} />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={detailHref}
              className="truncate text-sm font-semibold text-gray-900 transition-colors hover:text-brand-600 sm:text-base dark:text-white dark:hover:text-brand-400"
            >
              {project.name}
            </Link>

            {leaderlessBadgeLabel && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 text-[11px] font-medium text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-warning-500"
                />
                {leaderlessBadgeLabel}
              </span>
            )}
          </div>

          {/* Core Metadata Line: Status • (Category if real) • Visibility */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            {/* 1. Status */}
            <span
              className={`inline-flex items-center gap-1.5 font-medium ${
                isActive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${
                  isActive ? "bg-emerald-500" : "bg-gray-400"
                }`}
              />
              {statusLabel}
            </span>

            {/* 2. Category (ONLY rendered if project.category actually exists) */}
            {category && (
              <>
                <span
                  aria-hidden="true"
                  className="text-gray-300 dark:text-gray-600"
                >
                  •
                </span>
                <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                  <Tag aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="truncate">{category}</span>
                </span>
              </>
            )}

            {/* 3. Access Scope (Visibility) */}
            <span
              aria-hidden="true"
              className="text-gray-300 dark:text-gray-600"
            >
              •
            </span>
            <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
              {isPrivate ? (
                <Lock aria-hidden="true" className="size-3.5 shrink-0" />
              ) : (
                <Globe aria-hidden="true" className="size-3.5 shrink-0" />
              )}
              <span>{visibilityLabel}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Right: Member Avatars (+N) + Member Count + Action Chevron */}
      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end sm:gap-4">
        <div className="flex items-center gap-2.5">
          <ProjectMemberAvatarGroup
            members={memberList}
            totalCount={memberCount}
            fallbackMemberName={fallbackMemberName}
            maxVisible={3}
          />
          <span className="text-xs font-medium whitespace-nowrap text-gray-600 tabular-nums dark:text-gray-300">
            {memberCountLabel}
          </span>
        </div>

        <Link
          href={targetActionHref}
          aria-label={actionAriaLabel}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-50/90 text-indigo-600 transition hover:bg-indigo-100 dark:bg-gray-800 dark:text-indigo-300 dark:hover:bg-gray-700"
        >
          <ChevronRight aria-hidden="true" className="size-4" />
          <span className="sr-only">{actionAriaLabel}</span>
        </Link>
      </div>
    </article>
  );
}
