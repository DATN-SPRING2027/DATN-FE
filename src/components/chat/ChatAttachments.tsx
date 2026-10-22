"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { chatApi, type ChatAttachment } from "@/lib/queries/chat/useChat";

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ChatAttachmentItem({
  conversationId,
  attachment,
}: Readonly<{ conversationId: string; attachment: ChatAttachment }>) {
  const t = useTranslations("chat");
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let renewal: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const result = await chatApi.attachmentDownloadUrl(
          conversationId,
          attachment.id,
        );
        if (!active) return;
        setUrl(result.url);
        setFailed(false);
        renewal = setTimeout(
          () => void load(),
          Math.max(30, result.expiresInSeconds - 30) * 1000,
        );
      } catch {
        if (active) setFailed(true);
      }
    };
    void load();
    return () => {
      active = false;
      if (renewal) clearTimeout(renewal);
    };
  }, [attachment.id, conversationId]);

  if (attachment.kind === "IMAGE") {
    return url ? (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block max-w-72 overflow-hidden border border-black/10 focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <Image
          src={url}
          alt={attachment.name}
          width={320}
          height={240}
          unoptimized
          className="max-h-64 w-auto object-contain"
        />
      </a>
    ) : (
      <span className="mt-2 block text-xs opacity-70">
        {failed ? t("attachmentUnavailable") : t("loadingAttachment")}
      </span>
    );
  }

  return (
    <a
      href={url || undefined}
      target={url ? "_blank" : undefined}
      rel={url ? "noreferrer" : undefined}
      aria-disabled={!url}
      className="mt-2 flex max-w-72 items-center gap-2 border border-current/20 px-2.5 py-2 text-xs opacity-90 hover:opacity-100"
    >
      <span aria-hidden="true" className="text-base">
        ▤
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{attachment.name}</span>
        <span className="opacity-70">{formatSize(attachment.size)}</span>
      </span>
      <span aria-hidden="true">{failed ? "!" : url ? "↓" : "…"}</span>
    </a>
  );
}

export default function ChatAttachments({
  conversationId,
  attachments,
}: Readonly<{
  conversationId: string;
  attachments: readonly ChatAttachment[];
}>) {
  if (!attachments.length) return null;
  return (
    <div className="space-y-1">
      {attachments.map((attachment) => (
        <ChatAttachmentItem
          key={attachment.id}
          conversationId={conversationId}
          attachment={attachment}
        />
      ))}
    </div>
  );
}
