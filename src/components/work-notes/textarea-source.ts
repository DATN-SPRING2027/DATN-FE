import type { SelectionAnchor } from "@/lib/queries/work-notes/work-note-agent.api";
const normalized = (value: string) => value.replace(/\r\n?/g, "\n");
/** Textarea API values normalize newlines to LF. Source/API offsets do not. */
function sourceOffset(source: string, domOffset: number): number {
  let raw = 0,
    dom = 0;
  while (raw < source.length && dom < domOffset) {
    raw += source[raw] === "\r" && source[raw + 1] === "\n" ? 2 : 1;
    dom++;
  }
  return raw;
}
export function sourceSelection(
  source: string,
  start: number,
  end: number,
): SelectionAnchor | null {
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end <= start ||
    end > normalized(source).length
  )
    return null;
  const rawStart = sourceOffset(source, start),
    rawEnd = sourceOffset(source, end);
  return {
    start: rawStart,
    end: rawEnd,
    quote: source.slice(rawStart, rawEnd),
  };
}
/** Preserve exact source outside the user's edit, including mixed log line endings. */
export function reconcileTextareaEdit(source: string, value: string): string {
  const old = normalized(source),
    next = normalized(value);
  if (old === next) return source;
  let prefix = 0;
  while (
    prefix < old.length &&
    prefix < next.length &&
    old[prefix] === next[prefix]
  )
    prefix++;
  let suffix = 0;
  while (
    suffix < old.length - prefix &&
    suffix < next.length - prefix &&
    old[old.length - 1 - suffix] === next[next.length - 1 - suffix]
  )
    suffix++;
  const newline = /\r\n|\r|\n/.exec(source)?.[0] ?? "\n";
  const replacement = next
    .slice(prefix, next.length - suffix)
    .replace(/\n/g, newline);
  return (
    source.slice(0, sourceOffset(source, prefix)) +
    replacement +
    source.slice(sourceOffset(source, old.length - suffix))
  );
}
