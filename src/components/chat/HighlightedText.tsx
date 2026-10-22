import { foldSearchText as fold } from "./search-text";
export function highlightParts(text: string, query: string) {
  let folded = "",
    offset = 0;
  const starts: number[] = [],
    ends: number[] = [];
  for (const point of text) {
    const normalized = fold(point);
    for (let i = 0; i < normalized.length; i++) {
      starts.push(offset);
      ends.push(offset + point.length);
    }
    if (!normalized && ends.length)
      ends[ends.length - 1] = offset + point.length;
    folded += normalized;
    offset += point.length;
  }
  const ranges: [number, number][] = [];
  for (const term of new Set(fold(query).trim().split(/\s+/).filter(Boolean))) {
    let from = 0,
      found: number;
    while ((found = folded.indexOf(term, from)) !== -1) {
      ranges.push([starts[found], ends[found + term.length - 1]]);
      from = found + term.length;
    }
  }
  const merged: [number, number][] = [];
  for (const range of ranges.sort((a, b) => a[0] - b[0])) {
    const previous = merged.at(-1);
    if (previous && range[0] <= previous[1])
      previous[1] = Math.max(previous[1], range[1]);
    else merged.push([...range]);
  }
  const parts: { text: string; matched: boolean }[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor)
      parts.push({ text: text.slice(cursor, start), matched: false });
    parts.push({ text: text.slice(start, end), matched: true });
    cursor = end;
  }
  if (cursor < text.length)
    parts.push({ text: text.slice(cursor), matched: false });
  return parts;
}

export default function HighlightedText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  return (
    <>
      {highlightParts(text, query).map((part, index) =>
        part.matched ? (
          <mark
            key={index}
            className="rounded-sm bg-warning-100 text-gray-950 dark:bg-warning-300 dark:text-gray-950"
          >
            {part.text}
          </mark>
        ) : (
          part.text
        ),
      )}
    </>
  );
}
