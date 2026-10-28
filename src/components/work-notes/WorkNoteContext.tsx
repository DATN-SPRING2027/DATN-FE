"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { fetchProjectTaskDetail } from "@/lib/queries/tasks/useTasks";

/** Read-only preview of the existing Task API. Provider authority stays on BE. */
export default function WorkNoteContext({
  projectId,
  taskId,
  selection,
  fullContext,
}: {
  projectId: string;
  taskId: string;
  selection: { quote: string } | null;
  fullContext: boolean;
}) {
  const t = useTranslations("workNotes.agent");
  const task = useQuery({
    queryKey: ["worknote-task-context", projectId, taskId],
    queryFn: async ({ signal }) => {
      const value = await fetchProjectTaskDetail(projectId, taskId, signal);
      if (value.id !== taskId || value.projectId !== projectId)
        throw Error("Task scope mismatch");
      return value;
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  return (
    <details className="border-y border-gray-100 py-3 text-sm dark:border-gray-800">
      <summary className="cursor-pointer font-medium focus-visible:outline-2 focus-visible:outline-brand-500">
        {t("contextDetails")}
      </summary>
      <div className="mt-3 space-y-3 text-gray-600 dark:text-gray-300">
        <p>
          {t(
            selection
              ? fullContext
                ? "scopeSelectionFull"
                : "scopeSelection"
              : "scopeWhole",
          )}
        </p>
        {selection && (
          <blockquote
            aria-label={t("selectedSource")}
            className="max-h-24 overflow-auto border-l-2 border-brand-300 pl-3 break-words whitespace-pre-wrap"
          >
            {selection.quote}
          </blockquote>
        )}
        {task.isPending && <p role="status">{t("contextLoading")}</p>}
        {task.isError && (
          <div role="alert" className="space-y-2">
            <p>{t("contextLoadFailed")}</p>
            <button
              type="button"
              onClick={() => void task.refetch()}
              disabled={task.isFetching}
              className="rounded border border-gray-200 px-2 py-1 dark:border-gray-700"
            >
              {t("contextReload")}
            </button>
          </div>
        )}
        {task.data && !task.isError && (
          <div className="space-y-2">
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {task.data.title}
            </p>
            <p>{t("contextStatus", { status: task.data.status })}</p>
            <p className="max-h-36 overflow-auto break-words whitespace-pre-wrap">
              {task.data.description || t("contextNoDescription")}
            </p>
            {task.data.steps.length > 0 && (
              <ul className="space-y-1">
                {task.data.steps.map((step) => (
                  <li key={step.id} className="flex gap-2">
                    <span>{t(step.done ? "stepDone" : "stepOpen")}</span>
                    <span className="min-w-0 break-words">{step.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t("contextEvidence")}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t("contextAuthorSource")}
        </p>
      </div>
    </details>
  );
}
