"use client";

import {
  Fragment,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useTranslations } from "next-intl";
import {
  ArrowUpToLine,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Download,
  FileCode2,
  FileText,
  ListTree,
  Lock,
  Share2,
} from "lucide-react";
import type {
  ArtifactFileMetadata,
  DocumentStorageReference,
} from "@/lib/queries/work-notes/useWorkNotes";
import { cn } from "@/utils";

export function formatArtifactBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface MarkdownSignalSummary {
  readonly checklistDone: number;
  readonly checklistTotal: number;
  readonly hasTable: boolean;
  readonly hasCode: boolean;
  readonly codeLang: string | null;
  readonly hasCallout: boolean;
  readonly cleanExcerpt: string;
}

export function extractMarkdownSignals(raw: string): MarkdownSignalSummary {
  if (!raw || !raw.trim()) {
    return {
      checklistDone: 0,
      checklistTotal: 0,
      hasTable: false,
      hasCode: false,
      codeLang: null,
      hasCallout: false,
      cleanExcerpt: "",
    };
  }

  const normalized = raw
    .replace(/\r\n/g, "\n")
    .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");

  const checkedMatches = normalized.match(/^\s*[-*+]\s+\[[xX]\]\s+/gm);
  const uncheckedMatches = normalized.match(/^\s*[-*+]\s+\[\s\]\s+/gm);
  const checklistDone = checkedMatches ? checkedMatches.length : 0;
  const checklistTotal =
    checklistDone + (uncheckedMatches ? uncheckedMatches.length : 0);

  const codeMatch = normalized.match(/^```([a-zA-Z0-9_-]*)/m);
  const hasCode = Boolean(codeMatch);
  const codeLang = codeMatch?.[1]?.trim() ? codeMatch[1].trim() : null;

  const hasTable = /^\s*\|?.+\|.+\n\s*\|?[\s:-]+\|[\s|:-]*$/m.test(normalized);
  const hasCallout = /^\s*>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/im.test(
    normalized,
  );

  const stripped = normalized
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*\|?[\s:-]+\|[\s|:-]*$/gm, " ")
    .replace(/^\s*>\s*\[![A-Z]+\]\s*/gim, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\|/g, " ")
    .replace(/[*_~`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const cleanExcerpt =
    stripped.length > 135 ? `${stripped.slice(0, 132).trimEnd()}…` : stripped;

  return {
    checklistDone,
    checklistTotal,
    hasTable,
    hasCode,
    codeLang,
    hasCallout,
    cleanExcerpt,
  };
}

function slugifyPreviewName(value: string): string {
  const ascii = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return ascii || "artifact";
}

export function buildClientMarkdownPreview(params: {
  kind: "TASK_NOTE" | "WORK_REPORT";
  title: string;
  version?: number;
  taskKey?: string;
  taskTitle?: string;
  authorName?: string;
  scope?: string;
  frequency?: string;
  periodLabel?: string;
  contentMarkdown?: string;
  sections?: ReadonlyArray<{ heading: string; body?: string }>;
}): { previewFileName: string; markdownSource: string; byteLength: number } {
  const version = Math.max(1, params.version ?? 1);
  const cleanTitle = params.title.trim() || "Untitled";
  const prefix =
    params.kind === "TASK_NOTE"
      ? params.taskKey
        ? `TASK-${slugifyPreviewName(params.taskKey)}-${slugifyPreviewName(cleanTitle)}`
        : `task-note-${slugifyPreviewName(cleanTitle)}`
      : `report-${(params.scope ?? "member").toLowerCase()}-${slugifyPreviewName(cleanTitle)}`;
  const previewFileName = `${prefix}-v${version}.md`;

  const fmLines: string[] = [
    "---",
    `source_type: ${params.kind === "TASK_NOTE" ? "WORK_NOTE" : "PERIODIC_REPORT"}`,
    `version: v${version}`,
  ];
  if (params.taskKey || params.taskTitle) {
    fmLines.push(
      `task: "${[params.taskKey, params.taskTitle].filter(Boolean).join(" — ").replace(/"/g, '\\"')}"`,
    );
  }
  if (params.scope || params.frequency) {
    fmLines.push(
      `cadence: "${[params.scope, params.frequency].filter(Boolean).join(" · ")}"`,
    );
  }
  if (params.periodLabel) {
    fmLines.push(`period: "${params.periodLabel.replace(/"/g, '\\"')}"`);
  }
  if (params.authorName) {
    fmLines.push(`author: "${params.authorName.replace(/"/g, '\\"')}"`);
  }
  fmLines.push("---");

  const body =
    params.contentMarkdown && params.contentMarkdown.trim().length > 0
      ? params.contentMarkdown.trim()
      : (params.sections ?? [])
          .filter((sec) => Boolean(sec.body?.trim()))
          .map((sec) => `## ${sec.heading}\n\n${sec.body?.trim()}`)
          .join("\n\n");

  const hasLeadingH1 = /^#\s+/.test(body);
  const fullBody = hasLeadingH1 ? body : `# ${cleanTitle}\n\n${body}`;
  const markdownSource = `${fmLines.join("\n")}\n\n${fullBody}\n`;
  const byteLength =
    typeof TextEncoder !== "undefined"
      ? new TextEncoder().encode(markdownSource).byteLength
      : markdownSource.length;

  return {
    previewFileName,
    markdownSource,
    byteLength,
  };
}

type ParsedFrontmatterEntry = Readonly<{
  key: string;
  value: string;
}>;

type MarkdownBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "hr" }
  | { kind: "code"; language: string; content: string }
  | {
      kind: "table";
      headers: string[];
      alignments: Array<"text-start" | "text-center" | "text-end">;
      rows: string[][];
    }
  | { kind: "blockquote"; lines: string[]; calloutType?: string }
  | {
      kind: "ul";
      items: Array<{ text: string; checked?: boolean }>;
    }
  | { kind: "ol"; items: Array<{ num: string; text: string }> }
  | { kind: "paragraph"; text: string };

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?(?:\s*\|\s*:?-{2,}:?)+\s*\|?\s*$/.test(line);
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replace(/\\\|/g, "|").trim());
}

function parseTableAlignments(
  separatorLine: string,
): Array<"text-start" | "text-center" | "text-end"> {
  return splitTableRow(separatorLine).map((col) => {
    const marker = col.trim();
    if (marker.startsWith(":") && marker.endsWith(":")) return "text-center";
    if (marker.endsWith(":")) return "text-end";
    return "text-start";
  });
}

function extractFrontmatter(raw: string): {
  frontmatter: ParsedFrontmatterEntry[];
  body: string;
} {
  const normalized = raw.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { frontmatter: [], body: normalized };
  }
  const endIdx = normalized.indexOf("\n---\n", 4);
  if (endIdx === -1) {
    return { frontmatter: [], body: normalized };
  }
  const fmRaw = normalized.slice(4, endIdx).trim();
  const entries: ParsedFrontmatterEntry[] = [];
  for (const line of fmRaw.split("\n")) {
    const m = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    const rawVal = m[2]!.trim().replace(/^["']|["']$/g, "");
    if (rawVal) {
      entries.push({ key: m[1]!, value: rawVal });
    }
  }
  return {
    frontmatter: entries,
    body: normalized.slice(endIdx + 5).trim(),
  };
}

function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i]!;
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Fenced code block
    const fenceMatch = /^\s*(`{3,}|~{3,})([A-Za-z0-9_+.-]*)\s*$/.exec(rawLine);
    if (fenceMatch) {
      const fenceMarker = fenceMatch[1]!;
      const language = fenceMatch[2]?.trim() || "";
      i += 1;
      const codeLines: string[] = [];
      while (
        i < lines.length &&
        !lines[i]!.trim().startsWith(fenceMarker.slice(0, 3))
      ) {
        codeLines.push(lines[i]!);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({
        kind: "code",
        language,
        content: codeLines.join("\n"),
      });
      continue;
    }

    // Horizontal rule
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ kind: "hr" });
      i += 1;
      continue;
    }

    // GFM Table
    if (
      trimmed.includes("|") &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1]!)
    ) {
      const headers = splitTableRow(rawLine);
      const alignments = parseTableAlignments(lines[i + 1]!);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length) {
        const rowTrim = lines[i]!.trim();
        if (!rowTrim || !rowTrim.includes("|")) break;
        if (isTableSeparator(rowTrim)) {
          i += 1;
          continue;
        }
        rows.push(splitTableRow(lines[i]!));
        i += 1;
      }
      blocks.push({ kind: "table", headers, alignments, rows });
      continue;
    }

    // Blockquote / Callout
    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!.trim())) {
        const cleaned = lines[i]!.trim().replace(/^>\s?/, "");
        quoteLines.push(cleaned);
        i += 1;
      }
      let calloutType: string | undefined;
      if (quoteLines.length > 0) {
        const calloutMatch = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i.exec(
          quoteLines[0]!,
        );
        if (calloutMatch) {
          calloutType = calloutMatch[1]!.toUpperCase();
          if (calloutMatch[2]?.trim()) {
            quoteLines[0] = calloutMatch[2].trim();
          } else {
            quoteLines.shift();
          }
        }
      }
      blocks.push({
        kind: "blockquote",
        lines: quoteLines.filter((l, idx) => Boolean(l) || idx > 0),
        calloutType,
      });
      continue;
    }

    // Heading
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      blocks.push({
        kind: "heading",
        level: headingMatch[1]!.length,
        text: headingMatch[2]!.replace(/\s+#+\s*$/, "").trim(),
      });
      i += 1;
      continue;
    }

    // Unordered / Checklist
    if (/^[-*+•]\s+/.test(trimmed)) {
      const items: Array<{ text: string; checked?: boolean }> = [];
      while (i < lines.length && /^[-*+•]\s+/.test(lines[i]!.trim())) {
        const itemBody = lines[i]!.trim().replace(/^[-*+•]\s+/, "");
        const taskMatch = /^\[([ xX])\]\s+(.*)$/.exec(itemBody);
        if (taskMatch) {
          items.push({
            checked: taskMatch[1]!.toLowerCase() === "x",
            text: taskMatch[2]!.trim(),
          });
        } else {
          items.push({ text: itemBody });
        }
        i += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    // Ordered List
    const orderedMatch = /^(\d{1,3})[.)]\s+(.*)$/.exec(trimmed);
    if (orderedMatch) {
      const items: Array<{ num: string; text: string }> = [];
      while (i < lines.length) {
        const m = /^(\d{1,3})[.)]\s+(.*)$/.exec(lines[i]!.trim());
        if (!m) break;
        items.push({ num: m[1]!, text: m[2]!.trim() });
        i += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    // Paragraph
    const paraLines: string[] = [trimmed];
    i += 1;
    while (i < lines.length) {
      const nextRaw = lines[i]!;
      const nextTrim = nextRaw.trim();
      if (
        !nextTrim ||
        /^\s*(`{3,}|~{3,})/.test(nextRaw) ||
        /^(?:-{3,}|\*{3,}|_{3,})$/.test(nextTrim) ||
        /^#{1,6}\s+/.test(nextTrim) ||
        /^>\s?/.test(nextTrim) ||
        /^[-*+•]\s+/.test(nextTrim) ||
        /^\d{1,3}[.)]\s+/.test(nextTrim) ||
        (nextTrim.includes("|") &&
          i + 1 < lines.length &&
          isTableSeparator(lines[i + 1]!))
      ) {
        break;
      }
      paraLines.push(nextTrim);
      i += 1;
    }
    blocks.push({ kind: "paragraph", text: paraLines.join(" ") });
  }

  return blocks;
}

const INLINE_TOKEN_RE =
  /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|\*[^*\s][^*\n]*\*)/g;

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode {
  if (!text) return null;
  const tokens = text.split(INLINE_TOKEN_RE);
  if (tokens.length === 1) return text;

  return tokens.map((token, idx) => {
    if (!token) return null;
    const key = `${keyPrefix}-${idx}`;

    if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
      return (
        <code
          key={key}
          className="rounded border border-gray-200 bg-gray-100/90 px-1.5 py-0.5 font-mono text-[0.84em] font-medium text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    if (
      ((token.startsWith("**") && token.endsWith("**")) ||
        (token.startsWith("__") && token.endsWith("__"))) &&
      token.length >= 4
    ) {
      return (
        <strong
          key={key}
          className="font-semibold text-gray-900 dark:text-white"
        >
          {token.slice(2, -2)}
        </strong>
      );
    }

    if (token.startsWith("~~") && token.endsWith("~~") && token.length >= 4) {
      return (
        <del key={key} className="text-gray-400 line-through">
          {token.slice(2, -2)}
        </del>
      );
    }

    if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const splitIdx = token.indexOf("](");
      const label = token.slice(1, splitIdx);
      const href = token.slice(splitIdx + 2, -1);
      return (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-gray-900 underline decoration-gray-400 underline-offset-2 hover:decoration-gray-900 dark:text-gray-100"
        >
          {label}
        </a>
      );
    }

    if (token.startsWith("*") && token.endsWith("*") && token.length >= 3) {
      return (
        <em key={key} className="italic text-gray-800 dark:text-gray-200">
          {token.slice(1, -1)}
        </em>
      );
    }

    return <Fragment key={key}>{token}</Fragment>;
  });
}

export interface MarkdownOutlineItem {
  readonly id: string;
  readonly blockIndex: number;
  readonly level: number;
  readonly text: string;
}

function stripInlineMarkdownFormatting(raw: string): string {
  return raw
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

export function extractMarkdownOutline(
  markdown: string,
  omitTopHeading?: string,
): MarkdownOutlineItem[] {
  if (!markdown || !markdown.trim()) return [];
  const { body } = extractFrontmatter(markdown);
  const parsed = parseMarkdownBlocks(body);
  const blocks =
    omitTopHeading &&
    parsed.length > 0 &&
    parsed[0]?.kind === "heading" &&
    parsed[0].level === 1 &&
    parsed[0].text.trim().toLowerCase() === omitTopHeading.trim().toLowerCase()
      ? parsed.slice(1)
      : parsed;

  const primaryHeadings: MarkdownOutlineItem[] = [];
  const allHeadings: MarkdownOutlineItem[] = [];

  blocks.forEach((block, idx) => {
    if (block.kind !== "heading") return;
    const cleanText = stripInlineMarkdownFormatting(block.text);
    if (!cleanText) return;
    const item: MarkdownOutlineItem = {
      id: `md-sec-${idx}`,
      blockIndex: idx,
      level: block.level,
      text: cleanText,
    };
    allHeadings.push(item);
    if (block.level <= 2) {
      primaryHeadings.push(item);
    }
  });

  return primaryHeadings.length >= 2 ? primaryHeadings : allHeadings;
}

function scrollContainerToOffset(container: HTMLElement, top: number): void {
  const clampedTop = Math.max(0, top);
  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof container.scrollTo === "function") {
    container.scrollTo({
      top: clampedTop,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  } else {
    container.scrollTop = clampedTop;
  }
}

export function SectionOutlineBar({
  items,
  scrollContainerRef,
  minHeadings = 3,
  className,
}: Readonly<{
  items: readonly MarkdownOutlineItem[];
  scrollContainerRef?: RefObject<HTMLElement | null>;
  minHeadings?: number;
  className?: string;
}>) {
  const t = useTranslations("workNotes.artifact");
  const [activeId, setActiveId] = useState<string | null>(null);

  if (items.length < minHeadings) {
    return null;
  }

  const handleJumpTop = () => {
    setActiveId(null);
    const container = scrollContainerRef?.current;
    if (container) {
      scrollContainerToOffset(container, 0);
    }
  };

  const handleJumpSection = (sectionId: string) => {
    setActiveId(sectionId);
    const container = scrollContainerRef?.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(
      `[data-section-id="${sectionId}"]`,
    );
    if (!target) return;
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextTop =
      container.scrollTop + (targetRect.top - containerRect.top) - 14;
    scrollContainerToOffset(container, nextTop);
  };

  return (
    <nav
      aria-label={t("outlineLabel")}
      data-testid="section-outline-bar"
      className={cn(
        "flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-gray-100 bg-gray-50/75 px-5 py-1.5 text-[11px] dark:border-gray-800/80 dark:bg-gray-900/60",
        className,
      )}
    >
      <span className="inline-flex shrink-0 items-center gap-1 pe-1 font-medium text-gray-400 dark:text-gray-500">
        <ListTree className="h-3 w-3" aria-hidden="true" />
        <span>{t("outlineLabel")}</span>
      </span>

      <button
        type="button"
        onClick={handleJumpTop}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 font-medium transition-colors",
          activeId === null
            ? "bg-white text-gray-800 ring-1 ring-inset ring-gray-200/80 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700"
            : "text-gray-500 hover:bg-white/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/70 dark:hover:text-gray-200",
        )}
      >
        <ArrowUpToLine className="h-2.5 w-2.5" aria-hidden="true" />
        <span>{t("outlineTop")}</span>
      </button>

      {items.map((item) => {
        const isCurrent = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleJumpSection(item.id)}
            title={item.text}
            className={cn(
              "max-w-[190px] shrink-0 truncate rounded-md px-2 py-0.5 font-medium transition-colors",
              isCurrent
                ? "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200/80 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30"
                : "text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200",
            )}
          >
            {item.text}
          </button>
        );
      })}
    </nav>
  );
}

const CODE_CLAMP_THRESHOLD_LINES = 18;

function CollapsibleCodeBlock({
  language,
  content,
  compact,
}: Readonly<{
  language: string;
  content: string;
  compact: boolean;
}>) {
  const t = useTranslations("workNotes.artifact");
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const lineCount = useMemo(
    () => content.replace(/\r\n/g, "\n").split("\n").length,
    [content],
  );
  const shouldClamp = !compact && lineCount > CODE_CLAMP_THRESHOLD_LINES;
  const isClamped = shouldClamp && !expanded;

  const handleCopyCode = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div
      data-testid="markdown-code-block"
      className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-950 text-gray-100 dark:border-gray-800"
    >
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/90 px-3.5 py-1.5 font-mono text-[10px] text-gray-400">
        <span className="uppercase tracking-wider">
          {language || "code"} · {lineCount}L
        </span>
        <button
          type="button"
          onClick={handleCopyCode}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
        >
          {copied ? (
            <Check className="h-2.5 w-2.5 text-emerald-400" />
          ) : (
            <Copy className="h-2.5 w-2.5 text-gray-400" />
          )}
          <span>{copied ? t("copiedMd") : t("copyShort")}</span>
        </button>
      </div>

      <div
        className={cn(
          "relative",
          isClamped && "max-h-72 overflow-hidden",
        )}
      >
        <pre className="overflow-x-auto p-3.5 font-mono text-[12px] leading-relaxed text-gray-100">
          <code>{content}</code>
        </pre>

        {isClamped ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-gray-950 via-gray-950/90 to-transparent" />
        ) : null}
      </div>

      {shouldClamp ? (
        <div className="flex items-center justify-center border-t border-gray-800/90 bg-gray-950/95 px-3 py-1.5">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[11px] font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                <span>{t("codeCollapseLines")}</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                <span>{t("codeExpandLines", { count: lineCount })}</span>
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export interface MarkdownDocumentViewProps {
  readonly markdown: string;
  readonly omitTopHeading?: string;
  readonly showFrontmatter?: boolean;
  readonly compact?: boolean;
  readonly className?: string;
}

export function MarkdownDocumentView({
  markdown,
  omitTopHeading,
  showFrontmatter = false,
  compact = false,
  className,
}: MarkdownDocumentViewProps) {
  const { frontmatter, body } = useMemo(
    () => extractFrontmatter(markdown),
    [markdown],
  );
  const blocks = useMemo(() => {
    const parsed = parseMarkdownBlocks(body);
    if (
      omitTopHeading &&
      parsed.length > 0 &&
      parsed[0]?.kind === "heading" &&
      parsed[0].level === 1 &&
      parsed[0].text.trim().toLowerCase() ===
        omitTopHeading.trim().toLowerCase()
    ) {
      return parsed.slice(1);
    }
    return parsed;
  }, [body, omitTopHeading]);

  const proseMeasureClass = compact ? undefined : "max-w-[72ch]";

  return (
    <div
      className={cn(
        "space-y-4 text-[14px] leading-7 text-gray-700 dark:text-gray-300",
        compact && "space-y-3 text-[13.5px] leading-relaxed",
        className,
      )}
    >
      {showFrontmatter && frontmatter.length > 0 ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border border-gray-200/80 bg-gray-50/70 px-3 py-2 text-[11px] dark:border-gray-800 dark:bg-gray-900/60",
            proseMeasureClass,
          )}
        >
          {frontmatter.map((entry) => (
            <div key={entry.key} className="inline-flex items-baseline gap-1.5">
              <span className="font-mono uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {entry.key}:
              </span>
              <span className="font-medium text-gray-700 dark:text-gray-200">
                {entry.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {blocks.map((block, idx) => {
        const key = `md-b-${idx}`;
        const sectionId = `md-sec-${idx}`;

        if (block.kind === "hr") {
          return (
            <hr
              key={key}
              className={cn(
                "border-t border-gray-200 dark:border-gray-800",
                proseMeasureClass,
              )}
            />
          );
        }

        if (block.kind === "heading") {
          if (block.level === 1) {
            return (
              <h2
                key={key}
                data-section-id={sectionId}
                className={cn(
                  "scroll-mt-4 border-b border-gray-200 pb-2 text-lg font-semibold tracking-tight text-gray-900 dark:border-gray-800 dark:text-white",
                  proseMeasureClass,
                )}
              >
                {renderInlineMarkdown(block.text, key)}
              </h2>
            );
          }
          if (block.level === 2) {
            return (
              <h3
                key={key}
                data-section-id={sectionId}
                className={cn(
                  "scroll-mt-4 border-b border-gray-100 pb-1.5 text-[15px] font-semibold tracking-tight text-gray-900 dark:border-gray-800/80 dark:text-gray-100",
                  idx > 0 && "pt-2",
                  proseMeasureClass,
                )}
              >
                {renderInlineMarkdown(block.text, key)}
              </h3>
            );
          }
          return (
            <h4
              key={key}
              data-section-id={sectionId}
              className={cn(
                "scroll-mt-4 text-[13.5px] font-semibold text-gray-900 dark:text-gray-100",
                idx > 0 && "pt-1",
                proseMeasureClass,
              )}
            >
              {renderInlineMarkdown(block.text, key)}
            </h4>
          );
        }

        if (block.kind === "code") {
          return (
            <CollapsibleCodeBlock
              key={key}
              language={block.language}
              content={block.content}
              compact={compact}
            />
          );
        }

        if (block.kind === "table") {
          return (
            <div
              key={key}
              className="overflow-x-auto rounded-xl border border-gray-200/90 dark:border-gray-800"
            >
              <table className="w-full border-collapse text-start text-[12.5px]">
                <thead>
                  <tr className="border-b border-gray-200/90 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-900/80">
                    {block.headers.map((header, hIdx) => (
                      <th
                        key={`${key}-h-${hIdx}`}
                        className={cn(
                          "px-3.5 py-2 font-semibold text-gray-800 dark:text-gray-200",
                          block.alignments[hIdx] ?? "text-start",
                        )}
                      >
                        {renderInlineMarkdown(header, `${key}-h-${hIdx}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/70">
                  {block.rows.map((row, rIdx) => (
                    <tr
                      key={`${key}-r-${rIdx}`}
                      className="bg-white dark:bg-gray-950"
                    >
                      {block.headers.map((_, cIdx) => (
                        <td
                          key={`${key}-r-${rIdx}-c-${cIdx}`}
                          className={cn(
                            "px-3.5 py-2 align-top text-gray-700 dark:text-gray-300",
                            block.alignments[cIdx] ?? "text-start",
                          )}
                        >
                          {renderInlineMarkdown(
                            row[cIdx] ?? "",
                            `${key}-r-${rIdx}-c-${cIdx}`,
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

        if (block.kind === "blockquote") {
          const isWarn =
            block.calloutType === "WARNING" || block.calloutType === "CAUTION";
          const isBrandCallout = Boolean(block.calloutType) && !isWarn;
          return (
            <blockquote
              key={key}
              className={cn(
                "rounded-xl px-4 py-3 text-[13px] ring-1 ring-inset",
                isWarn
                  ? "bg-amber-50/70 text-amber-950 ring-amber-200/80 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/25"
                  : isBrandCallout
                    ? "bg-brand-50/55 text-gray-800 ring-brand-200/75 dark:bg-brand-500/10 dark:text-gray-200 dark:ring-brand-500/25"
                    : "bg-gray-50/90 text-gray-700 ring-gray-200/80 dark:bg-gray-900/60 dark:text-gray-300 dark:ring-gray-800",
                proseMeasureClass,
              )}
            >
              {block.calloutType ? (
                <p
                  className={cn(
                    "mb-1 font-mono text-[10px] font-semibold uppercase tracking-wider",
                    isWarn
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-brand-700 dark:text-brand-300",
                  )}
                >
                  {block.calloutType}
                </p>
              ) : null}
              <div className="space-y-1">
                {block.lines.map((line, lIdx) => (
                  <p key={`${key}-q-${lIdx}`}>
                    {renderInlineMarkdown(line, `${key}-q-${lIdx}`)}
                  </p>
                ))}
              </div>
            </blockquote>
          );
        }

        if (block.kind === "ul") {
          return (
            <ul key={key} className={cn("space-y-1.5", proseMeasureClass)}>
              {block.items.map((item, iIdx) => (
                <li
                  key={`${key}-li-${iIdx}`}
                  className="flex items-start gap-2.5"
                >
                  {typeof item.checked === "boolean" ? (
                    <span
                      className={cn(
                        "mt-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                        item.checked
                          ? "border-brand-500 bg-brand-500 text-white dark:border-brand-400 dark:bg-brand-500 dark:text-white"
                          : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900",
                      )}
                    >
                      {item.checked ? (
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      ) : null}
                    </span>
                  ) : (
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400 dark:bg-brand-500" />
                  )}
                  <span
                    className={cn(
                      "min-w-0 flex-1",
                      item.checked
                        ? "text-gray-800 dark:text-gray-200"
                        : typeof item.checked === "boolean"
                          ? "text-gray-600 dark:text-gray-400"
                          : undefined,
                    )}
                  >
                    {renderInlineMarkdown(item.text, `${key}-li-${iIdx}`)}
                  </span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.kind === "ol") {
          return (
            <ol key={key} className={cn("space-y-1.5", proseMeasureClass)}>
              {block.items.map((item, iIdx) => (
                <li
                  key={`${key}-oli-${iIdx}`}
                  className="flex items-start gap-2.5"
                >
                  <span className="mt-0.5 min-w-[1.25rem] shrink-0 font-mono text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-400">
                    {item.num}.
                  </span>
                  <span className="min-w-0 flex-1">
                    {renderInlineMarkdown(item.text, `${key}-oli-${iIdx}`)}
                  </span>
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={key} className={cn("leading-7", proseMeasureClass)}>
            {renderInlineMarkdown(block.text, key)}
          </p>
        );
      })}
    </div>
  );
}

export interface ArtifactActionClusterProps {
  readonly viewMode: "rendered" | "markdown";
  readonly onViewModeChange: (mode: "rendered" | "markdown") => void;
  readonly markdownSource: string;
  readonly isApproved: boolean;
  readonly onDownload?: () => void;
  readonly isDownloading?: boolean;
  readonly compactCopy?: boolean;
  readonly className?: string;
}

export function ArtifactActionCluster({
  viewMode,
  onViewModeChange,
  markdownSource,
  isApproved,
  onDownload,
  isDownloading = false,
  compactCopy = false,
  className,
}: ArtifactActionClusterProps) {
  const t = useTranslations("workNotes.artifact");
  const [copiedMd, setCopiedMd] = useState(false);

  const handleCopyMarkdown = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(markdownSource).then(() => {
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 1800);
    });
  };

  return (
    <div className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      <div
        role="tablist"
        aria-label={t("viewModeAria")}
        className="inline-flex h-8 items-center rounded-lg bg-gray-100/90 p-0.5 ring-1 ring-inset ring-gray-200/75 dark:bg-gray-800 dark:ring-gray-700"
      >
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === "rendered"}
          onClick={() => onViewModeChange("rendered")}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-all",
            viewMode === "rendered"
              ? "bg-white text-gray-900 shadow-theme-xs ring-1 ring-gray-200/70 dark:bg-gray-900 dark:text-white dark:ring-gray-700"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
          )}
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t("renderedShortTab")}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === "markdown"}
          onClick={() => onViewModeChange("markdown")}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-all",
            viewMode === "markdown"
              ? "bg-white text-gray-900 shadow-theme-xs ring-1 ring-gray-200/70 dark:bg-gray-900 dark:text-white dark:ring-gray-700"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
          )}
        >
          <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t("sourceShortTab")}</span>
        </button>
      </div>

      <button
        type="button"
        onClick={handleCopyMarkdown}
        aria-label={copiedMd ? t("copiedMd") : t("copyMd")}
        title={t("copyMd")}
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 shadow-theme-xs transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        {copiedMd ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
        )}
        <span
          className={cn(
            "hidden",
            compactCopy || (isApproved && onDownload)
              ? "2xl:inline"
              : "sm:inline",
          )}
        >
          {copiedMd ? t("copiedMd") : t("copyShort")}
        </span>
      </button>

      {isApproved && onDownload ? (
        <button
          type="button"
          onClick={onDownload}
          disabled={isDownloading}
          aria-label={isDownloading ? t("downloading") : t("downloadMd")}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-200/80 bg-brand-50/70 px-2.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100/70 disabled:opacity-50 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{isDownloading ? t("downloading") : t("downloadShort")}</span>
        </button>
      ) : null}
    </div>
  );
}

interface ClassifiedMarkdownLine {
  readonly lineNumber: number;
  readonly raw: string;
  readonly zone: "frontmatter-delimiter" | "frontmatter-prop" | "code-fence" | "code-body" | "body";
  readonly isLastFrontmatterLine?: boolean;
}

function classifyMarkdownSourceLines(lines: readonly string[]): ClassifiedMarkdownLine[] {
  const result: ClassifiedMarkdownLine[] = [];
  const hasFrontmatter =
    lines.length >= 2 &&
    lines[0]?.trim() === "---" &&
    lines.slice(1).some((l) => l.trim() === "---");

  let inFrontmatter = false;
  let frontmatterClosed = !hasFrontmatter;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    const trimmed = raw.trim();
    const lineNumber = i + 1;

    if (!frontmatterClosed) {
      if (i === 0 && trimmed === "---") {
        inFrontmatter = true;
        result.push({
          lineNumber,
          raw,
          zone: "frontmatter-delimiter",
        });
        continue;
      }
      if (inFrontmatter && trimmed === "---") {
        inFrontmatter = false;
        frontmatterClosed = true;
        result.push({
          lineNumber,
          raw,
          zone: "frontmatter-delimiter",
          isLastFrontmatterLine: true,
        });
        continue;
      }
      if (inFrontmatter) {
        result.push({
          lineNumber,
          raw,
          zone: "frontmatter-prop",
        });
        continue;
      }
    }

    if (/^(`{3,}|~{3,})/.test(trimmed)) {
      inCodeBlock = !inCodeBlock;
      result.push({
        lineNumber,
        raw,
        zone: "code-fence",
      });
      continue;
    }

    if (inCodeBlock) {
      result.push({
        lineNumber,
        raw,
        zone: "code-body",
      });
      continue;
    }

    result.push({
      lineNumber,
      raw,
      zone: "body",
    });
  }

  return result;
}

function renderHighlightedInlineSource(text: string, keyPrefix: string): ReactNode {
  if (!text) return " ";
  const tokens = text.split(INLINE_TOKEN_RE);
  if (tokens.length === 1) return text;

  return tokens.map((token, idx) => {
    if (!token) return null;
    const key = `${keyPrefix}-${idx}`;
    if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
      return (
        <span
          key={key}
          className="rounded bg-rose-50 px-1 py-0.2 text-rose-700 ring-1 ring-inset ring-rose-200/70 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30"
        >
          {token}
        </span>
      );
    }
    if (
      ((token.startsWith("**") && token.endsWith("**")) ||
        (token.startsWith("__") && token.endsWith("__"))) &&
      token.length >= 4
    ) {
      return (
        <span key={key} className="font-semibold text-gray-900 dark:text-white">
          <span className="text-brand-500/80 dark:text-brand-400/80">
            {token.slice(0, 2)}
          </span>
          {token.slice(2, -2)}
          <span className="text-brand-500/80 dark:text-brand-400/80">
            {token.slice(-2)}
          </span>
        </span>
      );
    }
    if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const splitIdx = token.indexOf("](");
      const label = token.slice(0, splitIdx + 1);
      const urlPart = token.slice(splitIdx + 1);
      return (
        <span key={key}>
          <span className="font-medium text-brand-600 dark:text-brand-400">
            {label}
          </span>
          <span className="text-sky-600 underline decoration-sky-300/80 dark:text-sky-400 dark:decoration-sky-700">
            {urlPart}
          </span>
        </span>
      );
    }
    if (token.startsWith("*") && token.endsWith("*") && token.length >= 3) {
      return (
        <span key={key} className="italic text-amber-800 dark:text-amber-300">
          {token}
        </span>
      );
    }
    return <Fragment key={key}>{token}</Fragment>;
  });
}

function renderHighlightedMarkdownLine(item: ClassifiedMarkdownLine): ReactNode {
  const { raw, zone, lineNumber } = item;
  const trimmed = raw.trim();

  if (!trimmed) {
    return " ";
  }

  if (zone === "frontmatter-delimiter") {
    return (
      <span className="inline-flex items-center gap-2.5">
        <span className="font-semibold text-indigo-500 dark:text-indigo-400">
          {raw}
        </span>
        {lineNumber === 1 ? (
          <span className="select-none rounded bg-indigo-50 px-1.5 py-0.2 font-sans text-[9px] font-semibold uppercase tracking-wider text-indigo-600 ring-1 ring-inset ring-indigo-200/70 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30">
            YAML Frontmatter
          </span>
        ) : null}
      </span>
    );
  }

  if (zone === "frontmatter-prop") {
    const propMatch = /^(\s*)([A-Za-z0-9_.-]+)(\s*:\s*)(.*)$/.exec(raw);
    if (propMatch) {
      const [, leading, key, colon, val] = propMatch;
      const isQuoted =
        (val!.startsWith('"') && val!.endsWith('"')) ||
        (val!.startsWith("'") && val!.endsWith("'"));
      return (
        <>
          {leading}
          <span className="font-medium text-sky-700 dark:text-sky-400">
            {key}
          </span>
          <span className="text-gray-400 dark:text-gray-500">{colon}</span>
          <span
            className={
              isQuoted
                ? "text-emerald-700 dark:text-emerald-300"
                : "font-semibold text-amber-700 dark:text-amber-300"
            }
          >
            {val}
          </span>
        </>
      );
    }
    return <span className="text-gray-600 dark:text-gray-300">{raw}</span>;
  }

  if (zone === "code-fence") {
    return (
      <span className="font-semibold text-purple-600 dark:text-purple-400">
        {raw}
      </span>
    );
  }

  if (zone === "code-body") {
    return <span className="text-gray-800 dark:text-gray-200">{raw}</span>;
  }

  // Headings: # H1, ## H2, ### H3
  const headingMatch = /^(\s*)(#{1,6})(\s+)(.*)$/.exec(raw);
  if (headingMatch) {
    const [, leading, hashes, space, title] = headingMatch;
    const isH1 = hashes!.length === 1;
    return (
      <>
        {leading}
        <span className="font-bold text-brand-500 dark:text-brand-400">
          {hashes}
        </span>
        {space}
        <span
          className={cn(
            "font-semibold",
            isH1
              ? "text-brand-700 dark:text-brand-300"
              : "text-gray-900 dark:text-white",
          )}
        >
          {title}
        </span>
      </>
    );
  }

  // Checklist item: - [x] or - [ ]
  const taskMatch = /^(\s*[-*+]\s+)(\[[ xX]\])(\s+)(.*)$/.exec(raw);
  if (taskMatch) {
    const [, bullet, box, space, rest] = taskMatch;
    const isChecked = box!.toLowerCase() === "[x]";
    return (
      <>
        <span className="font-semibold text-brand-500 dark:text-brand-400">
          {bullet}
        </span>
        <span
          className={
            isChecked
              ? "font-semibold text-emerald-600 dark:text-emerald-400"
              : "text-gray-400 dark:text-gray-500"
          }
        >
          {box}
        </span>
        {space}
        <span className="text-gray-800 dark:text-gray-200">
          {renderHighlightedInlineSource(rest ?? "", `ln-${lineNumber}`)}
        </span>
      </>
    );
  }

  // Unordered or ordered list
  const listMatch = /^(\s*(?:[-*+•]|\d{1,3}[.)])\s+)(.*)$/.exec(raw);
  if (listMatch) {
    const [, prefix, rest] = listMatch;
    return (
      <>
        <span className="font-semibold text-brand-600 dark:text-brand-400">
          {prefix}
        </span>
        <span className="text-gray-800 dark:text-gray-200">
          {renderHighlightedInlineSource(rest ?? "", `ln-${lineNumber}`)}
        </span>
      </>
    );
  }

  // Blockquote / Callout
  const quoteMatch = /^(\s*>\s?)(\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\])?(.*)$/i.exec(
    raw,
  );
  if (quoteMatch) {
    const [, arrow, callout, rest] = quoteMatch;
    return (
      <>
        <span className="font-bold text-amber-600 dark:text-amber-400">
          {arrow}
        </span>
        {callout ? (
          <span className="font-semibold text-brand-600 dark:text-brand-400">
            {callout}
          </span>
        ) : null}
        <span className="italic text-gray-600 dark:text-gray-300">
          {renderHighlightedInlineSource(rest ?? "", `ln-${lineNumber}`)}
        </span>
      </>
    );
  }

  return (
    <span className="text-gray-800 dark:text-gray-200">
      {renderHighlightedInlineSource(raw, `ln-${lineNumber}`)}
    </span>
  );
}

export interface MarkdownArtifactStripProps {
  readonly isApproved: boolean;
  readonly file?: ArtifactFileMetadata;
  readonly storageReference?: DocumentStorageReference;
  readonly previewFileName: string;
  readonly markdownSource: string;
  readonly previewByteLength?: number;
  readonly renderedContent?: ReactNode;
  readonly omitTopHeading?: string;
  readonly onDownload?: () => void;
  readonly isDownloading?: boolean;
  readonly defaultTab?: "rendered" | "markdown";
  readonly viewMode?: "rendered" | "markdown";
  readonly onViewModeChange?: (mode: "rendered" | "markdown") => void;
  readonly variant?: "card" | "flush" | "editorial";
  readonly className?: string;
}

export function MarkdownArtifactStrip({
  isApproved,
  file,
  storageReference,
  previewFileName,
  markdownSource,
  previewByteLength,
  renderedContent,
  omitTopHeading,
  onDownload,
  isDownloading = false,
  defaultTab = "rendered",
  viewMode: controlledViewMode,
  onViewModeChange,
  variant = "card",
  className,
}: MarkdownArtifactStripProps) {
  const t = useTranslations("workNotes.artifact");
  const [internalViewMode, setInternalViewMode] = useState<
    "rendered" | "markdown"
  >(defaultTab);
  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = (next: "rendered" | "markdown") => {
    setInternalViewMode(next);
    onViewModeChange?.(next);
  };
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedSha, setCopiedSha] = useState(false);

  const displayFileName = file?.name || previewFileName;
  const effectiveBytes =
    isApproved && file?.size ? file.size : (previewByteLength ?? 0);
  const shortSha =
    isApproved && file?.sha256 ? file.sha256.slice(0, 10) : undefined;
  const sourceLines = useMemo(
    () => markdownSource.replace(/\r\n/g, "\n").trimEnd().split("\n"),
    [markdownSource],
  );
  const classifiedLines = useMemo(
    () => classifyMarkdownSourceLines(sourceLines),
    [sourceLines],
  );

  function copyMarkdown() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(markdownSource).then(() => {
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 1800);
    });
  }

  function copySha() {
    if (
      !file?.sha256 ||
      typeof navigator === "undefined" ||
      !navigator.clipboard
    )
      return;
    void navigator.clipboard.writeText(file.sha256).then(() => {
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 1800);
    });
  }

  const externalRefs = storageReference?.externalDocumentRefs ?? 0;
  const isLocalStorage = storageReference?.provider === "LOCAL";
  const isFlush = variant === "flush";
  const isEditorial = variant === "editorial";

  const renderSyntaxCodeBody = (keyPrefix: string) => (
    <div className="overflow-x-auto py-2 font-mono text-[12.5px] leading-6">
      {classifiedLines.map((item) => {
        const isFrontmatterZone =
          item.zone === "frontmatter-delimiter" ||
          item.zone === "frontmatter-prop";
        const isCodeZone =
          item.zone === "code-fence" || item.zone === "code-body";
        const isHeadingLine =
          item.zone === "body" && /^\s*#{1,6}\s+/.test(item.raw);

        return (
          <div
            key={`${keyPrefix}-${item.lineNumber}`}
            className={cn(
              "group/line flex items-baseline transition-colors hover:bg-brand-50/40 dark:hover:bg-brand-500/10",
              isFrontmatterZone &&
                "bg-slate-50/80 dark:bg-slate-900/45",
              item.isLastFrontmatterLine &&
                "border-b border-dashed border-gray-200/90 pb-1 mb-1 dark:border-gray-800",
              isCodeZone && "bg-gray-50/90 dark:bg-gray-900/60",
              isHeadingLine && "bg-brand-50/20 dark:bg-brand-500/5",
            )}
          >
            <span className="w-11 shrink-0 select-none border-e border-gray-100 bg-gray-50/50 pe-3 text-end font-mono text-[11px] tabular-nums text-gray-400 group-hover/line:text-gray-600 dark:border-gray-800/80 dark:bg-gray-900/40 dark:text-gray-600 dark:group-hover/line:text-gray-400">
              {item.lineNumber}
            </span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-words px-4">
              {renderHighlightedMarkdownLine(item)}
            </span>
          </div>
        );
      })}
    </div>
  );

  if (isEditorial) {
    if (viewMode === "markdown") {
      return (
        <div
          className={cn(
            "overflow-hidden rounded-xl border border-gray-200/90 bg-white text-gray-800 shadow-theme-xs dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200",
            className,
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/80 bg-gray-50/90 px-4 py-2.5 text-[11px] dark:border-gray-800 dark:bg-gray-900/90">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-200/70 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30">
                <FileCode2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </span>
              <span
                className="max-w-[260px] truncate font-mono text-xs font-semibold text-gray-900 sm:max-w-[380px] dark:text-gray-100"
                title={displayFileName}
              >
                {displayFileName}
              </span>
              {effectiveBytes > 0 ? (
                <span className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums text-gray-600 ring-1 ring-inset ring-gray-200/80 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700">
                  {formatArtifactBytes(effectiveBytes)}
                </span>
              ) : null}
              {shortSha ? (
                <button
                  type="button"
                  onClick={copySha}
                  title={t("copyShaTitle", { sha: file?.sha256 ?? shortSha })}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-600 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-brand-500/50 dark:hover:text-white"
                >
                  <span>sha256:{shortSha}</span>
                  {copiedSha ? (
                    <Check className="h-2.5 w-2.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-2.5 w-2.5 text-gray-400" />
                  )}
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                UTF-8 · {sourceLines.length}L
              </span>
              <button
                type="button"
                onClick={copyMarkdown}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700 shadow-theme-xs transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {copiedMd ? (
                  <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                )}
                <span>{copiedMd ? t("copiedMd") : t("copyShort")}</span>
              </button>
            </div>
          </div>
          {renderSyntaxCodeBody("ed-src")}
        </div>
      );
    }

    return (
      <div className={cn("min-w-0", className)}>
        {renderedContent ?? (
          <MarkdownDocumentView
            markdown={markdownSource}
            omitTopHeading={omitTopHeading}
            showFrontmatter={false}
          />
        )}
      </div>
    );
  }

  const provenanceStatusNode = isApproved ? (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          file ? "bg-emerald-500" : "bg-amber-500",
        )}
      />
      <span>
        {file
          ? isLocalStorage
            ? t("storedInLocalVault")
            : t("storedInR2")
          : t("approvedFilePurgedNotice")}
      </span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
      <Lock className="h-3 w-3 shrink-0 text-gray-400" />
      <span>{t("pendingR2GateNotice")}</span>
    </span>
  );

  return (
    <div
      className={cn(
        isFlush
          ? "bg-transparent"
          : "overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-950",
        className,
      )}
    >
      {/* Artifact Toolbar */}
      <div
        className={cn(
          isFlush
            ? "space-y-1.5 border-b border-gray-100 pb-3 dark:border-gray-800/80"
            : "flex flex-wrap items-center justify-between gap-2.5 border-b border-gray-200/80 bg-gray-50/70 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900/70",
        )}
      >
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2",
            !isFlush && "w-full",
          )}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-200/70 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30">
                <FileCode2 className="h-3.5 w-3.5" />
              </span>
              <span
                className="max-w-[220px] truncate font-mono text-xs font-semibold text-gray-900 sm:max-w-[300px] dark:text-gray-100"
                title={displayFileName}
              >
                {displayFileName}
              </span>
            </div>
            {effectiveBytes > 0 ? (
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                {formatArtifactBytes(effectiveBytes)}
              </span>
            ) : null}
            {shortSha ? (
              <button
                type="button"
                onClick={copySha}
                title={t("copyShaTitle", { sha: file?.sha256 ?? shortSha })}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-600 transition-colors hover:border-brand-200 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                <span>sha256:{shortSha}</span>
                {copiedSha ? (
                  <Check className="h-2.5 w-2.5 text-emerald-600" />
                ) : (
                  <Copy className="h-2.5 w-2.5 text-gray-400" />
                )}
              </button>
            ) : null}
            {isApproved && file && storageReference ? (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium",
                  externalRefs > 0
                    ? "border-amber-200/80 bg-amber-50/70 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300"
                    : "border-emerald-200/80 bg-emerald-50/60 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300",
                )}
                title={
                  externalRefs > 0
                    ? t(
                        isLocalStorage
                          ? "localSharedTooltip"
                          : "r2SharedTooltip",
                        { count: externalRefs + 1 },
                      )
                    : t(isLocalStorage ? "localUniqueTooltip" : "r2UniqueTooltip")
                }
              >
                {externalRefs > 0 ? (
                  <Share2 className="h-2.5 w-2.5" />
                ) : (
                  <Database className="h-2.5 w-2.5" />
                )}
                <span>
                  {externalRefs > 0
                    ? t(
                        isLocalStorage ? "localSharedBadge" : "r2SharedBadge",
                        { count: externalRefs + 1 },
                      )
                    : t(isLocalStorage ? "localUniqueBadge" : "r2UniqueBadge")}
                </span>
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div
              role="tablist"
              aria-label={t("viewModeAria")}
              className="inline-flex items-center rounded-lg bg-gray-100/90 p-0.5 ring-1 ring-inset ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "rendered"}
                onClick={() => setViewMode("rendered")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                  viewMode === "rendered"
                    ? "bg-white text-gray-900 shadow-theme-xs ring-1 ring-gray-200/70 dark:bg-gray-900 dark:text-white dark:ring-gray-700"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
                )}
              >
                <FileText className="h-3 w-3" />
                <span>{t("renderedTab")}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "markdown"}
                onClick={() => setViewMode("markdown")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                  viewMode === "markdown"
                    ? "bg-white text-gray-900 shadow-theme-xs ring-1 ring-gray-200/70 dark:bg-gray-900 dark:text-white dark:ring-gray-700"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
                )}
              >
                <span>{t("sourceTab")}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={copyMarkdown}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 shadow-theme-xs transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {copiedMd ? (
                <Check className="h-3 w-3 text-emerald-600" />
              ) : (
                <Copy className="h-3 w-3 text-gray-500" />
              )}
              <span>{copiedMd ? t("copiedMd") : t("copyMd")}</span>
            </button>

            {isApproved && onDownload ? (
              <button
                type="button"
                onClick={onDownload}
                disabled={isDownloading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-theme-xs transition-colors hover:bg-brand-600 disabled:opacity-50"
              >
                <Download className="h-3 w-3" />
                <span>
                  {isDownloading ? t("downloading") : t("downloadMd")}
                </span>
              </button>
            ) : null}
          </div>
        </div>

        {isFlush ? <div>{provenanceStatusNode}</div> : null}
      </div>

      {/* Card-mode Provenance Sub-Bar */}
      {!isFlush ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/40 px-4 py-1.5 text-[11px] text-gray-500 dark:border-gray-800/70 dark:bg-gray-900/30 dark:text-gray-400">
          {provenanceStatusNode}
          <span className="font-mono text-[10px] uppercase tracking-wider text-gray-400">
            UTF-8 · MARKDOWN
          </span>
        </div>
      ) : null}

      {/* Document Body */}
      {viewMode === "markdown" ? (
        <div
          className={cn(
            "max-h-[540px] overflow-auto bg-white text-gray-800 dark:bg-gray-950 dark:text-gray-200",
            isFlush &&
              "mt-4 rounded-xl border border-gray-200/90 shadow-theme-xs dark:border-gray-800",
          )}
        >
          {renderSyntaxCodeBody("src")}
        </div>
      ) : renderedContent ? (
        <div className={cn(isFlush ? "pt-5" : "p-5")}>{renderedContent}</div>
      ) : (
        <div className={cn(isFlush ? "pt-5" : "p-5")}>
          <MarkdownDocumentView
            markdown={markdownSource}
            omitTopHeading={omitTopHeading}
            showFrontmatter={false}
          />
        </div>
      )}
    </div>
  );
}
