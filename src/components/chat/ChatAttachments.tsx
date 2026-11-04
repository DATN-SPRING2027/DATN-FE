"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { chatApi, type ChatAttachment } from "@/lib/queries/chat/useChat";

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function useAttachmentUrl(conversationId: string, attachmentId: string) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!attachmentId || !conversationId) return;
    let active = true;
    let renewal: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const result = await chatApi.attachmentDownloadUrl(
          conversationId,
          attachmentId,
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
  }, [attachmentId, conversationId]);

  return { url, failed };
}

function ChatDocumentAttachment({
  conversationId,
  attachment,
}: Readonly<{ conversationId: string; attachment: ChatAttachment }>) {
  const { url, failed } = useAttachmentUrl(conversationId, attachment.id);
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

function ChatImageThumbnail({
  conversationId,
  attachment,
  onClick,
  onUrlLoaded,
}: Readonly<{
  conversationId: string;
  attachment: ChatAttachment;
  onClick: () => void;
  onUrlLoaded: (url: string) => void;
}>) {
  const t = useTranslations("chat");
  const { url, failed } = useAttachmentUrl(conversationId, attachment.id);

  useEffect(() => {
    if (url) onUrlLoaded(url);
  }, [url, onUrlLoaded]);

  if (!url) {
    return (
      <span className="mt-2 block text-xs opacity-70">
        {failed ? t("attachmentUnavailable") : t("loadingAttachment")}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
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
  );
}

function ChatStripThumbnail({
  conversationId,
  image,
  cachedUrl,
  isActive,
  onClick,
}: Readonly<{
  conversationId: string;
  image: ChatAttachment;
  cachedUrl?: string;
  isActive: boolean;
  onClick: () => void;
}>) {
  const t = useTranslations("chat");
  const { url } = useAttachmentUrl(conversationId, cachedUrl ? "" : image.id);
  const displayUrl = cachedUrl || url;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("previewImage", { name: image.name })}
      className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
        isActive
          ? "border-white scale-110 shadow-lg opacity-100 ring-2 ring-white/30"
          : "border-transparent opacity-50 hover:opacity-90 hover:scale-105"
      }`}
    >
      {displayUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displayUrl}
          alt={image.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-white/10 text-[10px] text-white/60">
          …
        </div>
      )}
    </button>
  );
}

function ChatImageLightbox({
  conversationId,
  images,
  initialIndex,
  urls,
  onClose,
}: Readonly<{
  conversationId: string;
  images: readonly ChatAttachment[];
  initialIndex: number;
  urls: Record<string, string>;
  onClose: () => void;
}>) {
  const t = useTranslations("chat");
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);

  const safeIndex = Math.max(0, Math.min(currentIndex, images.length - 1));
  const currentAttachment = images[safeIndex];
  const { url: fallbackUrl } = useAttachmentUrl(
    conversationId,
    currentAttachment ? currentAttachment.id : "",
  );
  const currentUrl =
    (currentAttachment && urls[currentAttachment.id]) || fallbackUrl;

  const hasMultiple = images.length > 1;

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    setIsZoomed(false);
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    setIsZoomed(false);
  }, [images.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft" && hasMultiple) {
        event.preventDefault();
        goToPrev();
      } else if (event.key === "ArrowRight" && hasMultiple) {
        event.preventDefault();
        goToNext();
      }
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [hasMultiple, onClose, goToPrev, goToNext]);

  if (!currentAttachment || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={currentAttachment.name}
      className="fixed inset-0 z-99999 flex flex-col items-center justify-center bg-black/85 p-4 backdrop-blur-md select-none"
      onClick={onClose}
    >
      {/* Header bar */}
      <div
        className="absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent px-6 py-4 text-white/90"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-w-0 items-center gap-2.5 pr-4">
          <span className="truncate text-sm font-medium text-white">
            {currentAttachment.name}
          </span>
          <span className="shrink-0 font-mono text-xs text-white/60">
            ({formatSize(currentAttachment.size)})
          </span>
          {hasMultiple && (
            <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-white/90">
              {safeIndex + 1} / {images.length}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setIsZoomed((prev) => !prev)}
            aria-label={isZoomed ? t("zoomOut") : t("zoomIn")}
            title={isZoomed ? t("zoomOut") : t("zoomIn")}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-medium text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
          >
            <span className="text-sm font-bold">{isZoomed ? "−" : "+"}</span>
            <span>{isZoomed ? t("zoomOut") : t("zoomIn")}</span>
          </button>
          <a
            href={currentUrl || undefined}
            download={currentAttachment.name}
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
            onClick={onClose}
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

      {/* Previous Arrow Button */}
      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goToPrev();
          }}
          aria-label={t("previousImage")}
          title={t("previousImage")}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white/90 shadow-xl backdrop-blur-md transition-all hover:bg-black/90 hover:text-white hover:scale-110 focus-visible:outline-2 focus-visible:outline-white active:scale-95"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      {/* Next Arrow Button */}
      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          aria-label={t("nextImage")}
          title={t("nextImage")}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white/90 shadow-xl backdrop-blur-md transition-all hover:bg-black/90 hover:text-white hover:scale-110 focus-visible:outline-2 focus-visible:outline-white active:scale-95"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

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
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt={currentAttachment.name}
            className={`rounded-lg object-contain shadow-2xl transition-transform duration-200 ${
              isZoomed
                ? "max-h-none max-w-none scale-100"
                : "max-h-[85vh] max-w-[90vw]"
            }`}
          />
        ) : (
          <span className="text-sm text-white/70">
            {t("loadingAttachment")}
          </span>
        )}
      </div>

      {/* Bottom Thumbnail Strip for albums */}
      {hasMultiple && (
        <div
          className="absolute inset-x-0 bottom-4 z-30 flex items-center justify-center px-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex max-w-[90vw] items-center gap-2 overflow-x-auto rounded-2xl bg-black/65 px-3 py-2 shadow-2xl backdrop-blur-md">
            {images.map((img, idx) => (
              <ChatStripThumbnail
                key={img.id}
                conversationId={conversationId}
                image={img}
                cachedUrl={urls[img.id]}
                isActive={idx === safeIndex}
                onClick={() => {
                  setCurrentIndex(idx);
                  setIsZoomed(false);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

export default function ChatAttachments({
  conversationId,
  attachments,
  conversationImages,
}: Readonly<{
  conversationId: string;
  attachments: readonly ChatAttachment[];
  conversationImages?: readonly ChatAttachment[];
}>) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const handleUrlLoaded = useCallback((id: string, url: string) => {
    setUrls((prev) => (prev[id] === url ? prev : { ...prev, [id]: url }));
  }, []);

  if (!attachments.length) return null;

  const imageAttachments = attachments.filter((att) => att.kind === "IMAGE");
  const docAttachments = attachments.filter((att) => att.kind !== "IMAGE");

  const allImages =
    conversationImages && conversationImages.length > 0
      ? conversationImages
      : imageAttachments;

  const openLightbox = (attachment: ChatAttachment, localIdx: number) => {
    const foundIndex = allImages.findIndex((img) => img.id === attachment.id);
    setLightboxIndex(foundIndex >= 0 ? foundIndex : localIdx);
  };

  return (
    <div className="space-y-1">
      {imageAttachments.map((attachment, idx) => (
        <ChatImageThumbnail
          key={attachment.id}
          conversationId={conversationId}
          attachment={attachment}
          onClick={() => openLightbox(attachment, idx)}
          onUrlLoaded={(url) => handleUrlLoaded(attachment.id, url)}
        />
      ))}
      {docAttachments.map((attachment) => (
        <ChatDocumentAttachment
          key={attachment.id}
          conversationId={conversationId}
          attachment={attachment}
        />
      ))}

      {lightboxIndex !== null && allImages.length > 0 && (
        <ChatImageLightbox
          conversationId={conversationId}
          images={allImages}
          initialIndex={lightboxIndex}
          urls={urls}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
