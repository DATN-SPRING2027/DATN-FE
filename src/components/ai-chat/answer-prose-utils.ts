import type { CitationSegmentToken } from "./citation-utils";

/**
 * Strips leading decorative emoji / pictograph runs (e.g., "✅ ", "🚀 ", "📌 ", "🔹 ")
 * from Markdown headings and bullet items while preserving ASCII digits, letters,
 * punctuation, and Vietnamese diacritics.
 */
const LEADING_DECORATIVE_EMOJI_RE =
  /^(?:(?:[\p{Extended_Pictographic}\u2600-\u27BF][\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]*)+(?:\s+|(?=\d+[.)]|\p{L}))|\u20E3\s*)+/u;

const LEADING_KEYCAP_NUMBER_RE = /^([0-9])\uFE0F?\u20E3\s*/u;

export function stripLeadingDecorativeEmoji(raw: string): string {
  if (!raw) return raw;
  let cleaned = raw.trimStart();
  const keycapMatch = LEADING_KEYCAP_NUMBER_RE.exec(cleaned);
  if (keycapMatch?.[1]) {
    cleaned = `${keycapMatch[1]}. ${cleaned.slice(keycapMatch[0].length)}`;
  }
  const stripped = cleaned.replace(LEADING_DECORATIVE_EMOJI_RE, "");
  return stripped.length > 0 ? stripped : raw;
}

export interface ParsedNumberedHeading {
  numberPrefix: string;
  titleText: string;
}

const NUMBERED_HEADING_RE = /^(\d{1,2}[.)])\s+(.+)$/;

/**
 * Splits a numbered Markdown heading such as "1. Framework nền tảng: Next.js"
 * into a tabular index prefix ("1.") and heading body while keeping the exact
 * concatenated text intact for accessibility and tests.
 */
export function parseNumberedHeading(
  cleanedHeading: string,
): ParsedNumberedHeading | null {
  const match = NUMBERED_HEADING_RE.exec(cleanedHeading.trim());
  if (!match?.[1] || !match[2]) {
    return null;
  }
  return {
    numberPrefix: match[1],
    titleText: match[2],
  };
}

const LEADING_PUNCTUATION_SPACE_RE = /^\s+([.,;:!?)\]}])/;
const LEADING_TIGHT_PUNCTUATION_CAPTURE_RE = /^([.,;:!?)\]}]+)([\s\S]*)$/;

export interface NormalizedCitationToken {
  token: CitationSegmentToken;
  /** Trailing closing punctuation bound to a citation so it never orphans onto a new line. */
  boundPunctuation: string;
}

/**
 * Removes stray whitespace between a citation badge and following punctuation
 * (e.g. `Size) [4] .` -> `Size) [4].`) and binds immediate closing punctuation
 * onto the citation group so a period never wraps alone onto the next line.
 */
export function normalizeCitationTokens(
  tokens: readonly CitationSegmentToken[],
): NormalizedCitationToken[] {
  const cleaned: CitationSegmentToken[] = tokens.map((token, idx) => {
    const prev = idx > 0 ? tokens[idx - 1] : undefined;
    const next = idx + 1 < tokens.length ? tokens[idx + 1] : undefined;
    if (token.kind !== "text") {
      return token;
    }
    let nextText = token.text;
    if (prev?.kind === "citations") {
      nextText = nextText.replace(LEADING_PUNCTUATION_SPACE_RE, "$1");
    }
    if (next?.kind === "citations") {
      nextText = nextText.replace(/[ \t]+$/, "");
    }
    return nextText === token.text ? token : { kind: "text", text: nextText };
  });

  const result: NormalizedCitationToken[] = [];
  for (let i = 0; i < cleaned.length; i += 1) {
    const current = cleaned[i]!;
    if (current.kind === "citations") {
      let boundPunctuation = "";
      const next = cleaned[i + 1];
      if (next?.kind === "text") {
        const punctMatch = LEADING_TIGHT_PUNCTUATION_CAPTURE_RE.exec(next.text);
        if (punctMatch?.[1]) {
          boundPunctuation = punctMatch[1];
          cleaned[i + 1] = { kind: "text", text: punctMatch[2] ?? "" };
        }
      }
      result.push({ token: current, boundPunctuation });
    } else if (current.text.length > 0) {
      result.push({ token: current, boundPunctuation: "" });
    }
  }
  return result;
}

/**
 * Strips raw Markdown syntax (`**bold**`, `` `code` ``, `# headings`, links,
 * decorative emojis) so hover tooltips and source cards display clean plain text.
 */
export function formatCitationSnippetPreview(
  raw: string,
  maxLength = 160,
): string {
  if (!raw) return "";
  const plain = raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|$)/g, "$1$2")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•>]\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const withoutEmoji = stripLeadingDecorativeEmoji(plain).trim();
  if (withoutEmoji.length <= maxLength) {
    return withoutEmoji;
  }
  const sliced = withoutEmoji.slice(0, Math.max(1, maxLength - 1)).trimEnd();
  const cleanedTail = sliced.replace(/[.,;:!?\-–—]+$/u, "").trimEnd();
  return `${cleanedTail || sliced}…`;
}
