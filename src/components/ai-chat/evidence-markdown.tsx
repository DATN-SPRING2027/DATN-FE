"use client";

import { Fragment, type ReactNode } from "react";
import { cn } from "@/utils";

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "your",
  "have",
  "will",
  "when",
  "where",
  "what",
  "which",
  "about",
  "using",
  "project",
  "document",
  "documents",
  "section",
  "overview",
  "summary",
  "system",
  "module",
  "trong",
  "những",
  "được",
  "theo",
  "tổng",
  "quan",
  "phần",
  "mục",
  "của",
  "các",
  "cho",
  "với",
  "như",
  "thế",
  "nào",
  "hãy",
  "giải",
  "thích",
]);

const BOX_DRAWING_CHARS_RE = /[┌┐└┘├┤┬┴┼─━│┃╭╮╯╰]/;
const BOX_DRAWING_HEAVY_LINE_RE =
  /(?:[┌┐└┘├┤┬┴┼─━│┃╭╮╯╰]{2,}|^\s*[│|].*(?:▼|▲|►|◄|──|\[[^\]]+\]).*[│|]?\s*$)/;
const ASCII_BOX_BORDER_RE = /^\s*\+[-=+]+\+\s*$/;

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function splitSectionBreadcrumbs(heading: string): string[] {
  const parts = heading
    .split(/\s*>\s*|\s+\/\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [heading.trim()];
}

export function normalizeHeadingForCompare(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/^\d+(?:\.\d+)*[.)]?\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function deriveEnglishMorphologicalPattern(word: string): string | null {
  const lower = word.toLowerCase();
  if (!/^[a-z]{6,}$/.test(lower) || STOP_WORDS.has(lower)) {
    return null;
  }
  if (lower.endsWith("cation") && lower.length >= 8) {
    const base = escapeRegExp(lower.slice(0, -6));
    return `\\b(?:${base}c|${base}k)[a-z]*\\b`;
  }
  const suffixes = [
    "ation",
    "ition",
    "tion",
    "sion",
    "ment",
    "ness",
    "ship",
    "able",
    "ible",
    "ing",
    "ed",
    "es",
    "s",
  ];
  for (const suffix of suffixes) {
    if (lower.endsWith(suffix) && lower.length - suffix.length >= 5) {
      const stem = escapeRegExp(lower.slice(0, -suffix.length));
      return `\\b${stem}[a-z]*\\b`;
    }
  }
  return null;
}

/**
 * Builds a phrase-aware highlight RegExp that NEVER splits Vietnamese compound words
 * into broken 1-syllable fragments (e.g. never highlights "thức" alone from "tri thức").
 */
export function buildSmartHighlightRegex(
  focusTerms: readonly string[] | undefined,
  heading: string | undefined,
): RegExp | null {
  const exactPhrases = new Set<string>();
  const asciiWordPatterns = new Set<string>();

  const registerSourcePhrase = (
    raw: string | undefined,
    allowWholePhrase: boolean,
  ) => {
    if (!raw) return;
    const stripped = raw
      .replace(/^#{1,6}\s+/, "")
      .replace(/^\[[^\]]+\]\s*/, "")
      .replace(/^\d+(?:\.\d+)*[.)]?\s*/, "")
      .replace(/[?!.;:]+$/g, "")
      .trim();
    if (!stripped) return;

    // Extract parenthetical technical phrases and the outer phrase separately
    const segments: string[] = [];
    const withoutParens = stripped
      .replace(/\(([^()]{3,80})\)/g, (_m, inner: string) => {
        segments.push(inner.trim());
        return " ";
      })
      .replace(/\s+/g, " ")
      .trim();
    if (withoutParens) {
      segments.unshift(withoutParens);
    }

    for (const seg of segments) {
      const words = seg.split(/\s+/).filter(Boolean);
      if (
        allowWholePhrase &&
        words.length >= 2 &&
        words.length <= 8 &&
        seg.length >= 5
      ) {
        exactPhrases.add(seg);
      }

      // Extract 2–4 word capitalized / technical sub-phrases from long questions
      if (words.length > 4) {
        const subMatches = seg.match(
          /\b(?:[A-ZÀ-Ỹ0-9][A-Za-zÀ-ỹ0-9_/-]*\s+){1,3}[A-ZÀ-Ỹ0-9][A-Za-zÀ-ỹ0-9_/-]*\b/g,
        );
        for (const sub of subMatches ?? []) {
          const cleanedSub = sub.trim();
          if (cleanedSub.length >= 5) {
            exactPhrases.add(cleanedSub);
          }
        }
      }

      // Single-token highlights are restricted strictly to ASCII technical identifiers (>= 5 chars)
      // so Vietnamese 2-syllable compound words are never split into orphaned syllables.
      for (const rawToken of seg.split(/[\s,;:()/\\|–—"'`[\]{}?]+/)) {
        const token = rawToken.trim();
        if (
          /^[A-Za-z][A-Za-z0-9_.-]{4,}$/.test(token) &&
          !STOP_WORDS.has(token.toLowerCase())
        ) {
          asciiWordPatterns.add(`\\b${escapeRegExp(token)}\\b`);
          const morph = deriveEnglishMorphologicalPattern(token);
          if (morph) {
            asciiWordPatterns.add(morph);
          }
        }
      }
    }
  };

  for (const term of focusTerms ?? []) {
    registerSourcePhrase(term, true);
  }

  if (heading) {
    const crumbs = splitSectionBreadcrumbs(heading);
    const leaf = crumbs[crumbs.length - 1];
    // Do not highlight the entire leaf heading as a giant block if focusTerms already exist,
    // only register technical sub-phrases/identifiers from it.
    registerSourcePhrase(leaf, (focusTerms ?? []).length === 0);
  }

  const sortedPhrases = [...exactPhrases]
    .sort((a, b) => b.length - a.length)
    .slice(0, 8)
    .map(escapeRegExp);

  const combined = [...sortedPhrases, ...[...asciiWordPatterns].slice(0, 8)];
  if (combined.length === 0) return null;
  return new RegExp(`(${combined.join("|")})`, "gi");
}

/**
 * Recovers readable Markdown & diagram line breaks when rendering legacy single-line
 * flattened snippets saved before multiline excerpt preservation.
 */
export function recoverFlattenedMarkdownStructure(raw: string): string {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized || normalized.includes("\n")) {
    return normalized;
  }

  let recovered = normalized;

  // 1. Restore fenced code / diagram blocks collapsed onto a single line (` ``` `)
  if (recovered.includes("```")) {
    let fenceOpen = false;
    recovered = recovered.replace(/\s*```([A-Za-z0-9_-]*)\s*/g, (_m, lang: string) => {
      if (!fenceOpen) {
        fenceOpen = true;
        return `\n\`\`\`${lang || ""}\n`;
      }
      fenceOpen = false;
      return "\n```\n";
    });
    if (fenceOpen) {
      recovered = `${recovered}\n\`\`\``;
    }

    // Format interior of fenced blocks if they contain box-drawing lines collapsed onto 1 line
    recovered = recovered.replace(
      /```([A-Za-z0-9_-]*)\n([\s\S]*?)\n```/g,
      (_m, lang: string, body: string) =>
        `\`\`\`${lang}\n${formatFlattenedDiagramContent(body)}\n\`\`\``,
    );
  }

  // 2. Restore flattened Markdown blockquotes (` > ⭐ ...` or `: > ...`) outside fences
  const segments = recovered.split(/(```[\s\S]*?```)/g);
  recovered = segments
    .map((seg) => {
      if (seg.startsWith("```")) return seg;
      return seg
        .replace(/\s+>\s+(?=[⭐💡⚠️📌🔥A-ZÀ-Ỹ])/g, "\n> ")
        .replace(/\s+-\s+(?=`\[|[A-ZÀ-Ỹ])/g, "\n- ");
    })
    .join("");

  return recovered.trim();
}

function formatFlattenedDiagramContent(body: string): string {
  if (body.includes("\n")) return body;
  if (!BOX_DRAWING_CHARS_RE.test(body) && !/\|\s*\|/.test(body)) {
    return body;
  }
  return body
    .replace(/\s*(┌[─┬]+┐?)/g, "\n$1\n")
    .replace(/\s*(├[─┼┴┬]+┤?)/g, "\n$1\n")
    .replace(/\s*(└[─┴]+┘?)/g, "\n$1\n")
    .replace(/\s+(─{6,})\s+/g, "\n$1\n")
    .replace(/\|\s+\|/g, "|\n|")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function isGfmTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?(?:\s*\|\s*:?-{2,}:?)+\s*\|?\s*$/.test(line);
}

function splitGfmTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replace(/\\\|/g, "|").trim());
}

function parseGfmColumnAlignments(
  separatorLine: string,
): Array<"text-start" | "text-center" | "text-end"> {
  return splitGfmTableRow(separatorLine).map((col) => {
    const marker = col.trim();
    if (marker.startsWith(":") && marker.endsWith(":")) return "text-center";
    if (marker.endsWith(":")) return "text-end";
    return "text-start";
  });
}

function isDiagramLine(line: string): boolean {
  if (isGfmTableSeparator(line)) return false;
  return BOX_DRAWING_HEAVY_LINE_RE.test(line) || ASCII_BOX_BORDER_RE.test(line);
}

function renderTextWithHighlights(
  text: string,
  highlightRegex: RegExp | null,
  keyPrefix: string,
): ReactNode {
  if (!highlightRegex || !text) {
    return text;
  }
  const parts = text.split(highlightRegex);
  if (parts.length <= 1) {
    return text;
  }
  return parts.map((part, idx) => {
    if (!part) return null;
    if (idx % 2 === 1) {
      return (
        <mark
          key={`${keyPrefix}-hl-${idx}`}
          data-testid="evidence-highlight-mark"
          className="rounded-sm bg-amber-100/90 px-1 py-0.5 font-medium text-gray-950 ring-1 ring-amber-300/75 dark:bg-amber-400/20 dark:text-amber-100 dark:ring-amber-400/35"
        >
          {part}
        </mark>
      );
    }
    return <Fragment key={`${keyPrefix}-tx-${idx}`}>{part}</Fragment>;
  });
}

export function renderSafeInline(
  rawLine: string,
  highlightRegex: RegExp | null,
  keyPrefix: string,
): ReactNode {
  // Strip any stray unclosed fence markers that might remain in malformed text
  const line = rawLine.replace(/`{3,}/g, "").trim();
  if (!line) return null;

  const tokens = line.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g).filter(Boolean);
  if (
    tokens.length === 1 &&
    !tokens[0]!.startsWith("`") &&
    !tokens[0]!.startsWith("**")
  ) {
    const colonMatch = /^([A-Za-zÀ-ỹ0-9_[\]()/ -]{2,38}):(\s+.*)$/.exec(line);
    if (colonMatch && !line.includes("://")) {
      const [, label, rest] = colonMatch;
      return (
        <>
          <strong className="font-semibold text-gray-950 dark:text-white">
            {renderTextWithHighlights(label!, highlightRegex, `${keyPrefix}-k`)}:
          </strong>
          {renderTextWithHighlights(rest!, highlightRegex, `${keyPrefix}-v`)}
        </>
      );
    }
    return renderTextWithHighlights(line, highlightRegex, keyPrefix);
  }

  return tokens.map((token, idx) => {
    const tokenKey = `${keyPrefix}-${idx}`;
    if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
      return (
        <code
          key={tokenKey}
          data-testid="evidence-code-pill"
          className="font-mono inline-flex items-center rounded-md border border-gray-200/90 bg-gray-100/90 px-1.5 py-0.5 text-xs font-semibold text-gray-800 dark:border-white/15 dark:bg-white/10 dark:text-gray-100"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
      return (
        <strong
          key={tokenKey}
          className="font-semibold text-gray-950 dark:text-white"
        >
          {renderTextWithHighlights(
            token.slice(2, -2),
            highlightRegex,
            `${tokenKey}-b`,
          )}
        </strong>
      );
    }
    return (
      <Fragment key={tokenKey}>
        {renderTextWithHighlights(token, highlightRegex, tokenKey)}
      </Fragment>
    );
  });
}

type ParsedBlock =
  | Readonly<{ kind: "code"; lang: string; content: string; isDiagram: boolean }>
  | Readonly<{ kind: "callout"; lines: readonly string[]; isHighlightCallout: boolean }>
  | Readonly<{
      kind: "table";
      headers: readonly string[];
      alignments: readonly ("text-start" | "text-center" | "text-end")[];
      rows: readonly (readonly string[])[];
    }>
  | Readonly<{ kind: "heading"; level: number; text: string }>
  | Readonly<{ kind: "ul"; items: readonly string[] }>
  | Readonly<{ kind: "ol"; items: readonly { num: string; text: string }[] }>
  | Readonly<{ kind: "paragraph"; text: string }>;

export function parseEvidenceBlocks(
  rawText: string,
  leafHeading?: string,
  sectionBreadcrumbs?: readonly string[],
): ParsedBlock[] {
  const text = recoverFlattenedMarkdownStructure(rawText);
  if (!text) return [];

  const allLines = text.split("\n");
  const normalizedLeaf = normalizeHeadingForCompare(leafHeading);
  const headerHeadings = new Set<string>();
  if (normalizedLeaf) {
    headerHeadings.add(normalizedLeaf);
  }
  for (const crumb of sectionBreadcrumbs ?? []) {
    const norm = normalizeHeadingForCompare(crumb);
    if (norm) {
      headerHeadings.add(norm);
    }
  }

  // Deduplicate consecutive leading lines that repeat any breadcrumb/leaf heading already shown in card header
  let startIdx = 0;
  while (startIdx < allLines.length) {
    while (startIdx < allLines.length && !allLines[startIdx]!.trim()) {
      startIdx += 1;
    }
    if (startIdx >= allLines.length || headerHeadings.size === 0) {
      break;
    }
    const candidate = normalizeHeadingForCompare(allLines[startIdx]);
    if (candidate && headerHeadings.has(candidate)) {
      startIdx += 1;
      continue;
    }
    break;
  }

  const blocks: ParsedBlock[] = [];
  let i = startIdx;

  while (i < allLines.length) {
    const line = allLines[i]!;
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // 1. Fenced code or diagram block (```lang ... ``` or unclosed trailing fence)
    const fenceOpen = /^\s*```([A-Za-z0-9_+-]*)\s*$/.exec(line);
    if (fenceOpen) {
      const lang = (fenceOpen[1] ?? "").trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < allLines.length && !/^\s*```\s*$/.test(allLines[i]!)) {
        codeLines.push(allLines[i]!);
        i += 1;
      }
      if (i < allLines.length) {
        i += 1; // consume closing ```
      }
      const codeContent = codeLines.join("\n").replace(/^\n+|\n+$/g, "");
      if (codeContent.trim()) {
        const isDiagram =
          BOX_DRAWING_CHARS_RE.test(codeContent) ||
          ASCII_BOX_BORDER_RE.test(codeContent) ||
          ["mermaid", "ascii", "diagram", "text", "txt"].includes(
            lang.toLowerCase(),
          ) && BOX_DRAWING_HEAVY_LINE_RE.test(codeContent);
        blocks.push({
          kind: "code",
          lang,
          content: codeContent,
          isDiagram,
        });
      }
      continue;
    }

    // 2. GFM Markdown Table
    if (
      trimmed.includes("|") &&
      i + 1 < allLines.length &&
      isGfmTableSeparator(allLines[i + 1]!)
    ) {
      const headers = splitGfmTableRow(trimmed);
      const alignments = parseGfmColumnAlignments(allLines[i + 1]!);
      const rows: string[][] = [];
      i += 2;
      while (
        i < allLines.length &&
        allLines[i]!.trim().includes("|") &&
        ! /^\s*```/.test(allLines[i]!)
      ) {
        rows.push(splitGfmTableRow(allLines[i]!));
        i += 1;
      }
      blocks.push({ kind: "table", headers, alignments, rows });
      continue;
    }

    // 3. Unfenced ASCII / Unicode box-drawing diagram lines
    if (isDiagramLine(line)) {
      const diagLines: string[] = [];
      while (
        i < allLines.length &&
        (isDiagramLine(allLines[i]!) ||
          (allLines[i]!.trim().startsWith("|") &&
            allLines[i]!.trim().endsWith("|")))
      ) {
        diagLines.push(allLines[i]!);
        i += 1;
      }
      blocks.push({
        kind: "code",
        lang: "",
        content: diagLines.join("\n"),
        isDiagram: true,
      });
      continue;
    }

    // 4. Blockquote / Callout (`> ...`)
    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (i < allLines.length && /^>\s?/.test(allLines[i]!.trim())) {
        const cleanedQuote = allLines[i]!
          .trim()
          .replace(/^(?:>\s*)+/, "")
          .trim();
        if (cleanedQuote) {
          quoteLines.push(cleanedQuote);
        }
        i += 1;
      }
      if (quoteLines.length > 0) {
        const joinedQuote = quoteLines.join(" ");
        const isHighlightCallout = /[⭐💡⚠️📌🔥]|(?:\b(?:NOTE|IMPORTANT|WARNING|TIP)\b)/i.test(
          joinedQuote,
        );
        blocks.push({
          kind: "callout",
          lines: quoteLines,
          isHighlightCallout,
        });
      }
      continue;
    }

    // 5. Markdown Heading (`#`..`######`)
    const mdHeading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (mdHeading) {
      const headingText = mdHeading[2]!.trim();
      if (
        blocks.length > 0 ||
        normalizeHeadingForCompare(headingText) !== normalizedLeaf
      ) {
        blocks.push({
          kind: "heading",
          level: mdHeading[1]!.length,
          text: headingText,
        });
      }
      i += 1;
      continue;
    }

    // 6. Unordered Bullet List (`- `, `* `, `• `)
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < allLines.length && /^[-*•]\s+/.test(allLines[i]!.trim())) {
        items.push(allLines[i]!.trim().replace(/^[-*•]\s+/, ""));
        i += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    // 7. Ordered Numbered List (`1. `, `2) `) — guard against giant flattened section paragraphs
    const orderedMatch = /^(\d{1,3})[.)]\s+(.*)$/.exec(trimmed);
    if (orderedMatch) {
      const hasSecondOrdered =
        i + 1 < allLines.length &&
        /^\d{1,3}[.)]\s+/.test(allLines[i + 1]!.trim());
      if (hasSecondOrdered || trimmed.length <= 200) {
        if (
          !hasSecondOrdered &&
          blocks.length === 0 &&
          trimmed.length <= 120 &&
          !/[.!?]$/.test(trimmed)
        ) {
          // Standalone numbered section heading at top of chunk (e.g. `6.1. Kiến trúc Client`)
          if (normalizeHeadingForCompare(trimmed) !== normalizedLeaf) {
            blocks.push({ kind: "heading", level: 3, text: trimmed });
          }
          i += 1;
          continue;
        }
        const items: { num: string; text: string }[] = [];
        while (i < allLines.length) {
          const m = /^(\d{1,3})[.)]\s+(.*)$/.exec(allLines[i]!.trim());
          if (!m) break;
          items.push({ num: m[1]!, text: m[2]! });
          i += 1;
        }
        blocks.push({ kind: "ol", items });
        continue;
      }
    }

    // 8. Standard Prose Paragraph (merge consecutive plain lines until blank line or structural marker)
    const paraLines: string[] = [trimmed];
    i += 1;
    while (i < allLines.length) {
      const nextRaw = allLines[i]!;
      const nextTrim = nextRaw.trim();
      if (
        !nextTrim ||
        /^\s*```/.test(nextRaw) ||
        /^#{1,6}\s+/.test(nextTrim) ||
        /^>\s?/.test(nextTrim) ||
        /^[-*•]\s+/.test(nextTrim) ||
        /^\d{1,3}[.)]\s+/.test(nextTrim) ||
        isDiagramLine(nextRaw) ||
        (nextTrim.includes("|") &&
          i + 1 < allLines.length &&
          isGfmTableSeparator(allLines[i + 1]!))
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

export function FormattedDocumentPassage({
  text,
  highlightRegex,
  leafHeading,
  sectionBreadcrumbs,
  diagramBadgeLabel,
  codeBadgeLabel,
}: Readonly<{
  text: string;
  highlightRegex: RegExp | null;
  leafHeading?: string;
  sectionBreadcrumbs?: readonly string[];
  diagramBadgeLabel: string;
  codeBadgeLabel: string;
}>) {
  const blocks = parseEvidenceBlocks(text, leafHeading, sectionBreadcrumbs);

  if (blocks.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
        {renderSafeInline(text, highlightRegex, "fallback")}
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm leading-7 text-gray-800 dark:text-gray-200">
      {blocks.map((block, idx) => {
        const blockKey = `blk-${idx}`;

        if (block.kind === "code") {
          const badgeText = block.isDiagram
            ? diagramBadgeLabel
            : block.lang
              ? block.lang.toUpperCase()
              : codeBadgeLabel;
          return (
            <div
              key={blockKey}
              data-testid="evidence-code-block"
              className="overflow-hidden rounded-xl border border-gray-800/80 bg-gray-900 shadow-theme-xs dark:border-white/12 dark:bg-gray-950"
            >
              <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3.5 py-1.5">
                <span className="font-mono text-xs font-semibold tracking-wide text-gray-300">
                  {badgeText}
                </span>
              </div>
              <pre className="evidence-diagram-scroll font-mono overflow-x-auto p-3.5 text-xs leading-5 whitespace-pre text-gray-100">
                <code>{block.content}</code>
              </pre>
            </div>
          );
        }

        if (block.kind === "callout") {
          return (
            <blockquote
              key={blockKey}
              data-testid="evidence-callout-block"
              className={cn(
                "space-y-1.5 rounded-xl border py-2.5 ps-3.5 pe-3.5 text-xs leading-6 sm:text-sm",
                block.isHighlightCallout
                  ? "border-amber-200/90 border-s-4 border-s-amber-500 bg-amber-50/65 text-gray-900 dark:border-amber-400/20 dark:border-s-amber-400 dark:bg-amber-500/10 dark:text-gray-100"
                  : "border-brand-200/80 border-s-4 border-s-brand-500 bg-brand-50/45 text-gray-800 dark:border-brand-400/20 dark:border-s-brand-400 dark:bg-brand-500/10 dark:text-gray-100",
              )}
            >
              {block.lines.map((qLine, qIdx) => (
                <p key={`${blockKey}-q-${qIdx}`} className="break-words">
                  {renderSafeInline(
                    qLine,
                    highlightRegex,
                    `${blockKey}-q-${qIdx}`,
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
              className="overflow-x-auto rounded-xl border border-gray-200/90 dark:border-white/12"
            >
              <table className="min-w-full divide-y divide-gray-200 text-xs tabular-nums dark:divide-white/10">
                <thead className="bg-gray-50 dark:bg-white/5">
                  <tr>
                    {block.headers.map((header, colIdx) => (
                      <th
                        key={`${blockKey}-th-${colIdx}`}
                        className={cn(
                          "px-3 py-2 font-semibold text-gray-900 dark:text-white",
                          block.alignments[colIdx] ?? "text-start",
                        )}
                      >
                        {renderSafeInline(
                          header,
                          highlightRegex,
                          `${blockKey}-th-${colIdx}`,
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white dark:divide-white/8 dark:bg-transparent">
                  {block.rows.map((row, rowIdx) => (
                    <tr key={`${blockKey}-tr-${rowIdx}`}>
                      {block.headers.map((_, colIdx) => (
                        <td
                          key={`${blockKey}-td-${rowIdx}-${colIdx}`}
                          className={cn(
                            "px-3 py-2 text-gray-700 dark:text-gray-200",
                            block.alignments[colIdx] ?? "text-start",
                          )}
                        >
                          {renderSafeInline(
                            row[colIdx] ?? "",
                            highlightRegex,
                            `${blockKey}-td-${rowIdx}-${colIdx}`,
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
          return (
            <h4
              key={blockKey}
              className={cn(
                "font-bold tracking-tight text-gray-950 dark:text-white",
                block.level <= 2 ? "pt-1 text-base" : "pt-0.5 text-sm",
              )}
            >
              {renderSafeInline(block.text, highlightRegex, `${blockKey}-h`)}
            </h4>
          );
        }

        if (block.kind === "ul") {
          return (
            <ul key={blockKey} className="space-y-1.5">
              {block.items.map((item, itemIdx) => (
                <li
                  key={`${blockKey}-li-${itemIdx}`}
                  className="flex items-start gap-2.5 text-xs leading-6 sm:text-sm"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand-500 dark:bg-brand-400"
                  />
                  <div className="min-w-0 flex-1 break-words">
                    {renderSafeInline(
                      item,
                      highlightRegex,
                      `${blockKey}-li-${itemIdx}`,
                    )}
                  </div>
                </li>
              ))}
            </ul>
          );
        }

        if (block.kind === "ol") {
          return (
            <ol key={blockKey} className="space-y-1.5 tabular-nums">
              {block.items.map((item, itemIdx) => (
                <li
                  key={`${blockKey}-ol-${itemIdx}`}
                  className="flex items-start gap-2.5 text-xs leading-6 sm:text-sm"
                >
                  <span className="mt-0.5 inline-flex min-w-5 shrink-0 justify-end font-semibold text-brand-600 dark:text-brand-300">
                    {item.num}.
                  </span>
                  <div className="min-w-0 flex-1 break-words">
                    {renderSafeInline(
                      item.text,
                      highlightRegex,
                      `${blockKey}-ol-${itemIdx}`,
                    )}
                  </div>
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={blockKey} className="break-words text-xs leading-6 sm:text-sm">
            {renderSafeInline(block.text, highlightRegex, `${blockKey}-p`)}
          </p>
        );
      })}
    </div>
  );
}
