import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  useCreateWorkItemCommentMutation,
  useWorkItemActivityQuery,
  useWorkItemCommentsQuery,
} from "@/lib/queries/work-management/useWorkManagement";
import type {
  WorkItem,
  WorkItemEvent,
} from "@/lib/queries/work-management/work-management.types";
import WorkError from "./WorkError";
import {
  controlClassName,
  formatDate,
  isAuthUnavailable,
  secondaryButtonClassName,
} from "./work-management-ui";

type Translation = ReturnType<typeof useTranslations<"workManagement">>;

type WorkItemDetailsProps = Readonly<{
  item: WorkItem;
  projectId: string;
  onClose: () => void;
  locale: string;
}>;

export default function WorkItemDetails({
  item,
  projectId,
  onClose,
  locale,
}: WorkItemDetailsProps) {
  const t = useTranslations("workManagement");
  const [commentBody, setCommentBody] = useState("");
  const commentsQuery = useWorkItemCommentsQuery(projectId, item.id);
  const activityQuery = useWorkItemActivityQuery(projectId, item.id);
  const commentMutation = useCreateWorkItemCommentMutation(projectId, item.id, {
    onSuccess: () => setCommentBody(""),
  });

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = commentBody.trim();
    if (body) commentMutation.mutate(body);
  }

  return (
    <section
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm sm:p-6 dark:border-gray-800 dark:bg-gray-900"
      aria-labelledby="work-item-details-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-brand-500 uppercase">
            {t("viewDetails")}
          </p>
          <h2
            className="mt-1 text-lg font-semibold text-gray-900 dark:text-white/90"
            id="work-item-details-title"
          >
            {item.title}
          </h2>
        </div>
        <button
          type="button"
          className={secondaryButtonClassName}
          onClick={onClose}
        >
          {t("closeDetails")}
        </button>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="work-comments-title">
          <h3
            className="font-semibold text-gray-900 dark:text-white/90"
            id="work-comments-title"
          >
            {t("comments")}
          </h3>
          {commentsQuery.error ? (
            <WorkError
              message={
                isAuthUnavailable(commentsQuery.error)
                  ? t("authPending")
                  : t("requestFailed")
              }
            />
          ) : commentsQuery.data?.data.length ? (
            <ul className="mt-3 space-y-3">
              {commentsQuery.data.data.map((comment) => (
                <li
                  key={comment.id}
                  className="rounded-xl bg-gray-50 p-3 dark:bg-white/5"
                >
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{comment.authorId.slice(0, 8)}</span>
                    <time dateTime={comment.createdAt}>
                      {formatDate(comment.createdAt, locale)}
                    </time>
                  </div>
                  <p className="mt-2 text-sm break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {comment.body}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              {commentsQuery.isPending ? t("loading") : t("noComments")}
            </p>
          )}

          {!item.archivedAt && (
            <form className="mt-4 space-y-2" onSubmit={submitComment}>
              <label className="sr-only" htmlFor="work-comment-body">
                {t("commentPlaceholder")}
              </label>
              <textarea
                id="work-comment-body"
                value={commentBody}
                maxLength={10000}
                rows={3}
                className={`${controlClassName} h-auto py-3`}
                onChange={(event) => setCommentBody(event.currentTarget.value)}
                placeholder={t("commentPlaceholder")}
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!commentBody.trim() || commentMutation.isPending}
                >
                  {t("addComment")}
                </button>
              </div>
              {commentMutation.error && (
                <p className="text-sm text-error-500" role="alert">
                  {t("requestFailed")}
                </p>
              )}
            </form>
          )}
        </section>

        <section aria-labelledby="work-activity-title">
          <h3
            className="font-semibold text-gray-900 dark:text-white/90"
            id="work-activity-title"
          >
            {t("activity")}
          </h3>
          {activityQuery.error ? (
            <WorkError
              message={
                isAuthUnavailable(activityQuery.error)
                  ? t("authPending")
                  : t("requestFailed")
              }
            />
          ) : activityQuery.data?.data.length ? (
            <ol className="mt-3 space-y-3 border-s border-gray-200 ps-4 dark:border-gray-700">
              {activityQuery.data.data.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -start-[1.35rem] mt-1.5 size-2 rounded-full bg-brand-500" />
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">
                      {event.actorUserId.slice(0, 8)}
                    </span>{" "}
                    {activityLabel(event, t)}
                  </p>
                  <time
                    className="mt-1 block text-xs text-gray-500 dark:text-gray-400"
                    dateTime={event.occurredAt}
                  >
                    {formatDate(event.occurredAt, locale)}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              {activityQuery.isPending ? t("loading") : t("noActivity")}
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

function activityLabel(event: WorkItemEvent, t: Translation): string {
  switch (event.eventType) {
    case "CREATED":
      return t("created");
    case "UPDATED":
      return t("updated");
    case "COMMENT_ADDED":
      return t("commentAdded");
    case "ARCHIVED":
      return t("archived");
  }
}
