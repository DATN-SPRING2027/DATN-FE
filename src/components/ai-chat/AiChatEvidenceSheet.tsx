"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircleIcon,
  CheckLineIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CloseLineIcon,
  CopyIcon,
  DocsIcon,
  MaximizeIcon,
  MindMapIcon,
  MinimizeIcon,
  ShootingStarIcon,
} from "@/icons";
import type {
  AiChatCitation,
  AiChatProjectDocumentSources,
} from "@/lib/queries/ai-chat/ai-chat.types";
import { ApiError, apiClient } from "@/lib/api-client";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { registerSessionCacheCleanup } from "@/lib/session-cleanup";
import {
  workNotesApi,
  type DocumentKnowledgeChunk,
  type ProjectDocumentSummary,
  type TaskNote,
  type WorkReport,
} from "@/lib/queries/work-notes/useWorkNotes";
import { cn } from "@/utils";
import type { InspectedEvidence } from "./AiChatMessageList";
import {
  buildProjectCitationHref,
  isContinuumDocumentId,
  parseContinuumCitationTarget,
  type ContinuumCitationSourceKind,
} from "./citation-utils";
import {
  FormattedDocumentPassage,
  buildSmartHighlightRegex,
  normalizeHeadingForCompare,
  splitSectionBreadcrumbs,
} from "./evidence-markdown";

export type AiChatEvidenceSheetProps = Readonly<{
  evidence: InspectedEvidence | null;
  projectId: string;
  userId?: string;
  organizationId?: string;
  sessionPreviewText?: string;
  onClose: () => void;
}>;

const DRAWER_WIDTH_STORAGE_KEY = "continuum:ai-chat:evidence-drawer-width:v1";
const DEFAULT_DRAWER_WIDTH = 540;
const WIDE_DRAWER_WIDTH = 740;
const MIN_DRAWER_WIDTH = 420;
const MAX_DRAWER_WIDTH = 860;
const CACHE_TTL_MS = 60_000;
const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

type CachedEntry<T> = Readonly<{ data: T; expiresAt: number }>;
const projectDocsCache = new Map<
  string,
  CachedEntry<readonly ProjectDocumentSummary[]>
>();
const projectReportsCache = new Map<
  string,
  CachedEntry<readonly WorkReport[]>
>();
const projectNotesCache = new Map<
  string,
  CachedEntry<readonly TaskNote[]>
>();
const docChunksCache = new Map<
  string,
  CachedEntry<readonly DocumentKnowledgeChunk[]>
>();

function clearEvidenceSheetCaches(): void {
  projectDocsCache.clear();
  projectReportsCache.clear();
  projectNotesCache.clear();
  docChunksCache.clear();
}

registerSessionCacheCleanup(clearEvidenceSheetCaches);

export function resetEvidenceSheetCachesForTests(): void {
  clearEvidenceSheetCaches();
}

function buildSessionCachePrefix(
  userId: string,
  organizationId: string,
): string {
  return `${userId || "anon"}:${organizationId || "no-org"}`;
}

function acquireBodyScrollLock(): () => void {
  if (typeof document === "undefined") return () => {};
  const body = document.body;
  const currentCount =
    Number.parseInt(body.dataset.scrollLockCount ?? "0", 10) || 0;
  if (currentCount === 0) {
    body.dataset.scrollLockPrevOverflow = body.style.overflow;
    body.style.overflow = "hidden";
  }
  body.dataset.scrollLockCount = String(currentCount + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const count =
      Number.parseInt(body.dataset.scrollLockCount ?? "1", 10) || 1;
    const nextCount = Math.max(0, count - 1);
    if (nextCount === 0) {
      body.style.overflow = body.dataset.scrollLockPrevOverflow ?? "";
      delete body.dataset.scrollLockCount;
      delete body.dataset.scrollLockPrevOverflow;
    } else {
      body.dataset.scrollLockCount = String(nextCount);
    }
  };
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (el) =>
      !el.hasAttribute("disabled") &&
      el.getAttribute("aria-hidden") !== "true" &&
      el.tabIndex >= 0,
  );
}

function clampDrawerWidth(raw: number): number {
  const viewportCap =
    typeof window !== "undefined" && window.innerWidth >= 1024
      ? Math.max(MIN_DRAWER_WIDTH, Math.min(MAX_DRAWER_WIDTH, window.innerWidth - 320))
      : MAX_DRAWER_WIDTH;
  return Math.round(Math.min(viewportCap, Math.max(MIN_DRAWER_WIDTH, raw)));
}

function getDrawerWidthStorageKey(
  userId: string,
  organizationId: string,
): string {
  if (!userId && !organizationId) return DRAWER_WIDTH_STORAGE_KEY;
  return `continuum.aiChat.mindMap.evidenceWidth.${userId || "anon"}.${organizationId || "no-org"}`;
}

function readStoredDrawerWidth(storageKey: string): number {
  if (typeof window === "undefined") return DEFAULT_DRAWER_WIDTH;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_DRAWER_WIDTH;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return DEFAULT_DRAWER_WIDTH;
    return clampDrawerWidth(parsed);
  } catch {
    return DEFAULT_DRAWER_WIDTH;
  }
}

function writeStoredDrawerWidth(storageKey: string, width: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, String(width));
  } catch {
    // Ignore storage quota errors in restricted browsing modes.
  }
}

function prefersSmoothMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: no-preference)").matches
  );
}

function detectFileFormatBadge(name: string | undefined): string {
  if (!name) return "DOC";
  const lower = name.trim().toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "MD";
  if (lower.endsWith(".pdf")) return "PDF";
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) return "DOCX";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "XLSX";
  if (lower.endsWith(".csv")) return "CSV";
  if (lower.endsWith(".pptx") || lower.endsWith(".ppt")) return "PPTX";
  if (lower.endsWith(".json")) return "JSON";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "YAML";
  if (lower.endsWith(".txt")) return "TXT";
  return "DOC";
}

function matchBestDocumentSummary(
  docs: readonly ProjectDocumentSummary[],
  citation: AiChatCitation,
  allowFilenameFallback: boolean,
): string | null {
  const candidates = [citation.documentId, citation.sagDocumentId].filter(
    (id): id is string => Boolean(id),
  );
  for (const doc of docs) {
    if (
      doc.knowledgeSync?.sagDocumentId &&
      candidates.includes(doc.knowledgeSync.sagDocumentId)
    ) {
      return doc.id;
    }
  }
  if (!allowFilenameFallback) return null;
  const targetName = (citation.documentName ?? "").trim().toLowerCase();
  if (targetName) {
    const exactByFile = docs.find(
      (doc) =>
        doc.file?.name.trim().toLowerCase() === targetName ||
        doc.title.trim().toLowerCase() === targetName,
    );
    if (exactByFile) {
      return exactByFile.id;
    }
  }
  return null;
}

function matchBestWorkReportSummary(
  reports: readonly WorkReport[],
  citation: AiChatCitation,
  allowTitleFallback: boolean,
): string | null {
  const candidates = [citation.documentId, citation.sagDocumentId].filter(
    (id): id is string => Boolean(id),
  );
  for (const report of reports) {
    if (
      report.knowledgeSync?.sagDocumentId &&
      candidates.includes(report.knowledgeSync.sagDocumentId)
    ) {
      return report.id;
    }
  }
  if (!allowTitleFallback) return null;
  const targetName = (citation.documentName ?? "").trim().toLowerCase();
  if (targetName) {
    const exactMatch = reports.find(
      (report) =>
        report.file?.name.trim().toLowerCase() === targetName ||
        (report.title ?? "").trim().toLowerCase() === targetName,
    );
    if (exactMatch) {
      return exactMatch.id;
    }
  }
  return null;
}

function matchBestTaskNoteSummary(
  notes: readonly TaskNote[],
  citation: AiChatCitation,
  allowTitleFallback: boolean,
): string | null {
  const candidates = [citation.documentId, citation.sagDocumentId].filter(
    (id): id is string => Boolean(id),
  );
  for (const note of notes) {
    if (
      note.knowledgeSync?.sagDocumentId &&
      candidates.includes(note.knowledgeSync.sagDocumentId)
    ) {
      return note.id;
    }
  }
  if (!allowTitleFallback) return null;
  const targetName = (citation.documentName ?? "").trim().toLowerCase();
  if (targetName) {
    const exactMatch = notes.find(
      (note) =>
        note.file?.name.trim().toLowerCase() === targetName ||
        note.title.trim().toLowerCase() === targetName,
    );
    if (exactMatch) {
      return exactMatch.id;
    }
  }
  return null;
}

async function fetchKnowledgeChunksByKind(
  targetProjectId: string,
  entityId: string,
  sourceKind: ContinuumCitationSourceKind,
  signal: AbortSignal,
): Promise<readonly DocumentKnowledgeChunk[]> {
  if (sourceKind === "work_report") {
    const resp = await workNotesApi.getWorkReportKnowledgeChunks(
      targetProjectId,
      entityId,
      { limit: 100, signal },
    );
    return resp.items ?? [];
  }
  if (sourceKind === "work_note") {
    const resp = await workNotesApi.getTaskNoteKnowledgeChunks(
      targetProjectId,
      entityId,
      { limit: 100, signal },
    );
    return resp.items ?? [];
  }
  const resp = await workNotesApi.getDocumentKnowledgeChunks(
    targetProjectId,
    entityId,
    { limit: 100, signal },
  );
  return resp.items ?? [];
}

function matchBestKnowledgeChunk(
  chunks: readonly DocumentKnowledgeChunk[],
  citation: AiChatCitation,
): number {
  if (chunks.length === 0) return -1;

  if (citation.chunkId) {
    const byId = chunks.findIndex((c) => c.chunkId === citation.chunkId);
    if (byId !== -1) return byId;
  }

  const targetSection = normalizeHeadingForCompare(
    citation.sectionPath ?? citation.heading,
  );
  const normalizedSnippet = (citation.snippet ?? "")
    .replace(/\s+/g, " ")
    .replace(/…$/, "")
    .trim()
    .toLowerCase();
  const snippetProbe = normalizedSnippet.slice(0, 96);

  let bestIdx = -1;
  let bestScore = 0;

  for (let idx = 0; idx < chunks.length; idx += 1) {
    const chunk = chunks[idx]!;
    let score = 0;

    if (targetSection) {
      const chunkSec = normalizeHeadingForCompare(chunk.sectionPath);
      if (chunkSec === targetSection) {
        score += 40;
      } else if (
        chunkSec &&
        (chunkSec.includes(targetSection) || targetSection.includes(chunkSec))
      ) {
        score += 20;
      }
    }

    if (
      citation.pageFrom !== undefined &&
      chunk.pageFrom === citation.pageFrom
    ) {
      score += 6;
    }

    if (snippetProbe.length >= 16) {
      const flatChunk = chunk.content.replace(/\s+/g, " ").trim().toLowerCase();
      if (flatChunk.includes(snippetProbe)) {
        score += 60;
      } else {
        const probeWords = snippetProbe
          .split(" ")
          .filter((w) => w.length >= 4)
          .slice(0, 12);
        if (probeWords.length > 0) {
          let hits = 0;
          for (const word of probeWords) {
            if (flatChunk.includes(word)) hits += 1;
          }
          const ratio = hits / probeWords.length;
          if (ratio >= 0.65) {
            score += Math.round(ratio * 35);
          }
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }

  return bestScore >= 28 ? bestIdx : -1;
}

type HydratedCitationData = Readonly<{
  key: string;
  projectId: string | null;
  continuumDocId: string | null;
  sourceKind: ContinuumCitationSourceKind;
  matchedChunk: DocumentKnowledgeChunk | null;
  prevChunk: DocumentKnowledgeChunk | null;
  nextChunk: DocumentKnowledgeChunk | null;
}>;

type AiChatEvidenceSheetContentProps = AiChatEvidenceSheetProps &
  Readonly<{
    userId: string;
    organizationId: string;
  }>;

function AiChatEvidenceSheetContent({
  evidence,
  projectId,
  userId,
  organizationId,
  sessionPreviewText,
  onClose,
}: AiChatEvidenceSheetContentProps) {
  const t = useTranslations("AiChat");
  const closeTimerRef = useRef<number | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const drawerWidthStorageKey = getDrawerWidthStorageKey(
    userId,
    organizationId,
  );
  const [prevEvidence, setPrevEvidence] = useState(evidence);
  const [selectedCitationNum, setSelectedCitationNum] = useState<number | null>(
    evidence?.kind === "document" ? evidence.citation.number : null,
  );
  const [isClosing, setIsClosing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [highlightsEnabled, setHighlightsEnabled] = useState(true);
  const [expandedContextKey, setExpandedContextKey] = useState<{
    citationKey: string;
    showPrev: boolean;
    showNext: boolean;
  }>({ citationKey: "", showPrev: false, showNext: false });

  const [prevDrawerWidthKey, setPrevDrawerWidthKey] = useState(
    drawerWidthStorageKey,
  );
  const [drawerWidth, setDrawerWidth] = useState<number>(() =>
    readStoredDrawerWidth(drawerWidthStorageKey),
  );
  if (prevDrawerWidthKey !== drawerWidthStorageKey) {
    setPrevDrawerWidthKey(drawerWidthStorageKey);
    setDrawerWidth(readStoredDrawerWidth(drawerWidthStorageKey));
  }
  const [isDraggingWidth, setIsDraggingWidth] = useState(false);
  const [hydrated, setHydrated] = useState<HydratedCitationData | null>(null);

  if (prevEvidence !== evidence) {
    setPrevEvidence(evidence);
    setIsClosing(false);
    setCopiedKey(null);
    setSelectedCitationNum(
      evidence?.kind === "document" ? evidence.citation.number : null,
    );
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
      dragCleanupRef.current?.();
    };
  }, []);

  const handleRequestClose = useCallback(() => {
    if (!prefersSmoothMotion()) {
      onClose();
      return;
    }
    if (isClosing) return;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
    }, 165);
  }, [isClosing, onClose]);

  const isSheetOpen = Boolean(evidence);

  useEffect(() => {
    if (!isSheetOpen) return;
    const releaseScrollLock = acquireBodyScrollLock();
    const prevActive =
      typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    previousFocusRef.current = prevActive;

    const dialogEl = dialogRef.current;
    if (
      dialogEl &&
      (!document.activeElement || !dialogEl.contains(document.activeElement))
    ) {
      const focusables = getFocusableElements(dialogEl);
      (focusables[0] ?? dialogEl).focus();
    }

    return () => {
      releaseScrollLock();
      const toRestore = previousFocusRef.current;
      previousFocusRef.current = null;
      if (toRestore && toRestore.isConnected) {
        toRestore.focus();
      }
    };
  }, [isSheetOpen]);

  useEffect(() => {
    if (!isSheetOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        handleRequestClose();
        return;
      }
      if (event.key === "Tab") {
        const dialogEl = dialogRef.current;
        if (!dialogEl) return;
        const focusables = getFocusableElements(dialogEl);
        if (focusables.length === 0) {
          event.preventDefault();
          dialogEl.focus();
          return;
        }
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        const active = document.activeElement;
        if (event.shiftKey) {
          if (active === first || active === dialogEl || !dialogEl.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else if (active === last || !dialogEl.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleRequestClose, isSheetOpen]);

  const activeDocumentCitation: AiChatCitation | null = useMemo(() => {
    if (!evidence || evidence.kind !== "document") return null;
    if (
      evidence.relatedCitations &&
      evidence.relatedCitations.length > 0 &&
      selectedCitationNum !== null
    ) {
      return (
        evidence.relatedCitations.find(
          (item) => item.number === selectedCitationNum,
        ) ?? evidence.citation
      );
    }
    return evidence.citation;
  }, [evidence, selectedCitationNum]);

  const parsedCitationTarget = useMemo(
    () => parseContinuumCitationTarget(activeDocumentCitation),
    [activeDocumentCitation],
  );

  const sessionCachePrefix = buildSessionCachePrefix(userId, organizationId);

  const activeCitationLookupKey = activeDocumentCitation
    ? `${sessionCachePrefix}:${projectId}:${activeDocumentCitation.projectId ?? ""}:${activeDocumentCitation.documentId}:${activeDocumentCitation.chunkId ?? ""}:${activeDocumentCitation.number}`
    : "";

  // Hydrate full unflattened canonical chunk & Continuum entity ID for authorized project artifacts
  useEffect(() => {
    if (!activeDocumentCitation) {
      return;
    }
    const directProjectId =
      activeDocumentCitation.projectId &&
      isContinuumDocumentId(activeDocumentCitation.projectId)
        ? activeDocumentCitation.projectId
        : isContinuumDocumentId(projectId)
          ? projectId
          : null;

    if (!directProjectId && projectId !== "all") {
      return;
    }

    const controller = new AbortController();
    const lookupKey = activeCitationLookupKey;
    const initialTarget = parseContinuumCitationTarget(activeDocumentCitation);

    const runHydration = async () => {
      let targetProjectId: string | null = directProjectId;
      let resolvedDocId: string | null = initialTarget.entityId;
      let resolvedKind: ContinuumCitationSourceKind = initialTarget.sourceKind;

      if (!targetProjectId && projectId === "all") {
        // The catalog exposes Continuum artifact IDs. A legacy SAG UUID alone
        // cannot identify which Project owns the cited artifact.
        if (!resolvedDocId) return;
        let totalPages = 1;
        for (let page = 1; page <= totalPages; page += 1) {
          const result = await apiClient<AiChatProjectDocumentSources>(
            `/ai-chat/projects/all/document-sources?page=${page}&pageSize=100`,
            { signal: controller.signal, cache: "no-store" },
          );
          if (controller.signal.aborted) return;
          const match = result.data.find((source) => {
            if (!isContinuumDocumentId(source.projectId)) return false;
            if (source.documentId === resolvedDocId) return true;
            const parsedSource = parseContinuumCitationTarget({
              documentId: source.documentId,
            });
            return parsedSource.entityId === resolvedDocId;
          });
          if (match?.projectId) {
            targetProjectId = match.projectId;
            break;
          }
          totalPages = Math.min(result.pagination.totalPages, 5);
        }
      }

      if (!targetProjectId || !isContinuumDocumentId(targetProjectId)) {
        return;
      }

      const projectListCacheKey = `${sessionCachePrefix}:${targetProjectId}`;
      const allowNameFallback = projectId !== "all";

      if (!resolvedDocId) {
        const lookupOrder: readonly ContinuumCitationSourceKind[] =
          resolvedKind === "work_report"
            ? ["work_report", "project_document", "work_note"]
            : resolvedKind === "work_note"
              ? ["work_note", "project_document", "work_report"]
              : ["project_document", "work_report", "work_note"];

        for (const candidateKind of lookupOrder) {
          if (controller.signal.aborted) return;
          const now = Date.now();
          if (candidateKind === "project_document") {
            const cachedDocs = projectDocsCache.get(projectListCacheKey);
            let docs: readonly ProjectDocumentSummary[] = [];
            if (cachedDocs && cachedDocs.expiresAt > now) {
              docs = cachedDocs.data;
            } else {
              const page = await workNotesApi
                .listDocuments(targetProjectId, "APPROVED", 1, controller.signal)
                .catch(() => ({ data: [] as readonly ProjectDocumentSummary[] }));
              docs = page.data ?? [];
              projectDocsCache.set(projectListCacheKey, {
                data: docs,
                expiresAt: Date.now() + CACHE_TTL_MS,
              });
            }
            const matched = matchBestDocumentSummary(
              docs,
              activeDocumentCitation,
              allowNameFallback,
            );
            if (matched) {
              resolvedDocId = matched;
              resolvedKind = "project_document";
              break;
            }
          } else if (candidateKind === "work_report") {
            const cachedReports = projectReportsCache.get(projectListCacheKey);
            let reports: readonly WorkReport[] = [];
            if (cachedReports && cachedReports.expiresAt > now) {
              reports = cachedReports.data;
            } else {
              const page = await workNotesApi
                .listReports(targetProjectId, "APPROVED", 1, controller.signal)
                .catch(() => ({ data: [] as readonly WorkReport[] }));
              reports = page.data ?? [];
              projectReportsCache.set(projectListCacheKey, {
                data: reports,
                expiresAt: Date.now() + CACHE_TTL_MS,
              });
            }
            const matched = matchBestWorkReportSummary(
              reports,
              activeDocumentCitation,
              allowNameFallback,
            );
            if (matched) {
              resolvedDocId = matched;
              resolvedKind = "work_report";
              break;
            }
          } else {
            const cachedNotes = projectNotesCache.get(projectListCacheKey);
            let notes: readonly TaskNote[] = [];
            if (cachedNotes && cachedNotes.expiresAt > now) {
              notes = cachedNotes.data;
            } else {
              const page = await workNotesApi
                .listProjectTaskNotes(
                  targetProjectId,
                  1,
                  controller.signal,
                  "APPROVED",
                )
                .catch(() => ({ data: [] as readonly TaskNote[] }));
              notes = page.data ?? [];
              projectNotesCache.set(projectListCacheKey, {
                data: notes,
                expiresAt: Date.now() + CACHE_TTL_MS,
              });
            }
            const matched = matchBestTaskNoteSummary(
              notes,
              activeDocumentCitation,
              allowNameFallback,
            );
            if (matched) {
              resolvedDocId = matched;
              resolvedKind = "work_note";
              break;
            }
          }
        }
      }

      if (!resolvedDocId || !isContinuumDocumentId(resolvedDocId)) {
        return;
      }

      const chunkCacheKey = `${sessionCachePrefix}:${targetProjectId}:${resolvedKind}:${resolvedDocId}`;
      const cachedChunks = docChunksCache.get(chunkCacheKey);
      let chunks: readonly DocumentKnowledgeChunk[] = [];
      if (cachedChunks && cachedChunks.expiresAt > Date.now()) {
        chunks = cachedChunks.data;
      } else {
        try {
          chunks = await fetchKnowledgeChunksByKind(
            targetProjectId,
            resolvedDocId,
            resolvedKind,
            controller.signal,
          );
          docChunksCache.set(chunkCacheKey, {
            data: chunks,
            expiresAt: Date.now() + CACHE_TTL_MS,
          });
        } catch (error) {
          if (
            controller.signal.aborted ||
            initialTarget.hasExplicitKind ||
            resolvedKind !== "project_document" ||
            !(error instanceof ApiError && error.status === 404)
          ) {
            throw error;
          }
          // When SAG omitted explicit sourceKind for a 24-hex work_report/work_note ID,
          // fall back gracefully to work-report and work-note chunk endpoints.
          let recovered = false;
          for (const fallbackKind of [
            "work_report",
            "work_note",
          ] as const) {
            if (controller.signal.aborted) return;
            try {
              const fallbackChunks = await fetchKnowledgeChunksByKind(
                targetProjectId,
                resolvedDocId,
                fallbackKind,
                controller.signal,
              );
              resolvedKind = fallbackKind;
              chunks = fallbackChunks;
              docChunksCache.set(
                `${sessionCachePrefix}:${targetProjectId}:${fallbackKind}:${resolvedDocId}`,
                {
                  data: chunks,
                  expiresAt: Date.now() + CACHE_TTL_MS,
                },
              );
              recovered = true;
              break;
            } catch {
              // Continue to next artifact kind fallback.
            }
          }
          if (!recovered) {
            throw error;
          }
        }
      }
      if (controller.signal.aborted) return;

      const matchedIdx = matchBestKnowledgeChunk(chunks, activeDocumentCitation);
      setHydrated({
        key: lookupKey,
        projectId: targetProjectId,
        continuumDocId: resolvedDocId,
        sourceKind: resolvedKind,
        matchedChunk: matchedIdx >= 0 ? (chunks[matchedIdx] ?? null) : null,
        prevChunk: matchedIdx > 0 ? (chunks[matchedIdx - 1] ?? null) : null,
        nextChunk:
          matchedIdx >= 0 && matchedIdx + 1 < chunks.length
            ? (chunks[matchedIdx + 1] ?? null)
            : null,
      });
    };

    void runHydration().catch(() => {
      // Fall back gracefully to inline citation snippet when offline or restricted.
    });

    return () => {
      controller.abort();
    };
  }, [activeCitationLookupKey, activeDocumentCitation, projectId, sessionCachePrefix]);

  const currentHydrated =
    hydrated && hydrated.key === activeCitationLookupKey ? hydrated : null;

  const resolvedProjectId = useMemo(() => {
    if (!activeDocumentCitation) return null;
    if (
      activeDocumentCitation.projectId &&
      isContinuumDocumentId(activeDocumentCitation.projectId)
    ) {
      return activeDocumentCitation.projectId;
    }
    if (
      currentHydrated?.projectId &&
      isContinuumDocumentId(currentHydrated.projectId)
    ) {
      return currentHydrated.projectId;
    }
    if (projectId && projectId !== "all") {
      return projectId;
    }
    return null;
  }, [activeDocumentCitation, currentHydrated, projectId]);

  const resolvedContinuumDocId = useMemo(() => {
    if (!activeDocumentCitation) return null;
    if (parsedCitationTarget.entityId) {
      return parsedCitationTarget.entityId;
    }
    return currentHydrated?.continuumDocId ?? null;
  }, [activeDocumentCitation, currentHydrated, parsedCitationTarget.entityId]);

  const resolvedSourceKind: ContinuumCitationSourceKind =
    currentHydrated?.sourceKind ?? parsedCitationTarget.sourceKind;

  const effectivePassageText =
    currentHydrated?.matchedChunk?.content ||
    activeDocumentCitation?.snippet ||
    "";

  const effectiveHeading =
    activeDocumentCitation?.heading ??
    activeDocumentCitation?.sectionPath ??
    currentHydrated?.matchedChunk?.sectionPath;

  const sectionBreadcrumbs = useMemo(() => {
    if (!effectiveHeading) return [];
    return splitSectionBreadcrumbs(effectiveHeading);
  }, [effectiveHeading]);

  const baseHighlightRegex = useMemo(() => {
    if (!evidence || evidence.kind !== "document") return null;
    return buildSmartHighlightRegex(evidence.focusTerms, effectiveHeading);
  }, [effectiveHeading, evidence]);

  const activeHighlightRegex = highlightsEnabled ? baseHighlightRegex : null;

  const copyPayload =
    evidence?.kind === "document"
      ? effectivePassageText
      : (sessionPreviewText ?? "");
  const activeCopyId =
    evidence?.kind === "document"
      ? `doc-${activeDocumentCitation?.number ?? 0}`
      : `sess-${evidence?.sessionCitation.ref ?? ""}`;
  const isCopied = copiedKey === activeCopyId;

  const handleCopyExcerpt = useCallback(async () => {
    if (!copyPayload || !navigator?.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(copyPayload);
      setCopiedKey(activeCopyId);
    } catch {
      // Clipboard blocked in restricted context; ignore silently.
    }
  }, [activeCopyId, copyPayload]);

  const applyDrawerWidth = useCallback(
    (nextWidth: number) => {
      const clamped = clampDrawerWidth(nextWidth);
      setDrawerWidth(clamped);
      writeStoredDrawerWidth(drawerWidthStorageKey, clamped);
    },
    [drawerWidthStorageKey],
  );

  const handleStartResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      dragCleanupRef.current?.();

      const startX = event.clientX;
      const startWidth = drawerWidth;
      const isRtl =
        typeof document !== "undefined" && document.dir === "rtl";

      setIsDraggingWidth(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onPointerMove = (moveEvent: PointerEvent) => {
        const delta = isRtl
          ? moveEvent.clientX - startX
          : startX - moveEvent.clientX;
        const clamped = clampDrawerWidth(startWidth + delta);
        setDrawerWidth(clamped);
        writeStoredDrawerWidth(drawerWidthStorageKey, clamped);
      };

      const cleanup = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", cleanup);
        window.removeEventListener("pointercancel", cleanup);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setIsDraggingWidth(false);
        dragCleanupRef.current = null;
      };

      dragCleanupRef.current = cleanup;
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", cleanup);
      window.addEventListener("pointercancel", cleanup);
    },
    [drawerWidth, drawerWidthStorageKey],
  );

  const handleResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const isRtl =
        typeof document !== "undefined" && document.dir === "rtl";
      const step = event.shiftKey ? 48 : 24;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        applyDrawerWidth(drawerWidth + (isRtl ? -step : step));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        applyDrawerWidth(drawerWidth + (isRtl ? step : -step));
      } else if (event.key === "Home") {
        event.preventDefault();
        applyDrawerWidth(MIN_DRAWER_WIDTH);
      } else if (event.key === "End") {
        event.preventDefault();
        applyDrawerWidth(MAX_DRAWER_WIDTH);
      }
    },
    [applyDrawerWidth, drawerWidth],
  );

  if (!evidence) {
    return null;
  }

  const relatedCitations =
    evidence.kind === "document" ? (evidence.relatedCitations ?? []) : [];
  const leafHeading =
    sectionBreadcrumbs.length > 0
      ? sectionBreadcrumbs[sectionBreadcrumbs.length - 1]
      : undefined;
  const parentBreadcrumbs =
    sectionBreadcrumbs.length > 1 ? sectionBreadcrumbs.slice(0, -1) : [];

  const effectiveWideTarget = clampDrawerWidth(WIDE_DRAWER_WIDTH);
  const isWideMode =
    effectiveWideTarget > DEFAULT_DRAWER_WIDTH &&
    drawerWidth >= effectiveWideTarget - 16;
  const drawerStyle = {
    "--evidence-drawer-width": `${drawerWidth}px`,
  } as CSSProperties;

  const showPrevContext =
    expandedContextKey.citationKey === activeCitationLookupKey &&
    expandedContextKey.showPrev;
  const showNextContext =
    expandedContextKey.citationKey === activeCitationLookupKey &&
    expandedContextKey.showNext;

  const documentDisplayTitle =
    evidence.kind === "document" && activeDocumentCitation
      ? (activeDocumentCitation.documentName ??
        activeDocumentCitation.sourceName ??
        activeDocumentCitation.documentId)
      : evidence.kind === "session"
        ? evidence.sessionCitation.source === "selected_group"
          ? t("sessionSelectedGroup")
          : t("sessionRecentContinuity")
        : "";

  const formatBadge =
    evidence.kind === "document"
      ? detectFileFormatBadge(activeDocumentCitation?.documentName)
      : null;

  return (
    <div className="fixed inset-0 z-999999 flex items-end justify-center lg:items-stretch lg:justify-end">
      {/* Subtle scrim: soft blur on mobile bottom-sheet; clear non-blur scrim on desktop so Chat/MindMap remain readable side-by-side */}
      <button
        type="button"
        aria-label={t("closeDialog")}
        onClick={handleRequestClose}
        className={cn(
          "fixed inset-0 bg-gray-950/40 backdrop-blur-[3px] dark:bg-gray-950/60 lg:bg-gray-950/12 lg:backdrop-blur-none dark:lg:bg-gray-950/35",
          isClosing ? "continuum-backdrop-exit" : "continuum-backdrop-enter",
        )}
      />

      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t("citationDialogAriaLabel")}
        data-testid="ai-chat-evidence-sheet"
        data-dragging={isDraggingWidth ? "true" : undefined}
        style={drawerStyle}
        className={cn(
          "continuum-evidence-drawer relative z-10 flex w-full flex-col overflow-hidden rounded-t-3xl border border-gray-200/90 bg-white shadow-theme-xl focus:outline-none lg:rounded-none lg:border-y-0 lg:border-e-0 lg:border-s dark:border-white/12 dark:bg-gpt-popover",
          isClosing
            ? "continuum-evidence-exit"
            : "continuum-evidence-enter",
        )}
      >
        {/* Desktop Interactive Left-Edge Drag Resize Handle */}
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label={t("evidenceResizeAriaLabel")}
          aria-valuemin={MIN_DRAWER_WIDTH}
          aria-valuemax={MAX_DRAWER_WIDTH}
          aria-valuenow={drawerWidth}
          data-testid="evidence-resize-handle"
          onPointerDown={handleStartResize}
          onDoubleClick={() => applyDrawerWidth(DEFAULT_DRAWER_WIDTH)}
          onKeyDown={handleResizeKeyDown}
          className="group absolute inset-y-0 start-0 z-20 hidden w-3 cursor-col-resize items-center justify-center focus-visible:outline-none lg:flex"
        >
          <span
            aria-hidden="true"
            className={cn(
              "h-14 w-1 rounded-full transition-all duration-150",
              isDraggingWidth
                ? "bg-brand-500 scale-y-110"
                : "bg-gray-300/75 group-hover:bg-brand-400 group-focus-visible:bg-brand-500 dark:bg-white/15 dark:group-hover:bg-brand-400",
            )}
          />
        </div>

        {/* Mobile Bottom-Sheet Pull Pill (Hidden on Desktop Drawer) */}
        <div
          aria-hidden="true"
          className="flex shrink-0 justify-center pt-2.5 pb-1 lg:hidden"
        >
          <span className="h-1 w-10 rounded-full bg-gray-300/85 dark:bg-white/18" />
        </div>

        {/* Top Studio Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200/80 px-5 py-3.5 dark:border-white/10">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              className={cn(
                "inline-flex h-7 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-bold ring-1 tabular-nums",
                evidence.kind === "document"
                  ? "bg-brand-50 text-brand-700 ring-brand-200/80 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-400/30"
                  : "bg-warning-50 text-warning-800 ring-warning-200/80 dark:bg-warning-500/20 dark:text-warning-300 dark:ring-warning-400/30",
              )}
            >
              [
              {evidence.kind === "document" && activeDocumentCitation
                ? activeDocumentCitation.number
                : evidence.kind === "session"
                  ? evidence.sessionCitation.ref
                  : ""}
              ]
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <h3
                  title={documentDisplayTitle}
                  className="truncate text-sm font-bold text-gray-950 sm:text-base dark:text-white"
                >
                  {documentDisplayTitle}
                </h3>
                {formatBadge && (
                  <span className="font-mono hidden shrink-0 rounded-md border border-gray-200/90 bg-gray-100/90 px-1.5 py-0.5 text-xs font-semibold text-gray-600 sm:inline-flex dark:border-white/12 dark:bg-white/8 dark:text-gray-300">
                    {formatBadge}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              data-testid="evidence-width-toggle"
              onClick={() =>
                applyDrawerWidth(
                  isWideMode ? DEFAULT_DRAWER_WIDTH : WIDE_DRAWER_WIDTH,
                )
              }
              aria-label={
                isWideMode
                  ? t("evidenceRestoreWidthAria")
                  : t("evidenceExpandWidthAria")
              }
              title={
                isWideMode
                  ? t("evidenceRestoreWidthAria")
                  : t("evidenceExpandWidthAria")
              }
              className="hidden size-8 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 lg:inline-flex dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {isWideMode ? (
                <MinimizeIcon aria-hidden="true" className="size-4" />
              ) : (
                <MaximizeIcon aria-hidden="true" className="size-4" />
              )}
            </button>

            <button
              type="button"
              onClick={handleRequestClose}
              aria-label={t("closeDialog")}
              className="inline-flex size-8 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <CloseLineIcon aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>

        {/* Multi-Source Switcher Strip (shown whenever 2+ citations are available) */}
        {relatedCitations.length > 1 && (
          <div
            role="tablist"
            aria-label={t("evidenceSourceSwitcherAria")}
            className="custom-scrollbar flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-gray-200/70 bg-gray-50/75 px-5 py-2 dark:border-white/10 dark:bg-gpt-sidebar/60"
          >
            {relatedCitations.map((item) => {
              const isSelected = activeDocumentCitation?.number === item.number;
              const shortTitle =
                item.documentName ?? item.sourceName ?? item.documentId;
              return (
                <button
                  key={item.number}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  data-testid={`evidence-tab-${item.number}`}
                  onClick={() => setSelectedCitationNum(item.number)}
                  className={cn(
                    "inline-flex max-w-52 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-all tabular-nums",
                    isSelected
                      ? "border-brand-300 bg-white text-brand-700 shadow-theme-xs dark:border-brand-400/45 dark:bg-brand-500/20 dark:text-brand-200"
                      : "border-transparent bg-transparent text-gray-600 hover:border-gray-200 hover:bg-white/80 hover:text-gray-900 dark:text-gray-400 dark:hover:border-white/10 dark:hover:bg-white/8 dark:hover:text-white",
                  )}
                >
                  <span className="font-bold">[{item.number}]</span>
                  <span className="truncate font-medium">{shortTitle}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Compact Single-Line Reader Toolbar */}
        {evidence.kind === "document" && activeDocumentCitation && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-white px-5 py-2 text-xs tabular-nums dark:border-white/8 dark:bg-gpt-popover">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-gray-600 dark:text-gray-300">
              <span className="inline-flex items-center gap-1 font-semibold text-success-700 dark:text-success-400">
                <CheckCircleIcon aria-hidden="true" className="size-3.5" />
                <span>{t("evidenceVerifiedBadge")}</span>
              </span>

              {activeDocumentCitation.versionNo !== undefined && (
                <>
                  <span aria-hidden="true" className="text-gray-300 dark:text-white/20">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium">
                    <DocsIcon aria-hidden="true" className="size-3 text-gray-400" />
                    <span>
                      {t("versionBadge", {
                        version: activeDocumentCitation.versionNo,
                      })}
                    </span>
                  </span>
                </>
              )}

              {activeDocumentCitation.pageFrom && (
                <>
                  <span aria-hidden="true" className="text-gray-300 dark:text-white/20">
                    ·
                  </span>
                  <span className="font-medium">
                    {activeDocumentCitation.pageTo &&
                    activeDocumentCitation.pageTo !==
                      activeDocumentCitation.pageFrom
                      ? t("pageRangeLabel", {
                          from: activeDocumentCitation.pageFrom,
                          to: activeDocumentCitation.pageTo,
                        })
                      : t("pageSingleLabel", {
                          page: activeDocumentCitation.pageFrom,
                        })}
                  </span>
                </>
              )}

              {currentHydrated?.matchedChunk && (
                <>
                  <span aria-hidden="true" className="text-gray-300 dark:text-white/20">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-brand-700 dark:text-brand-300">
                    <BookOpenIcon aria-hidden="true" className="size-3.5" />
                    <span>
                      {t("evidenceFullChunkBadge", {
                        ordinal: currentHydrated.matchedChunk.ordinal + 1,
                      })}
                    </span>
                  </span>
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {baseHighlightRegex && (
                <button
                  type="button"
                  data-testid="evidence-toggle-highlight"
                  aria-pressed={highlightsEnabled}
                  aria-label={t("evidenceHighlightToggleAria")}
                  onClick={() => setHighlightsEnabled((prev) => !prev)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors",
                    highlightsEnabled
                      ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200/90 hover:bg-amber-100/80 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/30"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white",
                  )}
                >
                  <ShootingStarIcon aria-hidden="true" className="size-3" />
                  <span>{t("evidenceHighlightToggle")}</span>
                </button>
              )}

              {effectivePassageText && (
                <button
                  type="button"
                  data-testid="evidence-copy-excerpt"
                  onClick={() => void handleCopyExcerpt()}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  {isCopied ? (
                    <>
                      <CheckLineIcon
                        aria-hidden="true"
                        className="size-3.5 text-success-600 dark:text-success-400"
                      />
                      <span className="font-semibold text-success-700 dark:text-success-300">
                        {t("evidenceCopiedExcerpt")}
                      </span>
                    </>
                  ) : (
                    <>
                      <CopyIcon aria-hidden="true" className="size-3.5" />
                      <span>{t("evidenceCopyExcerpt")}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Scrollable Document Page Reader Body */}
        {evidence.kind === "document" && activeDocumentCitation ? (
          <div
            key={activeDocumentCitation.number}
            className="custom-scrollbar continuum-stagger-1 min-h-0 flex-1 overflow-y-auto bg-gray-50/75 px-4 py-4 sm:px-5 sm:py-5 dark:bg-gpt-canvas/60"
          >
            {/* Previous Passage Expandable Context */}
            {currentHydrated?.prevChunk && (
              <div className="mb-3">
                <button
                  type="button"
                  data-testid="evidence-prev-chunk-toggle"
                  onClick={() =>
                    setExpandedContextKey((prev) => ({
                      citationKey: activeCitationLookupKey,
                      showPrev:
                        prev.citationKey === activeCitationLookupKey
                          ? !prev.showPrev
                          : true,
                      showNext:
                        prev.citationKey === activeCitationLookupKey
                          ? prev.showNext
                          : false,
                    }))
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200/80 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-theme-xs transition-colors hover:border-gray-300 hover:text-gray-900 dark:border-white/10 dark:bg-gpt-sidebar dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <ChevronUpIcon aria-hidden="true" className="size-3.5" />
                  <span>
                    {showPrevContext
                      ? t("evidenceHidePrevChunk")
                      : t("evidenceShowPrevChunk")}
                  </span>
                </button>

                {showPrevContext && (
                  <div className="continuum-accordion-open mt-2 rounded-2xl border border-dashed border-gray-300/90 bg-white/80 p-4 opacity-90 dark:border-white/15 dark:bg-gpt-sidebar/70">
                    {currentHydrated.prevChunk.sectionPath && (
                      <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {currentHydrated.prevChunk.sectionPath}
                      </p>
                    )}
                    <FormattedDocumentPassage
                      text={currentHydrated.prevChunk.content}
                      highlightRegex={null}
                      leafHeading={
                        splitSectionBreadcrumbs(
                          currentHydrated.prevChunk.sectionPath,
                        ).at(-1)
                      }
                      diagramBadgeLabel={t("evidenceDiagramBadge")}
                      codeBadgeLabel={t("evidenceCodeBadge")}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Main Verified Document Sheet (Single Clean Paper Card — Zero Nested Clutter) */}
            <article className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs dark:border-white/10 dark:bg-gpt-sidebar/95">
              {/*Unified Section Header inside the Document Sheet (Never duplicated below) */}
              {leafHeading && (
                <header className="mb-4 border-b border-gray-100 pb-3.5 dark:border-white/10">
                  {parentBreadcrumbs.length > 0 && (
                    <div className="mb-1 flex flex-wrap items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {parentBreadcrumbs.map((crumb, idx) => (
                        <span
                          key={`${crumb}-${idx}`}
                          className="inline-flex max-w-full items-center gap-1"
                        >
                          {idx > 0 && (
                            <ChevronRightIcon
                              aria-hidden="true"
                              className="size-3.5 shrink-0 text-gray-400 rtl:rotate-180"
                            />
                          )}
                          <span className="truncate">{crumb}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <h4 className="text-sm font-bold leading-snug text-gray-950 sm:text-base dark:text-white">
                    {leafHeading}
                  </h4>
                </header>
              )}

              {effectivePassageText ? (
                <FormattedDocumentPassage
                  text={effectivePassageText}
                  highlightRegex={activeHighlightRegex}
                  leafHeading={leafHeading}
                  sectionBreadcrumbs={sectionBreadcrumbs}
                  diagramBadgeLabel={t("evidenceDiagramBadge")}
                  codeBadgeLabel={t("evidenceCodeBadge")}
                />
              ) : (
                <p className="text-xs text-gray-500 italic dark:text-gray-400">
                  {t("excerptNoSnippet")}
                </p>
              )}
            </article>

            {/* Next Passage Expandable Context */}
            {currentHydrated?.nextChunk && (
              <div className="mt-3">
                <button
                  type="button"
                  data-testid="evidence-next-chunk-toggle"
                  onClick={() =>
                    setExpandedContextKey((prev) => ({
                      citationKey: activeCitationLookupKey,
                      showPrev:
                        prev.citationKey === activeCitationLookupKey
                          ? prev.showPrev
                          : false,
                      showNext:
                        prev.citationKey === activeCitationLookupKey
                          ? !prev.showNext
                          : true,
                    }))
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200/80 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-theme-xs transition-colors hover:border-gray-300 hover:text-gray-900 dark:border-white/10 dark:bg-gpt-sidebar dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <ChevronDownIcon aria-hidden="true" className="size-3.5" />
                  <span>
                    {showNextContext
                      ? t("evidenceHideNextChunk")
                      : t("evidenceShowNextChunk")}
                  </span>
                </button>

                {showNextContext && (
                  <div className="continuum-accordion-open mt-2 rounded-2xl border border-dashed border-gray-300/90 bg-white/80 p-4 opacity-90 dark:border-white/15 dark:bg-gpt-sidebar/70">
                    {currentHydrated.nextChunk.sectionPath && (
                      <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {currentHydrated.nextChunk.sectionPath}
                      </p>
                    )}
                    <FormattedDocumentPassage
                      text={currentHydrated.nextChunk.content}
                      highlightRegex={null}
                      leafHeading={
                        splitSectionBreadcrumbs(
                          currentHydrated.nextChunk.sectionPath,
                        ).at(-1)
                      }
                      diagramBadgeLabel={t("evidenceDiagramBadge")}
                      codeBadgeLabel={t("evidenceCodeBadge")}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : evidence.kind === "session" ? (
          <div className="custom-scrollbar continuum-stagger-1 min-h-0 flex-1 space-y-3.5 overflow-y-auto bg-gray-50/75 px-5 py-5 text-xs dark:bg-gpt-canvas/60">
            <article className="rounded-2xl border border-warning-300/60 border-s-4 border-s-warning-500 bg-white p-4 text-xs leading-relaxed break-words whitespace-pre-wrap text-gray-800 shadow-theme-xs sm:text-sm dark:border-warning-500/25 dark:border-s-warning-400 dark:bg-gpt-sidebar dark:text-gray-200">
              {sessionPreviewText}
            </article>

            {evidence.sessionCitation.turnIds.length > 0 && (
              <div className="rounded-xl border border-gray-200/80 bg-white px-4 py-3 dark:border-white/10 dark:bg-gpt-sidebar">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {t("turnReferenceIdsLabel")}
                </p>
                <p className="font-mono mt-1 text-xs text-gray-700 dark:text-gray-300">
                  {evidence.sessionCitation.turnIds.join(", ")}
                </p>
              </div>
            )}
          </div>
        ) : null}

        {/* Clean Footer Bar */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200/80 bg-white px-5 py-3 dark:border-white/10 dark:bg-gpt-popover">
          <div className="min-w-0 flex-1">
            {evidence.kind === "document" && evidence.focusLabel && (
              <span className="hidden max-w-full items-center gap-1.5 rounded-full bg-brand-50/90 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200/70 sm:inline-flex dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-400/25">
                <MindMapIcon aria-hidden="true" className="size-3 shrink-0" />
                <span className="truncate">
                  {t("evidenceFocusContextLabel", {
                    label: evidence.focusLabel,
                  })}
                </span>
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleRequestClose}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-gray-200 bg-white px-3.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-white/12 dark:bg-gpt-sidebar dark:text-gray-200 dark:hover:bg-white/10"
            >
              {t("evidenceCloseAction")}
            </button>

            {evidence.kind === "document" &&
              resolvedContinuumDocId &&
              resolvedProjectId && (
              <Link
                href={buildProjectCitationHref(
                  resolvedProjectId,
                  resolvedContinuumDocId,
                  resolvedSourceKind,
                )}
                onClick={onClose}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-xs font-semibold text-white shadow-theme-xs transition-all hover:bg-brand-700 active:scale-95 dark:bg-brand-500 dark:hover:bg-brand-600"
              >
                <span>{t("openDocumentLink")}</span>
                <ArrowRightIcon
                  aria-hidden="true"
                  className="size-3.5 rtl:rotate-180"
                />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AiChatEvidenceSheetWithSession(props: AiChatEvidenceSheetProps) {
  const currentUserQuery = useCurrentUserQuery();
  const userId = props.userId ?? currentUserQuery.data?.id ?? "";
  const organizationId =
    props.organizationId ?? currentUserQuery.data?.organizationId ?? "";
  return (
    <AiChatEvidenceSheetContent
      {...props}
      userId={userId}
      organizationId={organizationId}
    />
  );
}

export default function AiChatEvidenceSheet(props: AiChatEvidenceSheetProps) {
  const queryClient = useContext(QueryClientContext);
  if (queryClient) {
    return <AiChatEvidenceSheetWithSession {...props} />;
  }
  return (
    <AiChatEvidenceSheetContent
      {...props}
      userId={props.userId ?? ""}
      organizationId={props.organizationId ?? ""}
    />
  );
}
