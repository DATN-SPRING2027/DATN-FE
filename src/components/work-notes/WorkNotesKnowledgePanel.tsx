"use client";

import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { BookOpenIcon, CheckCircleIcon, CloseLineIcon, PlusIcon } from "@/icons";
import type { KnowledgeStatus, WorkNote, WorkNotesRole } from "./work-notes-types";

export default function WorkNotesKnowledgePanel({
  notes,
  role,
  onStatusChange,
  onCreate,
}: {
  notes: readonly WorkNote[];
  role: WorkNotesRole;
  onStatusChange: (id: string, status: KnowledgeStatus) => void;
  onCreate: () => void;
}) {
  const t = useTranslations("workNotes");
  const awaitingReview = notes.filter((note) => note.knowledgeStatus === "PENDING").length;

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">{role === "LEADER" ? t("knowledge.reviewQueue") : t("knowledge.title")}</h2>
            {role === "LEADER" && awaitingReview > 0 && <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-semibold text-white">{awaitingReview}</span>}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{role === "LEADER" ? t("knowledge.leaderDescription") : t("knowledge.description")}</p>
        </div>
        {role === "MEMBER" && (
          <Button type="button" size="sm" startIcon={<PlusIcon aria-hidden="true" className="size-4" />} onClick={onCreate}>
            {t("knowledge.create")}
          </Button>
        )}
      </div>

      {notes.length === 0 ? (
        <div role="status" className="rounded-xl border border-dashed border-gray-300 px-5 py-12 text-center dark:border-gray-700">
          <BookOpenIcon className="mx-auto size-7 text-gray-400" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-gray-800 dark:text-gray-200">{t("knowledge.emptyTitle")}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("knowledge.emptyDescription")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @5xl:grid-cols-3">
          {notes.map((note) => (
            <article key={note.id} className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs transition hover:border-brand-200 hover:shadow-theme-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/30">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"><BookOpenIcon aria-hidden="true" className="size-4" /></span>
                <KnowledgeStatusPill status={note.knowledgeStatus ?? "PENDING"} label={t(`knowledge.status.${note.knowledgeStatus ?? "PENDING"}`)} />
              </div>
              <h3 className="mt-4 text-sm font-semibold leading-5 text-gray-900 dark:text-white/90">{note.title}</h3>
              <p className="mt-2 line-clamp-3 min-h-14 text-xs leading-5 text-gray-500 dark:text-gray-400">{note.body}</p>
              {note.taskKey && <p className="mt-3 text-xs font-medium text-brand-600 dark:text-brand-400">{note.taskKey}</p>}
              <div className="mt-auto pt-4">
                {(note.tags?.length ?? 0) > 0 && (
                  <ul className="flex flex-wrap gap-1.5" aria-label={t("knowledge.tagsLabel")}>
                    {note.tags?.map((tag) => <li key={tag} className="rounded-full bg-gray-100 px-2 py-1 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">{tag}</li>)}
                  </ul>
                )}
                <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <Avatar initials={note.initials} />
                  <span className="min-w-0 truncate">{t("knowledge.updatedBy", { member: note.author })}</span>
                  <span aria-hidden="true">·</span><time className="shrink-0">{note.createdAt}</time>
                </div>
                {role === "LEADER" && (note.knowledgeStatus === "PENDING" || note.knowledgeStatus === "CHANGES_REQUESTED") && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" startIcon={<CloseLineIcon aria-hidden="true" className="size-4" />} onClick={() => onStatusChange(note.id, "CHANGES_REQUESTED")} className="text-warning-700 hover:bg-warning-50 dark:text-warning-300 dark:hover:bg-warning-500/10">{t("knowledge.requestChanges")}</Button>
                    <Button type="button" size="sm" startIcon={<CheckCircleIcon aria-hidden="true" className="size-4" />} onClick={() => onStatusChange(note.id, "PUBLISHED")}>{t("knowledge.approve")}</Button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{t("knowledge.permissionHint")}</p>
    </section>
  );
}

function KnowledgeStatusPill({ status, label }: { status: KnowledgeStatus; label: string }) {
  const styles = {
    PENDING: "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300",
    PUBLISHED: "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300",
    CHANGES_REQUESTED: "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-300",
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${styles[status]}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{label}</span>;
}

function Avatar({ initials }: { initials: string }) {
  return <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[9px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{initials}</span>;
}
