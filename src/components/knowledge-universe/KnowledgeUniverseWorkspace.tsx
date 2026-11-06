"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  ChevronLeft,
  ChevronRight,
  FileText,
  Focus,
  Globe2,
  Layers3,
  Loader2,
  Minus,
  Orbit,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import { formatAppTitle } from "@/lib/page-titles";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { knowledgeUniverseApi } from "@/lib/queries/knowledge-universe/knowledge-universe.api";
import type {
  UniverseKnowledgeDetail,
  UniverseKnowledgeEdge,
  UniverseKnowledgeMatch,
  UniverseKnowledgePage,
  UniverseKnowledgeSynapse,
  UniverseKnowledgeUnit,
  UniverseManifest,
  UniverseTree,
  UniverseTreeNode,
} from "@/lib/queries/knowledge-universe/knowledge-universe.types";
import { useActiveOrganizationProjects } from "@/lib/queries/projects/useActiveOrganizationProjects";
import type { Project } from "@/lib/queries/projects/useProjects";
import { cn } from "@/utils";
import {

  isNoisyTechnicalLabel,
  knowledgeDocumentTitle,
  knowledgePassage,
  knowledgePreviewScore,
  knowledgeRegionCandidates,
  knowledgeUnitTitle,
} from "./knowledge-presentation";
import type {
  NeuralCortexEdgeItem,
  NeuralCortexNeuronItem,
  NeuralCortexRegionItem,
} from "./neural-atlas-contract";
import {
  NeuralAtlasScene,
  type NeuralAtlasSceneHandle,
} from "./neural-atlas-scene";
import styles from "./neural-atlas.module.css";
import { OrbitalEventEntityGraph } from "./orbital-graph-3d";
import {
  findKnowledgeCluster,
  groupUnitsByDocument,
  type KnowledgeCluster,
  knowledgeClusterKey,
  knowledgeClusterTrail,
  knowledgeUnitKey,
  projectUnitsToOrbitalGraph,
} from "./universe-knowledge-projection";
import {
  detectUniverseWebGLCapability,
  type UniverseSceneUnavailableReason,
} from "./universe-webgl-capability";

const EMPTY_TREES: UniverseTree[] = [];
const DEFAULT_PAGE_SIZE = 32;

export type Knowledge3DViewMode = "atlas" | "orbital";

interface SelectedNeuronRef {
  unitId: string;
  projectId: string;
  treeVersion: string;
  nodeId: string;
}

function humanizeDocName(raw: string, headingHint?: string): string {
  return knowledgeDocumentTitle(raw, headingHint);
}

function cleanNeuronLabel(unit: UniverseKnowledgeUnit): string {
  return knowledgeUnitTitle(unit);
}

function formatCorticalRegionLabel(
  node: UniverseTreeNode,
  subtreeUnits: UniverseKnowledgeUnit[],
  fallbackLabel: string,
  usedLabels?: Set<string>,
): string {
  const candidates = knowledgeRegionCandidates(
    subtreeUnits,
    node.label ?? "",
    fallbackLabel,
  );

  if (usedLabels) {
    for (const candidate of candidates) {
      const key = candidate.toLowerCase();
      if (!usedLabels.has(key)) {
        usedLabels.add(key);
        return candidate;
      }
    }
    const base = candidates[0] ?? fallbackLabel;
    let suffix = 2;
    while (usedLabels.has(`${base} ${suffix}`.toLowerCase())) {
      suffix += 1;
    }
    const disambiguated = `${base} · ${suffix}`;
    usedLabels.add(disambiguated.toLowerCase());
    return disambiguated;
  }

  return candidates[0] ?? fallbackLabel;
}

function KnowledgeUniverseContent() {
  const t = useTranslations("knowledgeUniverse");
  const tPage = useTranslations("pageTitles");
  const reducedMotion = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentUserQuery = useCurrentUserQuery();
  const organizationId = currentUserQuery.data?.organizationId ?? "";
  const activeProjectsQuery = useActiveOrganizationProjects(
    organizationId,
    Boolean(organizationId),
  );
  const projects = activeProjectsQuery.projects;

  const urlProjectId = searchParams.get("projectId");
  const [manualProjectId, setManualProjectId] = React.useState<string | null>(
    null,
  );

  // Sync with AppSidebar project switcher so there is only one project selector in the UI
  React.useEffect(() => {
    const onSidebarProjectSwitch = (event: Event) => {
      const nextId = (
        event as CustomEvent<{ projectId?: string }>
      ).detail?.projectId;
      if (nextId) {
        setManualProjectId(nextId);
        setSelected(null);
        setDetail(null);
        setActive(null);
      }
    };
    window.addEventListener(
      "continuum:workspace-project-switch",
      onSidebarProjectSwitch,
    );
    return () => {
      window.removeEventListener(
        "continuum:workspace-project-switch",
        onSidebarProjectSwitch,
      );
    };
  }, []);

  const selectedProject: Project | null = React.useMemo(() => {
    if (projects.length === 0) return null;
    if (urlProjectId) {
      const urlMatch = projects.find((p) => p.id === urlProjectId);
      if (urlMatch) return urlMatch;
    }
    if (manualProjectId) {
      const manualMatch = projects.find((p) => p.id === manualProjectId);
      if (manualMatch) return manualMatch;
    }
    return projects[0] ?? null;
  }, [projects, manualProjectId, urlProjectId]);

  const projectId = selectedProject?.id ?? "";

  React.useEffect(() => {
    if (!projectId) return;
    window.dispatchEvent(
      new CustomEvent("continuum:workspace-project-sync", {
        detail: { projectId },
      }),
    );
    if (urlProjectId !== projectId) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("projectId", projectId);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [projectId, urlProjectId, pathname, router, searchParams]);

  useDocumentTitle(
    formatAppTitle(
      selectedProject
        ? `${selectedProject.name} · ${tPage("knowledge")}`
        : tPage("knowledge"),
    ),
  );

  const graphRef = React.useRef<NeuralAtlasSceneHandle>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = React.useState<Knowledge3DViewMode>("atlas");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [manifest, setManifest] = React.useState<UniverseManifest | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [revision, setRevision] = React.useState(0);
  const [active, setActive] = React.useState<KnowledgeCluster | null>(null);
  const [page, setPage] = React.useState<UniverseKnowledgePage | null>(null);
  const [ambientPages, setAmbientPages] = React.useState<
    UniverseKnowledgePage[]
  >([]);
  const [ambientLinks, setAmbientLinks] = React.useState<
    UniverseKnowledgeEdge[]
  >([]);
  const [pageLoading, setPageLoading] = React.useState(false);
  const [cursors, setCursors] = React.useState<Array<string | undefined>>([
    undefined,
  ]);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [selected, setSelected] = React.useState<SelectedNeuronRef | null>(
    null,
  );
  const [detail, setDetail] = React.useState<UniverseKnowledgeDetail | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [showList, setShowList] = React.useState(false);
  const [matches, setMatches] = React.useState<UniverseKnowledgeMatch[]>([]);
  const [sceneFailure, setSceneFailure] = React.useState<
    UniverseSceneUnavailableReason | "api-unavailable" | null
  >(null);
  const [sceneAttempt, setSceneAttempt] = React.useState(0);
  const pendingFocus = React.useRef<string | null>(null);
  const pageCacheRef = React.useRef<Map<string, UniverseKnowledgePage>>(
    new Map(),
  );
  const inflightPageRef = React.useRef<
    Map<string, Promise<UniverseKnowledgePage>>
  >(new Map());
  const detailCacheRef = React.useRef<Map<string, UniverseKnowledgeDetail>>(
    new Map(),
  );
  const stableRegionLabelsRef = React.useRef<
    Map<string, { label: string; fromUnits: boolean }>
  >(new Map());
  const hoverPrefetchTimerRef = React.useRef<number | null>(null);

  const trees = manifest?.trees ?? EMPTY_TREES;
  const sourceProjection = trees.some((tree) => tree.projection === "source");
  const current = React.useMemo(
    () => findKnowledgeCluster(trees, active),
    [trees, active],
  );
  const activeKey = active ? knowledgeClusterKey(active) : "overview";
  const pageSize = DEFAULT_PAGE_SIZE;

  const fetchClusterCached = React.useCallback(
    async (
      targetProjectId: string,
      params: {
        tree_version: string;
        node_id: string;
        limit: number;
        cursor?: string;
      },
      signal?: AbortSignal,
    ): Promise<UniverseKnowledgePage> => {
      const cacheKey = `${targetProjectId}:${params.tree_version}:${params.node_id}:${params.limit}:${params.cursor ?? ""}`;
      const cached = pageCacheRef.current.get(cacheKey);
      if (cached) return cached;
      if (!params.cursor && params.limit <= 50) {
        const fallback50 = pageCacheRef.current.get(
          `${targetProjectId}:${params.tree_version}:${params.node_id}:50:`,
        );
        if (fallback50) return fallback50;
      }
      const existing = inflightPageRef.current.get(cacheKey);
      if (existing) return existing;
      const promise = knowledgeUniverseApi
        .cluster(targetProjectId, params, signal)
        .then((result) => {
          pageCacheRef.current.set(cacheKey, result);
          inflightPageRef.current.delete(cacheKey);
          return result;
        })
        .catch((err) => {
          inflightPageRef.current.delete(cacheKey);
          throw err;
        });
      inflightPageRef.current.set(cacheKey, promise);
      return promise;
    },
    [],
  );

  const prefetchRegion = React.useCallback(
    (ref: KnowledgeCluster | null) => {
      if (hoverPrefetchTimerRef.current !== null) {
        window.clearTimeout(hoverPrefetchTimerRef.current);
        hoverPrefetchTimerRef.current = null;
      }
      if (!ref || !projectId) return;
      hoverPrefetchTimerRef.current = window.setTimeout(() => {
        const targetCluster = findKnowledgeCluster(trees, ref);
        if (!targetCluster) return;
        const { tree, node } = targetCluster;
        if (node.is_leaf) {
          void fetchClusterCached(projectId, {
            tree_version: tree.tree_version,
            node_id: node.id,
            limit: pageSize,
          }).catch(() => undefined);
          return;
        }
        const children = tree.nodes
          .filter((n) => n.parent_id === node.id && n.unit_count > 0)
          .sort((a, b) => b.unit_count - a.unit_count)
          .slice(0, 12);
        const nodesToPrefetch = [node, ...children];
        nodesToPrefetch.forEach((n) => {
          void fetchClusterCached(projectId, {
            tree_version: tree.tree_version,
            node_id: n.id,
            limit: 50,
          }).catch(() => undefined);
        });
      }, 85);
    },
    [projectId, trees, pageSize, fetchClusterCached],
  );

  const clearSelection = React.useCallback(() => {
    setSelected(null);
    setDetail(null);
    setDetailLoading(false);
  }, []);

  React.useEffect(() => {
    const onSearchShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      clearSelection();
      setShowList(true);
    };
    window.addEventListener("keydown", onSearchShortcut, true);
    return () => window.removeEventListener("keydown", onSearchShortcut, true);
  }, [clearSelection]);

  const navigate = React.useCallback(
    (target: KnowledgeCluster | null, focusUnit?: string) => {
      const targetCluster = target ? findKnowledgeCluster(trees, target) : null;
      if (target && !targetCluster) {
        setError(t("snapshotChanged"));
        return;
      }
      pendingFocus.current = focusUnit ?? null;
      setActive(
        target
          ? {
              project_id: target.project_id,
              tree_version: target.tree_version,
              node_id: target.node_id,
            }
          : null,
      );
      const cachedLeafPage =
        target && targetCluster?.node.is_leaf
          ? (pageCacheRef.current.get(
              `${target.project_id}:${target.tree_version}:${target.node_id}:${pageSize}:`,
            ) ??
            pageCacheRef.current.get(
              `${target.project_id}:${target.tree_version}:${target.node_id}:50:`,
            ) ??
            null)
          : null;
      setPage(cachedLeafPage);
      if (!target || !targetCluster?.node.is_leaf) {
        const nextTargets = trees
          .flatMap((tree) => {
            if (
              target &&
              (tree.project_id !== target.project_id ||
                tree.tree_version !== target.tree_version)
            ) {
              return [];
            }
            const roots = target
              ? [target.node_id]
              : tree.nodes.filter((n) => !n.parent_id).map((n) => n.id);
            const children = tree.nodes.filter(
              (n) => n.parent_id && roots.includes(n.parent_id),
            );
            const visible = children.length
              ? children
              : tree.nodes.filter((n) => roots.includes(n.id));
            return visible
              .filter((n) => n.unit_count > 0)
              .map((n) => ({
                project_id: tree.project_id,
                tree_version: tree.tree_version,
                node_id: n.id,
                unit_count: n.unit_count,
              }));
          })
          .sort((a, b) => b.unit_count - a.unit_count)
          .slice(0, 12);
        const cachedNextPages = nextTargets
          .map((item) =>
            pageCacheRef.current.get(
              `${item.project_id}:${item.tree_version}:${item.node_id}:50:`,
            ),
          )
          .filter((item): item is UniverseKnowledgePage => Boolean(item));
        if (
          nextTargets.length > 0 &&
          cachedNextPages.length === nextTargets.length
        ) {
          setAmbientPages(cachedNextPages);
        } else {
          setAmbientPages([]);
          setAmbientLinks([]);
        }
      }
      setPageLoading(false);
      setSelected(null);
      setDetail(null);
      setDetailLoading(false);
      setCursors([undefined]);
      setPageIndex(0);
      setError("");
    },
    [trees, pageSize, t],
  );

  const onFailure = React.useCallback(
    (reason: unknown) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError(reason instanceof ApiError ? reason.message : t("loadFailed"));
      if (
        reason instanceof ApiError &&
        [401, 403, 404, 409].includes(reason.status)
      ) {
        setPage(null);
        setAmbientPages([]);
        setAmbientLinks([]);
        setDetail(null);
        setSelected(null);
        setMatches([]);
        setManifest(null);
      }
    },
    [t],
  );

  React.useEffect(() => {
    if (detectUniverseWebGLCapability(window) !== "available") {
      setSceneFailure("api-unavailable");
    }
  }, []);

  React.useEffect(() => {
    pageCacheRef.current.clear();
    detailCacheRef.current.clear();
    stableRegionLabelsRef.current.clear();
    if (!projectId) {
      setManifest(null);
      setPage(null);
      setAmbientPages([]);
      setAmbientLinks([]);
      setDetail(null);
      setSelected(null);
      setPageLoading(false);
      setDetailLoading(false);
      setMatches([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void knowledgeUniverseApi
      .overview(projectId, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setManifest(value);
        const overviewTrees = value.trees ?? [];
        const roots = overviewTrees.flatMap((tree) =>
          tree.nodes
            .filter((node) => !node.parent_id)
            .map((node) => ({ tree, node })),
        );
        if (roots.length === 1 && roots[0].node.is_leaf) {
          const { tree, node } = roots[0];
          setActive({
            project_id: tree.project_id,
            tree_version: tree.tree_version,
            node_id: node.id,
          });
        } else {
          setActive(null);
        }
        setCursors([undefined]);
        setPageIndex(0);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) onFailure(reason);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [projectId, revision, onFailure]);

  const refresh = React.useCallback(() => {
    pageCacheRef.current.clear();
    detailCacheRef.current.clear();
    stableRegionLabelsRef.current.clear();
    clearSelection();
    setPage(null);
    setAmbientPages([]);
    setAmbientLinks([]);
    setManifest(null);
    setActive(null);
    setMatches([]);
    setRevision((value) => value + 1);
  }, [clearSelection]);

  React.useEffect(() => {
    if (!projectId || !active || !current?.node.is_leaf) return;
    const cursorVal = cursors[pageIndex] ?? "";
    const cacheKey = `${projectId}:${active.tree_version}:${active.node_id}:${pageSize}:${cursorVal}`;
    const cached =
      pageCacheRef.current.get(cacheKey) ??
      (!cursorVal
        ? pageCacheRef.current.get(
            `${projectId}:${active.tree_version}:${active.node_id}:50:`,
          )
        : undefined);
    if (cached) {
      setPage(cached);
      setPageLoading(false);
      return;
    }
    const controller = new AbortController();
    setPageLoading(true);
    setPage(null);
    setError("");
    void fetchClusterCached(
      projectId,
      {
        tree_version: active.tree_version,
        node_id: active.node_id,
        limit: pageSize,
        cursor: cursors[pageIndex],
      },
      controller.signal,
    )
      .then((value) => {
        if (controller.signal.aborted) return;
        if (
          value.project_id !== active.project_id ||
          value.tree_version !== active.tree_version ||
          value.node_id !== active.node_id
        ) {
          onFailure(new ApiError(409, "snapshot_changed", t("snapshotChanged")));
          return;
        }
        setPage(value);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) onFailure(reason);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPageLoading(false);
      });
    return () => controller.abort();
  }, [
    projectId,
    active,
    current?.node.is_leaf,
    pageSize,
    cursors,
    pageIndex,
    fetchClusterCached,
    onFailure,
    t,
  ]);

  React.useEffect(() => {
    if (!projectId || !trees.length || (active && current?.node.is_leaf)) return;
    const controller = new AbortController();
    const targets = trees
      .flatMap((tree) => {
        if (
          active &&
          (tree.project_id !== active.project_id ||
            tree.tree_version !== active.tree_version)
        ) {
          return [];
        }
        const roots = active
          ? [active.node_id]
          : tree.nodes.filter((node) => !node.parent_id).map((node) => node.id);
        const children = tree.nodes.filter(
          (node) => node.parent_id && roots.includes(node.parent_id),
        );
        const visible = children.length
          ? children
          : tree.nodes.filter((node) => roots.includes(node.id));
        return visible
          .filter((node) => node.unit_count > 0)
          .map((node) => ({
            project_id: tree.project_id,
            tree_version: tree.tree_version,
            node_id: node.id,
            unit_count: node.unit_count,
          }));
      })
      .sort((a, b) => b.unit_count - a.unit_count)
      .slice(0, 12);

    const scopes = trees
      .flatMap((tree) => {
        if (
          active &&
          (tree.project_id !== active.project_id ||
            tree.tree_version !== active.tree_version)
        ) {
          return [];
        }
        return tree.nodes
          .filter((node) =>
            active ? node.id === active.node_id : !node.parent_id,
          )
          .filter((node) => !node.is_leaf)
          .map((node) => ({
            project_id: tree.project_id,
            tree_version: tree.tree_version,
            node_id: node.id,
          }));
      })
      .slice(0, 12);

    // Zero-latency synchronous fast-path if all pages & scopes are already cached
    const allTargetsCached = targets.every((target) =>
      pageCacheRef.current.has(
        `${projectId}:${target.tree_version}:${target.node_id}:50:`,
      ),
    );
    const allScopesCached = scopes.every((scope) =>
      pageCacheRef.current.has(
        `${projectId}:${scope.tree_version}:${scope.node_id}:50:`,
      ),
    );
    if (allTargetsCached && allScopesCached) {
      const cachedPages = targets
        .map((target) =>
          pageCacheRef.current.get(
            `${projectId}:${target.tree_version}:${target.node_id}:50:`,
          ),
        )
        .filter((item): item is UniverseKnowledgePage => Boolean(item));
      const cachedLinks = scopes.flatMap(
        (scope) =>
          pageCacheRef.current.get(
            `${projectId}:${scope.tree_version}:${scope.node_id}:50:`,
          )?.edges ?? [],
      );
      setAmbientPages(cachedPages);
      setAmbientLinks(cachedLinks);
      setPageLoading(false);
      return;
    }

    setPageLoading(true);
    void (async () => {
      const [targetBatch, scopeBatch] = await Promise.all([
        Promise.all(
          targets.map((target) =>
            fetchClusterCached(
              projectId,
              {
                tree_version: target.tree_version,
                node_id: target.node_id,
                limit: 50,
              },
              controller.signal,
            ).catch((reason) => {
              if (!controller.signal.aborted) onFailure(reason);
              return null;
            }),
          ),
        ),
        Promise.all(
          scopes.map((scope) =>
            fetchClusterCached(
              projectId,
              {
                tree_version: scope.tree_version,
                node_id: scope.node_id,
                limit: 50,
              },
              controller.signal,
            ).catch((reason) => {
              if (!controller.signal.aborted) onFailure(reason);
              return null;
            }),
          ),
        ),
      ]);

      if (controller.signal.aborted) return;
      const pages = targetBatch.filter(
        (item): item is UniverseKnowledgePage => item !== null,
      );
      const links: UniverseKnowledgeEdge[] = [];
      scopeBatch.forEach((value) => {
        if (value) links.push(...value.edges);
      });
      setAmbientPages(pages);
      setAmbientLinks(links);
    })().finally(() => {
      if (!controller.signal.aborted) setPageLoading(false);
    });
    return () => controller.abort();
  }, [
    projectId,
    trees,
    active,
    current?.node.is_leaf,
    fetchClusterCached,
    onFailure,
  ]);

  React.useEffect(() => {
    if (!projectId || !selected) return;
    const detailKey = `${projectId}:${selected.treeVersion}:${selected.unitId}`;
    const cachedDetail = detailCacheRef.current.get(detailKey);
    if (cachedDetail) {
      setDetail(cachedDetail);
      setDetailLoading(false);
      return;
    }
    const controller = new AbortController();
    setDetailLoading(true);
    setDetail(null);
    void knowledgeUniverseApi
      .unit(projectId, selected.unitId, selected.treeVersion, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        detailCacheRef.current.set(detailKey, value);
        setDetail(value);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) onFailure(reason);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [projectId, selected, onFailure]);

  const activePages = React.useMemo(
    () => (current?.node.is_leaf ? (page ? [page] : []) : ambientPages),
    [current?.node.is_leaf, page, ambientPages],
  );

  const allVisibleUnits = React.useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ unit: UniverseKnowledgeUnit; ref: KnowledgeCluster }> =
      [];
    for (const p of activePages) {
      const ref: KnowledgeCluster = {
        project_id: p.project_id,
        tree_version: p.tree_version,
        node_id: p.node_id,
      };
      for (const u of p.units) {
        if (!seen.has(u.id)) {
          seen.add(u.id);
          out.push({ unit: u, ref });
        }
      }
    }
    return out;
  }, [activePages]);

  const allVisibleEdges = React.useMemo(() => {
    const out: UniverseKnowledgeEdge[] = [];
    const seen = new Set<string>();
    const edges = activePages.flatMap((value) => value.edges);
    if (!current?.node.is_leaf) edges.push(...ambientLinks);
    for (const edge of edges) {
      const key = `${edge.source}~${edge.target}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(edge);
      }
    }
    return out;
  }, [activePages, ambientLinks, current?.node.is_leaf]);

  const matchedClusters = React.useMemo(
    () =>
      new Set(
        matches.flatMap((match) =>
          knowledgeClusterTrail(trees, match).map((node) =>
            knowledgeClusterKey({ ...match, node_id: node.id }),
          ),
        ),
      ),
    [matches, trees],
  );

  const childCountByNodeId = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const tree of trees) {
      for (const node of tree.nodes) {
        if (node.parent_id && node.unit_count > 0) {
          map.set(node.parent_id, (map.get(node.parent_id) ?? 0) + 1);
        }
      }
    }
    return map;
  }, [trees]);

  const unitsByNodeSubtree = React.useMemo(() => {
    const map = new Map<string, UniverseKnowledgeUnit[]>();
    const directByNode = new Map<string, UniverseKnowledgeUnit[]>();
    allVisibleUnits.forEach(({ unit, ref }) => {
      const list = directByNode.get(ref.node_id) ?? [];
      list.push(unit);
      directByNode.set(ref.node_id, list);
    });
    for (const tree of trees) {
      const childrenByParent = new Map<string, UniverseTreeNode[]>();
      tree.nodes.forEach((n) => {
        if (n.parent_id) {
          const list = childrenByParent.get(n.parent_id) ?? [];
          list.push(n);
          childrenByParent.set(n.parent_id, list);
        }
      });
      const collect = (
        nodeId: string,
        visited = new Set<string>(),
      ): UniverseKnowledgeUnit[] => {
        if (visited.has(nodeId)) return [];
        visited.add(nodeId);
        const out = [...(directByNode.get(nodeId) ?? [])];
        for (const child of childrenByParent.get(nodeId) ?? []) {
          out.push(...collect(child.id, visited));
        }
        return out;
      };
      tree.nodes.forEach((n) => {
        map.set(n.id, collect(n.id));
      });
    }
    return map;
  }, [trees, allVisibleUnits]);

  const regionLabelByKey = React.useMemo(() => {
    const labels = new Map<string, string>();
    const usedLabels = new Set<string>();
    for (const [key, entry] of stableRegionLabelsRef.current.entries()) {
      if (entry.fromUnits) {
        labels.set(key, entry.label);
        usedLabels.add(entry.label.toLowerCase());
      }
    }

    for (const tree of trees) {
      const byParent = new Map<string, UniverseTreeNode[]>();
      tree.nodes.forEach((n) => {
        if (n.parent_id) {
          const list = byParent.get(n.parent_id) ?? [];
          list.push(n);
          byParent.set(n.parent_id, list);
        }
      });
      const roots = tree.nodes.filter((n) => !n.parent_id);
      const firstLevel =
        roots.length === 1 && (byParent.get(roots[0].id)?.length ?? 0) > 0
          ? (byParent.get(roots[0].id) ?? [])
          : roots;

      const queue = [...firstLevel];
      const visited = new Set<string>();
      let idx = 0;
      while (queue.length > 0) {
        const node = queue.shift()!;
        if (visited.has(node.id)) continue;
        visited.add(node.id);
        idx += 1;
        const ref: KnowledgeCluster = {
          project_id: tree.project_id,
          tree_version: tree.tree_version,
          node_id: node.id,
        };
        const key = knowledgeClusterKey(ref);
        const subtreeUnits = unitsByNodeSubtree.get(node.id) ?? [];
        const cached = stableRegionLabelsRef.current.get(key);
        if (!cached?.fromUnits) {
          const fallbackLabel = t("clusterFallback", { index: idx });
          const computed = formatCorticalRegionLabel(
            node,
            subtreeUnits,
            fallbackLabel,
            usedLabels,
          );
          labels.set(key, computed);
          usedLabels.add(computed.toLowerCase());
          if (subtreeUnits.length > 0) {
            stableRegionLabelsRef.current.set(key, {
              label: computed,
              fromUnits: true,
            });
          }
        }
        const children = byParent.get(node.id) ?? [];
        queue.push(...children);
      }
    }
    return labels;
  }, [trees, unitsByNodeSubtree, t]);

  const subtreeRegions = React.useMemo<NeuralCortexRegionItem[]>(() => {
    const items: NeuralCortexRegionItem[] = [];
    const usedLabels = new Set<string>();

    for (const tree of trees) {
      if (
        active &&
        (tree.project_id !== active.project_id ||
          tree.tree_version !== active.tree_version)
      ) {
        continue;
      }
      const byParent = new Map<string, UniverseTreeNode[]>();
      tree.nodes.forEach((n) => {
        if (n.parent_id) {
          const list = byParent.get(n.parent_id) ?? [];
          list.push(n);
          byParent.set(n.parent_id, list);
        }
      });

      const addSubtree = (roots: UniverseTreeNode[]) => {
        const queue = [...roots];
        const visited = new Set<string>();
        let idx = 0;
        while (queue.length > 0) {
          const node = queue.shift()!;
          if (visited.has(node.id)) continue;
          visited.add(node.id);
          idx += 1;
          const ref: KnowledgeCluster = {
            project_id: tree.project_id,
            tree_version: tree.tree_version,
            node_id: node.id,
          };
          const key = knowledgeClusterKey(ref);
          const fallbackLabel = t("clusterFallback", { index: idx });
          const humanLabel =
            regionLabelByKey.get(key) ??
            formatCorticalRegionLabel(
              node,
              unitsByNodeSubtree.get(node.id) ?? [],
              fallbackLabel,
              usedLabels,
            );
          items.push({
            key,
            project_id: tree.project_id,
            tree_version: tree.tree_version,
            node,
            label: humanLabel,
            stats: t("clusterStats", {
              units: node.unit_count,
              sources: node.source_count,
            }),
            childCount: childCountByNodeId.get(node.id) ?? 0,
            isActive: activeKey === key,
            isRouted: false,
            isMatched: matchedClusters.has(key),
          });
          const children = byParent.get(node.id) ?? [];
          queue.push(...children);
        }
      };

      if (active) {
        const start = tree.nodes.find((n) => n.id === active.node_id);
        if (start) addSubtree([start]);
      } else {
        addSubtree(tree.nodes.filter((n) => !n.parent_id));
      }
    }
    return items;
  }, [
    trees,
    active,
    activeKey,
    matchedClusters,
    unitsByNodeSubtree,
    regionLabelByKey,
    childCountByNodeId,
    t,
  ]);

  // In Overview mode, list the actual child cortical regions rather than a single wrapper root node.
  // At leaf depth, fall back to sibling clusters so the user never hits a dead-end.
  const clusterChoices = React.useMemo(() => {
    const choices =
      current && active
        ? (() => {
            const directChildren = current.tree.nodes
              .filter(
                (node) =>
                  node.parent_id === active.node_id && node.unit_count > 0,
              )
              .sort((a, b) => b.unit_count - a.unit_count);
            if (directChildren.length > 0) {
              return directChildren.map((node) => ({
                tree: current.tree,
                node,
              }));
            }
            if (current.node.parent_id) {
              return current.tree.nodes
                .filter(
                  (node) =>
                    node.parent_id === current.node.parent_id &&
                    node.unit_count > 0,
                )
                .sort((a, b) => b.unit_count - a.unit_count)
                .map((node) => ({ tree: current.tree, node }));
            }
            return [];
          })()
        : trees.flatMap((tree) => {
            const roots = tree.nodes.filter((node) => !node.parent_id);
            const rootIds = roots.map((r) => r.id);
            const children = tree.nodes.filter(
              (node) => node.parent_id && rootIds.includes(node.parent_id),
            );
            const visibleNodes = children.length > 0 ? children : roots;
            return visibleNodes
              .filter((node) => node.unit_count > 0)
              .sort((a, b) => b.unit_count - a.unit_count)
              .map((node) => ({ tree, node }));
          });

    const usedChoiceLabels = new Set<string>();
    return choices.map(({ tree, node }, index) => {
      const ref: KnowledgeCluster = {
        project_id: tree.project_id,
        tree_version: tree.tree_version,
        node_id: node.id,
      };
      const key = knowledgeClusterKey(ref);
      const label =
        regionLabelByKey.get(key) ??
        formatCorticalRegionLabel(
          node,
          unitsByNodeSubtree.get(node.id) ?? [],
          t("clusterFallback", { index: index + 1 }),
          usedChoiceLabels,
        );
      return {
        ref,
        node,
        label,
        childCount: childCountByNodeId.get(node.id) ?? 0,
        stats: t("clusterStats", {
          units: node.unit_count,
          sources: node.source_count,
        }),
      };
    });
  }, [
    current,
    active,
    trees,
    regionLabelByKey,
    unitsByNodeSubtree,
    childCountByNodeId,
    t,
  ]);

  const selectedSceneId = React.useMemo(
    () =>
      selected
        ? knowledgeUnitKey(
            {
              project_id: selected.projectId,
              tree_version: selected.treeVersion,
              node_id: selected.nodeId,
            },
            selected.unitId,
          )
        : null,
    [selected],
  );

  const { cortexNeurons, cortexEdges } = React.useMemo(() => {
    const matchedUnitIds = new Set(matches.flatMap((m) => m.unit_ids));
    const unitKeyById = new Map<string, string>();
    const unitById = new Map<string, UniverseKnowledgeUnit>();

    const neuronItems: NeuralCortexNeuronItem[] = allVisibleUnits.map(
      ({ unit, ref }) => {
        const clusterKey = knowledgeClusterKey(ref);
        const key = knowledgeUnitKey(ref, unit.id);
        unitKeyById.set(unit.id, key);
        unitById.set(unit.id, unit);
        return {
          key,
          clusterKey,
          unit,
          cleanLabel: cleanNeuronLabel(unit),
          isSelected: selected?.unitId === unit.id,
          isMatched: matchedUnitIds.has(unit.id),
        };
      },
    );

    const edgeItems: NeuralCortexEdgeItem[] = [];
    const seen = new Set<string>();
    for (const edge of allVisibleEdges) {
      const sourceKey = unitKeyById.get(edge.source);
      const targetKey = unitKeyById.get(edge.target);
      if (!sourceKey || !targetKey) continue;
      const id = [sourceKey, targetKey].sort().join("~");
      if (seen.has(id)) continue;
      seen.add(id);
      const source = unitById.get(edge.source);
      const target = unitById.get(edge.target);
      edgeItems.push({
        id,
        sourceKey,
        targetKey,
        kind:
          edge.cross_document || source?.document_id !== target?.document_id
            ? "cross_doc_axon"
            : "local_dendrite",
        weight: edge.weight,
        sharedEntities: edge.shared_entities,
      });
    }

    if (detail && selected) {
      const sourceKey = unitKeyById.get(detail.id);
      for (const synapse of detail.synapses ?? []) {
        const targetKey = unitKeyById.get(synapse.target_unit_id);
        if (!sourceKey || !targetKey) continue;
        const id = [sourceKey, targetKey].sort().join("~");
        if (seen.has(id)) continue;
        seen.add(id);
        edgeItems.push({
          id,
          sourceKey,
          targetKey,
          kind: synapse.cross_document ? "cross_doc_axon" : "local_dendrite",
          weight: synapse.weight,
          sharedEntities: synapse.shared_entities,
        });
      }
    }
    return { cortexNeurons: neuronItems, cortexEdges: edgeItems };
  }, [allVisibleUnits, allVisibleEdges, matches, selected, detail]);

  const trail = React.useMemo(() => {
    const rawTrail = knowledgeClusterTrail(trees, active);
    // Skip single root wrapper node in breadcrumb trail when it contains the entire tree
    if (
      rawTrail.length > 1 &&
      !rawTrail[0].parent_id &&
      isNoisyTechnicalLabel(rawTrail[0].label ?? "")
    ) {
      return rawTrail.slice(1);
    }
    return rawTrail;
  }, [trees, active]);

  React.useEffect(() => {
    if (pendingFocus.current) {
      const target = allVisibleUnits.find(
        ({ unit }) => unit.id === pendingFocus.current,
      );
      if (target) {
        const key = knowledgeUnitKey(target.ref, target.unit.id);
        graphRef.current?.focusNode(key);
        setSelected({
          unitId: target.unit.id,
          projectId: target.ref.project_id,
          treeVersion: target.ref.tree_version,
          nodeId: target.ref.node_id,
        });
        pendingFocus.current = null;
      }
    }
  }, [allVisibleUnits]);

  const selectUnit = React.useCallback(
    (unit: UniverseKnowledgeUnit, refOverride?: KnowledgeCluster) => {
      const targetRef =
        refOverride ??
        active ??
        (trees[0]
          ? {
              project_id: trees[0].project_id,
              tree_version: trees[0].tree_version,
              node_id:
                trees[0].nodes.find((n) => !n.parent_id)?.id ??
                trees[0].nodes[0]?.id ??
                "",
            }
          : null);
      if (!targetRef) return;
      setSelected({
        unitId: unit.id,
        projectId: targetRef.project_id,
        treeVersion: targetRef.tree_version,
        nodeId: targetRef.node_id,
      });
      graphRef.current?.focusNode(knowledgeUnitKey(targetRef, unit.id));
    },
    [active, trees],
  );

  const back = React.useCallback(() => {
    if (selected) {
      clearSelection();
      return;
    }
    const parentId = current?.node.parent_id;
    const parentNode = parentId
      ? current?.tree.nodes.find((n) => n.id === parentId)
      : null;
    // If parent is the single root wrapper node, return directly to Overview (null)
    if (!parentNode || !parentNode.parent_id) {
      navigate(null);
      return;
    }
    navigate(active ? { ...active, node_id: parentNode.id } : null);
  }, [selected, clearSelection, navigate, current, active]);

  const status = manifest?.status ?? "ready";
  const empty =
    Boolean(manifest) &&
    !loading &&
    (trees.length === 0 || status !== "ready");
  const fallback = Boolean(sceneFailure);

  const visibleUnitList = React.useMemo(
    () => allVisibleUnits.map((item) => item.unit),
    [allVisibleUnits],
  );
  const unitRefMap = React.useMemo(
    () => new Map(allVisibleUnits.map((item) => [item.unit.id, item.ref])),
    [allVisibleUnits],
  );

  const docGroups = React.useMemo(
    () => groupUnitsByDocument(visibleUnitList, allVisibleEdges),
    [visibleUnitList, allVisibleEdges],
  );

  const orbitalGraphData = React.useMemo(
    () =>
      projectUnitsToOrbitalGraph(projectId, visibleUnitList, allVisibleEdges),
    [projectId, visibleUnitList, allVisibleEdges],
  );

  const jumpToSynapse = React.useCallback(
    (synapse: UniverseKnowledgeSynapse) => {
      if (!selected) return;
      const found = allVisibleUnits.find(
        ({ unit }) => unit.id === synapse.target_unit_id,
      );
      if (found) {
        selectUnit(found.unit, found.ref);
        return;
      }
      if (synapse.target_node_id && synapse.target_node_id !== selected.nodeId) {
        navigate(
          {
            project_id: selected.projectId,
            tree_version: selected.treeVersion,
            node_id: synapse.target_node_id,
          },
          synapse.target_unit_id,
        );
        return;
      }
      setSelected({
        ...selected,
        unitId: synapse.target_unit_id,
      });
    },
    [selected, allVisibleUnits, selectUnit, navigate],
  );

  const connectionReason = (synapse: UniverseKnowledgeSynapse) => {
    const entities = synapse.shared_entities?.filter(
      (entity) =>
        entity.length > 4 && !isNoisyTechnicalLabel(entity),
    );
    return entities?.length
      ? t("atlas.sharedEntity", { entity: entities.slice(0, 2).join(", ") })
      : t(
          synapse.cross_document ? "atlas.sharedContext" : "atlas.sameDocument",
        );
  };

  const query = searchQuery.trim().toLocaleLowerCase();
  const matchesQuery = (text: string) =>
    !query || text.toLocaleLowerCase().includes(query);

  React.useEffect(() => {
    if (showList) searchRef.current?.focus();
  }, [showList]);

  const filteredClusters = React.useMemo(
    () =>
      clusterChoices.filter((item) => !query || item.label.toLocaleLowerCase().includes(query)),
    [clusterChoices, query],
  );

  const isShowingSiblingClusters = React.useMemo(
    () =>
      Boolean(
        active &&
          current &&
          !current.tree.nodes.some(
            (n) => n.parent_id === active.node_id && n.unit_count > 0,
          ),
      ),
    [active, current],
  );

  const activeRegionLabel = React.useMemo(() => {
    if (!active) return t("overview");
    return (
      regionLabelByKey.get(activeKey) ??
      (current
        ? formatCorticalRegionLabel(
            current.node,
            unitsByNodeSubtree.get(current.node.id) ?? [],
            t("clusterFallback", { index: 1 }),
          )
        : t("overview"))
    );
  }, [active, activeKey, regionLabelByKey, current, unitsByNodeSubtree, t]);

  const selectedClusterInfo = React.useMemo(() => {
    if (!selected) return null;
    const ref: KnowledgeCluster = {
      project_id: selected.projectId,
      tree_version: selected.treeVersion,
      node_id: selected.nodeId,
    };
    const key = knowledgeClusterKey(ref);
    const cluster = findKnowledgeCluster(trees, ref);
    const label =
      regionLabelByKey.get(key) ??
      (cluster
        ? formatCorticalRegionLabel(
            cluster.node,
            unitsByNodeSubtree.get(cluster.node.id) ?? [],
            t("clusterFallback", { index: 1 }),
          )
        : null);
    if (!label) return null;
    return {
      ref,
      key,
      label,
      unitCount: cluster?.node.unit_count ?? 0,
      sourceCount: cluster?.node.source_count ?? 0,
      isCurrentActive: activeKey === key,
    };
  }, [selected, trees, regionLabelByKey, unitsByNodeSubtree, activeKey, t]);

  const renderUnitList = (fallbackList = false) => (
    <div
      id="sag-universe-browser"
      className={fallbackList ? styles.fallbackList : styles.browser}
      data-universe-fallback={fallbackList || undefined}
    >
      <div className={styles.browserHeading}>
        <span>
          {t("browse")}
          {docGroups.length > 0 && (
            <small className={styles.browserMeta}>
              {docGroups.length} docs · {visibleUnitList.length} units
            </small>
          )}
        </span>
        {!fallbackList && (
          <button
            type="button"
            aria-label={t("close")}
            onClick={() => setShowList(false)}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {active && (
        <div className={styles.browserScopeBar}>
          <span>
            Scope: <strong>{activeRegionLabel}</strong>
          </span>
          <button
            type="button"
            className={styles.browserUpButton}
            onClick={back}
          >
            ↑ Up one level
          </button>
        </div>
      )}
      <label className={styles.localSearch}>
        <Search aria-hidden="true" className="size-3.5 shrink-0" />
        <input
          ref={searchRef}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Filter regions, documents, or units…"
          aria-label={t("atlas.findInView")}
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-white/50 hover:text-white"
            aria-label={t("close")}
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <kbd className={styles.kbdHint}>Ctrl K</kbd>
        )}
      </label>
      <div className={styles.browserBody}>
        {filteredClusters.length > 0 && (
          <>
            <div className={styles.sectionHeader}>
              <span>
                {!active
                  ? "Regions"
                  : isShowingSiblingClusters
                    ? "Sibling Regions"
                    : "Sub-regions"}
              </span>
              <span>{filteredClusters.length}</span>
            </div>
            {filteredClusters.map((item) => {
              const itemKey = knowledgeClusterKey(item.ref);
              const isItemActive = itemKey === activeKey;
              return (
                <button
                  key={itemKey}
                  type="button"
                  className={styles.regionRow}
                  data-active={isItemActive || undefined}
                  onMouseEnter={() => prefetchRegion(item.ref)}
                  onClick={() => {
                    setSearchQuery("");
                    navigate(item.ref);
                  }}
                >
                  <Orbit className="size-3.5 shrink-0 text-[#e7b58a]/85" />
                  <strong>{item.label}</strong>
                  <span className={styles.regionCountPill}>
                    {item.node.unit_count} units
                    {item.childCount > 0 ? ` · ${item.childCount} sub` : ""}
                  </span>
                  <ChevronRight className="size-3.5 shrink-0 text-white/40" />
                </button>
              );
            })}
          </>
        )}

        {docGroups.map((group, groupIndex) => {
          const cleanDocTitle = humanizeDocName(
            group.document_name,
            group.units[0]?.heading,
          );
          // Deduplicate units that share the exact same section heading within the same document
          const seenTitles = new Set<string>();
          const uniqueUnits = group.units.filter((unit) => {
            const titleKey = cleanNeuronLabel(unit).toLocaleLowerCase();
            if (seenTitles.has(titleKey)) return false;
            seenTitles.add(titleKey);
            return true;
          });
          const units = uniqueUnits.filter((unit) => {
            const displayTitle = cleanNeuronLabel(unit);
            return matchesQuery(
              `${displayTitle} ${unit.heading} ${cleanDocTitle}`,
            );
          });
          if (units.length === 0) return null;

          return (
            <div key={group.document_id} className={styles.ganglionGroup}>
              {groupIndex === 0 && (
                <div className={styles.sectionHeader}>
                  <span>Documents</span>
                  <span>{docGroups.length}</span>
                </div>
              )}
              <div className={styles.ganglionHeader}>
                <div className={styles.ganglionTitle} title={cleanDocTitle}>
                  <FileText className="size-3.5 shrink-0" />
                  <strong>{cleanDocTitle}</strong>
                </div>
                <span className={styles.ganglionCount}>
                  {units.length} sections
                </span>
              </div>
              {units.map((unit) => {
                const displayTitle = cleanNeuronLabel(unit);
                return (
                  <button
                    key={unit.id}
                    type="button"
                    className={styles.unitRow}
                    data-selected={selected?.unitId === unit.id}
                    onClick={() => {
                      selectUnit(unit, unitRefMap.get(unit.id));
                      setShowList(false);
                    }}
                  >
                    <span className={styles.unitSomaDot} />
                    <span>
                      <strong>{displayTitle}</strong>
                      <small>{t("page", { page: unit.page_from })}</small>
                    </span>
                    <ChevronRight className="mt-1 size-3.5 shrink-0 text-white/40" />
                  </button>
                );
              })}
            </div>
          );
        })}

        {pageLoading && (
          <p className={styles.inlineStatus}>
            <Loader2 className="size-4 animate-spin" />
            {t("loadingUnits")}
          </p>
        )}
        {query &&
          !pageLoading &&
          filteredClusters.length === 0 &&
          !visibleUnitList.some((unit) =>
            matchesQuery(
              `${cleanNeuronLabel(unit)} ${unit.heading} ${humanizeDocName(unit.document_name, unit.heading)}`,
            ),
          ) && (
            <p className={styles.inlineStatus}>{t("atlas.noFilterResults")}</p>
          )}
      </div>
    </div>
  );

  const leftDrawerVisible = Boolean(!fallback && showList && !selected);
  const rightDrawerVisible = Boolean(selected);

  return (
    <div
      className={cn(
        "sag-knowledge-universe relative h-full min-h-0 flex-1 overflow-hidden",
        styles.universe,
      )}
      aria-label={t("title")}
      data-universe-mode="explore"
      data-universe-view={active ? "detail" : "overview"}
      data-universe-reduced-motion={Boolean(reducedMotion)}
      data-universe-knowledge="true"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          if (showList) setShowList(false);
          else back();
        }
      }}
    >
      {manifest && !fallback && trees.length > 0 && viewMode === "atlas" && (
        <div className={cn("sag-universe-graph", styles.graph)}>
          <NeuralAtlasScene
            key={`${projectId}:${sceneAttempt}`}
            ref={graphRef}
            regions={subtreeRegions}
            neurons={cortexNeurons}
            edges={cortexEdges}
            selectedKey={selectedSceneId}
            activeRegionKey={active ? activeKey : null}
            leftDrawerOpen={leftDrawerVisible}
            rightDrawerOpen={rightDrawerVisible}
            darkTheme={true}
            onUnavailable={setSceneFailure}
            keyboardHint={t("keyboardHint")}
            reducedMotion={Boolean(reducedMotion)}
            filterMode="all"
            onHoverRegion={(region) =>
              prefetchRegion(
                region
                  ? {
                      project_id: region.project_id,
                      tree_version: region.tree_version,
                      node_id: region.node.id,
                    }
                  : null,
              )
            }
            onSelectRegion={(region) => {
              const target = {
                project_id: region.project_id,
                tree_version: region.tree_version,
                node_id: region.node.id,
              };
              if (knowledgeClusterKey(target) !== activeKey) {
                navigate(target);
                return;
              }
              const clusterUnits =
                unitsByNodeSubtree.get(region.node.id) ?? [];
              const heroUnit = [...clusterUnits].sort(
                (a, b) =>
                  knowledgePreviewScore(b) - knowledgePreviewScore(a) ||
                  a.id.localeCompare(b.id),
              )[0];
              if (heroUnit && selected?.unitId !== heroUnit.id) {
                selectUnit(heroUnit, target);
              } else {
                clearSelection();
                graphRef.current?.focusAll();
              }
            }}
            onSelectNeuron={(neuron) => {
              const ref = unitRefMap.get(neuron.unit.id);
              selectUnit(neuron.unit, ref);
            }}
            onDiveNeuron={(neuron) => {
              const ref = unitRefMap.get(neuron.unit.id);
              if (ref && knowledgeClusterKey(ref) !== activeKey) {
                navigate(ref, neuron.unit.id);
              } else {
                selectUnit(neuron.unit, ref);
              }
            }}
            onClearSelection={clearSelection}
          />
        </div>
      )}

      {manifest && !fallback && trees.length > 0 && viewMode === "orbital" && (
        <div
          className={styles.orbitalContainer}
          data-left-drawer={leftDrawerVisible || undefined}
          data-right-drawer={rightDrawerVisible || undefined}
        >
          <OrbitalEventEntityGraph
            graph={orbitalGraphData}
            refreshKey={`${projectId}:${activeKey}:${visibleUnitList.length}`}
            onOpenEvent={(eventItem) => {
              const found = allVisibleUnits.find(
                ({ unit }) => unit.id === eventItem.id,
              );
              if (found) {
                selectUnit(found.unit, found.ref);
              }
            }}
          />
        </div>
      )}

      <header className={styles.topbar}>
        <nav
          className={styles.breadcrumbs}
          aria-label={t("navigation")}
          data-universe-navigation="true"
        >
          {active && (
            <button
              type="button"
              className={styles.breadcrumbBackButton}
              onClick={back}
              title={t("back")}
              aria-label={t("back")}
            >
              <ArrowLeft className="size-3" />
              <span>{t("back")}</span>
            </button>
          )}
          <button
            type="button"
            aria-current={!active && !selected ? "location" : undefined}
            onClick={() => navigate(null)}
          >
            <span className={styles.scopeDot} />
            <span>{t("overview")}</span>
          </button>
          {trail.map((node, index) => {
            const nodeRef: KnowledgeCluster = {
              project_id: active?.project_id ?? projectId,
              tree_version: active?.tree_version ?? trees[0]?.tree_version ?? "",
              node_id: node.id,
            };
            const label =
              regionLabelByKey.get(knowledgeClusterKey(nodeRef)) ??
              formatCorticalRegionLabel(
                node,
                unitsByNodeSubtree.get(node.id) ?? [],
                t("clusterFallback", { index: index + 1 }),
              );
            return (
              <React.Fragment key={node.id}>
                <span>/</span>
                <button
                  type="button"
                  aria-current={
                    index === trail.length - 1 ? "location" : undefined
                  }
                  onClick={() =>
                    active && navigate({ ...active, node_id: node.id })
                  }
                >
                  {label}
                </button>
              </React.Fragment>
            );
          })}
          {!active && detail && selected && (
            <>
              <span>/</span>
              <button
                type="button"
                className={styles.breadcrumbSelection}
                onClick={() =>
                  navigate({
                    project_id: selected.projectId,
                    tree_version: selected.treeVersion,
                    node_id: selected.nodeId,
                  })
                }
              >
                {selectedClusterInfo?.label ??
                  humanizeDocName(detail.document_name, detail.heading)}
              </button>
            </>
          )}
          {pageLoading && !loading ? (
            <span className={styles.scopeBadge} role="status">
              <Loader2 className="size-3 animate-spin text-[#e7b58a]" />
              {t("loadingUnits")}
            </span>
          ) : visibleUnitList.length > 0 ? (
            <span className={styles.scopeBadge}>
              {visibleUnitList.length} units
            </span>
          ) : null}
        </nav>

        {/* 3D Experience Switcher: Neural Atlas 3D vs Orbital Sphere 3D */}
        <div
          className={styles.modeSwitcher}
          role="group"
          aria-label={t("atlas.knowledge")}
        >
          <button
            type="button"
            data-active={viewMode === "atlas"}
            onClick={() => setViewMode("atlas")}
          >
            <Brain className="size-3.5" />
            <span>{t("atlas.neuralAtlasMode")}</span>
          </button>
          <button
            type="button"
            data-active={viewMode === "orbital"}
            onClick={() => setViewMode("orbital")}
          >
            <Globe2 className="size-3.5" />
            <span>{t("atlas.orbitalSphereMode")}</span>
          </button>
        </div>

        <div className={styles.topbarActions}>
          <button
            type="button"
            className={styles.actionButton}
            aria-expanded={showList}
            aria-controls="sag-universe-browser"
            onClick={() => {
              clearSelection();
              setShowList((value) => !value);
            }}
          >
            <Layers3 className="size-3.5" />
            <span>{t("browse")}</span>
            <kbd className={styles.kbdHint}>Ctrl K</kbd>
          </button>
          <button
            type="button"
            className={styles.actionButton}
            onClick={refresh}
            title={t("refresh")}
            aria-label={t("refresh")}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            <span className="hidden sm:inline">{t("refresh")}</span>
          </button>
        </div>
      </header>

      {!activeProjectsQuery.isLoading && !projectId && (
        <div className={styles.centerStatus}>
          <Layers3 className="mx-auto mb-3 size-8 text-[#d49b62]/70" />
          <h2>{t("noProjectsTitle")}</h2>
          <p>{t("noProjectsDescription")}</p>
          <div className="mt-5 flex justify-center">
            <Link href="/projects" className={styles.actionButton}>
              {t("openProjects")}
            </Link>
          </div>
        </div>
      )}

      {loading && projectId && (
        <div className={styles.centerStatus} role="status">
          <div className={styles.loadingOrbit}>
            <Brain className="size-7 animate-pulse text-[#d49b62]" />
          </div>
          <h2>{t("loading")}</h2>
          <p>{t("loadingHint")}</p>
        </div>
      )}

      {empty && projectId && (
        <div className={styles.centerStatus}>
          <Layers3 className="mx-auto mb-3 size-8 text-[#d49b62]/70" />
          <h2>
            {t(
              status === "failed"
                ? "failedTitle"
                : status === "stale"
                  ? "staleTitle"
                  : "emptyTitle",
            )}
          </h2>
          <p>
            {t(
              status === "failed"
                ? "failedHint"
                : status === "stale"
                  ? "staleHint"
                  : "emptyHint",
            )}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              className={styles.actionButton}
              onClick={refresh}
            >
              <RefreshCw className="size-3.5" />
              {t("refresh")}
            </button>
            <Link
              href={`/projects/${projectId}/documents`}
              className={styles.actionButton}
            >
              <FileText className="size-3.5" />
              {t("openDocuments")}
            </Link>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className={styles.error}>
          <span>{error}</span>
          <button
            type="button"
            className={styles.actionButton}
            onClick={refresh}
          >
            {t("retry")}
          </button>
        </div>
      )}

      {fallback && trees.length > 0 && (
        <>
          <div className={styles.fallbackNotice} role="status">
            <p>
              {t("webgl.title")} · {t("listAvailable")}
            </p>
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => {
                setSceneFailure(null);
                setSceneAttempt((value) => value + 1);
              }}
            >
              {t("webgl.retry")}
            </button>
          </div>
          {renderUnitList(true)}
        </>
      )}

      {leftDrawerVisible && renderUnitList()}

      {selected && (
        <aside
          className={styles.detail}
          aria-label={t("details")}
          data-universe-detail-panel="true"
          data-selected-unit={detail?.id}
        >
          <div className={styles.browserHeading}>
            <span>{t("atlas.selectedKnowledge")}</span>
            <button
              type="button"
              aria-label={t("close")}
              onClick={clearSelection}
            >
              <X className="size-4" />
            </button>
          </div>
          {detailLoading && (
            <p className={styles.inlineStatus} role="status">
              <Loader2 className="size-4 animate-spin" />
              {t("loadingEvidence")}
            </p>
          )}
          {detail && (
            <div className={styles.detailContent}>
              <h2 aria-live="polite">{cleanNeuronLabel(detail)}</h2>
              <p className={styles.sourceMeta}>
                {humanizeDocName(detail.document_name, detail.heading)} ·{" "}
                {t("page", { page: detail.page_from })}
              </p>
              {selectedClusterInfo && (
                <div
                  className={styles.clusterContextCard}
                  data-universe-cluster-context="true"
                >
                  <div className={styles.clusterContextMeta}>
                    <small>Cortical Region</small>
                    <strong>{selectedClusterInfo.label}</strong>
                  </div>
                  {!selectedClusterInfo.isCurrentActive && (
                    <button
                      type="button"
                      className={styles.clusterDiveButton}
                      onMouseEnter={() =>
                        prefetchRegion(selectedClusterInfo.ref)
                      }
                      onClick={() =>
                        navigate(selectedClusterInfo.ref, selected.unitId)
                      }
                    >
                      <span>Explore Region</span>
                      <span aria-hidden="true">↗</span>
                    </button>
                  )}
                </div>
              )}
              <div className={styles.passage}>
                {knowledgePassage(detail.content).text || detail.preview}
              </div>
              {!sourceProjection && Boolean(detail.synapses?.length) && (
                <section className={styles.connections}>
                  <h3>{t("related")}</h3>
                  {detail.synapses?.map((synapse) => (
                    <button
                      type="button"
                      key={synapse.target_unit_id}
                      className={styles.connectionRow}
                      onClick={() => jumpToSynapse(synapse)}
                    >
                      <span>
                        <strong>
                          {knowledgeUnitTitle({
                            label: synapse.target_label,
                            heading: synapse.target_heading,
                            preview: synapse.target_preview,
                            document_name: synapse.target_document_name,
                          })}
                        </strong>
                        <small>{connectionReason(synapse)}</small>
                      </span>
                      <ChevronRight className="size-4 shrink-0" />
                    </button>
                  ))}
                </section>
              )}
            </div>
          )}
        </aside>
      )}

      {manifest &&
        !fallback &&
        trees.length > 0 &&
        clusterChoices.length > 0 &&
        !(current?.node.is_leaf && page && page.total > pageSize && !selected) && (
          <nav
            className={styles.depthDock}
            aria-label="Cortical depth and region navigator"
            data-universe-depth-dock="true"
          >
            <span className={styles.depthBadge}>
              <Orbit className="size-3" />
              <span>
                {!active
                  ? "L1 · OVERVIEW"
                  : current?.node.is_leaf
                    ? "L3 · LEAF CLUSTER"
                    : "L2 · SUB-REGIONS"}
              </span>
            </span>
            {active && (
              <button
                type="button"
                className={styles.depthUpButton}
                onClick={back}
                title="Up one cortical level"
              >
                <ArrowLeft className="size-3" />
                <span>Parent</span>
              </button>
            )}
            <div className={styles.depthChipTrack}>
              {clusterChoices.map((item) => {
                const itemKey = knowledgeClusterKey(item.ref);
                const isItemActive = itemKey === activeKey;
                return (
                  <button
                    key={itemKey}
                    type="button"
                    className={styles.depthChip}
                    data-active={isItemActive || undefined}
                    onMouseEnter={() => prefetchRegion(item.ref)}
                    onClick={() => navigate(item.ref)}
                  >
                    <span>{item.label}</span>
                    <span className={styles.depthChipCount}>
                      {item.node.unit_count}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}

      {manifest && trees.length > 0 && viewMode === "atlas" && (
        <>
          <div className={styles.tools}>
            {active && (
              <button
                type="button"
                title={t("back")}
                aria-label={t("back")}
                onClick={back}
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            <button
              type="button"
              title={t("fit")}
              aria-label={t("fit")}
              disabled={fallback}
              onClick={() => graphRef.current?.focusAll()}
            >
              <Focus className="size-4" />
            </button>
            <button
              type="button"
              title={t("atlas.zoomOut")}
              aria-label={t("atlas.zoomOut")}
              disabled={fallback}
              onClick={() => graphRef.current?.zoomOut()}
            >
              <Minus className="size-4" />
            </button>
            <button
              type="button"
              title={t("atlas.zoomIn")}
              aria-label={t("atlas.zoomIn")}
              disabled={fallback}
              onClick={() => graphRef.current?.zoomIn()}
            >
              <Plus className="size-4" />
            </button>
          </div>
          <footer className={styles.legend}>
            <span>
              <i data-kind="knowledge" />
              {t("unit")}
            </span>
            <span>
              <i data-kind="evidence" />
              {t("atlas.relatedEvidence")}
            </span>
            <small>{t("gestureHint")}</small>
          </footer>
        </>
      )}

      {!selected && current?.node.is_leaf && page && (
        <div className={styles.pagination} data-universe-pagination="true">
          <button
            type="button"
            aria-label={t("previous")}
            disabled={pageIndex === 0 || pageLoading}
            onClick={() => {
              clearSelection();
              setPageIndex((value) => value - 1);
            }}
          >
            <ChevronLeft className="size-4" />
          </button>
          <span>
            {t("range", {
              from: page.total ? pageIndex * pageSize + 1 : 0,
              to: Math.min((pageIndex + 1) * pageSize, page.total),
              total: page.total,
            })}
          </span>
          <button
            type="button"
            aria-label={t("next")}
            disabled={!page.next_cursor || pageLoading}
            onClick={() => {
              if (page.next_cursor) {
                clearSelection();
                setCursors((value) => [
                  ...value.slice(0, pageIndex + 1),
                  page.next_cursor!,
                ]);
                setPageIndex((value) => value + 1);
              }
            }}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function KnowledgeUniverseWorkspace() {
  const t = useTranslations("knowledgeUniverse");
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-[#0c1117] text-white/75">
          <Loader2 className="mr-2 size-5 animate-spin text-[#e7b58a]" />
          <span className="text-sm">{t("loading")}</span>
        </div>
      }
    >
      <KnowledgeUniverseContent />
    </Suspense>
  );
}
