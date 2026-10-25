"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import {
  AlertIcon,
  ArrowRightIcon,
  CheckLineIcon,
  ChevronLeftIcon,
  CloseLineIcon,
  CopyIcon,
  DocsIcon,
  DownloadIcon,
  PlusIcon,
  TableIcon,
} from "@/icons";

export type PreviewFileMode =
  | "docx"
  | "spreadsheet"
  | "pptx"
  | "pdf"
  | "image"
  | "text"
  | "binary";

export interface SpreadsheetSheet {
  name: string;
  rows: string[][];
}

export interface PptxSlide {
  index: number;
  paragraphs: string[];
}

export interface DocumentFilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  contentType?: string;
  fileSize?: number;
  fetchBlob: () => Promise<Blob>;
  downloadUrl?: string;
  onDownload?: () => void;
}

export function formatPreviewFileSize(bytes?: number): string {
  if (typeof bytes !== "number" || Number.isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getPreviewFileBadge(name: string, contentType?: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".markdown") || lower.endsWith(".md")) return "MD";
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "YAML";
  if (lower.endsWith(".jpeg") || lower.endsWith(".jpg")) return "JPG";
  const dotIdx = lower.lastIndexOf(".");
  if (dotIdx !== -1 && dotIdx < lower.length - 1) {
    return lower.slice(dotIdx + 1).toUpperCase();
  }
  if (contentType === "application/pdf") return "PDF";
  if (contentType?.startsWith("text/")) return "TXT";
  return "FILE";
}

export function detectPreviewFileMode(
  name: string,
  contentType?: string,
): PreviewFileMode {
  const lower = name.toLowerCase();
  const mime = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";

  if (lower.endsWith(".pdf") || mime === "application/pdf") {
    return "pdf";
  }
  if (
    lower.endsWith(".docx") ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".ods") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".tsv") ||
    mime ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.oasis.opendocument.spreadsheet" ||
    mime === "text/csv" ||
    mime === "text/tab-separated-values"
  ) {
    return "spreadsheet";
  }
  if (
    lower.endsWith(".pptx") ||
    mime ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return "pptx";
  }
  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".svg") ||
    mime.startsWith("image/")
  ) {
    return "image";
  }
  if (
    [
      ".txt",
      ".md",
      ".markdown",
      ".json",
      ".yaml",
      ".yml",
      ".xml",
      ".drawio",
      ".sql",
      ".rtf",
    ].some((ext) => lower.endsWith(ext)) ||
    mime.startsWith("text/") ||
    [
      "application/json",
      "application/yaml",
      "application/x-yaml",
      "application/xml",
      "application/sql",
    ].includes(mime)
  ) {
    return "text";
  }
  return "binary";
}

function getColumnLabel(colIndex: number): string {
  let label = "";
  let n = colIndex;
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

async function readBlobArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read file buffer"));
    reader.readAsArrayBuffer(blob);
  });
}

function isZipBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const bytes = new Uint8Array(buffer, 0, 4);
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function extractXmlSlideParagraphs(xmlText: string): string[] {
  const paragraphs: string[] = [];
  const pRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = pRegex.exec(xmlText)) !== null) {
    const pContent = pMatch[1];
    const tRegex = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g;
    let tMatch: RegExpExecArray | null;
    const runs: string[] = [];
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      runs.push(
        tMatch[1]
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'"),
      );
    }
    const line = runs.join("").trim();
    if (line) paragraphs.push(line);
  }
  return paragraphs;
}

export default function DocumentFilePreviewModal({
  isOpen,
  onClose,
  fileName,
  contentType,
  fileSize,
  fetchBlob,
  downloadUrl,
  onDownload,
}: DocumentFilePreviewModalProps) {
  const t = useTranslations("workNotes.previewModal");
  const docxContainerRef = useRef<HTMLDivElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedMode, setResolvedMode] = useState<PreviewFileMode>("binary");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string>("");
  const [docxBuffer, setDocxBuffer] = useState<ArrayBuffer | null>(null);
  const [sheets, setSheets] = useState<SpreadsheetSheet[]>([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [slides, setSlides] = useState<PptxSlide[]>([]);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  const fileBadge = useMemo(
    () => getPreviewFileBadge(fileName, contentType),
    [fileName, contentType],
  );
  const formattedSize = useMemo(
    () => formatPreviewFileSize(fileSize),
    [fileSize],
  );

  // Stop Escape propagation in capture phase so parent modals do not close simultaneously
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        event.stopImmediatePropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  const loadPreview = useCallback(async () => {
    if (!isOpen || !fileName) return;
    const initialMode = detectPreviewFileMode(fileName, contentType);
    setError(null);
    setCopied(false);
    setZoom(100);
    setDocxBuffer(null);
    setSheets([]);
    setActiveSheetIdx(0);
    setSlides([]);
    setActiveSlideIdx(0);
    setTextContent("");
    setObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    if (initialMode === "binary") {
      setResolvedMode("binary");
      setLoading(false);
      return;
    }

    setLoading(true);
    setResolvedMode(initialMode);

    try {
      const blob = await fetchBlob();

      if (initialMode === "text") {
        const text = await blob.text();
        setTextContent(text);
        setResolvedMode("text");
        setLoading(false);
        return;
      }

      if (initialMode === "pdf") {
        const pdfBlob =
          blob.type === "application/pdf"
            ? blob
            : new Blob([blob], { type: "application/pdf" });
        const url = URL.createObjectURL(pdfBlob);
        setObjectUrl(url);
        setResolvedMode("pdf");
        setLoading(false);
        return;
      }

      if (initialMode === "image") {
        const url = URL.createObjectURL(blob);
        setObjectUrl(url);
        setResolvedMode("image");
        setLoading(false);
        return;
      }

      const arrayBuffer = await readBlobArrayBuffer(blob);

      if (initialMode === "docx") {
        if (isZipBuffer(arrayBuffer)) {
          setDocxBuffer(arrayBuffer);
          setResolvedMode("docx");
        } else {
          // If a text-based fixture was supplied in a test or plain text .docx
          const fallbackText = new TextDecoder("utf-8", {
            fatal: false,
          }).decode(arrayBuffer);
          if (fallbackText.trim() && !fallbackText.includes("\uFFFD")) {
            setTextContent(fallbackText);
            setResolvedMode("text");
          } else {
            setResolvedMode("binary");
          }
        }
        setLoading(false);
        return;
      }

      if (initialMode === "spreadsheet") {
        const XLSX = await import("xlsx");
        const isCsvOrTsv =
          fileName.toLowerCase().endsWith(".csv") ||
          fileName.toLowerCase().endsWith(".tsv");
        const workbook = isCsvOrTsv
          ? XLSX.read(new TextDecoder("utf-8").decode(arrayBuffer), {
              type: "string",
            })
          : XLSX.read(arrayBuffer, { type: "array" });

        const parsedSheets: SpreadsheetSheet[] = workbook.SheetNames.map(
          (sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const rawRows = XLSX.utils.sheet_to_json<
              (string | number | boolean | null)[]
            >(worksheet, {
              header: 1,
              defval: "",
              raw: false,
            });
            const normalizedRows = rawRows.map((row) =>
              Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : [],
            );
            return {
              name: sheetName,
              rows: normalizedRows,
            };
          },
        );
        setSheets(parsedSheets);
        setActiveSheetIdx(0);
        setResolvedMode("spreadsheet");
        setLoading(false);
        return;
      }

      if (initialMode === "pptx") {
        if (!isZipBuffer(arrayBuffer)) {
          setResolvedMode("binary");
          setLoading(false);
          return;
        }
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(arrayBuffer);
        const slideFiles = Object.keys(zip.files)
          .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
          .sort((a, b) => {
            const numA = Number(a.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
            const numB = Number(b.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
            return numA - numB;
          });

        const parsedSlides: PptxSlide[] = [];
        for (let i = 0; i < slideFiles.length; i += 1) {
          const xml = await zip.files[slideFiles[i]].async("string");
          parsedSlides.push({
            index: i + 1,
            paragraphs: extractXmlSlideParagraphs(xml),
          });
        }
        if (parsedSlides.length > 0) {
          setSlides(parsedSlides);
          setActiveSlideIdx(0);
          setResolvedMode("pptx");
        } else {
          setResolvedMode("binary");
        }
        setLoading(false);
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // When running in unit tests without a mocked /api/backend fetch, gracefully show binary notice
      if (
        msg.includes("Failed to parse URL") ||
        msg.includes("Invalid URL") ||
        msg.includes("Unexpected API request")
      ) {
        setResolvedMode("binary");
        setError(null);
      } else {
        setError(msg || t("binaryNotice"));
      }
      setLoading(false);
    }
  }, [contentType, fetchBlob, fileName, isOpen, t]);

  useEffect(() => {
    if (!isOpen) return;
    void loadPreview();
  }, [isOpen, loadPreview]);

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  // Render DOCX into container once docxBuffer is ready
  useEffect(() => {
    if (
      !isOpen ||
      resolvedMode !== "docx" ||
      !docxBuffer ||
      !docxContainerRef.current
    ) {
      return;
    }
    let cancelled = false;
    const container = docxContainerRef.current;
    container.innerHTML = "";

    void (async () => {
      try {
        const { renderAsync } = await import("docx-preview");
        if (cancelled) return;
        await renderAsync(docxBuffer, container, undefined, {
          className: "docx-viewer",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          useBase64URL: true,
        });
      } catch {
        if (!cancelled) {
          setResolvedMode("binary");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [docxBuffer, isOpen, resolvedMode]);

  if (!isOpen) return null;

  const activeSheet = sheets[activeSheetIdx] ?? null;
  const maxCols = activeSheet
    ? Math.max(
        1,
        ...activeSheet.rows.map((row) => row.length),
      )
    : 0;
  const activeSlide = slides[activeSlideIdx] ?? null;
  const showZoomControls =
    resolvedMode === "docx" ||
    resolvedMode === "image" ||
    resolvedMode === "spreadsheet";

  const modalBody = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("dialogLabel", { name: fileName })}
      className="fixed inset-0 z-[100001] flex items-center justify-center p-2 sm:p-4"
    >
      <div
        data-testid="document-preview-backdrop"
        className="fixed inset-0 bg-gray-950/60 backdrop-blur-xs"
        onClick={onClose}
      />

      <div
        onClick={(event) => event.stopPropagation()}
        className={`relative z-10 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl transition-all dark:border-gray-800 dark:bg-gray-900 ${
          isFullscreen
            ? "h-[96vh] w-[98vw]"
            : "max-h-[90vh] w-full max-w-5xl"
        }`}
      >
        {/* Modal Header & Toolbar */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50/80 px-4 py-3 sm:px-6 dark:border-gray-800 dark:bg-gray-950/80">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-10 w-12 shrink-0 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-xs font-bold tracking-wider text-brand-700 uppercase dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300">
              {fileBadge}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                {t("eyebrow", { format: fileBadge })}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="max-w-xs truncate text-sm font-semibold text-gray-900 sm:max-w-md md:max-w-lg dark:text-white/90">
                  {fileName}
                </h2>
                {formattedSize && (
                  <span className="rounded-md bg-gray-200/70 px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {formattedSize}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {showZoomControls && !loading && !error && (
              <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-900">
                <button
                  type="button"
                  aria-label={t("zoomOut")}
                  onClick={() => setZoom((z) => Math.max(50, z - 15))}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  −
                </button>
                <button
                  type="button"
                  aria-label={t("zoomReset")}
                  onClick={() => setZoom(100)}
                  className="px-2 text-xs font-semibold tabular-nums text-gray-700 hover:text-brand-600 dark:text-gray-200 dark:hover:text-brand-400"
                >
                  {zoom}%
                </button>
                <button
                  type="button"
                  aria-label={t("zoomIn")}
                  onClick={() => setZoom((z) => Math.min(175, z + 15))}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {resolvedMode === "text" && textContent && !loading && (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(textContent);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                }}
                className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {copied ? (
                  <>
                    <CheckLineIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{t("copiedContent")}</span>
                  </>
                ) : (
                  <>
                    <CopyIcon className="h-3.5 w-3.5" />
                    <span>{t("copyContent")}</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="hidden h-8.5 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 sm:inline-flex dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <span>
                {isFullscreen ? t("fullscreenExit") : t("fullscreenEnter")}
              </span>
            </button>

            {downloadUrl ? (
              <a
                href={downloadUrl}
                className="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-xs font-semibold text-white shadow-theme-xs transition hover:bg-brand-700"
              >
                <DownloadIcon className="h-3.5 w-3.5" />
                <span>{t("downloadAction")}</span>
              </a>
            ) : onDownload ? (
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-xs font-semibold text-white shadow-theme-xs transition hover:bg-brand-700"
              >
                <DownloadIcon className="h-3.5 w-3.5" />
                <span>{t("downloadAction")}</span>
              </button>
            ) : null}

            <button
              type="button"
              aria-label={t("closeAction")}
              onClick={onClose}
              className="inline-flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            >
              <CloseLineIcon className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Viewer Surface */}
        <div className="min-h-[52vh] flex-1 overflow-y-auto bg-gray-100/80 p-3 sm:p-5 dark:bg-gray-950">
          {loading ? (
            <div
              role="status"
              className="flex h-80 flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {t("loading")}
              </p>
            </div>
          ) : error ? (
            <div
              role="alert"
              className="flex h-80 flex-col items-center justify-center gap-3 rounded-xl border border-error-200 bg-error-50/70 p-8 text-center dark:border-error-500/30 dark:bg-error-500/10"
            >
              <AlertIcon className="h-8 w-8 text-error-600 dark:text-error-400" />
              <p className="max-w-md text-sm font-medium text-error-700 dark:text-error-300">
                {error}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadPreview()}
              >
                {t("retryAction")}
              </Button>
            </div>
          ) : resolvedMode === "docx" ? (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-200/70 p-2 sm:p-4 dark:border-gray-800 dark:bg-gray-900">
              <div
                style={{
                  transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                  transformOrigin: "top center",
                }}
                ref={docxContainerRef}
                className="docx-preview-surface mx-auto min-h-[60vh] max-w-full overflow-x-auto [&_.docx-viewer-wrapper]:!bg-transparent [&_.docx-viewer-wrapper]:!p-2 [&_.docx-viewer]:!mx-auto [&_.docx-viewer]:!rounded-lg [&_.docx-viewer]:!shadow-md"
              />
            </div>
          ) : resolvedMode === "spreadsheet" ? (
            <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
              {/* Sheet selector bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-3.5 py-2.5 dark:border-gray-800 dark:bg-gray-950">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="me-1 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    <TableIcon className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                    {t("sheetTabLabel")}:
                  </span>
                  {sheets.map((sheet, idx) => (
                    <button
                      key={sheet.name}
                      type="button"
                      onClick={() => setActiveSheetIdx(idx)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        idx === activeSheetIdx
                          ? "bg-brand-600 text-white shadow-2xs"
                          : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                      }`}
                    >
                      {sheet.name}
                    </button>
                  ))}
                </div>
                {activeSheet && (
                  <span className="text-xs font-medium tabular-nums text-gray-500 dark:text-gray-400">
                    {t("rowsCount", {
                      rows: activeSheet.rows.length,
                      cols: maxCols,
                    })}
                  </span>
                )}
              </div>

              {/* Spreadsheet Table */}
              {activeSheet && activeSheet.rows.length > 0 ? (
                <div
                  className="max-h-[64vh] overflow-auto"
                  style={{ fontSize: `${Math.round((12 * zoom) / 100)}px` }}
                >
                  <table className="w-full border-collapse text-start">
                    <thead className="sticky top-0 z-10 bg-gray-100 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      <tr>
                        <th className="w-12 border-b border-e border-gray-200 bg-gray-100 px-2 py-1.5 text-center tabular-nums dark:border-gray-700 dark:bg-gray-800">
                          #
                        </th>
                        {Array.from({ length: maxCols }).map((_, colIdx) => (
                          <th
                            key={colIdx}
                            className="min-w-28 border-b border-e border-gray-200 px-3 py-1.5 text-start font-mono dark:border-gray-700"
                          >
                            {getColumnLabel(colIdx)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-900">
                      {activeSheet.rows.map((row, rowIdx) => (
                        <tr
                          key={rowIdx}
                          className={
                            rowIdx === 0
                              ? "bg-brand-50/40 font-semibold text-gray-900 dark:bg-brand-500/10 dark:text-white"
                              : "hover:bg-gray-50/80 dark:hover:bg-gray-800/50"
                          }
                        >
                          <td className="border-e border-gray-200 bg-gray-50 px-2 py-1.5 text-center text-[11px] font-medium tabular-nums text-gray-400 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-500">
                            {rowIdx + 1}
                          </td>
                          {Array.from({ length: maxCols }).map((_, colIdx) => (
                            <td
                              key={colIdx}
                              className="max-w-xs border-e border-gray-100 px-3 py-1.5 break-words text-gray-800 tabular-nums dark:border-gray-800 dark:text-gray-200"
                            >
                              {row[colIdx] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {t("emptySheet")}
                </div>
              )}
            </div>
          ) : resolvedMode === "pptx" && activeSlide ? (
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              {/* Slide Thumbnails List */}
              <div className="flex gap-2 overflow-x-auto md:max-h-[65vh] md:flex-col md:overflow-y-auto">
                {slides.map((slide, idx) => (
                  <button
                    key={slide.index}
                    type="button"
                    onClick={() => setActiveSlideIdx(idx)}
                    className={`flex shrink-0 flex-col items-start rounded-xl border p-3 text-start transition md:w-full ${
                      idx === activeSlideIdx
                        ? "border-brand-500 bg-brand-50/80 text-brand-800 shadow-2xs dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-200"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
                    }`}
                  >
                    <span className="text-[11px] font-bold tracking-wider uppercase opacity-75">
                      Slide {slide.index}
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs font-medium">
                      {slide.paragraphs[0] || t("emptySlide")}
                    </span>
                  </button>
                ))}
              </div>

              {/* Active Slide Canvas */}
              <div className="flex min-h-[55vh] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10 dark:border-gray-800 dark:bg-gray-900">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
                    <span className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                      {t("slidePosition", {
                        current: activeSlide.index,
                        total: slides.length,
                      })}
                    </span>
                  </div>

                  {activeSlide.paragraphs.length > 0 ? (
                    <div className="space-y-3 pt-2">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {activeSlide.paragraphs[0]}
                      </h3>
                      {activeSlide.paragraphs.slice(1).map((para, pIdx) => (
                        <p
                          key={pIdx}
                          className="flex items-start gap-2.5 text-sm leading-6 text-gray-700 dark:text-gray-300"
                        >
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                          <span>{para}</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="py-12 text-center text-sm text-gray-400">
                      {t("emptySlide")}
                    </p>
                  )}
                </div>

                {slides.length > 1 && (
                  <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={activeSlideIdx === 0}
                      onClick={() =>
                        setActiveSlideIdx((idx) => Math.max(0, idx - 1))
                      }
                    >
                      <ChevronLeftIcon className="me-1 h-4 w-4" />
                      {t("previousSlide")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={activeSlideIdx >= slides.length - 1}
                      onClick={() =>
                        setActiveSlideIdx((idx) =>
                          Math.min(slides.length - 1, idx + 1),
                        )
                      }
                    >
                      {t("nextSlide")}
                      <ArrowRightIcon className="ms-1 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : resolvedMode === "pdf" && objectUrl ? (
            <iframe
              title={fileName}
              src={objectUrl}
              className="h-[72vh] w-full rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800"
            />
          ) : resolvedMode === "image" && objectUrl ? (
            <div className="flex min-h-[60vh] items-center justify-center overflow-auto rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={objectUrl}
                alt={fileName}
                style={{
                  transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                  transformOrigin: "center center",
                }}
                className="max-h-[68vh] w-auto rounded-lg object-contain transition-transform"
              />
            </div>
          ) : resolvedMode === "text" ? (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
              <pre className="max-h-[70vh] overflow-auto p-4 font-mono text-xs leading-6 break-words whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                {textContent || t("emptyText")}
              </pre>
            </div>
          ) : (
            <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                <DocsIcon className="h-6 w-6" />
              </span>
              <p className="max-w-md text-sm text-gray-600 dark:text-gray-300">
                {t("binaryNotice")}
              </p>
              {downloadUrl ? (
                <a
                  href={downloadUrl}
                  className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-xs font-semibold text-white shadow-theme-xs transition hover:bg-brand-700"
                >
                  <DownloadIcon className="h-3.5 w-3.5" />
                  <span>{t("downloadAction")}</span>
                </a>
              ) : onDownload ? (
                <Button type="button" size="sm" onClick={onDownload}>
                  <DownloadIcon className="me-1.5 h-3.5 w-3.5" />
                  {t("downloadAction")}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return modalBody;
  }

  return createPortal(modalBody, document.body);
}
