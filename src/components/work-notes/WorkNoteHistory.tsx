"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { agentApi } from "@/lib/queries/work-notes/work-note-agent.api";
export default function WorkNoteHistory({
  projectId,
  taskId,
  noteId,
  disabled,
  onRestore,
  api = agentApi,
  workflow = "TASK_NOTE",
}: {
  projectId: string;
  taskId: string;
  noteId: string;
  disabled: boolean;
  onRestore: (version: number) => void;
  api?: Pick<typeof agentApi, "versions">;
  workflow?: string;
}) {
  const t = useTranslations("workNotes.agent");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: [
      "worknote-agent-versions",
      projectId,
      workflow,
      taskId,
      noteId,
      page,
    ],
    queryFn: () => api.versions(projectId, taskId, noteId, page),
    retry: false,
  });
  return (
    <section
      aria-label={t("history")}
      className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
    >
      <h3 className="font-semibold">{t("history")}</h3>
      {query.isPending && <p role="status">{t("loading")}</p>}
      {query.isError && <p role="alert">{t("loadFailed")}</p>}
      {query.data?.data.map((version) => (
        <details
          key={version.versionNumber}
          className="border-t border-gray-100 py-2 dark:border-gray-800"
        >
          <summary className="cursor-pointer text-sm">
            {t("version", { version: version.versionNumber })}: {version.title}
          </summary>
          <pre className="my-3 max-h-48 overflow-auto font-sans text-sm break-words whitespace-pre-wrap">
            {version.contentMarkdown}
          </pre>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onRestore(version.versionNumber)}
          >
            {t("restore")}
          </Button>
        </details>
      ))}
      {query.data && query.data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((v) => v - 1)}
          >
            {t("previous")}
          </Button>
          <span className="text-sm">
            {page} / {query.data.pagination.totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= query.data.pagination.totalPages}
            onClick={() => setPage((v) => v + 1)}
          >
            {t("next")}
          </Button>
        </div>
      )}
    </section>
  );
}
