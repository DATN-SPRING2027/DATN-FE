"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  Check,
  Copy,
  FastForward,
  HelpCircle,
  History,
  Info,
  LayoutGrid,
  Loader2,
  Paperclip,
  Pencil,
  RotateCcw,
  SendHorizontal,
  Sparkles,
  SquarePen,
  Wand2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { CloseIcon } from "@/icons";
import type {
  AgentDraft,
  AgentOperation,
  AgentQuestion,
  AgentSecurityReport,
  AgentSuggestion,
} from "@/lib/queries/work-notes/work-note-agent.api";
import { reconcileTextareaEdit } from "./textarea-source";
import { computeReadableDiff, type DiffSegment } from "./work-note-diff";
import {
  PreSendSecurityNotice,
  SecurityShieldBanner,
  type PreSendSecurityScan,
} from "./work-note-security-notice";

type ProposalAction =
  "replace_body" | "replace_selection" | "insert_after" | "replace_title";

export type ClarificationTargetItem = {
  number: number;
  label: string;
};

export type ParsedClarificationQuestion = {
  prompt: string;
  targetItems: readonly ClarificationTargetItem[];
  choices: readonly string[];
  choiceMode: "matrix" | "multi" | "single" | "none";
};

function extractNumberedTargetItems(stem: string): {
  prompt: string;
  items: ClarificationTargetItem[];
} {
  const firstMatch = /(?:^|\n|\s+)1\.\s+/.exec(stem);
  if (!firstMatch) {
    return { prompt: stem, items: [] };
  }
  const promptCandidate = stem.slice(0, firstMatch.index).trim();
  let rest = stem.slice(firstMatch.index + firstMatch[0].length).trim();
  const items: ClarificationTargetItem[] = [];
  let currentNumber = 1;

  while (rest.length > 0) {
    const nextNumber = currentNumber + 1;
    const nextPattern = new RegExp(`(?:\\n|\\s+)${nextNumber}\\.\\s+`);
    const nextMatch = nextPattern.exec(rest);
    if (!nextMatch) {
      items.push({ number: currentNumber, label: rest.trim() });
      break;
    }
    const itemLabel = rest.slice(0, nextMatch.index).trim();
    if (itemLabel) {
      items.push({ number: currentNumber, label: itemLabel });
    }
    rest = rest.slice(nextMatch.index + nextMatch[0].length).trim();
    currentNumber = nextNumber;
  }

  if (items.length < 2) {
    return { prompt: stem, items: [] };
  }
  return {
    prompt: promptCandidate,
    items,
  };
}

export function parseClarificationQuestion(
  question: Pick<AgentQuestion, "text" | "options">,
): ParsedClarificationQuestion {
  const rawText = question.text.trim();
  let stemPart = rawText;
  let extractedChoices: string[] = [];
  let hasCheckboxChoices = false;

  const checkboxCue = /(?:^|\n|\s)(?:[-*•]\s*)?(?:\[\s*[xX✓]?\s*\]|☐)\s*/;
  const firstCheckboxMatch = checkboxCue.exec(rawText);
  if (firstCheckboxMatch) {
    stemPart = rawText.slice(0, firstCheckboxMatch.index).trim();
    const checkboxPart = rawText.slice(firstCheckboxMatch.index).trim();
    extractedChoices = checkboxPart
      .split(/(?:^|\n|\s+)(?:[-*•]\s*)?(?:\[\s*[xX✓]?\s*\]|☐)\s*/)
      .map((item) =>
        item
          .trim()
          .replace(/[;,]+$/, "")
          .trim(),
      )
      .filter(Boolean);
    hasCheckboxChoices = extractedChoices.length > 0;
  } else if (question.options.length === 0) {
    const bulletCue =
      /([\s\S]*?)\b(?:(?:vui\s+lòng|hãy)\s+chọn(?:\s+một)?|lựa\s+chọn|options?|choose)\s*:\s*((?:[-*•]\s+\S[\s\S]*))$/i.exec(
        rawText,
      );
    if (bulletCue) {
      const candidateChoices = bulletCue[2]
        .split(/(?:^|\n|\s+)[-*•]\s+/)
        .map((item) =>
          item
            .trim()
            .replace(/[;,]+$/, "")
            .trim(),
        )
        .filter(Boolean);
      if (candidateChoices.length >= 2) {
        stemPart = bulletCue[1].trim();
        extractedChoices = candidateChoices;
      }
    }
  }

  if (extractedChoices.length > 0) {
    stemPart = stemPart
      .replace(
        /[\s\n]*(?:(?:vui\s+lòng|hãy)\s+chọn(?:\s+một)?|lựa\s+chọn|chọn\s+một(?:\s+trong\s+các\s+mục(?:\s+sau)?)?|chọn|options?|choose)\s*:?\s*$/i,
        "",
      )
      .trim();
  }

  if (question.options.length > 0) {
    const listIndex = stemPart.search(
      /(?:\n|\s+)(?:ví\s+dụ|gợi\s+ý|lựa\s+chọn|options?|cụ\s+thể)?:?\s*\n?\s*1[.)]\s+/i,
    );
    if (listIndex !== -1) {
      stemPart = stemPart.slice(0, listIndex).trim();
    }
  }

  const { prompt, items: targetItems } =
    question.options.length > 0
      ? { prompt: stemPart, items: [] }
      : extractNumberedTargetItems(stemPart);

  const mergedChoices: string[] = [];
  const seen = new Set<string>();
  for (const option of [...question.options, ...extractedChoices]) {
    const clean = option.trim();
    const normalized = clean.toLowerCase();
    if (!clean || seen.has(normalized)) continue;
    seen.add(normalized);
    mergedChoices.push(clean);
  }

  const choiceMode: ParsedClarificationQuestion["choiceMode"] =
    targetItems.length >= 2 && mergedChoices.length >= 2
      ? "matrix"
      : mergedChoices.length > 0 && hasCheckboxChoices
        ? "multi"
        : mergedChoices.length > 0
          ? "single"
          : "none";

  return {
    prompt,
    targetItems,
    choices: mergedChoices,
    choiceMode,
  };
}

const MASKED_PLACEHOLDER = /^\[\[WN_SEC:([A-Z_]+):[a-f0-9]{10,16}\]\]$/;

/** Server-masked sensitive value (Pre-LLM Security Gateway). Never revealed in chat. */
function MaskedSensitiveChip({ category }: { category: string }) {
  const t = useTranslations("workNotes.agent");
  const key = `securityCategory.${category}`;
  const label = t.has(key) ? t(key) : category;
  return (
    <span
      data-testid="masked-sensitive-chip"
      title={t("securityMaskedTooltip")}
      className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 ring-inset dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30"
    >
      <span aria-hidden="true">🔒</span>
      {t("securityMaskedLabel", { category: label })}
    </span>
  );
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const tokens = text.split(
    /(\[\[WN_SEC:[A-Z_]+:[a-f0-9]{10,16}\]\]|\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*|`[^`\n]+`)/g,
  );
  return tokens.map((token, idx) => {
    if (!token) return null;
    const masked = MASKED_PLACEHOLDER.exec(token);
    if (masked) {
      return <MaskedSensitiveChip key={idx} category={masked[1]} />;
    }
    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      return (
        <strong
          key={idx}
          className="font-semibold text-gray-900 dark:text-white"
        >
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("*") && token.endsWith("*") && token.length > 2) {
      return (
        <em
          key={idx}
          className="rounded bg-gray-100 px-1 py-0.5 font-medium text-gray-800 not-italic dark:bg-gray-800 dark:text-gray-200"
        >
          {token.slice(1, -1)}
        </em>
      );
    }
    if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
      return (
        <code
          key={idx}
          className="font-mono rounded bg-gray-100 px-1 py-0.5 text-[11px] text-gray-800 dark:bg-gray-800 dark:text-gray-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={idx}>{token}</Fragment>;
  });
}

function FormattedAssistantText({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  if (lines.length === 1) {
    return <p>{renderInlineMarkdown(lines[0])}</p>;
  }
  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" aria-hidden="true" />;
        }
        return (
          <p key={idx} className="leading-relaxed">
            {renderInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
}

export function cleanLabel(text: string): string {
  return text.trim().replace(/^[\"']|[\"']$/g, "").trim();
}

export function isOtherOption(text: string): boolean {
  const norm = text.trim().toLowerCase();
  return (
    norm === "khác" ||
    norm.startsWith("khác") ||
    norm.startsWith("other") ||
    norm.includes("khác (") ||
    norm.includes("nội dung khác") ||
    norm.includes("other (")
  );
}

function ClarificationQuestionCard({
  question,
  step,
  disabled,
  onSend,
}: {
  question: AgentQuestion;
  step?: { current: number; total: number };
  disabled: boolean;
  onSend: (text?: string, disposition?: "answered" | "skipped") => void;
}) {
  const t = useTranslations("workNotes.agent");
  const parsed = parseClarificationQuestion(question);

  // Sequential multi-item state (when question contains multiple numbered items 1., 2., 3...)
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [itemSelections, setItemSelections] = useState<Record<number, string>>({});
  const [itemCustomTexts, setItemCustomTexts] = useState<Record<number, string>>({});
  const itemOtherInputRef = useRef<HTMLInputElement>(null);

  // Single-question state
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [otherCustomText, setOtherCustomText] = useState("");
  const otherInputRef = useRef<HTMLInputElement>(null);

  // Legacy matrix / multi checklist state
  const [matrixSelections, setMatrixSelections] = useState<Record<number, string>>({});
  const [multiSelections, setMultiSelections] = useState<string[]>([]);

  const skipLabel = t("skip");
  const unknownLabel = t("unknown");
  const otherChoiceLabel = t("clarificationOtherOption");

  const totalTargetItems = parsed.targetItems.length;
  const isMultiItem = totalTargetItems >= 2;

  // Step indicator (e.g. 1/3, 2/3, 3/3)
  const stepIndicator = useMemo(() => {
    if (isMultiItem) {
      return `${activeItemIndex + 1}/${totalTargetItems}`;
    }
    if (step && step.total >= 2) {
      return `${step.current}/${step.total}`;
    }
    const match = /(?:^|\s|\()(\d+)\/(\d+)(?:\)|\s|$)/.exec(question.text);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
    return null;
  }, [isMultiItem, activeItemIndex, totalTargetItems, step, question.text]);

  const displayChoices = useMemo(() => {
    const raw = parsed.choices.filter(
      (opt) =>
        opt.toLowerCase() !== skipLabel.toLowerCase() &&
        opt.toLowerCase() !== unknownLabel.toLowerCase(),
    );
    if (!raw.some(isOtherOption)) {
      return [...raw, otherChoiceLabel];
    }
    return raw;
  }, [parsed.choices, skipLabel, unknownLabel, otherChoiceLabel]);

  // Current item logic for sequential stepper
  const currentTargetItem = isMultiItem
    ? parsed.targetItems[activeItemIndex]
    : null;
  const currentItemSelection = currentTargetItem
    ? itemSelections[currentTargetItem.number] ?? null
    : null;
  const currentItemCustomText = currentTargetItem
    ? itemCustomTexts[currentTargetItem.number] ?? ""
    : "";
  const isCurrentOtherActive = Boolean(
    currentItemSelection && isOtherOption(currentItemSelection),
  );
  const canAdvanceCurrentItem = isCurrentOtherActive
    ? currentItemCustomText.trim().length > 0
    : Boolean(currentItemSelection);

  function handleSubmitSequentialItems() {
    const lines = parsed.targetItems.map((item) => {
      const rawChoice = itemSelections[item.number] ?? "";
      const isOther = isOtherOption(rawChoice);
      const finalAnswer = isOther
        ? (itemCustomTexts[item.number] || rawChoice)
        : rawChoice;
      return `${item.number}. ${cleanLabel(item.label)}: ${finalAnswer}`;
    });
    onSend(lines.join("\n"), "answered");
  }

  // Single-select confirm logic
  const isOtherActive = Boolean(
    selectedChoice && isOtherOption(selectedChoice),
  );
  const canConfirmSingle = isOtherActive
    ? otherCustomText.trim().length > 0
    : Boolean(selectedChoice);

  function handleConfirmSingle() {
    if (!selectedChoice || disabled) return;
    if (isOtherActive) {
      if (!otherCustomText.trim()) return;
      onSend(otherCustomText.trim(), "answered");
    } else {
      onSend(selectedChoice, "answered");
    }
  }

  const hasMatrixSelection = parsed.targetItems.some(
    (item) => !!matrixSelections[item.number],
  );

  function submitMatrixSelections() {
    const lines = parsed.targetItems
      .filter((item) => !!matrixSelections[item.number])
      .map(
        (item) =>
          `${item.number}. ${item.label}: ${matrixSelections[item.number]}`,
      );
    if (lines.length === 0) return;
    onSend(lines.join("\n"), "answered");
  }

  function submitMultiSelections() {
    if (multiSelections.length === 0) return;
    onSend(multiSelections.join(", "), "answered");
  }

  return (
    <div
      data-testid="clarification-question-card"
      className="space-y-3.5 rounded-2xl border border-brand-200/90 bg-brand-50/40 p-4 shadow-2xs dark:border-brand-500/30 dark:bg-brand-500/10"
    >
      {/* Header: (?) Cần làm rõ thêm          1/3 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-brand-600 dark:text-brand-400">
          <HelpCircle className="size-4 shrink-0" aria-hidden="true" />
          <span className="text-xs font-bold tracking-tight">
            {t("clarificationBadge")}
          </span>
        </div>

        {stepIndicator && (
          <span
            data-testid="clarification-step-badge"
            className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold tabular-nums text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          >
            {stepIndicator}
          </span>
        )}
      </div>

      {/* Question reuses information from a previous note → confirmation, not a re-ask */}
      {question.historyRef && (
        <div
          data-testid="clarification-history-ref"
          className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ring-1 ring-inset ${
            question.historyRef.status === "CURRENT"
              ? "bg-white text-gray-600 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700"
              : "bg-warning-50 text-warning-800 ring-warning-200 dark:bg-warning-500/10 dark:text-warning-200 dark:ring-warning-500/30"
          }`}
        >
          <History className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            {question.historyRef.relation && question.historyRef.relation !== "SELF"
              ? t("historyRefRelatedLabel", {
                  title: question.historyRef.noteTitle,
                  relation: `${t(`historyContext.relation.${question.historyRef.relation}`)}${
                    question.historyRef.taskKey ? ` ${question.historyRef.taskKey}` : ""
                  }`,
                  date: question.historyRef.date.split("-").reverse().join("/"),
                })
              : t("historyRefLabel", {
                  title: question.historyRef.noteTitle,
                  date: question.historyRef.date.split("-").reverse().join("/"),
                })}
            {question.historyRef.status !== "CURRENT" &&
              ` · ${t(`historyContext.status.${question.historyRef.status}`)}`}
          </span>
        </div>
      )}

      {/* Case A: Sequential Stepper for Multi-item Questions (1/3, 2/3, 3/3) */}
      {isMultiItem && currentTargetItem && (
        <div className="space-y-3 pt-0.5">
          {/* Tiêu đề câu hỏi chung nếu có */}
          {parsed.prompt && (
            <h4 className="text-sm font-bold leading-snug text-gray-900 dark:text-gray-100">
              {parsed.prompt}
            </h4>
          )}

          {/* Tiêu đề mục hiện tại */}
          <div className="rounded-xl border border-brand-200/60 bg-brand-50/60 px-3 py-2 text-xs font-semibold text-brand-900 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-200">
            {currentTargetItem.number}. {cleanLabel(currentTargetItem.label)}
          </div>

          {/* Lý do / mô tả */}
          {question.reason && (
            <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {question.reason}
            </p>
          )}

          {/* Các lựa chọn dạng Radio */}
          <div
            role="radiogroup"
            aria-label={`${currentTargetItem.number}. ${cleanLabel(currentTargetItem.label)}`}
            className="space-y-2"
          >
            {displayChoices.map((choice) => {
              const isThisOther = isOtherOption(choice);
              const isSelected = currentItemSelection === choice;
              return (
                <div key={choice} className="space-y-2">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={disabled}
                    onClick={() => {
                      setItemSelections((prev) => ({
                        ...prev,
                        [currentTargetItem.number]: choice,
                      }));
                      if (isThisOther) {
                        setTimeout(() => {
                          itemOtherInputRef.current?.focus();
                        }, 50);
                      }
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-start text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
                      isSelected
                        ? "border-brand-500 bg-white text-gray-900 shadow-2xs ring-1 ring-brand-500 dark:border-brand-400 dark:bg-gray-900 dark:text-gray-100"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50/80 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        isSelected
                          ? "border-brand-600 bg-white dark:border-brand-400 dark:bg-gray-900"
                          : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"
                      }`}
                    >
                      {isSelected && (
                        <span className="size-2 rounded-full bg-brand-600 dark:bg-brand-400" />
                      )}
                    </span>
                    <span className="flex-1 leading-relaxed">
                      {isThisOther ? t("clarificationOtherOption") : choice}
                    </span>
                  </button>

                  {/* Khi chọn Khác, luôn hiển thị một ô nhập text ngay bên dưới để người dùng nhập */}
                  {isThisOther && isSelected && (
                    <div className="pt-0.5">
                      <input
                        ref={itemOtherInputRef}
                        type="text"
                        value={currentItemCustomText}
                        disabled={disabled}
                        onChange={(e) =>
                          setItemCustomTexts((prev) => ({
                            ...prev,
                            [currentTargetItem.number]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (canAdvanceCurrentItem) {
                              if (activeItemIndex < totalTargetItems - 1) {
                                setActiveItemIndex((prev) => prev + 1);
                              } else {
                                handleSubmitSequentialItems();
                              }
                            }
                          }
                        }}
                        placeholder={t("clarificationOtherPlaceholder")}
                        className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs text-gray-900 shadow-2xs placeholder:text-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Dòng hướng dẫn: Bạn cũng có thể trả lời bằng văn bản hoặc chọn "Bỏ qua" nếu chưa có thông tin */}
          <div className="flex items-start gap-1.5 pt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
            <Info className="mt-0.5 size-3.5 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            <span>{t("clarificationHintText")}</span>
          </div>

          {/* Các nút hành động: [ ▷▷ Bỏ qua ] [ ← Quay lại ] và [ Tiếp theo → ] / [ ✓ Xác nhận ] */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={disabled}
                aria-label={skipLabel}
                onClick={() => onSend(skipLabel, "skipped")}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-2xs transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <FastForward className="size-3.5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                <span>{t("clarificationSkipBtn")}</span>
              </button>

              {activeItemIndex > 0 && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setActiveItemIndex((prev) => prev - 1)}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 shadow-2xs transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                  <span>{t("clarificationBackBtn")}</span>
                </button>
              )}
            </div>

            {activeItemIndex < totalTargetItems - 1 ? (
              <button
                type="button"
                disabled={disabled || !canAdvanceCurrentItem}
                onClick={() => setActiveItemIndex((prev) => prev + 1)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-brand-500 dark:hover:bg-brand-600"
              >
                <span>{t("clarificationNextBtn")}</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                disabled={disabled || !canAdvanceCurrentItem}
                onClick={handleSubmitSequentialItems}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-brand-500 dark:hover:bg-brand-600"
              >
                <Check className="size-3.5" aria-hidden="true" />
                <span>{t("clarificationConfirmBtn")}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Case B: Single Question with Radio buttons, 'Khác' input, and Action Buttons */}
      {!isMultiItem && parsed.choiceMode === "single" && (
        <div className="space-y-3 pt-0.5">
          {parsed.prompt && (
            <h4 className="text-sm font-bold leading-snug text-gray-900 dark:text-gray-100">
              {parsed.prompt}
            </h4>
          )}

          {question.reason && (
            <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {question.reason}
            </p>
          )}

          <div
            role="radiogroup"
            aria-label={parsed.prompt || t("clarificationBadge")}
            className="space-y-2"
          >
            {displayChoices.map((choice) => {
              const isThisOther = isOtherOption(choice);
              const isSelected = selectedChoice === choice;
              return (
                <div key={choice} className="space-y-2">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={disabled}
                    onClick={() => {
                      setSelectedChoice(choice);
                      if (isThisOther) {
                        setTimeout(() => {
                          otherInputRef.current?.focus();
                        }, 50);
                      }
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-start text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
                      isSelected
                        ? "border-brand-500 bg-white text-gray-900 shadow-2xs ring-1 ring-brand-500 dark:border-brand-400 dark:bg-gray-900 dark:text-gray-100"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50/80 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        isSelected
                          ? "border-brand-600 bg-white dark:border-brand-400 dark:bg-gray-900"
                          : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"
                      }`}
                    >
                      {isSelected && (
                        <span className="size-2 rounded-full bg-brand-600 dark:bg-brand-400" />
                      )}
                    </span>
                    <span className="flex-1 leading-relaxed">
                      {isThisOther ? t("clarificationOtherOption") : choice}
                    </span>
                  </button>

                  {/* Khi chọn Khác, luôn hiển thị một ô nhập text ngay bên dưới để người dùng nhập */}
                  {isThisOther && isSelected && (
                    <div className="pt-0.5">
                      <input
                        ref={otherInputRef}
                        type="text"
                        value={otherCustomText}
                        disabled={disabled}
                        onChange={(e) => setOtherCustomText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (otherCustomText.trim()) {
                              handleConfirmSingle();
                            }
                          }
                        }}
                        placeholder={t("clarificationOtherPlaceholder")}
                        className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs text-gray-900 shadow-2xs placeholder:text-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Dòng hướng dẫn: Bạn cũng có thể trả lời bằng văn bản hoặc chọn "Bỏ qua" nếu chưa có thông tin */}
          <div className="flex items-start gap-1.5 pt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
            <Info className="mt-0.5 size-3.5 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            <span>{t("clarificationHintText")}</span>
          </div>

          {/* Các nút hành động: [ ▷▷ Bỏ qua ] và [ ✓ Xác nhận ] */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              disabled={disabled}
              aria-label={skipLabel}
              onClick={() => onSend(skipLabel, "skipped")}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-2xs transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <FastForward className="size-3.5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              <span>{t("clarificationSkipBtn")}</span>
            </button>

            <button
              type="button"
              disabled={disabled || !canConfirmSingle}
              onClick={handleConfirmSingle}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              <Check className="size-3.5" aria-hidden="true" />
              <span>{t("clarificationConfirmBtn")}</span>
            </button>
          </div>
        </div>
      )}

      {/* Case C: Multi-select Checklist (single question with embedded `- [ ]` checkboxes) */}
      {!isMultiItem && parsed.choiceMode === "multi" && (
        <div className="space-y-2.5 pt-0.5">
          {parsed.prompt && (
            <h4 className="text-sm font-bold leading-snug text-gray-900 dark:text-gray-100">
              {parsed.prompt}
            </h4>
          )}
          {question.reason && (
            <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {question.reason}
            </p>
          )}
          <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
            {t("clarificationMultiSelectHint")}
          </p>
          <div className="space-y-1.5">
            {parsed.choices.map((choice) => {
              const checked = multiSelections.includes(choice);
              return (
                <button
                  key={choice}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  disabled={disabled}
                  onClick={() =>
                    setMultiSelections((prev) =>
                      prev.includes(choice)
                        ? prev.filter((item) => item !== choice)
                        : [...prev, choice],
                    )
                  }
                  className={`flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2 text-start text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                    checked
                      ? "border-brand-500 bg-white text-brand-900 ring-1 ring-brand-500 dark:border-brand-400 dark:bg-gray-900 dark:text-brand-100"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50/80 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                      checked
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"
                    }`}
                  >
                    {checked && <Check className="size-3" />}
                  </span>
                  <span>{choice}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              disabled={disabled}
              aria-label={skipLabel}
              onClick={() => onSend(skipLabel, "skipped")}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-2xs transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <FastForward className="size-3.5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              <span>{t("clarificationSkipBtn")}</span>
            </button>

            <button
              type="button"
              disabled={disabled || multiSelections.length === 0}
              onClick={submitMultiSelections}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              <SendHorizontal className="size-3.5" aria-hidden="true" />
              <span>{t("clarificationSubmitSelected")}</span>
            </button>
          </div>
        </div>
      )}

      {/* Case D: Legacy Matrix for Embedded Checkbox Tests (where options: []) */}
      {!isMultiItem && parsed.choiceMode === "matrix" && (
        <div className="space-y-2.5 pt-0.5">
          <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
            {t("clarificationMatrixHint")}
          </p>
          <div className="space-y-2">
            {parsed.targetItems.map((item) => {
              const chosen = matrixSelections[item.number] ?? null;
              return (
                <div
                  key={item.number}
                  role="group"
                  aria-label={`${item.number}. ${item.label}`}
                  className="space-y-2 rounded-xl border border-gray-200/90 bg-white p-2.5 shadow-2xs dark:border-gray-800 dark:bg-gray-900"
                >
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                    {item.number}. {item.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {parsed.choices.map((choice) => {
                      const selected = chosen === choice;
                      return (
                        <button
                          key={choice}
                          type="button"
                          aria-pressed={selected}
                          disabled={disabled}
                          onClick={() =>
                            setMatrixSelections((prev) => {
                              const next = { ...prev };
                              if (next[item.number] === choice) {
                                delete next[item.number];
                              } else {
                                next[item.number] = choice;
                              }
                              return next;
                            })
                          }
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-start text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                            selected
                              ? "border-brand-500 bg-brand-600 text-white shadow-2xs"
                              : "border-gray-200 bg-gray-50/80 text-gray-700 hover:border-brand-300 hover:bg-brand-50/70 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-brand-500/40"
                          }`}
                        >
                          {selected && (
                            <Check
                              className="size-3 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          <span>{choice}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              disabled={disabled}
              aria-label={skipLabel}
              onClick={() => onSend(skipLabel, "skipped")}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-2xs transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <FastForward className="size-3.5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              <span>{t("clarificationSkipBtn")}</span>
            </button>

            <button
              type="button"
              disabled={disabled || !hasMatrixSelection}
              onClick={submitMatrixSelections}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              <SendHorizontal className="size-3.5" aria-hidden="true" />
              <span>{t("clarificationSubmitSelected")}</span>
            </button>
          </div>
        </div>
      )}

      {/* Case E: Open-ended Question */}
      {!isMultiItem && parsed.choiceMode === "none" && (
        <div className="space-y-3 pt-0.5">
          {parsed.prompt && (
            <h4 className="text-sm font-bold leading-snug text-gray-900 dark:text-gray-100">
              {parsed.prompt}
            </h4>
          )}
          {question.reason && (
            <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {question.reason}
            </p>
          )}
          {parsed.targetItems.length >= 2 && (
            <ol className="space-y-1 rounded-xl border border-gray-200/80 bg-white/90 px-3 py-2 text-xs text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
              {parsed.targetItems.map((item) => (
                <li key={item.number}>
                  <span className="font-semibold">{item.number}.</span>{" "}
                  {item.label}
                </li>
              ))}
            </ol>
          )}

          <div className="flex items-start gap-1.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
            <Info className="mt-0.5 size-3.5 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            <span>{t("clarificationHintText")}</span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              disabled={disabled}
              aria-label={skipLabel}
              onClick={() => onSend(skipLabel, "skipped")}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-2xs transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <FastForward className="size-3.5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              <span>{t("clarificationSkipBtn")}</span>
            </button>

            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => onSend(unknownLabel, "answered")}
            >
              {unknownLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DiffHighlightedContent({
  segments,
}: {
  segments: readonly DiffSegment[];
}) {
  return (
    <div
      data-testid="proposal-diff-content"
      className="text-xs leading-6 break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300"
    >
      {segments.map((seg, idx) => {
        if (seg.type === "equal") {
          return <Fragment key={idx}>{seg.text}</Fragment>;
        }

        const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(seg.text);
        const lead = match?.[1] ?? "";
        const core = match?.[2] ?? "";
        const trail = match?.[3] ?? "";

        if (!core) {
          return <Fragment key={idx}>{seg.text}</Fragment>;
        }

        const nextSeg = segments[idx + 1];
        const needsGapAfter =
          seg.type === "delete" &&
          !trail &&
          nextSeg?.type === "insert" &&
          !/^\s/.test(nextSeg.text);

        const coreLines = core.split("\n");

        return (
          <Fragment key={idx}>
            {lead}
            {coreLines.map((line, lineIdx) => {
              const isLastLine = lineIdx === coreLines.length - 1;
              return (
                <Fragment key={lineIdx}>
                  {line ? (
                    seg.type === "delete" ? (
                      <del
                        className={`rounded border border-error-200 bg-error-100 px-1 py-0.5 font-medium text-error-800 line-through decoration-error-500 dark:border-error-500/35 dark:bg-error-500/20 dark:text-error-300 ${
                          isLastLine && needsGapAfter ? "me-1" : ""
                        }`}
                      >
                        {line}
                      </del>
                    ) : (
                      <ins className="rounded border border-success-300 bg-success-100 px-1 py-0.5 font-semibold text-success-900 no-underline dark:border-success-500/40 dark:bg-success-500/25 dark:text-success-200">
                        {line}
                      </ins>
                    )
                  ) : null}
                  {!isLastLine && "\n"}
                </Fragment>
              );
            })}
            {trail}
          </Fragment>
        );
      })}
    </div>
  );
}

function InlineChatProposalCard({
  suggestion,
  before,
  stale,
  busy,
  uncertainties,
  security,
  onApply,
  onDismiss,
  onRegenerate,
}: {
  suggestion: AgentSuggestion;
  before: { title: string; contentMarkdown: string };
  stale: boolean;
  busy: boolean;
  uncertainties?: readonly string[];
  security?: AgentSecurityReport | null;
  onApply: (
    action: ProposalAction,
    applyTitle: boolean,
    edited: string | null,
  ) => void;
  onDismiss: () => void;
  onRegenerate: () => void;
}) {
  const t = useTranslations("workNotes.agent");
  const [edited, setEdited] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [applyTitle, setApplyTitle] = useState(false);
  const [copied, setCopied] = useState(false);

  const originalText =
    suggestion.operation === "title"
      ? before.title
      : (suggestion.selection?.quote ?? before.contentMarkdown);
  const proposedText =
    suggestion.replacementText ?? suggestion.suggestedTitle ?? "";
  const effectiveProposedText = edited ?? proposedText;

  const [viewMode, setViewMode] = useState<"diff" | "clean" | "original">(() =>
    originalText.trim().length === 0 ? "clean" : "diff",
  );

  const diff = useMemo(
    () => computeReadableDiff(originalText, effectiveProposedText),
    [originalText, effectiveProposedText],
  );

  return (
    <div
      role="region"
      aria-label={t("proposal")}
      className="flex items-start gap-2.5"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
      >
        <Sparkles className="size-3.5" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="space-y-2.5 rounded-2xl rounded-ss-md border border-gray-200/90 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          {/* Header Row + Change Count Badge + Dismiss */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                {t("proposalIntro")}
              </p>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                  diff.isNewContent
                    ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300"
                    : diff.isIdentical
                      ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      : "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                }`}
              >
                {diff.isNewContent
                  ? t("diffBadgeNew")
                  : diff.isIdentical
                    ? t("diffBadgeNoChange")
                    : t("diffBadgeChanges", { count: diff.changedBlocks })}
              </span>
            </div>

            <button
              type="button"
              aria-label={t("dismiss")}
              title={t("dismiss")}
              disabled={busy}
              onClick={onDismiss}
              className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <CloseIcon className="size-3.5 fill-current" />
            </button>
          </div>

          <SecurityShieldBanner report={security} />

          {/* Segmented View Switcher (So sánh | Bản hoàn chỉnh | Bản gốc) + Edit/Copy */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            {!diff.isNewContent ? (
              <div className="inline-flex items-center rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
                {(
                  [
                    ["diff", "diffTabCompare"],
                    ["clean", "diffTabClean"],
                    ["original", "diffTabOriginal"],
                  ] as const
                ).map(([mode, labelKey]) => {
                  const active = !isEditing && viewMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setIsEditing(false);
                        setViewMode(mode);
                      }}
                      className={`rounded-md px-2 py-1 text-[11px] whitespace-nowrap transition-all ${
                        active
                          ? "bg-white font-semibold text-brand-700 shadow-2xs dark:bg-gray-900 dark:text-brand-300"
                          : "font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                      }`}
                    >
                      {t(labelKey)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="text-[11px] font-bold text-success-700 dark:text-success-400">
                {t("diffTabClean")}
              </span>
            )}

            <div className="flex items-center gap-1">
              {proposedText.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (isEditing) {
                      setIsEditing(false);
                    } else {
                      setEdited((prev) => prev ?? proposedText);
                      setIsEditing(true);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-40 dark:text-brand-300 dark:hover:bg-brand-500/15"
                >
                  <Pencil className="size-3" aria-hidden="true" />
                  <span>
                    {t(isEditing ? "finishEditProposal" : "editProposal")}
                  </span>
                </button>
              )}

              <button
                type="button"
                aria-label={t(copied ? "inlineCopied" : "inlineCopy")}
                title={t(copied ? "inlineCopied" : "inlineCopy")}
                onClick={() => {
                  void navigator.clipboard?.writeText?.(effectiveProposedText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                {copied ? (
                  <Check
                    className="size-3.5 text-success-600"
                    aria-hidden="true"
                  />
                ) : (
                  <Copy className="size-3.5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* Main Proposal Content Box (No cramped inner scrollbars) */}
          {isEditing && edited !== null ? (
            <label className="block space-y-1 text-xs">
              <span className="sr-only">{t("editProposal")}</span>
              <textarea
                rows={5}
                maxLength={30000}
                value={edited}
                onChange={(e) =>
                  setEdited(reconcileTextareaEdit(edited, e.target.value))
                }
                className="w-full rounded-xl border border-brand-300 bg-white p-2.5 text-xs leading-relaxed text-gray-900 outline-none focus:border-brand-500 dark:border-brand-500/40 dark:bg-gray-950 dark:text-gray-100"
              />
            </label>
          ) : viewMode === "diff" && !diff.isNewContent ? (
            <div className="overflow-hidden rounded-xl border border-gray-200/90 bg-white dark:border-gray-700/80 dark:bg-gray-950/60">
              {!diff.isIdentical && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/90 px-3 py-1.5 dark:border-gray-800 dark:bg-gray-800/70">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded border border-error-200 bg-error-100 px-1.5 py-0.5 text-[10px] font-medium text-error-800 line-through decoration-error-500 dark:border-error-500/35 dark:bg-error-500/20 dark:text-error-300">
                      {t("diffLegendRemoved")}
                    </span>
                    <span className="rounded border border-success-300 bg-success-100 px-1.5 py-0.5 text-[10px] font-semibold text-success-900 dark:border-success-500/40 dark:bg-success-500/25 dark:text-success-200">
                      {t("diffLegendAdded")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-semibold">
                    {diff.removedWords > 0 && (
                      <span className="text-error-600 dark:text-error-400">
                        {t("diffWordsRemoved", { count: diff.removedWords })}
                      </span>
                    )}
                    {diff.addedWords > 0 && (
                      <span className="text-success-700 dark:text-success-400">
                        {t("diffWordsAdded", { count: diff.addedWords })}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="max-h-[26rem] overflow-y-auto px-3 py-2.5">
                <DiffHighlightedContent segments={diff.segments} />
              </div>
            </div>
          ) : viewMode === "original" ? (
            <div className="max-h-[26rem] overflow-y-auto rounded-xl bg-gray-100/85 px-3 py-2.5 text-xs leading-6 break-words whitespace-pre-wrap text-gray-700 dark:bg-gray-800/85 dark:text-gray-300">
              {originalText}
            </div>
          ) : (
            <div className="max-h-[26rem] overflow-y-auto rounded-xl border border-success-200 bg-success-50/80 px-3 py-2.5 text-xs leading-6 break-words whitespace-pre-wrap text-gray-900 dark:border-success-500/30 dark:bg-success-500/10 dark:text-gray-100">
              {effectiveProposedText}
            </div>
          )}

          {suggestion.suggestedTitle && suggestion.operation !== "title" && (
            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={applyTitle}
                onChange={(e) => setApplyTitle(e.target.checked)}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span>
                {t("applyTitle")}: <strong>{suggestion.suggestedTitle}</strong>
              </span>
            </label>
          )}

          {stale && (
            <p
              role="status"
              className="text-xs font-medium text-warning-700 dark:text-warning-400"
            >
              {t("stale")}
            </p>
          )}

          {!!uncertainties?.length && (
            <ul className="space-y-1 rounded-lg border border-warning-200 bg-warning-50/70 p-2 text-[11px] text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
              {uncertainties.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Action Buttons Row underneath AI Proposal Bubble */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || stale || (edited !== null && !edited.trim())}
            onClick={() =>
              onApply(
                suggestion.operation === "title"
                  ? "replace_title"
                  : suggestion.scope === "selection"
                    ? "replace_selection"
                    : "replace_body",
                suggestion.operation === "title" || applyTitle,
                edited,
              )
            }
            className="rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {t(
              suggestion.scope === "selection"
                ? "inlineApplySelection"
                : "apply",
            )}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={onRegenerate}
            className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-2xs transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {t("regenerate")}
          </button>

          {suggestion.scope === "selection" && (
            <button
              type="button"
              disabled={busy || stale}
              onClick={() => onApply("insert_after", false, edited)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {t("inlineInsertAfter")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkNoteAgentChat({
  draft,
  before,
  selectionPromptQuote,
  suggestion,
  suggestionStale,
  uncertainties,
  security,
  preSendSecurity,
  busy,
  thinking,
  pendingUserMessage,
  message,
  onMessage,
  onQuickOption,
  onSend,
  onApplySuggestion,
  onDismissSuggestion,
  onRegenerateSuggestion,
  onReset,
  inputRef,
}: {
  draft: AgentDraft | undefined;
  before: { title: string; contentMarkdown: string };
  selectionPromptQuote: string | null;
  suggestion: AgentSuggestion | null;
  suggestionStale: boolean;
  uncertainties?: readonly string[];
  security?: AgentSecurityReport | null;
  preSendSecurity?: PreSendSecurityScan | null;
  busy: boolean;
  thinking: boolean;
  pendingUserMessage?: string | null;
  message: string;
  onMessage: (v: string) => void;
  onQuickOption: (operation: AgentOperation, promptText: string) => void;
  onSend: (text?: string, disposition?: "answered" | "skipped") => void;
  onApplySuggestion: (
    action: ProposalAction,
    applyTitle: boolean,
    edited: string | null,
  ) => void;
  onDismissSuggestion: () => void;
  onRegenerateSuggestion: () => void;
  onReset: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const t = useTranslations("workNotes.agent");
  const question = draft?.pendingQuestion;
  const logEndRef = useRef<HTMLDivElement>(null);

  const conversationCount = draft?.conversation.length ?? 0;
  const suggestionId = suggestion?.id ?? null;
  const questionId = question?.id ?? null;

  useEffect(() => {
    logEndRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [
    conversationCount,
    selectionPromptQuote,
    suggestionId,
    questionId,
    pendingUserMessage,
    thinking,
  ]);

  const selectionOptions: readonly {
    id: string;
    labelKey:
      | "selectionOptionClarify"
      | "selectionOptionTone"
      | "selectionOptionShorten"
      | "selectionOptionExpand"
      | "selectionOptionCustom";
    operation?: AgentOperation;
    promptKey?: "clarify" | "tone" | "shorten" | "restructure";
    Icon: typeof Wand2;
  }[] = [
    {
      id: "clarify",
      labelKey: "selectionOptionClarify",
      operation: "clarify",
      promptKey: "clarify",
      Icon: Wand2,
    },
    {
      id: "tone",
      labelKey: "selectionOptionTone",
      operation: "tone",
      promptKey: "tone",
      Icon: SquarePen,
    },
    {
      id: "shorten",
      labelKey: "selectionOptionShorten",
      operation: "shorten",
      promptKey: "shorten",
      Icon: ArrowLeftRight,
    },
    {
      id: "expand",
      labelKey: "selectionOptionExpand",
      operation: "restructure",
      promptKey: "restructure",
      Icon: LayoutGrid,
    },
    {
      id: "custom",
      labelKey: "selectionOptionCustom",
      Icon: Pencil,
    },
  ];

  const assessmentGaps = draft?.assessment?.gaps ?? [];
  const openGaps = assessmentGaps.filter((g) => g.status === "open");
  const answeredGaps = assessmentGaps.filter(
    (g) => g.status === "answered" || g.status === "skipped",
  );
  const totalGaps = openGaps.length + answeredGaps.length;

  const activeQuestionStep = useMemo(() => {
    if (totalGaps >= 2) {
      return {
        current: Math.min(answeredGaps.length + 1, totalGaps),
        total: totalGaps,
      };
    }
    if (question) {
      const match = /(?:^|\s|\()(\d+)\/(\d+)(?:\)|\s|$)/.exec(question.text);
      if (match) {
        return {
          current: parseInt(match[1], 10),
          total: parseInt(match[2], 10),
        };
      }
    }
    return undefined;
  }, [totalGaps, answeredGaps.length, question]);

  const hasMessages =
    conversationCount > 0 ||
    !!pendingUserMessage ||
    !!selectionPromptQuote ||
    !!suggestion ||
    !!question;

  return (
    <section
      id="worknote-agent-chat"
      aria-label={t("chat")}
      className="flex min-h-0 flex-1 flex-col"
    >
      {/* Top Sub-bar (Reset Conversation when history exists) */}
      {conversationCount > 0 && (
        <div className="flex shrink-0 items-center justify-end px-4 pb-1.5">
          <button
            type="button"
            disabled={busy || thinking}
            onClick={onReset}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 transition-colors hover:text-brand-600 disabled:opacity-40 dark:text-gray-400 dark:hover:text-brand-300"
          >
            <RotateCcw className="size-3" aria-hidden="true" />
            <span>{t("resetChat")}</span>
          </button>
        </div>
      )}

      {/* Scrollable Chat Stream (Regions 9 & 10) */}
      <div
        role="log"
        aria-live="polite"
        className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-2 text-xs"
      >
        {!hasMessages && (
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
            </span>
            <div className="rounded-2xl rounded-ss-md bg-brand-50/75 px-3.5 py-2.5 text-xs leading-relaxed text-gray-800 dark:bg-brand-500/10 dark:text-gray-200">
              {t("chatEmptyGreeting")}
            </div>
          </div>
        )}

        {draft?.conversation.map((entry, i) => {
          const isLastAssistantWithProposal =
            entry.role === "assistant" &&
            i === conversationCount - 1 &&
            !!suggestion;
          if (isLastAssistantWithProposal) {
            return null;
          }

          if (entry.role === "user") {
            return (
              <div key={i} className="flex items-end justify-end gap-2">
                <div className="max-w-[82%] rounded-2xl rounded-ee-md bg-brand-100/80 px-3.5 py-2 text-xs font-medium break-words whitespace-pre-wrap text-gray-900 dark:bg-brand-500/20 dark:text-brand-100">
                  {renderInlineMarkdown(entry.content)}
                </div>
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[11px] font-bold text-white shadow-2xs"
                >
                  {t("userInitial")}
                </span>
              </div>
            );
          }

          return (
            <div key={i} className="flex items-start gap-2.5">
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
              </span>
              <div className="max-w-[86%] space-y-2">
                <SecurityShieldBanner report={entry.security} />
                <div className="rounded-2xl rounded-ss-md border border-gray-100 bg-white px-3.5 py-2.5 text-xs leading-relaxed break-words text-gray-800 shadow-2xs dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
                  <FormattedAssistantText content={entry.content} />
                </div>
              </div>
            </div>
          );
        })}

        {/* Region (9): Contextual Selection Greeting + 5 Vertical Quick Options */}
        {selectionPromptQuote && (
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="rounded-2xl rounded-ss-md bg-brand-50/80 px-3.5 py-2.5 text-xs leading-relaxed text-gray-800 dark:bg-brand-500/15 dark:text-gray-100">
                <p>
                  {t("selectionGreetingPrefix")}{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    “{selectionPromptQuote}”
                  </span>
                  .
                </p>
                <p className="mt-0.5">{t("selectionGreetingQuestion")}</p>
              </div>

              <div className="space-y-1.5">
                {selectionOptions.map(
                  ({ id, labelKey, operation, promptKey, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      disabled={busy || thinking}
                      onClick={() => {
                        if (operation && promptKey) {
                          onQuickOption(operation, t(`prompts.${promptKey}`));
                        } else {
                          inputRef.current?.focus();
                        }
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-start text-xs font-medium text-gray-700 shadow-2xs transition-colors hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                    >
                      <Icon
                        className="size-3.5 shrink-0 text-gray-500 dark:text-gray-400"
                        aria-hidden="true"
                      />
                      <span>{t(labelKey)}</span>
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        )}

        {/* Region (10): Inline Proposal Bubble (Original vs Improved version + Apply / Try another version) */}
        {suggestion && (
          <InlineChatProposalCard
            key={suggestion.id}
            suggestion={suggestion}
            before={before}
            stale={suggestionStale}
            busy={busy || thinking}
            uncertainties={uncertainties}
            security={
              security ??
              draft?.lastSecurity ??
              draft?.conversation[conversationCount - 1]?.security ??
              null
            }
            onApply={onApplySuggestion}
            onDismiss={onDismissSuggestion}
            onRegenerate={onRegenerateSuggestion}
          />
        )}

        {/* Structured Interactive Clarification Question Card */}
        {question && (
          <ClarificationQuestionCard
            key={question.id}
            question={question}
            step={activeQuestionStep}
            disabled={thinking || busy}
            onSend={onSend}
          />
        )}

        {/* Optimistic In-Flight User Message Bubble (appears immediately before AI finishes) */}
        {thinking && pendingUserMessage && (
          <div
            data-testid="optimistic-user-message"
            className="flex items-end justify-end gap-2"
          >
            <div className="max-w-[82%] rounded-2xl rounded-ee-md bg-brand-100/80 px-3.5 py-2 text-xs font-medium break-words whitespace-pre-wrap text-gray-900 dark:bg-brand-500/20 dark:text-brand-100">
              {pendingUserMessage}
            </div>
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[11px] font-bold text-white shadow-2xs"
            >
              {t("userInitial")}
            </span>
          </div>
        )}

        {/* Thinking Indicator */}
        {thinking && (
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
            >
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            </span>
            <p
              role="status"
              className="rounded-2xl bg-white px-3.5 py-2 text-xs font-medium text-brand-600 shadow-2xs dark:bg-gray-900 dark:text-brand-300"
            >
              {t("thinking")}
            </p>
          </div>
        )}

        <div ref={logEndRef} />
      </div>

      {/* Region (11): Pinned Bottom Message Input Bar */}
      <div className="shrink-0 space-y-2 border-t border-gray-200/80 bg-white/85 px-4 py-3 backdrop-blur-xs dark:border-gray-800 dark:bg-gray-900/90">
        {preSendSecurity && <PreSendSecurityNotice scan={preSendSecurity} />}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!message.trim() || thinking || busy) return;
            onSend(undefined, question ? "answered" : undefined);
          }}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 shadow-2xs transition-colors focus-within:border-brand-500 dark:border-gray-700 dark:bg-gray-950"
        >
          <Paperclip
            className="size-4 shrink-0 text-gray-400"
            aria-hidden="true"
          />
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t("instruction")}</span>
            <textarea
              ref={inputRef}
              rows={1}
              value={message}
              maxLength={2000}
              disabled={busy}
              placeholder={t("instruction")}
              onChange={(e) => onMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!message.trim() || thinking || busy) return;
                  onSend(undefined, question ? "answered" : undefined);
                }
              }}
              className="max-h-24 min-h-6 w-full resize-none border-0 bg-transparent py-1 text-xs text-gray-900 outline-none focus:ring-0 dark:text-gray-100"
            />
          </label>
          <button
            type="submit"
            aria-label={t("send")}
            title={t("send")}
            disabled={!message.trim() || thinking || busy}
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-2xs transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-200 dark:disabled:bg-brand-500/30"
          >
            <SendHorizontal className="size-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    </section>
  );
}
