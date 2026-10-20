"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRoleDisplayLabel } from "@/components/common/RoleLabel";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectQuery } from "@/lib/queries/projects/useProjects";
import ProjectState from "@/components/projects/ProjectState";
import Button from "@/components/ui/button/Button";
import {
  BookOpenIcon,
  CalenderIcon,
  CheckCircleIcon,
  DocsIcon,
  EyeIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  TaskIcon,
  TimeIcon,
} from "@/icons";
import WorkNotesActivityPanel from "./WorkNotesActivityPanel";
import WorkNotesConfigPanel from "./WorkNotesConfigPanel";
import WorkNotesKnowledgePanel from "./WorkNotesKnowledgePanel";
import WorkNotesReportPanel from "./WorkNotesReportPanel";
import WorkNoteCreateDialog from "./WorkNoteCreateDialog";
import {
  INITIAL_PREVIEW_NOTES,
  INITIAL_PREVIEW_REPORTS,
  PREVIEW_MEMBERS,
  PREVIEW_TASKS,
} from "./work-notes-preview-data";
import type {
  CreateWorkNoteInput,
  NotesWeek,
  KnowledgeStatus,
  WorkNote,
  WorkNoteKind,
  WorkNotesTab,
  WorkNotesIdentity,
  WeeklyReport,
} from "./work-notes-types";
import { getWorkNotesInitials, resolveWorkNotesRole } from "./work-notes-types";

const FIELD_CLASS =
  "h-10 min-w-0 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:placeholder:text-gray-500";

const CONTENT_TABS: readonly WorkNotesTab[] = ["ACTIVITY", "REPORTS", "KNOWLEDGE"];

export default function WorkNotesWorkspace({ projectId }: { projectId: string }) {
  const t = useTranslations("workNotes");
  const roleLabel = useRoleDisplayLabel();
  const user = useCurrentUserQuery();
  const organizationId = user.data?.organizationId ?? "";
  const project = useProjectQuery(organizationId, projectId);
  const currentUser: WorkNotesIdentity = {
    id: user.data?.id ?? "",
    name: user.data?.name ?? "",
    initials: getWorkNotesInitials(user.data?.name ?? ""),
  };
  const role = user.data && "roles" in user.data
    ? resolveWorkNotesRole(user.data.roles ?? [])
    : undefined;
  const [tab, setTab] = useState<WorkNotesTab>("ACTIVITY");
  const [notes, setNotes] = useState<WorkNote[]>([...INITIAL_PREVIEW_NOTES]);
  const [reports, setReports] = useState<WeeklyReport[]>([...INITIAL_PREVIEW_REPORTS]);
  const [search, setSearch] = useState("");
  const [member, setMember] = useState("ALL");
  const [task, setTask] = useState("ALL");
  const [kind, setKind] = useState<WorkNoteKind | "ALL">("ALL");
  const [week, setWeek] = useState<NotesWeek>("THIS_WEEK");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<WorkNoteKind>("WORK_UPDATE");
  const [announcement, setAnnouncement] = useState("");

  const projectName = project.data?.name ?? "";
  const projectCode = project.data?.code ?? "";
  const filteredNotes = useMemo(() => {
    const normalizedSearch = normalize(search);
    return notes.filter((note) => {
      const matchesSearch =
        !normalizedSearch ||
        normalize(
          [note.author, note.title, note.body, note.taskKey ?? "", ...(note.tags ?? [])].join(" "),
        ).includes(normalizedSearch);
      return (
        matchesSearch &&
        (member === "ALL" || note.author === member) &&
        (task === "ALL" || note.taskKey === task) &&
        (kind === "ALL" || note.kind === kind) &&
        (week === "ALL" || note.week === week) &&
        (!attentionOnly || role === "MEMBER" || Boolean(note.blocker || note.unfinished) || !note.viewed || (note.kind === "KNOWLEDGE" && note.knowledgeStatus !== "PUBLISHED"))
      );
    });
  }, [attentionOnly, kind, member, notes, role, search, task, week]);

  const filteredReports = useMemo(() => {
    const normalizedSearch = normalize(search);
    return reports.filter((report) => {
      const matchesSearch =
        !normalizedSearch ||
        normalize(
          [report.member, report.completed, report.blockers, report.nextWeek].join(" "),
        ).includes(normalizedSearch);
      const reportText = normalize([report.completed, report.blockers, report.nextWeek].join(" "));
      return (
        matchesSearch &&
        (member === "ALL" || report.member === member) &&
        (task === "ALL" || reportText.includes(normalize(task))) &&
        (kind === "ALL" || kind === "WEEKLY_SUMMARY") &&
        (week === "ALL" || report.week === week) &&
        (!attentionOnly || role === "MEMBER" || report.status === "MISSING" || !report.reviewed)
      );
    });
  }, [attentionOnly, kind, member, reports, role, search, task, week]);
  const currentUserReportSubmitted = reports.some(
    (report) => report.member === currentUser.name && report.week === "THIS_WEEK" && report.status === "SUBMITTED",
  );

  if (user.isPending || (organizationId && project.isPending)) return <ProjectState />;
  if (user.isError) return <ProjectState error={user.error} />;
  if (!organizationId) return <ProjectState error={new Error("No trusted organization")} />;
  if (!role) return <ProjectState error={new Error("No supported Work Notes role")} />;
  if (project.isError) {
    return <ProjectState error={project.error} retry={() => void project.refetch()} />;
  }
  if (!project.data) return <ProjectState />;

  const pendingKnowledge = notes.filter(
    (note) => note.kind === "KNOWLEDGE" && note.knowledgeStatus === "PENDING",
  ).length;
  const missingReports = reports.filter((report) => report.status === "MISSING").length;
  const reviewedReports = reports.filter((report) => report.reviewed).length;
  const blockedItems = new Set(notes.filter((note) => note.blocker).map((note) => note.taskKey ?? note.id)).size;

  function addNote(input: CreateWorkNoteInput) {
    const note: WorkNote = {
      ...input,
      id: `preview-${Date.now()}`,
      createdAt: t("justNow"),
      week: "THIS_WEEK",
      viewed: false,
    };
    setNotes((current) => [note, ...current]);
    setCreateOpen(false);
    setAnnouncement(t("noteAddedPreview"));
  }

  function updateNote(id: string, updater: (note: WorkNote) => WorkNote) {
    setNotes((current) => current.map((note) => (note.id === id ? updater(note) : note)));
  }

  function convertToKnowledge(note: WorkNote) {
    const converted: WorkNote = {
      ...note,
      id: `knowledge-${Date.now()}`,
      kind: "KNOWLEDGE",
      title: note.title,
      body: [
        note.body,
        note.blocker ? `${t("activity.blockedLabel")}: ${note.blocker}` : "",
        note.nextStep ? `${t("nextStepLabel")}: ${note.nextStep}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      knowledgeStatus: "PENDING",
      tags: [t("convertedTag")],
      createdAt: t("justNow"),
      viewed: false,
    };
    setNotes((current) => [converted, ...current]);
    setAnnouncement(t("convertedPreview"));
  }

  function updateKnowledgeStatus(id: string, status: KnowledgeStatus) {
    updateNote(id, (note) => ({ ...note, knowledgeStatus: status }));
    setAnnouncement(t(status === "PUBLISHED" ? "knowledgeApprovedPreview" : "knowledgeChangesPreview"));
  }

  function saveReport(input: Pick<WeeklyReport, "completed" | "blockers" | "nextWeek">) {
    setReports((current) => {
      const existingReport = current.some(
        (report) => report.member === currentUser.name && report.week === "THIS_WEEK",
      );
      if (existingReport) {
        return current.map((report) =>
          report.member === currentUser.name && report.week === "THIS_WEEK"
            ? { ...report, ...input, status: "SUBMITTED", updatedAt: t("justNow"), reviewed: false }
            : report,
        );
      }
      return [
        {
          id: `report-${currentUser.id}-THIS_WEEK`,
          member: currentUser.name,
          initials: currentUser.initials,
          status: "SUBMITTED",
          ...input,
          updatedAt: t("justNow"),
          reviewed: false,
          week: "THIS_WEEK",
        },
        ...current,
      ];
    });
    setAnnouncement(t("reportSavedPreview"));
  }

  function markReportReviewed(id: string) {
    setReports((current) =>
      current.map((report) => (report.id === id ? { ...report, reviewed: true } : report)),
    );
    setAnnouncement(t("reportReviewedPreview"));
  }

  const tabs: readonly WorkNotesTab[] = role === "ADMIN"
    ? [...CONTENT_TABS, "CONFIG"]
    : CONTENT_TABS;

  return (
    <div className="@container min-w-0 space-y-5 sm:space-y-6">
      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div className="min-w-0">
          <nav aria-label={t("breadcrumb")} className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <span>{projectName}</span><span aria-hidden="true">/</span><span>{t("title")}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <DocsIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">{t("title")}</h1>
              <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">{t("subtitle", { project: projectName })}</p>
            </div>
            <span className="rounded-full border border-warning-200 bg-warning-50 px-2.5 py-1 text-xs font-medium text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
              {t("previewBadge")}
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t("projectCode", { code: projectCode })}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between xl:justify-end">
          <span
            aria-label={t("currentRoleLabel", { role: roleLabel(role) })}
            className="w-fit rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300"
          >
            {roleLabel(role)}
          </span>
          {role === "MEMBER" && (
            <Button
              type="button"
              size="sm"
              startIcon={<PlusIcon className="size-4" aria-hidden="true" />}
              onClick={() => { setCreateKind("WORK_UPDATE"); setCreateOpen(true); }}
              className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              {t("createNote")}
            </Button>
          )}
        </div>
      </header>

      {role === "LEADER" && (
        <section aria-label={t("leaderSummaryLabel")} className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          <MetricCard icon={<TaskIcon className="size-5" />} value={blockedItems} label={t("metrics.blocked")} hint={t("metrics.needsHelp")} tone="error" />
          <MetricCard icon={<TimeIcon className="size-5" />} value={missingReports} label={t("metrics.missingReports")} hint={t("metrics.thisWeek")} tone="warning" />
          <MetricCard icon={<BookOpenIcon className="size-5" />} value={pendingKnowledge} label={t("metrics.pendingKnowledge")} hint={t("metrics.awaitingReview")} tone="brand" />
          <MetricCard icon={<EyeIcon className="size-5" />} value={reviewedReports} label={t("metrics.reviewedReports")} hint={t("metrics.thisWeek")} tone="success" />
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-4 pt-2 dark:border-gray-800 sm:px-5">
          <div className="flex min-w-0 gap-5 overflow-x-auto" role="tablist" aria-label={t("workspaceTabs")}>
            {tabs.map((value) => (
              <button
                key={value}
                id={`work-notes-${value.toLowerCase()}-tab`}
                role="tab"
                type="button"
                aria-selected={tab === value}
                aria-controls={`work-notes-${value.toLowerCase()}-panel`}
                tabIndex={tab === value ? 0 : -1}
                onClick={() => setTab(value)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
                  event.preventDefault();
                  const index = tabs.indexOf(value);
                  const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[tabs.length - 1] : tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
                  if (!next) return;
                  setTab(next);
                  document.getElementById(`work-notes-${next.toLowerCase()}-tab`)?.focus();
                }}
                className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${tab === value ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"}`}
              >
                {value === "ACTIVITY" ? <TimeIcon className="size-4" aria-hidden="true" /> : value === "REPORTS" ? <CalenderIcon className="size-4" aria-hidden="true" /> : value === "KNOWLEDGE" ? <BookOpenIcon className="size-4" aria-hidden="true" /> : <SettingsIcon className="size-4" aria-hidden="true" />}
                {t(`tabs.${value}`)}
                {value === "KNOWLEDGE" && pendingKnowledge > 0 && role !== "MEMBER" && (
                  <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{pendingKnowledge}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="border-b border-gray-200 bg-gray-50/70 px-4 py-3 dark:border-gray-800 dark:bg-gray-950/40 sm:px-5">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
            <label className="relative min-w-0 flex-1 xl:max-w-sm">
              <span className="sr-only">{t("searchLabel")}</span>
              <SearchIcon aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("searchPlaceholder")} className={`${FIELD_CLASS} w-full ps-9`} />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:flex-wrap">
              <FilterSelect label={t("filters.member")} value={member} onChange={setMember}>
                <option value="ALL">{t("filters.allMembers")}</option>
                {currentUser.name && !PREVIEW_MEMBERS.some((person) => person.name === currentUser.name) && (
                  <option value={currentUser.name}>{currentUser.name}</option>
                )}
                {PREVIEW_MEMBERS.map((person) => <option key={person.name} value={person.name}>{person.name}</option>)}
              </FilterSelect>
              <FilterSelect label={t("filters.task")} value={task} onChange={setTask}>
                <option value="ALL">{t("filters.allTasks")}</option>
                {PREVIEW_TASKS.map((item) => <option key={item.key} value={item.key}>{item.key}</option>)}
              </FilterSelect>
              <FilterSelect label={t("filters.noteType")} value={kind} onChange={(value) => setKind(value as WorkNoteKind | "ALL")}>
                <option value="ALL">{t("filters.allTypes")}</option>
                {(["WORK_UPDATE", "WEEKLY_SUMMARY", "KNOWLEDGE", "DECISION"] as const).map((value) => <option key={value} value={value}>{t(`kinds.${value}`)}</option>)}
              </FilterSelect>
              <FilterSelect label={t("filters.week")} value={week} onChange={(value) => setWeek(value as NotesWeek)}>
                <option value="THIS_WEEK">{t("filters.thisWeek")}</option>
                <option value="LAST_WEEK">{t("filters.lastWeek")}</option>
                <option value="ALL">{t("filters.allWeeks")}</option>
              </FilterSelect>
            </div>
            {role !== "MEMBER" && (
              <button
                type="button"
                aria-pressed={attentionOnly}
                onClick={() => setAttentionOnly((value) => !value)}
                className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${attentionOnly ? "border-warning-300 bg-warning-50 text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"}`}
              >
                <CheckCircleIcon aria-hidden="true" className="size-4" />{t("filters.attentionOnly")}
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t("previewNotice")}</p>
        </div>

        <div
          id={`work-notes-${tab.toLowerCase()}-panel`}
          role="tabpanel"
          aria-labelledby={`work-notes-${tab.toLowerCase()}-tab`}
          className="min-w-0 p-4 sm:p-5"
        >
          {tab === "ACTIVITY" && (
            <WorkNotesActivityPanel
              notes={filteredNotes.filter((note) => note.kind !== "KNOWLEDGE")}
              reports={reports}
              role={role}
              currentUserName={currentUser.name}
              currentUserReportSubmitted={currentUserReportSubmitted}
              onMarkViewed={(noteId) => {
                updateNote(noteId, (note) => ({ ...note, viewed: true }));
                setAnnouncement(t("markedViewedPreview"));
              }}
              onConvert={convertToKnowledge}
              onOpenReports={() => setTab("REPORTS")}
            />
          )}
          {tab === "REPORTS" && (
            <WorkNotesReportPanel
              role={role}
              reports={role === "MEMBER" ? reports : filteredReports}
              currentUserName={currentUser.name}
              onSubmit={saveReport}
              onMarkReviewed={markReportReviewed}
            />
          )}
          {tab === "KNOWLEDGE" && (
            <WorkNotesKnowledgePanel
              notes={filteredNotes.filter((note) => note.kind === "KNOWLEDGE")}
              role={role}
              onStatusChange={updateKnowledgeStatus}
              onCreate={() => { setCreateKind("KNOWLEDGE"); setCreateOpen(true); }}
            />
          )}
          {tab === "CONFIG" && role === "ADMIN" && <WorkNotesConfigPanel />}
        </div>
      </section>

      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
      <WorkNoteCreateDialog key={createKind} isOpen={createOpen} initialKind={createKind} currentUser={currentUser} onClose={() => setCreateOpen(false)} onCreate={addNote} />
    </div>
  );
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative min-w-0">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={`${FIELD_CLASS} w-full cursor-pointer pe-8 sm:min-w-32 xl:w-auto`}>
        {children}
      </select>
    </label>
  );
}

function MetricCard({
  icon,
  value,
  label,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  hint: string;
  tone: "error" | "warning" | "brand" | "success";
}) {
  const tones = {
    error: "bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400",
    warning: "bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-400",
    brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400",
    success: "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400",
  };
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`} aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-none text-gray-900 dark:text-white/90">{value}</p>
        <p className="mt-1 truncate text-xs font-medium text-gray-700 dark:text-gray-300">{label}</p>
        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{hint}</p>
      </div>
    </div>
  );
}
