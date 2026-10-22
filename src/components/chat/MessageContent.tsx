import { Fragment } from "react";

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

export default function MessageContent({ content }: { content: string }) {
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
              {prefix}
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
        {content.slice(suffixStart)}
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
