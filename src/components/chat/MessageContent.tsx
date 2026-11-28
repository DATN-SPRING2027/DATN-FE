import { Fragment, type ReactNode } from "react";

const ASSISTANT_TOKEN_RE = /(^|\s)(@continuumAI)(?=$|[\s.,!?;:)\]])/gu;

export function messageLinks(content: string) {
  return [...content.matchAll(/https?:\/\/[^\s<>]+/giu)].flatMap((match) => {
    const text = match[0].replace(/[),.;!?]+$/u, "");
    try {
      const url = new URL(text);
      return url.username || url.password
        ? []
        : [{ text, url, index: match.index }];
    } catch {
      return [];
    }
  });
}

function renderTextWithAssistantToken(
  segment: string,
  mine: boolean,
  keyPrefix: string,
): ReactNode {
  if (!segment || !segment.includes("@continuumAI")) {
    return segment;
  }
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = 0;
  for (const match of segment.matchAll(ASSISTANT_TOKEN_RE)) {
    const start = match.index ?? 0;
    const leading = match[1] ?? "";
    const token = match[2] ?? "@continuumAI";
    const tokenStart = start + leading.length;
    if (tokenStart > cursor) {
      nodes.push(
        <Fragment key={`${keyPrefix}-t-${matchIndex}`}>
          {segment.slice(cursor, tokenStart)}
        </Fragment>,
      );
    }
    nodes.push(
      <span
        key={`${keyPrefix}-ai-${matchIndex}`}
        translate="no"
        data-testid="message-assistant-mention-token"
        className={
          mine
            ? "inline-block rounded-md bg-brand-700/75 px-1 py-0.5 font-semibold text-white ring-1 ring-white/25"
            : "inline-block rounded-md bg-brand-100 px-1 py-0.5 font-semibold text-brand-800 dark:bg-brand-500/25 dark:text-brand-200"
        }
      >
        {token}
      </span>,
    );
    cursor = tokenStart + token.length;
    matchIndex += 1;
  }
  if (nodes.length === 0) {
    return segment;
  }
  if (cursor < segment.length) {
    nodes.push(
      <Fragment key={`${keyPrefix}-tail`}>{segment.slice(cursor)}</Fragment>,
    );
  }
  return nodes;
}

export default function MessageContent({
  content,
  mine = false,
}: {
  content: string;
  mine?: boolean;
}) {
  const links = messageLinks(content);
  const last = links.at(-1);
  const suffixStart = last ? last.index + last.text.length : 0;
  return (
    <>
      <p className="break-words whitespace-pre-wrap">
        {links.map((link, index) => {
          const previous = links[index - 1];
          const prefix = content.slice(
            previous ? previous.index + previous.text.length : 0,
            link.index,
          );
          return (
            <Fragment key={link.index}>
              {renderTextWithAssistantToken(prefix, mine, `pre-${index}`)}
              <a
                className="underline underline-offset-2"
                href={link.url.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.text}
              </a>
            </Fragment>
          );
        })}
        {renderTextWithAssistantToken(
          content.slice(suffixStart),
          mine,
          "suffix",
        )}
      </p>
      {links.slice(0, 3).map(({ url, index }) => (
        <a
          key={index}
          href={url.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block rounded-lg border border-current/20 px-3 py-2 text-sm"
        >
          <span className="block font-semibold">{url.hostname}</span>
          <span className="block truncate opacity-80">
            {url.pathname}
            {url.search}
          </span>
        </a>
      ))}
    </>
  );
}
