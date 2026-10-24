"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";

export type RouteLoadingVariant =
  | "admin"
  | "projects"
  | "project-create"
  | "project-members"
  | "project-teams"
  | "project-work"
  | "project-documents"
  | "project-work-notes"
  | "project-work-reports"
  | "project-settings"
  | "project-detail"
  | "workspace"
  | "chat"
  | "notifications"
  | "platform"
  | "users"
  | "organization-members"
  | "organization-settings"
  | "team-detail"
  | "team-form"
  | "auth"
  | "landing"
  | "not-found";

function Skeleton({ className }: { className: string }) {
  return <div aria-hidden="true" className={`continuum-shimmer rounded-lg ${className}`} />;
}

function Heading({
  title,
  actionLabel,
}: {
  title?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        {title ? (
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white/90">
            {title}
          </h1>
        ) : (
          <Skeleton className="h-7 w-48" />
        )}
        <Skeleton className="h-4 w-72 max-w-[70vw]" />
      </div>
      {actionLabel ? (
        <span
          aria-hidden="true"
          className="inline-flex h-10 shrink-0 items-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white"
        >
          {actionLabel}
        </span>
      ) : null}
    </div>
  );
}

function TableRows({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div aria-hidden="true" className="divide-y divide-gray-100 dark:divide-gray-800">
      <div className="flex gap-5 bg-gray-50/70 px-5 py-3 dark:bg-gray-800/40">
        {Array.from({ length: columns }, (_, index) => (
          <div key={index} className="flex-1">
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-5 px-5 py-4">
          {Array.from({ length: columns }, (_, column) => (
            <div key={column} className="flex-1">
              <Skeleton className={`h-3.5 ${column === 0 ? "w-3/4" : column === columns - 1 ? "ms-auto w-1/2" : "w-2/3"}`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DetailContent() {
  return (
    <div aria-hidden="true" className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <Skeleton className="h-24 w-full rounded-none" />
        <div className="space-y-4 px-5 pb-4 pt-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <Skeleton className="h-12 w-12 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-3.5 w-28" />
              </div>
            </div>
            <Skeleton className="h-8 w-28 rounded-xl" />
          </div>
          <div className="flex gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs lg:col-span-2 dark:border-gray-800 dark:bg-gray-900">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
        <div className="space-y-3.5 rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function ChatContent({ title }: { title?: string }) {
  return (
    <div className="grid min-h-[32rem] grid-cols-1 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="hidden border-e border-gray-100 p-4 dark:border-gray-800 lg:block">
        <Skeleton className="mb-4 h-10 w-full rounded-xl" />
        <div className="space-y-2">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-xl p-2">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-col p-4 sm:p-6">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            {title ? (
              <h1 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                {title}
              </h1>
            ) : (
              <Skeleton className="h-4 w-40" />
            )}
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-5 py-6">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className={`flex ${item % 2 === 0 ? "justify-start" : "justify-end"}`}>
              <Skeleton className={`h-14 ${item % 2 === 0 ? "w-2/3" : "w-1/2"} rounded-2xl`} />
            </div>
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}

function NotificationsContent() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="flex items-start gap-3.5 p-4 sm:p-5">
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-3.5 w-3/4 max-w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthContent({ title }: { title?: string }) {
  return (
    <div className="mx-auto w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs sm:p-8 dark:border-gray-800 dark:bg-gray-900">
      <Skeleton className="mx-auto h-10 w-10 rounded-xl" />
      {title ? (
        <h1 className="mx-auto mt-5 text-center text-xl font-semibold text-gray-900 dark:text-white/90">
          {title}
        </h1>
      ) : (
        <Skeleton className="mx-auto mt-5 h-6 w-56 max-w-full" />
      )}
      <Skeleton className="mx-auto mt-2 h-4 w-72 max-w-full" />
      <div className="mt-8 space-y-5">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function RouteLoadingSkeleton({
  variant = "admin",
  loadingLabel,
}: {
  variant?: RouteLoadingVariant;
  loadingLabel?: string;
}) {
  const t = useTranslations("common");
  const resolvedLoadingLabel = loadingLabel ?? t("loading");
  const pathname = usePathname();
  const projects = useTranslations("projects");
  const projectMembers = useTranslations("projectMembers");
  const organizationMembers = useTranslations("organizationMembers");
  const organizationSettings = useTranslations("organizationSettings");
  const work = useTranslations("work");
  const chat = useTranslations("chat");
  const teamFoundation = useTranslations("teamFoundation");
  const workNotes = useTranslations("workNotes");
  const users = useTranslations("users");
  const platformConsole = useTranslations("platformConsole");
  const auth = useTranslations("auth");
  const authExperience = useTranslations("authExperience");
  const notifications = useTranslations("header.notifications");
  const segments = pathname.split("/").filter(Boolean);
  let resolvedVariant = variant;
  let title: string | undefined;
  let actionLabel: string | undefined;

  if (segments[0] === "platform" && segments[1] === "signin") {
    resolvedVariant = "auth";
    title = auth("platformSignIn");
  } else if (segments[0] === "signin") {
    resolvedVariant = "auth";
    title = authExperience("signinTitle");
  } else if (segments[0] === "signup") {
    resolvedVariant = "auth";
    title = authExperience("signupTitle");
  } else if (segments[0] === "reset-password") {
    resolvedVariant = "auth";
    title = auth("forgotPasswordTitle");
  } else if (segments[0] === "verify-email") {
    resolvedVariant = "auth";
    title = auth("emailRegistrationChoosePasswordTitle");
  } else if (segments[0] === "select-organization") {
    resolvedVariant = "auth";
    title = auth("googleSelectOrganization");
  } else if (segments[0] === "onboarding") {
    resolvedVariant = "auth";
    title = auth("onboardingTitle");
  } else if (segments[0] === "error-404") {
    resolvedVariant = "not-found";
  } else if (segments[0] === "projects") {
    if (segments.length === 1) {
      resolvedVariant = "projects";
      title = projects("title");
      actionLabel = projects("createNew");
    } else if (segments[1] === "new") {
      resolvedVariant = "project-create";
      title = projects("createCardTitle");
    } else {
      switch (segments[2]) {
        case "members":
          resolvedVariant = "project-members";
          title = projectMembers("title");
          actionLabel = projectMembers("add");
          break;
        case "teams":
          if (segments[3] === "new" || segments[4] === "edit") {
            resolvedVariant = "team-form";
            title = segments[4] === "edit"
              ? teamFoundation("information")
              : teamFoundation("create");
          } else if (segments[3]) {
            resolvedVariant = "team-detail";
            title = teamFoundation("information");
          } else {
            resolvedVariant = "project-teams";
            title = teamFoundation("title");
            actionLabel = teamFoundation("create");
          }
          break;
        case "work":
          resolvedVariant = "project-work";
          title = work("title");
          actionLabel = work("create");
          break;
        case "documents":
          resolvedVariant = "project-documents";
          title = projects("projectDocumentsTitle");
          break;
        case "work-notes":
          resolvedVariant = "project-work-notes";
          title = workNotes("title");
          actionLabel = workNotes("createNote");
          break;
        case "work-reports":
          resolvedVariant = "project-work-reports";
          title = projects("workReportsTitle");
          break;
        case "settings":
          resolvedVariant = "project-settings";
          title = projects("settings");
          break;
        default:
          resolvedVariant = "project-detail";
      }
    }
  } else if (segments[0] === "organization") {
    if (segments[1] === "settings") {
      resolvedVariant = "organization-settings";
      title = organizationSettings("title");
    } else {
      resolvedVariant = "organization-members";
      title = organizationMembers("title");
      actionLabel = organizationMembers("inviteButton");
    }
  } else if (segments[0] === "users") {
    resolvedVariant = "users";
    title = users("title");
  } else if (segments[0] === "workspace") {
    resolvedVariant = "workspace";
    title = work("workspaceTitle");
  } else if (segments[0] === "chat") {
    resolvedVariant = "chat";
    title = chat("title");
  } else if (segments[0] === "notifications") {
    resolvedVariant = "notifications";
    title = notifications("title");
  } else if (segments[0] === "platform") {
    resolvedVariant = "platform";
    title = platformConsole(`pages.${segments[1] || "dashboard"}.title`);
  } else if (segments[0] === "dashboard") {
    resolvedVariant = "admin";
    title = platformConsole("pages.dashboard.title");
  }

  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={resolvedLoadingLabel}
      data-loading-variant={resolvedVariant}
      className={resolvedVariant === "chat" ? "min-h-0 flex-1" : "space-y-6"}
    >
      <span className="sr-only">{resolvedLoadingLabel}</span>
      {resolvedVariant === "chat" ? (
        <ChatContent title={title} />
      ) : resolvedVariant === "notifications" ? (
        <div className="space-y-6">
          <Heading title={title} actionLabel={actionLabel} />
          <div aria-hidden="true" className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
          <NotificationsContent />
        </div>
      ) : resolvedVariant === "project-detail" ? (
        <DetailContent />
      ) : resolvedVariant === "projects" ? (
        <div className="space-y-6">
          <Heading title={title} actionLabel={actionLabel} />
          <div aria-hidden="true" className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-10 w-64 max-w-full rounded-xl" />
            <Skeleton className="h-10 w-28 rounded-xl" />
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <TableRows rows={6} columns={5} />
          </div>
        </div>
      ) : resolvedVariant === "workspace" ? (
        <div className="space-y-6">
          <Heading title={title} actionLabel={actionLabel} />
          <div aria-hidden="true" className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap gap-3 border-b border-gray-100 p-4 dark:border-gray-800">
              <Skeleton className="h-9 w-56 max-w-full rounded-xl" />
              <Skeleton className="h-9 w-28 rounded-xl" />
              <Skeleton className="h-9 w-28 rounded-xl" />
            </div>
            <TableRows rows={6} columns={5} />
          </div>
        </div>
      ) : resolvedVariant === "platform" ? (
        <div className="space-y-6">
          <Heading title={title} actionLabel={actionLabel} />
          <div aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-3 w-36" />
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <TableRows rows={5} columns={4} />
          </div>
        </div>
      ) : resolvedVariant === "auth" ? (
        <AuthContent title={title} />
      ) : resolvedVariant === "landing" ? (
        <div aria-hidden="true" className="mx-auto max-w-6xl space-y-8 px-6 py-16 text-center">
          <Skeleton className="mx-auto h-7 w-40 rounded-full" />
          <Skeleton className="mx-auto h-12 w-2/3 max-w-3xl" />
          <Skeleton className="mx-auto h-5 w-1/2 max-w-xl" />
          <Skeleton className="mx-auto h-12 w-36 rounded-xl" />
          <Skeleton className="mx-auto h-72 w-full max-w-5xl rounded-3xl" />
        </div>
      ) : resolvedVariant === "not-found" ? (
        <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
          <Skeleton className="mx-auto h-8 w-24" />
          <Skeleton className="mx-auto h-5 w-48" />
          <Skeleton className="mx-auto h-4 w-64 max-w-full" />
        </div>
      ) : resolvedVariant === "organization-settings" ? (
        <div className="space-y-6">
          <Heading title={title} />
          <div aria-hidden="true" className="flex gap-2 border-b border-gray-200 pb-3 dark:border-gray-800">
            {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-9 w-28 rounded-xl" />)}
          </div>
          <div aria-hidden="true" className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      ) : resolvedVariant === "project-work" ? (
        <div className="space-y-6">
          <Heading title={title} actionLabel={actionLabel} />
          <div aria-hidden="true" className="flex flex-wrap gap-3">
            {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-9 w-28 rounded-xl" />)}
          </div>
          <div aria-hidden="true" className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((column) => (
              <div key={column} className="space-y-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                <Skeleton className="h-4 w-24" />
                {[0, 1, 2].map((card) => <Skeleton key={card} className="h-24 rounded-lg" />)}
              </div>
            ))}
          </div>
        </div>
      ) : [
          "project-members",
          "project-teams",
          "users",
          "organization-members",
        ].includes(resolvedVariant) ? (
        <div className="space-y-6">
          <Heading title={title} actionLabel={actionLabel} />
          <div aria-hidden="true" className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-64 max-w-full rounded-xl" />
            <Skeleton className="h-10 w-40 rounded-xl" />
          </div>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <TableRows rows={6} columns={5} />
          </div>
        </div>
      ) : [
          "project-documents",
          "project-work-notes",
          "project-work-reports",
        ].includes(resolvedVariant) ? (
        <div className="space-y-6">
          <Heading title={title} actionLabel={actionLabel} />
          <div aria-hidden="true" className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-56 max-w-full rounded-xl" />
            <Skeleton className="h-10 w-36 rounded-xl" />
          </div>
          <div aria-hidden="true" className="space-y-3">
            {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-24 rounded-xl" />)}
          </div>
        </div>
      ) : ["project-settings", "team-detail", "team-form", "project-create"].includes(resolvedVariant) ? (
        <div className="space-y-6">
          <Heading title={title} />
          <div aria-hidden="true" className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <Skeleton className="h-5 w-40" />
              {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-11 w-full rounded-xl" />)}
            </div>
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-10 w-36 rounded-xl" />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <Heading title={title} actionLabel={actionLabel} />
          <div aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-3 w-36" />
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <TableRows />
          </div>
        </div>
      )}
    </section>
  );
}
