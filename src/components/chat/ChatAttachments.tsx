"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

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

  useEffect(() => {
    if (!previewOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewOpen(false);
      }
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [previewOpen]);

  if (attachment.kind === "IMAGE") {
    if (!url) {
      return (
        <span className="mt-2 block text-xs opacity-70">
          {failed ? t("attachmentUnavailable") : t("loadingAttachment")}
        </span>
      );
    }

    return (
      <>
        <button
          type="button"
          onClick={() => {
            setPreviewOpen(true);
            setIsZoomed(false);
          }}
          aria-label={t("previewImage", { name: attachment.name })}
          className="group/img relative mt-2 block max-w-72 cursor-zoom-in overflow-hidden rounded-xl border border-black/10 text-start transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <Image
            src={url}
            alt={attachment.name}
            width={320}
            height={240}
            unoptimized
            className="max-h-64 w-auto object-contain transition-transform duration-200 group-hover/img:scale-[1.02]"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover/img:bg-black/15 group-hover/img:opacity-100">
            <span className="rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              🔍 {t("zoomIn")}
            </span>
          </div>
        </button>

        {previewOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={attachment.name}
              className="fixed inset-0 z-99999 flex flex-col items-center justify-center bg-black/85 p-4 backdrop-blur-md select-none"
              onClick={() => setPreviewOpen(false)}
            >
              {/* Header bar */}
              <div
                className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent px-6 py-4 text-white/90"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex min-w-0 items-center gap-3 pr-4">
                  <span className="truncate text-sm font-medium text-white">
                    {attachment.name}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-white/60">
                    ({formatSize(attachment.size)})
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsZoomed((prev) => !prev)}
                    aria-label={isZoomed ? t("zoomOut") : t("zoomIn")}
                    title={isZoomed ? t("zoomOut") : t("zoomIn")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-medium text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <span className="text-sm font-bold">
                      {isZoomed ? "−" : "+"}
                    </span>
                    <span>{isZoomed ? t("zoomOut") : t("zoomIn")}</span>
                  </button>
                  <a
                    href={url}
                    download={attachment.name}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-medium text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
                    title={t("downloadImage")}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>{t("downloadImage")}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(false)}
                    aria-label={t("closePreview")}
                    title={t("closePreview")}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Main image container */}
              <div
                className={`relative flex items-center justify-center transition-all ${
                  isZoomed
                    ? "max-h-[85vh] max-w-[95vw] cursor-zoom-out overflow-auto"
                    : "max-h-[85vh] max-w-[90vw] cursor-zoom-in"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsZoomed((prev) => !prev);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={attachment.name}
                  className={`rounded-lg object-contain shadow-2xl transition-transform duration-200 ${
                    isZoomed
                      ? "max-h-none max-w-none scale-100"
                      : "max-h-[85vh] max-w-[90vw]"
                  }`}
                />
              </div>
            </div>,
            document.body,
          )}
      </>
    );
  }

  return (
    <a
      href={url || undefined}
      download={attachment.name}
      target={url ? "_blank" : undefined}
      rel={url ? "noreferrer" : undefined}
      aria-disabled={!url}
      className="mt-2 flex max-w-72 items-center gap-2 rounded-xl border border-current/20 px-2.5 py-2 text-xs opacity-90 transition-opacity hover:opacity-100"
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
