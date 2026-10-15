"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CloseLineIcon, TaskIcon } from "@/icons";
import { Modal } from "@/components/ui/modal";
import { WorkPriorityLabel, WorkStatusBadge } from "./WorkStatusBadge";
import type { WorkItem, WorkPerson } from "./work-types";

export default function WorkItemDetailDialog({
  item,
  onClose,
}: {
  item: WorkItem | null;
  onClose: () => void;
}) {
  const t = useTranslations("work");
  const locale = useLocale();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (item) closeButtonRef.current?.focus();
  }, [item]);

  function trapDialogFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <Modal
      isOpen={Boolean(item)}
      onClose={onClose}
      backdropClassName="bg-gray-900/15 backdrop-blur-[1px] dark:bg-gray-950/25"
      showCloseButton={false}
      className="mx-3 max-h-[92vh] max-w-6xl overflow-hidden p-0 shadow-theme-lg"
    >
      {item && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="work-detail-title"
          aria-describedby="work-detail-description"
          onKeyDown={trapDialogFocus}
          className="max-h-[92vh] overflow-y-auto rounded-3xl"
        >
          <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-7 dark:border-gray-800">
            <div className="min-w-0">
              <nav aria-label={t("detailBreadcrumb")} className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5">
                  <TaskIcon className="h-3.5 w-3.5 text-brand-500" aria-hidden="true" />
                  {item.projectName}
                </span>
                <span aria-hidden="true">/</span>
                <span className="font-medium text-brand-600 dark:text-brand-400">{item.key}</span>
              </nav>
              <p id="work-detail-description" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("detailPreviewHint")}
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label={t("closeDetails")}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <CloseLineIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <main className="min-w-0 space-y-6 px-5 py-6 sm:px-7 sm:py-7">
              <div className="flex flex-wrap items-center gap-2">
                <WorkStatusBadge status={item.status} />
                <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {t(`types.${item.type}`)}
                </span>
              </div>

              <h2 id="work-detail-title" className="text-xl font-semibold leading-7 text-gray-900 sm:text-2xl dark:text-white/90">
                {item.title}
              </h2>

              <section aria-labelledby="work-detail-description-heading" className="space-y-3">
                <h3 id="work-detail-description-heading" className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {t("description")}
                </h3>
                <p className="rounded-lg border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm leading-6 text-gray-500 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
                  {t("noDescription")}
                </p>
              </section>

              <section aria-labelledby="work-detail-subtasks-heading" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 id="work-detail-subtasks-heading" className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {t("subtasks")}
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {t("subtaskProgress", {
                      completed: item.subtasks.completed,
                      total: item.subtasks.total,
                    })}
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                  role="progressbar"
                  aria-label={t("subtasks")}
                  aria-valuemin={0}
                  aria-valuemax={item.subtasks.total}
                  aria-valuenow={item.subtasks.completed}
                >
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{
                      width: `${item.subtasks.total === 0 ? 0 : (item.subtasks.completed / item.subtasks.total) * 100}%`,
                    }}
                  />
                </div>
              </section>
            </main>

            <aside className="min-w-0 border-t border-gray-200 bg-gray-50/70 px-5 py-6 sm:px-7 lg:border-s lg:border-t-0 dark:border-gray-800 dark:bg-gray-950/40">
              <section aria-labelledby="work-detail-fields-heading" className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <h3 id="work-detail-fields-heading" className="mb-4 text-sm font-semibold text-gray-900 dark:text-white/90">
                  {t("details")}
                </h3>
                <dl className="space-y-4">
                  <DetailField label={t("status")}><WorkStatusBadge status={item.status} /></DetailField>
                  <DetailField label={t("assignee")}><PersonValue person={item.assignee} /></DetailField>
                  <DetailField label={t("reporter")}><PersonValue person={item.reporter} /></DetailField>
                  <DetailField label={t("priority")}><WorkPriorityLabel priority={item.priority} /></DetailField>
                  <DetailField label={t("resolution")}><span className="text-sm text-gray-700 dark:text-gray-300">{t(`resolutions.${item.resolution}`)}</span></DetailField>
                  <DetailField label={t("project")}><span className="text-sm text-gray-700 dark:text-gray-300">{item.projectName}</span></DetailField>
                  <DetailField label={t("dueDate")}>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {item.dueDate
                        ? new Intl.DateTimeFormat(locale, {
                            dateStyle: "medium",
                            timeZone: "UTC",
                          }).format(new Date(`${item.dueDate}T00:00:00.000Z`))
                        : t("noDueDate")}
                    </span>
                  </DetailField>
                  <DetailField label={t("created")}>
                    <time dateTime={item.createdAt} className="text-sm text-gray-700 dark:text-gray-300">
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      }).format(new Date(item.createdAt))}
                    </time>
                  </DetailField>
                </dl>
              </section>
              <p className="mt-4 text-xs leading-5 text-gray-500 dark:text-gray-400">
                {t("detailPreviewNotice")}
              </p>
            </aside>
          </div>
        </div>
      )}
    </Modal>
  );
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3">
      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function PersonValue({ person }: { person: WorkPerson }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
        {person.initials}
      </span>
      <span className="truncate">{person.name}</span>
    </span>
  );
}
