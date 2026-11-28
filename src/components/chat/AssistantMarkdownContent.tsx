"use client";

import { Fragment, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  parseNumberedHeading,
  stripLeadingDecorativeEmoji,
} from "@/components/ai-chat/answer-prose-utils";
import { parseEvidenceBlocks } from "@/components/ai-chat/evidence-markdown";
import type { ChatAssistantSourceReference } from "@/lib/queries/chat/useChat";
import { cn } from "@/utils";

const INLINE_TOKEN_RE = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\[M[1-9][0-9]{0,2}\])/g;
const REF_TOKEN_RE = /^\[(M[1-9][0-9]{0,2})\]$/;

function renderInlineWithRefs(
  rawText: string,
  sourceMap: ReadonlyMap<string, ChatAssistantSourceReference>,
  onJumpToSource: ((messageId: string) => void) | undefined,
  keyPrefix: string,
  labels: {
    openAria: (refId: string, sender: string) => string;
    deletedAria: (refId: string, sender: string) => string;
  },
): ReactNode {
  const cleaned = rawText.replace(/`{3,}/g, "");
  if (!cleaned) return null;

  const parts = cleaned.split(INLINE_TOKEN_RE).filter(Boolean);
  return parts.map((part, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={key}
          className="font-mono inline-flex items-center rounded-md border border-brand-200/70 bg-white/85 px-1.5 py-0.5 text-xs font-medium text-brand-700 dark:border-brand-500/25 dark:bg-gray-900/70 dark:text-brand-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong
          key={key}
          className="font-semibold text-gray-950 dark:text-white"
        >
          {renderInlineWithRefs(
            part.slice(2, -2),
            sourceMap,
            onJumpToSource,
            `${key}-b`,
            labels,
          )}
        </strong>
      );
    }

    const refMatch = REF_TOKEN_RE.exec(part);
    if (refMatch?.[1]) {
      const refId = refMatch[1];
      const source = sourceMap.get(refId);
      if (source) {
        const isDeleted = source.status === "DELETED";
        const isEdited = source.status === "EDITED";
        return (
          <button
            key={key}
            type="button"
            data-testid={`assistant-inline-ref-${source.refId}`}
            disabled={isDeleted || !onJumpToSource}
            aria-disabled={isDeleted || !onJumpToSource ? "true" : undefined}
            title={
              isDeleted
                ? labels.deletedAria(source.refId, source.senderName)
                : labels.openAria(source.refId, source.senderName)
            }
            onClick={() => {
              if (!isDeleted && onJumpToSource) {
                onJumpToSource(source.messageId);
              }
            }}
            className={cn(
              "font-mono mx-0.5 inline-flex items-center rounded px-1.5 py-0.5 align-baseline text-xs font-semibold tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500",
              isDeleted
                ? "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-500 line-through dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                : isEdited
                  ? "border border-warning-300/90 bg-warning-50 text-warning-800 hover:bg-warning-100 dark:border-warning-500/35 dark:bg-warning-500/15 dark:text-warning-300 dark:hover:bg-warning-500/25"
                  : "border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25",
            )}
          >
            [{source.refId}]
          </button>
        );
      }
    }

    return <Fragment key={key}>{part}</Fragment>;
  });
}

export default function AssistantMarkdownContent({
  content,
  sourceReferences = [],
  onJumpToSource,
  compact = false,
}: Readonly<{
  content: string;
  sourceReferences?: readonly ChatAssistantSourceReference[];
  onJumpToSource?: (messageId: string) => void;
  compact?: boolean;
}>) {
  const t = useTranslations("chat");
  const sourceMap = new Map(
    sourceReferences.map((source) => [source.refId, source]),
  );
  const labels = {
    openAria: (refId: string, sender: string) =>
      t("assistantSourceOpenAria", { refId, sender }),
    deletedAria: (refId: string, sender: string) =>
      t("assistantSourceDeletedAria", { refId, sender }),
  };

  const blocks = parseEvidenceBlocks(content);
  if (blocks.length === 0) {
    return (
      <p
        className={cn(
          "break-words text-gray-800 dark:text-gray-100",
          compact ? "text-xs leading-5" : "text-sm leading-6",
        )}
      >
        {renderInlineWithRefs(
          stripLeadingDecorativeEmoji(content),
          sourceMap,
          onJumpToSource,
          "fallback",
          labels,
        )}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "min-w-0 text-gray-800 dark:text-gray-100",
        compact ? "space-y-2 text-xs leading-5" : "space-y-2.5 text-sm leading-6",
      )}
    >
      {blocks.map((block, idx) => {
        const blockKey = `ai-blk-${idx}`;

        if (block.kind === "code") {
          const badge = block.isDiagram
            ? t("assistantDiagramBlock")
            : block.lang
              ? block.lang.toUpperCase()
              : t("assistantCodeBlock");
          return (
            <div
              key={blockKey}
              className="overflow-hidden rounded-xl border border-gray-800/80 bg-gray-900 shadow-theme-xs dark:border-white/10 dark:bg-gray-950"
            >
              <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-1">
                <span className="font-mono text-xs font-semibold tracking-wide text-gray-300">
                  {badge}
                </span>
              </div>
              <pre className="font-mono overflow-x-auto p-3 text-xs leading-5 whitespace-pre text-gray-100">
                <code>{block.content}</code>
              </pre>
            </div>
          );
        }

        if (block.kind === "callout") {
          return (
            <blockquote
              key={blockKey}
              className="space-y-1 rounded-xl border border-brand-200/80 border-s-4 border-s-brand-500 bg-brand-50/50 py-2 ps-3 pe-3 text-gray-800 dark:border-brand-500/20 dark:border-s-brand-400 dark:bg-brand-500/10 dark:text-gray-100"
            >
              {block.lines.map((line, lineIdx) => (
                <p key={`${blockKey}-q-${lineIdx}`} className="break-words">
                  {renderInlineWithRefs(
                    stripLeadingDecorativeEmoji(line),
                    sourceMap,
                    onJumpToSource,
                    `${blockKey}-q-${lineIdx}`,
                    labels,
                  )}
                </p>
              ))}
            </blockquote>
          );
        }

        if (block.kind === "table") {
          return (
            <div
              key={blockKey}
              className="max-w-full overflow-x-auto rounded-xl border border-gray-200/90 bg-white dark:border-gray-700/80 dark:bg-gray-900/60"
            >
              <table className="min-w-full divide-y divide-gray-200 text-xs tabular-nums dark:divide-gray-700/80">
                <thead className="bg-gray-50 dark:bg-gray-800/70">
                  <tr>
                    {block.headers.map((header, colIdx) => (
                      <th
                        key={`${blockKey}-th-${colIdx}`}
                        className={cn(
                          "px-2.5 py-1.5 font-semibold text-gray-900 dark:text-white",
                          block.alignments[colIdx] ?? "text-start",
                        )}
                      >
                        {renderInlineWithRefs(
                          stripLeadingDecorativeEmoji(header),
                          sourceMap,
                          onJumpToSource,
                          `${blockKey}-th-${colIdx}`,
                          labels,
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {block.rows.map((row, rowIdx) => (
                    <tr key={`${blockKey}-tr-${rowIdx}`}>
                      {block.headers.map((_, colIdx) => (
                        <td
                          key={`${blockKey}-td-${rowIdx}-${colIdx}`}
                          className={cn(
                            "px-2.5 py-1.5 text-gray-700 dark:text-gray-200",
                            block.alignments[colIdx] ?? "text-start",
                          )}
                        >
                          {renderInlineWithRefs(
                            stripLeadingDecorativeEmoji(row[colIdx] ?? ""),
                            sourceMap,
                            onJumpToSource,
                            `${blockKey}-td-${rowIdx}-${colIdx}`,
                            labels,
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.kind === "heading") {
          const cleanedHeading = stripLeadingDecorativeEmoji(block.text);
          const numbered = parseNumberedHeading(cleanedHeading);
          return (
            <h4
              key={blockKey}
              className={cn(
                "font-semibold tracking-tight text-gray-950 dark:text-white",
                compact ? "pt-0.5 text-xs" : "pt-0.5 text-sm",
              )}
            >
              {numbered ? (
                <>
                  <span className="me-1.5 tabular-nums text-brand-700 dark:text-brand-300">
                    {numbered.numberPrefix}
                  </span>
                  {renderInlineWithRefs(
                    numbered.titleText,
                    sourceMap,
                    onJumpToSource,
                    `${blockKey}-h`,
                    labels,
                  )}
                </>
              ) : (
                renderInlineWithRefs(
                  cleanedHeading,
                  sourceMap,
                  onJumpToSource,
                  `${blockKey}-h`,
                  labels,
                )
              )}
            </h4>
          );
        }

        if (block.kind === "ul") {
          return (
            <ul
              key={blockKey}
              className="space-y-1.5 ps-4 list-disc marker:text-brand-500 dark:marker:text-brand-400"
            >
              {block.items.map((item, itemIdx) => (
                <li key={`${blockKey}-ul-${itemIdx}`} className="break-words">
                  {renderInlineWithRefs(
                    stripLeadingDecorativeEmoji(item),
                    sourceMap,
                    onJumpToSource,
                    `${blockKey}-ul-${itemIdx}`,
                    labels,
                  )}
                </li>
              ))}
            </ul>
          );
        }

        if (block.kind === "ol") {
          return (
            <ol
              key={blockKey}
              className="space-y-1.5 ps-5 list-decimal tabular-nums marker:font-semibold marker:text-brand-600 dark:marker:text-brand-400"
            >
              {block.items.map((item, itemIdx) => (
                <li key={`${blockKey}-ol-${itemIdx}`} className="break-words">
                  {renderInlineWithRefs(
                    stripLeadingDecorativeEmoji(item.text),
                    sourceMap,
                    onJumpToSource,
                    `${blockKey}-ol-${itemIdx}`,
                    labels,
                  )}
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={blockKey} className="break-words">
            {renderInlineWithRefs(
              stripLeadingDecorativeEmoji(block.text),
              sourceMap,
              onJumpToSource,
              `${blockKey}-p`,
              labels,
            )}
          </p>
        );
      })}
    </div>
  );
}
