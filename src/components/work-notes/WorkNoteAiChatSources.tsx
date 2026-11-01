"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { TaskNoteAiChatSource } from "@/lib/queries/work-notes/useWorkNotes";
import {
  buildProjectDocumentHref,
  isContinuumDocumentId,
} from "@/components/ai-chat/citation-utils";

export default function WorkNoteAiChatSources({
  projectId,
  source,
}: {
  projectId: string;
  source: TaskNoteAiChatSource;
}) {
  const t = useTranslations("workNotes.taskNotes");
  if (!source.citations.length && !source.sessionCitations.length) return null;

  return (
    <section
      aria-label={t("aiChatSourcesTitle")}
      className="mt-4 rounded-xl border border-gray-200 bg-gray-50/80 p-3.5 dark:border-gray-800 dark:bg-gray-950/60"
    >
      <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200">
        {t("aiChatSourcesTitle")}
      </h4>
      {source.citations.length > 0 && (
        <ol className="mt-2 space-y-2">
          {source.citations.map((citation) => {
            const title = citation.documentName || citation.sourceLabel;
            const canLink = isContinuumDocumentId(citation.documentId);
            return (
              <li
                key={`${citation.number}:${citation.documentId ?? citation.sourceLabel}`}
                className="min-w-0 text-xs leading-5 text-gray-700 dark:text-gray-300"
              >
                <span className="me-1 font-semibold tabular-nums text-gray-500 dark:text-gray-400">
                  [{citation.number}]
                </span>
                {canLink && citation.documentId ? (
                  <Link
                    href={buildProjectDocumentHref(projectId, citation.documentId)}
                    className="font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-300 dark:decoration-brand-500/50 dark:hover:text-brand-200"
                  >
                    {title}
                  </Link>
                ) : (
                  <span className="font-medium">{title}</span>
                )}
                {(citation.sectionPath || citation.heading) && (
                  <span className="ms-1 text-gray-500 dark:text-gray-400">
                    · {citation.sectionPath || citation.heading}
                  </span>
                )}
                {(citation.pageFrom || citation.pageTo) && (
                  <span className="ms-1 text-gray-500 tabular-nums dark:text-gray-400">
                    · {t("aiChatSourcePages", {
                      from: citation.pageFrom ?? citation.pageTo ?? 1,
                      to: citation.pageTo ?? citation.pageFrom ?? 1,
                    })}
                  </span>
                )}
                {citation.versionNo && (
                  <span className="ms-1 text-gray-500 tabular-nums dark:text-gray-400">
                    · {t("aiChatSourceVersion", { version: citation.versionNo })}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {source.sessionCitations.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-gray-200 pt-2 text-xs text-gray-600 dark:border-gray-800 dark:text-gray-400">
          {source.sessionCitations.map((citation) => (
            <li key={`${citation.ref}:${citation.groupId ?? "context"}`}>
              <span className="me-1 font-semibold tabular-nums">[{citation.ref}]</span>
              {t("aiChatSessionSource")}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
