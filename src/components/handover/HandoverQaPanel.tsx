"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import { ChatIcon, DocsIcon } from "@/icons";
import type {
  HandoverAnswerDto,
  HandoverSummaryDto,
} from "@/lib/queries/handovers/handover.types";
import { useAskHandoverQuestionMutation } from "@/lib/queries/handovers/useHandovers";
import {
  buildSourceWorkspaceHref,
  extractHandoverErrorMessage,
  formatShortId,
} from "./handover-ui.utils";

export default function HandoverQaPanel({
  projectId,
  handover,
}: {
  projectId: string;
  handover: HandoverSummaryDto;
}) {
  const t = useTranslations("handover.qa");
  const askMutation = useAskHandoverQuestionMutation(projectId, handover.id);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<
    Array<{ q: string; a: HandoverAnswerDto }>
  >([]);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!handover.publishedRevisionId) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("noRevisionNotice")}
        </p>
      </section>
    );
  }

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const trimmed = question.trim();
    if (!trimmed || !handover.publishedRevisionId) return;

    try {
      const res = await askMutation.mutateAsync({
        revisionId: handover.publishedRevisionId,
        assignmentVersion: handover.assignmentVersion,
        question: trimmed,
      });
      setHistory((prev) => [{ q: trimmed, a: res.data }, ...prev]);
      setQuestion("");
    } catch (err) {
      setLocalError(
        extractHandoverErrorMessage(err, "Unable to answer question."),
      );
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <ChatIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {t("title")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-400">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <form onSubmit={handleAsk} className="mt-4 space-y-3">
          {localError && (
            <div
              role="alert"
              className="rounded-xl border border-error-200 bg-error-50 px-3.5 py-2.5 text-xs text-error-700 [overflow-wrap:anywhere] dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
            >
              {localError}
            </div>
          )}

          <label
            htmlFor="handover-qa-input"
            className="sr-only"
          >
            {t("questionLabel")}
          </label>
          <textarea
            id="handover-qa-input"
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t("questionPlaceholder")}
            className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!question.trim()}
              isLoading={askMutation.isPending}
            >
              {askMutation.isPending ? t("asking") : t("askCta")}
            </Button>
          </div>
        </form>
      </section>

      {history.map((entry, idx) => (
        <article
          key={`${idx}-${entry.q}`}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900 [overflow-wrap:anywhere] dark:text-white">
              Q: {entry.q}
            </p>
            <Badge
              color={
                entry.a.answerStatus === "ANSWERED" ? "success" : "warning"
              }
              size="sm"
            >
              {entry.a.answerStatus === "ANSWERED"
                ? t("statusAnswered")
                : t("statusInsufficient")}
            </Badge>
          </div>

          <p className="mt-2 text-sm leading-6 text-gray-700 [overflow-wrap:anywhere] dark:text-gray-300">
            {entry.a.message}
          </p>

          {entry.a.sections.length > 0 && (
            <div className="mt-3 space-y-2.5 border-t border-gray-100 pt-3 dark:border-gray-800">
              {entry.a.sections.map((sec, sIdx) => (
                <div
                  key={sIdx}
                  className="rounded-xl bg-gray-50/70 p-3 text-xs dark:bg-gray-800/50"
                >
                  <p className="leading-5 text-gray-800 [overflow-wrap:anywhere] dark:text-gray-200">
                    {sec.text}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sec.citations.map((cit, cIdx) => {
                      const href = buildSourceWorkspaceHref(
                        projectId,
                        cit.source.kind,
                        cit.source.id,
                      );
                      const label = `${cit.source.kind}:${formatShortId(cit.source.id)} v${cit.source.version} (${cit.locator.value})`;
                      return href ? (
                        <Link
                          key={cIdx}
                          href={href}
                          className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 font-medium text-brand-700 hover:underline dark:bg-brand-500/15 dark:text-brand-300"
                        >
                          <DocsIcon className="h-3 w-3" />
                          <span>{label}</span>
                        </Link>
                      ) : (
                        <span
                          key={cIdx}
                          className="inline-flex items-center gap-1 rounded-md bg-gray-200/70 px-2 py-0.5 font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                        >
                          <DocsIcon className="h-3 w-3" />
                          <span>{label}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

