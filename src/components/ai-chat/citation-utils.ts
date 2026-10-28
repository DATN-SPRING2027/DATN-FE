export type CitationItemToken =
  | Readonly<{ type: "document"; number: number; label: string }>
  | Readonly<{ type: "session"; ref: string; label: string }>;

export type CitationSegmentToken =
  | Readonly<{ kind: "text"; text: string }>
  | Readonly<{ kind: "citations"; items: readonly CitationItemToken[] }>;

const BRACKET_GROUP_REGEX = /\[([0-9S,\s;]+)\]/gi;
const SINGLE_CITATION_TOKEN_REGEX = /^(?:([1-9]\d{0,2})|([sS][1-9]\d{0,2}))$/;

function parseBracketGroup(inner: string): CitationItemToken[] | null {
  const parts = inner
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const items: CitationItemToken[] = [];
  for (const part of parts) {
    const match = SINGLE_CITATION_TOKEN_REGEX.exec(part);
    if (!match) {
      return null;
    }
    if (match[1]) {
      const num = Number.parseInt(match[1], 10);
      items.push({
        type: "document",
        number: num,
        label: String(num),
      });
    } else if (match[2]) {
      const normalized = match[2].toUpperCase();
      items.push({
        type: "session",
        ref: normalized,
        label: normalized,
      });
    }
  }

  return items.length > 0 ? items : null;
}

function tokenizePlainSegment(segment: string): CitationSegmentToken[] {
  const result: CitationSegmentToken[] = [];
  let cursor = 0;
  BRACKET_GROUP_REGEX.lastIndex = 0;

  let match = BRACKET_GROUP_REGEX.exec(segment);
  while (match !== null) {
    const items = parseBracketGroup(match[1] ?? "");
    if (items) {
      if (match.index > cursor) {
        result.push({
          kind: "text",
          text: segment.slice(cursor, match.index),
        });
      }
      result.push({
        kind: "citations",
        items,
      });
      cursor = match.index + match[0].length;
    }
    match = BRACKET_GROUP_REGEX.exec(segment);
  }

  if (cursor < segment.length) {
    result.push({
      kind: "text",
      text: segment.slice(cursor),
    });
  }
  return result;
}

/**
 * Splits prose into plain-text runs and verified single/compound citation groups
 * (`[1]`, `[1, 2]`, `[S1, S2]`, `[1, S1]`), ignoring inline backtick spans.
 */
export function tokenizeTextWithCitations(
  input: string,
): CitationSegmentToken[] {
  if (!input) return [];

  const merged: CitationSegmentToken[] = [];
  const pushSegment = (token: CitationSegmentToken) => {
    if (token.kind === "text") {
      if (!token.text) return;
      const prev = merged[merged.length - 1];
      if (prev && prev.kind === "text") {
        merged[merged.length - 1] = {
          kind: "text",
          text: prev.text + token.text,
        };
        return;
      }
    }
    merged.push(token);
  };

  // Preserve inline code spans (`...`) verbatim as text so `[1]` inside code is never turned into a citation pill.
  const codeSpanRegex = /`[^`]*`/g;
  let lastIndex = 0;
  let codeMatch = codeSpanRegex.exec(input);

  while (codeMatch !== null) {
    if (codeMatch.index > lastIndex) {
      for (const token of tokenizePlainSegment(
        input.slice(lastIndex, codeMatch.index),
      )) {
        pushSegment(token);
      }
    }
    pushSegment({ kind: "text", text: codeMatch[0] });
    lastIndex = codeMatch.index + codeMatch[0].length;
    codeMatch = codeSpanRegex.exec(input);
  }

  if (lastIndex < input.length) {
    for (const token of tokenizePlainSegment(input.slice(lastIndex))) {
      pushSegment(token);
    }
  }

  return merged;
}

const MONGO_OBJECT_ID_REGEX = /^[a-f0-9]{24}$/i;

export function isContinuumDocumentId(documentId: string | undefined): boolean {
  return Boolean(documentId && MONGO_OBJECT_ID_REGEX.test(documentId));
}
