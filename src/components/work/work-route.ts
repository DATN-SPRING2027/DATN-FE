import type { WorkView } from "./WorkPageHeader";
import type { WorkItem, WorkSubtaskItem } from "./work-types";

export type WorkDetailRouteMode = "modal" | "page";

export const WORK_VIEW_SLUGS: readonly WorkView[] = [
  "overview",
  "list",
  "board",
  "calendar",
  "timeline",
  "development",
  "forms",
  "docs",
  "reports",
  "work-notes",
];

const WORK_VIEW_SLUG_SET = new Set<string>(WORK_VIEW_SLUGS);

export interface ParsedProjectWorkSlugs {
  view: WorkView | null;
  mode: WorkDetailRouteMode | null;
  taskRef: string | null;
  subtaskRef: string | null;
  isLegacyQueryOrHash: boolean;
}

export interface ParsedProjectWorkRoute extends ParsedProjectWorkSlugs {
  isProjectWorkPath: boolean;
}

export type ResolvedWorkRouteTarget =
  | {
      status: "matched";
      item: WorkItem;
      subtask: WorkSubtaskItem | null;
      missingSubtask: boolean;
    }
  | {
      status: "not_found";
    };

function safeDecodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function isWorkViewSlug(value: string): value is WorkView {
  return WORK_VIEW_SLUG_SET.has(value.trim().toLowerCase());
}

export function extractProjectIdFromWorkPathname(
  pathname: string | null | undefined,
): string | null {
  if (!pathname) return null;
  const match = pathname.match(
    /^(?:\/(?:en|vi))?\/projects\/([^/]+)\/work(?:\/|$)/,
  );
  if (!match?.[1]) return null;
  const decoded = safeDecodeSegment(match[1]).trim();
  return decoded || null;
}

export function isProjectWorkPathname(
  pathname: string | null | undefined,
  projectId: string,
): boolean {
  const cleanProjectId = projectId.trim();
  if (!cleanProjectId) return false;
  return extractProjectIdFromWorkPathname(pathname) === cleanProjectId;
}

export function parseProjectWorkSlugs(
  rawSlugs: readonly string[] | undefined,
): ParsedProjectWorkSlugs {
  const segments = (rawSlugs ?? [])
    .map((segment) => safeDecodeSegment(segment).trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return {
      view: "list",
      mode: null,
      taskRef: null,
      subtaskRef: null,
      isLegacyQueryOrHash: false,
    };
  }

  const firstLower = segments[0].toLowerCase();
  if (isWorkViewSlug(firstLower)) {
    if (segments.length === 1) {
      return {
        view: firstLower,
        mode: null,
        taskRef: null,
        subtaskRef: null,
        isLegacyQueryOrHash: false,
      };
    }
    return {
      view: firstLower,
      mode: "modal",
      taskRef: segments[1] ?? null,
      subtaskRef: segments[2] ?? null,
      isLegacyQueryOrHash: false,
    };
  }

  return {
    view: null,
    mode: "page",
    taskRef: segments[0] ?? null,
    subtaskRef: segments[1] ?? null,
    isLegacyQueryOrHash: false,
  };
}

function extractLegacyTaskRef(search?: string, hash?: string): string | null {
  if (search) {
    const queryString = search.startsWith("?") ? search.slice(1) : search;
    const fromQuery = new URLSearchParams(queryString).get("taskId")?.trim();
    if (fromQuery) return fromQuery;
  }
  if (hash) {
    const rawHash = hash.startsWith("#") ? hash.slice(1) : hash;
    const fromHash = safeDecodeSegment(rawHash).trim();
    if (fromHash) return fromHash;
  }
  return null;
}

export function parseProjectWorkLocation(options: {
  pathname: string | null | undefined;
  projectId: string;
  search?: string;
  hash?: string;
}): ParsedProjectWorkRoute {
  const { pathname, projectId, search, hash } = options;
  const legacyRef = extractLegacyTaskRef(search, hash);

  if (!pathname || !isProjectWorkPathname(pathname, projectId)) {
    return {
      isProjectWorkPath: false,
      view: null,
      mode: legacyRef ? "modal" : null,
      taskRef: legacyRef,
      subtaskRef: null,
      isLegacyQueryOrHash: Boolean(legacyRef),
    };
  }

  const match = pathname.match(
    /^(?:\/(?:en|vi))?\/projects\/[^/]+\/work(?:\/(.*))?$/,
  );
  const trailing = match?.[1] ?? "";
  const rawSlugs = trailing ? trailing.split("/").filter(Boolean) : [];
  const parsed = parseProjectWorkSlugs(rawSlugs);

  if (!parsed.taskRef && legacyRef) {
    return {
      isProjectWorkPath: true,
      view: parsed.view ?? "list",
      mode: "modal",
      taskRef: legacyRef,
      subtaskRef: null,
      isLegacyQueryOrHash: true,
    };
  }

  return {
    isProjectWorkPath: true,
    ...parsed,
  };
}

export function buildProjectWorkPath(options: {
  projectId: string;
  view?: WorkView;
  mode?: WorkDetailRouteMode | null;
  taskKeyOrId?: string | null;
  subtaskKeyOrId?: string | null;
}): string {
  const base = `/projects/${encodeURIComponent(options.projectId.trim())}/work`;
  const resolvedView: WorkView = options.view ?? "list";
  const taskSegment = options.taskKeyOrId?.trim()
    ? encodeURIComponent(options.taskKeyOrId.trim())
    : null;
  const subtaskSegment = options.subtaskKeyOrId?.trim()
    ? encodeURIComponent(options.subtaskKeyOrId.trim())
    : null;

  if (options.mode === "page" && taskSegment) {
    return subtaskSegment
      ? `${base}/${taskSegment}/${subtaskSegment}`
      : `${base}/${taskSegment}`;
  }

  if (options.mode === "modal" && taskSegment) {
    return subtaskSegment
      ? `${base}/${resolvedView}/${taskSegment}/${subtaskSegment}`
      : `${base}/${resolvedView}/${taskSegment}`;
  }

  return resolvedView === "list" ? base : `${base}/${resolvedView}`;
}

export function stripLegacyTaskSearchParams(search: string): string {
  if (!search) return "";
  const raw = search.startsWith("?") ? search.slice(1) : search;
  if (!raw) return "";
  const params = new URLSearchParams(raw);
  params.delete("taskId");
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function buildCanonicalTaskUrl(options: {
  origin: string;
  pathname?: string | null;
  projectId?: string | null;
  taskKeyOrId: string;
  subtaskKeyOrId?: string | null;
}): string {
  const effectiveProjectId =
    options.projectId?.trim() ||
    extractProjectIdFromWorkPathname(options.pathname);

  if (effectiveProjectId) {
    return `${options.origin}${buildProjectWorkPath({
      projectId: effectiveProjectId,
      mode: "page",
      taskKeyOrId: options.taskKeyOrId,
      subtaskKeyOrId: options.subtaskKeyOrId,
    })}`;
  }

  const cleanPathname = (options.pathname || "/workspace").replace(/\/+$/, "") || "/workspace";
  const targetRef =
    options.subtaskKeyOrId?.trim() || options.taskKeyOrId.trim();
  return `${options.origin}${cleanPathname}?taskId=${encodeURIComponent(targetRef)}`;
}

function matchesTaskIdentifier(
  candidate: { id: string; key: string },
  ref: string,
): boolean {
  const trimmed = ref.trim();
  if (!trimmed) return false;
  return (
    candidate.id === trimmed ||
    candidate.key.toUpperCase() === trimmed.toUpperCase()
  );
}

export function resolveWorkRouteTarget(
  items: readonly WorkItem[],
  taskRef: string,
  subtaskRef?: string | null,
): ResolvedWorkRouteTarget {
  const cleanTaskRef = taskRef.trim();
  if (!cleanTaskRef) return { status: "not_found" };

  const directParent = items.find((item) =>
    matchesTaskIdentifier(item, cleanTaskRef),
  );
  if (directParent) {
    const cleanSubRef = subtaskRef?.trim() || null;
    if (!cleanSubRef) {
      return {
        status: "matched",
        item: directParent,
        subtask: null,
        missingSubtask: false,
      };
    }
    const matchedSubtask =
      (directParent.subtaskItems ?? []).find((sub) =>
        matchesTaskIdentifier(sub, cleanSubRef),
      ) ?? null;
    return {
      status: "matched",
      item: directParent,
      subtask: matchedSubtask,
      missingSubtask: matchedSubtask === null,
    };
  }

  for (const parent of items) {
    const matchedSubtask = (parent.subtaskItems ?? []).find((sub) =>
      matchesTaskIdentifier(sub, cleanTaskRef),
    );
    if (matchedSubtask) {
      return {
        status: "matched",
        item: parent,
        subtask: matchedSubtask,
        missingSubtask: false,
      };
    }
  }

  return { status: "not_found" };
}
