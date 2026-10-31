export type DiffSegmentType = "equal" | "delete" | "insert";

export type DiffSegment = Readonly<{
  type: DiffSegmentType;
  text: string;
}>;

export type ReadableDiffResult = Readonly<{
  segments: readonly DiffSegment[];
  addedWords: number;
  removedWords: number;
  changedBlocks: number;
  isNewContent: boolean;
  isIdentical: boolean;
}>;

const TOKEN_PATTERN = /\n|[ \t]+|[\p{L}\p{N}_-]+|[^\s\p{L}\p{N}_-]/gu;
const WORD_CHECK_PATTERN = /[\p{L}\p{N}_]/u;
const WORD_COUNT_PATTERN = /[\p{L}\p{N}_-]+/gu;
const HORIZONTAL_SPACE_PATTERN = /^[ \t]+$/;

const MAX_TOKEN_MATRIX_CELLS = 360_000;

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function tokenize(text: string): string[] {
  if (!text) return [];
  return text.match(TOKEN_PATTERN) ?? [text];
}

function tokenWeight(token: string): number {
  if (WORD_CHECK_PATTERN.test(token)) return 4;
  if (token === "\n") return 3;
  return 1;
}

function countWords(text: string): number {
  if (!text) return 0;
  return text.match(WORD_COUNT_PATTERN)?.length ?? 0;
}

function splitLinesPreservingNewline(text: string): string[] {
  if (!text) return [];
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      parts.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < text.length) {
    parts.push(text.slice(start));
  }
  return parts;
}

function mergeAdjacentSameType(segments: readonly DiffSegment[]): DiffSegment[] {
  const merged: DiffSegment[] = [];
  for (const seg of segments) {
    if (!seg.text) continue;
    const prev = merged[merged.length - 1];
    if (prev && prev.type === seg.type) {
      merged[merged.length - 1] = {
        type: prev.type,
        text: prev.text + seg.text,
      };
    } else {
      merged.push(seg);
    }
  }
  return merged;
}

function weightedLcsOps(
  a: readonly string[],
  b: readonly string[],
  weightFn: (tok: string) => number,
): DiffSegment[] {
  const m = a.length;
  const n = b.length;
  if (m === 0 && n === 0) return [];
  if (m === 0) return [{ type: "insert", text: b.join("") }];
  if (n === 0) return [{ type: "delete", text: a.join("") }];

  const stride = n + 1;
  const dp = new Int32Array((m + 1) * stride);

  for (let i = m - 1; i >= 0; i--) {
    const ai = a[i];
    const wi = weightFn(ai);
    const rowOffset = i * stride;
    const nextRowOffset = (i + 1) * stride;
    for (let j = n - 1; j >= 0; j--) {
      if (ai === b[j]) {
        dp[rowOffset + j] = dp[nextRowOffset + j + 1] + wi;
      } else {
        const down = dp[nextRowOffset + j];
        const right = dp[rowOffset + j + 1];
        dp[rowOffset + j] = down >= right ? down : right;
      }
    }
  }

  const out: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: "equal", text: a[i] });
      i++;
      j++;
    } else if (dp[(i + 1) * stride + j] >= dp[i * stride + j + 1]) {
      out.push({ type: "delete", text: a[i] });
      i++;
    } else {
      out.push({ type: "insert", text: b[j] });
      j++;
    }
  }
  while (i < m) {
    out.push({ type: "delete", text: a[i] });
    i++;
  }
  while (j < n) {
    out.push({ type: "insert", text: b[j] });
    j++;
  }
  return out;
}

function diffTokenArrays(
  a: readonly string[],
  b: readonly string[],
): DiffSegment[] {
  let start = 0;
  const minLen = Math.min(a.length, b.length);
  while (start < minLen && a[start] === b[start]) {
    start++;
  }

  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const result: DiffSegment[] = [];
  if (start > 0) {
    result.push({ type: "equal", text: a.slice(0, start).join("") });
  }

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  if (midA.length === 0 && midB.length > 0) {
    result.push({ type: "insert", text: midB.join("") });
  } else if (midB.length === 0 && midA.length > 0) {
    result.push({ type: "delete", text: midA.join("") });
  } else if (midA.length > 0 && midB.length > 0) {
    if (midA.length * midB.length <= MAX_TOKEN_MATRIX_CELLS) {
      result.push(...weightedLcsOps(midA, midB, tokenWeight));
    } else {
      const linesA = splitLinesPreservingNewline(midA.join(""));
      const linesB = splitLinesPreservingNewline(midB.join(""));
      if (linesA.length * linesB.length <= MAX_TOKEN_MATRIX_CELLS) {
        const lineOps = mergeAdjacentSameType(
          weightedLcsOps(linesA, linesB, () => 1),
        );
        for (let idx = 0; idx < lineOps.length; idx++) {
          const cur = lineOps[idx];
          const next = lineOps[idx + 1];
          if (cur.type === "delete" && next?.type === "insert") {
            const subTokA = tokenize(cur.text);
            const subTokB = tokenize(next.text);
            if (subTokA.length * subTokB.length <= MAX_TOKEN_MATRIX_CELLS) {
              result.push(...weightedLcsOps(subTokA, subTokB, tokenWeight));
            } else {
              result.push(cur, next);
            }
            idx++;
          } else {
            result.push(cur);
          }
        }
      } else {
        result.push(
          { type: "delete", text: midA.join("") },
          { type: "insert", text: midB.join("") },
        );
      }
    }
  }

  if (endA < a.length) {
    result.push({ type: "equal", text: a.slice(endA).join("") });
  }

  return mergeAdjacentSameType(result);
}

type NormalizedBlock =
  | { kind: "equal"; text: string }
  | { kind: "edit"; del: string; ins: string };

function toNormalizedBlocks(segments: readonly DiffSegment[]): NormalizedBlock[] {
  const blocks: NormalizedBlock[] = [];
  for (const seg of segments) {
    if (!seg.text) continue;
    if (seg.type === "equal") {
      const last = blocks[blocks.length - 1];
      if (last && last.kind === "equal") {
        last.text += seg.text;
      } else {
        blocks.push({ kind: "equal", text: seg.text });
      }
    } else {
      const last = blocks[blocks.length - 1];
      if (last && last.kind === "edit") {
        if (seg.type === "delete") last.del += seg.text;
        else last.ins += seg.text;
      } else {
        blocks.push({
          kind: "edit",
          del: seg.type === "delete" ? seg.text : "",
          ins: seg.type === "insert" ? seg.text : "",
        });
      }
    }
  }
  return blocks;
}

/**
 * Coalesces fragmented word-by-word edits separated only by horizontal spaces
 * (e.g. `[-tại][+chưa] [-đang][+rõ]`) into single readable phrase edits
 * (`[-tại đang][+chưa rõ]`), while preserving exact `before` and `after` text.
 */
function coalescePhraseBlocks(
  blocks: readonly NormalizedBlock[],
): NormalizedBlock[] {
  const out: NormalizedBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const cur = blocks[i];
    const prev = out[out.length - 1];
    const prevPrev = out[out.length - 2];

    if (
      cur.kind === "edit" &&
      prev?.kind === "equal" &&
      HORIZONTAL_SPACE_PATTERN.test(prev.text) &&
      prevPrev?.kind === "edit" &&
      ((Boolean(prevPrev.del) && Boolean(cur.del)) ||
        (Boolean(prevPrev.ins) && Boolean(cur.ins)))
    ) {
      const ws = prev.text;
      out.pop();
      prevPrev.del = prevPrev.del + ws + cur.del;
      prevPrev.ins = prevPrev.ins + ws + cur.ins;
      continue;
    }

    out.push(cur.kind === "equal" ? { ...cur } : { ...cur });
  }
  return out;
}

function blocksToSegments(blocks: readonly NormalizedBlock[]): DiffSegment[] {
  const segments: DiffSegment[] = [];
  for (const block of blocks) {
    if (block.kind === "equal") {
      if (block.text) segments.push({ type: "equal", text: block.text });
      continue;
    }

    // Peel shared leading/trailing whitespace back into equal segments so
    // red/green highlight pills wrap crisp phrase boundaries.
    let del = block.del;
    let ins = block.ins;
    let sharedLead = "";
    while (
      del.length > 0 &&
      ins.length > 0 &&
      del[0] === ins[0] &&
      /\s/.test(del[0])
    ) {
      sharedLead += del[0];
      del = del.slice(1);
      ins = ins.slice(1);
    }

    let sharedTrail = "";
    while (
      del.length > 0 &&
      ins.length > 0 &&
      del[del.length - 1] === ins[ins.length - 1] &&
      /\s/.test(del[del.length - 1])
    ) {
      sharedTrail = del[del.length - 1] + sharedTrail;
      del = del.slice(0, -1);
      ins = ins.slice(0, -1);
    }

    if (sharedLead) segments.push({ type: "equal", text: sharedLead });
    if (del) segments.push({ type: "delete", text: del });
    if (ins) segments.push({ type: "insert", text: ins });
    if (sharedTrail) segments.push({ type: "equal", text: sharedTrail });
  }
  return mergeAdjacentSameType(segments);
}

export function computeReadableDiff(
  beforeRaw: string,
  afterRaw: string,
): ReadableDiffResult {
  const before = normalizeLineEndings(beforeRaw);
  const after = normalizeLineEndings(afterRaw);

  if (before === after) {
    return {
      segments: after ? [{ type: "equal", text: after }] : [],
      addedWords: 0,
      removedWords: 0,
      changedBlocks: 0,
      isNewContent: false,
      isIdentical: true,
    };
  }

  if (!before.trim()) {
    return {
      segments: after ? [{ type: "insert", text: after }] : [],
      addedWords: countWords(after),
      removedWords: 0,
      changedBlocks: after ? 1 : 0,
      isNewContent: true,
      isIdentical: false,
    };
  }

  if (!after.trim()) {
    return {
      segments: [{ type: "delete", text: before }],
      addedWords: 0,
      removedWords: countWords(before),
      changedBlocks: 1,
      isNewContent: false,
      isIdentical: false,
    };
  }

  const rawSegments = diffTokenArrays(tokenize(before), tokenize(after));
  const coalescedBlocks = coalescePhraseBlocks(toNormalizedBlocks(rawSegments));
  const segments = blocksToSegments(coalescedBlocks);

  let addedWords = 0;
  let removedWords = 0;
  for (const seg of segments) {
    if (seg.type === "insert") addedWords += countWords(seg.text);
    else if (seg.type === "delete") removedWords += countWords(seg.text);
  }

  const changedBlocks = coalescedBlocks.filter(
    (b) => b.kind === "edit" && (b.del.trim().length > 0 || b.ins.trim().length > 0),
  ).length;

  return {
    segments,
    addedWords,
    removedWords,
    changedBlocks: Math.max(changedBlocks, segments.some((s) => s.type !== "equal") ? 1 : 0),
    isNewContent: false,
    isIdentical: false,
  };
}

