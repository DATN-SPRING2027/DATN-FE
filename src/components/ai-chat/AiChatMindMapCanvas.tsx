"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/utils";
import type {
  MindMapLayoutResult,
  PositionedMindMapNode,
} from "./mind-map-layout";
import { getMindMapBranchPalette } from "./mind-map-theme";

const MIN_SCALE = 0.4;
const MAX_SCALE = 1.75;
const ZOOM_STEP = 0.15;

export type AiChatMindMapCanvasProps = Readonly<{
  layout: MindMapLayoutResult;
  selectedNodeId: string | null;
  isFullscreen: boolean;
  inspectorReserveWidth?: number;
  onSelectNode: (nodeId: string) => void;
  onToggleNode: (nodeId: string) => void;
  onExpandAll: () => void;
  onCollapseDefault: () => void;
}>;

function clampScale(value: number, minimum = MIN_SCALE): number {
  return Math.min(MAX_SCALE, Math.max(minimum, Number(value.toFixed(2))));
}

export default function AiChatMindMapCanvas({
  layout,
  selectedNodeId,
  isFullscreen,
  inspectorReserveWidth = 0,
  onSelectNode,
  onToggleNode,
  onExpandAll,
  onCollapseDefault,
}: AiChatMindMapCanvasProps) {
  const t = useTranslations("AiChat");
  const patternId = useId().replace(/:/g, "");
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
    originScale: number;
    moved: boolean;
  } | null>(null);

  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [userCamera, setUserCamera] = useState<{
    scale: number;
    pan: { x: number; y: number };
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (width <= 0 || height <= 0) return;
      setContainerSize((prev) =>
        prev && prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const autoFitCamera = useMemo(() => {
    if (
      !containerSize ||
      containerSize.width <= 0 ||
      containerSize.height <= 0
    ) {
      return {
        scale: isFullscreen ? 1 : 0.72,
        pan: { x: 14, y: 24 },
      };
    }
    const reservedEnd =
      isFullscreen &&
      inspectorReserveWidth > 0 &&
      containerSize.width >= 1024
        ? inspectorReserveWidth
        : 0;
    const effectiveWidth = Math.max(240, containerSize.width - reservedEnd);
    const fitX =
      Math.max(1, effectiveWidth - 24) / Math.max(1, layout.width);
    const fitY =
      Math.max(1, containerSize.height - 64) / Math.max(1, layout.height);
    // Fit must include every node, even when a supported tree needs <40% zoom.
    const nextScale = Math.min(isFullscreen ? 1.05 : 0.96, fitX, fitY);
    const offsetX = Math.max(
      10,
      Math.round((effectiveWidth - layout.width * nextScale) / 2),
    );
    const topSafeInset = containerSize.height >= 360 ? 36 : 8;
    const bottomSafeInset = 44;
    const usableHeight = Math.max(
      1,
      containerSize.height - topSafeInset - bottomSafeInset,
    );
    const offsetY = Math.max(
      topSafeInset,
      topSafeInset + Math.round((usableHeight - layout.height * nextScale) / 2),
    );
    return {
      scale: nextScale,
      pan: { x: offsetX, y: offsetY },
    };
  }, [
    containerSize,
    inspectorReserveWidth,
    isFullscreen,
    layout.height,
    layout.width,
  ]);

  const activeCamera = userCamera ?? autoFitCamera;
  const minimumScale = Math.min(MIN_SCALE, autoFitCamera.scale);
  const scale = activeCamera.scale;
  const pan = activeCamera.pan;

  const selectedPathIds = useMemo(() => {
    const active = new Set<string>();
    if (!selectedNodeId) return active;
    active.add(selectedNodeId);
    const parentByChild = new Map<string, string>();
    for (const edge of layout.edges) {
      parentByChild.set(edge.targetId, edge.sourceId);
    }
    let cursor: string | undefined = selectedNodeId;
    while (cursor) {
      active.add(cursor);
      cursor = parentByChild.get(cursor);
    }
    return active;
  }, [layout.edges, selectedNodeId]);

  const handleFitView = useCallback(() => {
    const el = viewportRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (width > 0 && height > 0) {
        setContainerSize({ width, height });
      }
    }
    setUserCamera(null);
  }, []);

  const handleZoomIn = useCallback(() => {
    setUserCamera((prev) => {
      const base = prev ?? autoFitCamera;
      return {
        scale: clampScale(base.scale + ZOOM_STEP, minimumScale),
        pan: base.pan,
      };
    });
  }, [autoFitCamera, minimumScale]);

  const handleZoomOut = useCallback(() => {
    setUserCamera((prev) => {
      const base = prev ?? autoFitCamera;
      return {
        scale: clampScale(base.scale - ZOOM_STEP, minimumScale),
        pan: base.pan,
      };
    });
  }, [autoFitCamera, minimumScale]);

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const delta = event.deltaY < 0 ? 0.1 : -0.1;
        setUserCamera((prev) => {
          const base = prev ?? autoFitCamera;
          return {
            scale: clampScale(base.scale + delta, minimumScale),
            pan: base.pan,
          };
        });
        return;
      }
      setUserCamera((prev) => {
        const base = prev ?? autoFitCamera;
        return {
          scale: base.scale,
          pan: {
            x: Math.round(base.pan.x - event.deltaX * 0.6),
            y: Math.round(base.pan.y - event.deltaY * 0.6),
          },
        };
      });
    },
    [autoFitCamera, minimumScale],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const target = event.target as Element | null;
      if (target?.closest("[data-mind-map-interactive='true']")) {
        return;
      }
      dragStateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        originX: pan.x,
        originY: pan.y,
        originScale: scale,
        moved: false,
      };
      setIsDragging(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [pan.x, pan.y, scale],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startClientX;
      const dy = event.clientY - drag.startClientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        drag.moved = true;
      }
      if (!drag.moved) return;
      setUserCamera({
        scale: drag.originScale,
        pan: {
          x: Math.round(drag.originX + dx),
          y: Math.round(drag.originY + dy),
        },
      });
    },
    [],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragStateRef.current = null;
      setIsDragging(false);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [],
  );

  const renderNode = (item: PositionedMindMapNode) => {
    const isRoot = item.depth === 0;
    const isSelected = item.node.id === selectedNodeId;
    const isOnSelectedTrail = selectedPathIds.has(item.node.id);
    const palette = getMindMapBranchPalette(item.branchIndex);
    const citeCount = item.node.citationNumbers.length;
    const textStartX = item.x + (isRoot ? 18 : 20);
    const firstLineY =
      item.y +
      (item.lines.length === 2
        ? citeCount > 0
          ? 24
          : 28
        : citeCount > 0
          ? 24
          : Math.round(item.height / 2 + 4));

    const sourceLabel =
      citeCount > 0 ? t("mindMapNodeSourcesCount", { count: citeCount }) : "";
    const sourcePillWidth =
      citeCount > 0 ? Math.max(54, 18 + sourceLabel.length * 5.8) : 0;

    const toggleWidth = item.isExpanded
      ? 24
      : Math.max(30, 20 + String(item.hiddenDescendantCount).length * 7);
    const toggleX = item.x + item.width + 6;
    const toggleY = Math.round(item.centerY - 12);

    return (
      <g key={item.node.id}>
        <g
          data-testid={`mind-map-node-${item.node.id}`}
          data-mind-map-interactive="true"
          role="button"
          tabIndex={0}
          aria-pressed={isSelected}
          onClick={() => onSelectNode(item.node.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectNode(item.node.id);
            }
          }}
          className="cursor-pointer focus:outline-none"
        >
          <rect
            x={item.x}
            y={item.y}
            width={item.width}
            height={item.height}
            rx={isRoot ? 14 : 12}
            ry={isRoot ? 14 : 12}
            filter={`url(#mindmap-shadow-${patternId})`}
            fill={isRoot ? `url(#mindmap-root-grad-${patternId})` : undefined}
            strokeWidth={isSelected ? 2.25 : isOnSelectedTrail ? 1.6 : 1.25}
            className={cn(
              "transition-colors duration-150",
              isRoot
                ? isSelected
                  ? "stroke-brand-300 dark:stroke-brand-300"
                  : "stroke-brand-700 dark:stroke-brand-400/80"
                : isSelected
                  ? palette.selectedCard
                  : cn(
                      "fill-white stroke-gray-200/95 dark:fill-gpt-popover dark:stroke-white/15",
                      palette.restCardHover,
                    ),
            )}
          />

          {!isRoot && (
            <rect
              x={item.x + 6}
              y={item.y + 10}
              width={4}
              height={Math.max(18, item.height - 20)}
              rx={2}
              className={palette.accentFill}
            />
          )}

          <text
            x={textStartX}
            y={firstLineY}
            className={cn(
              "select-none text-xs font-semibold",
              isRoot
                ? "fill-white"
                : isSelected
                  ? "fill-gray-950 dark:fill-white"
                  : "fill-gray-900 dark:fill-gray-100",
            )}
          >
            <tspan x={textStartX} dy={0}>
              {item.lines[0]}
            </tspan>
            {item.lines[1] && (
              <tspan x={textStartX} dy={17}>
                {item.lines[1]}
              </tspan>
            )}
          </text>

          {citeCount > 0 && (
            <g>
              <rect
                x={textStartX}
                y={item.y + item.height - 23}
                width={sourcePillWidth}
                height={16}
                rx={8}
                className={
                  isRoot
                    ? "fill-white/18"
                    : palette.sourcePillFill
                }
              />
              <text
                x={textStartX + sourcePillWidth / 2}
                y={item.y + item.height - 11.5}
                textAnchor="middle"
                className={cn(
                  "select-none text-xs font-semibold tabular-nums",
                  isRoot ? "fill-white" : palette.sourcePillText,
                )}
                style={{ fontSize: "10px" }}
              >
                {sourceLabel}
              </text>
            </g>
          )}
        </g>

        {item.hasChildren && (
          <g
            data-testid={`mind-map-toggle-${item.node.id}`}
            data-mind-map-interactive="true"
            role="button"
            tabIndex={0}
            aria-expanded={item.isExpanded}
            aria-label={
              item.isExpanded
                ? t("mindMapToggleCollapseAria", { label: item.node.label })
                : t("mindMapToggleExpandAria", {
                    label: item.node.label,
                    count: item.hiddenDescendantCount,
                  })
            }
            onClick={(event) => {
              event.stopPropagation();
              onToggleNode(item.node.id);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onToggleNode(item.node.id);
              }
            }}
            className="cursor-pointer focus:outline-none"
          >
            <rect
              x={toggleX}
              y={toggleY}
              width={toggleWidth}
              height={24}
              rx={12}
              ry={12}
              strokeWidth={1.25}
              className={cn(
                "transition-colors",
                item.isExpanded
                  ? "fill-white stroke-gray-300 hover:fill-gray-100 dark:fill-gpt-composer dark:stroke-white/20 dark:hover:fill-gpt-bubble"
                  : palette.expandPillRect,
              )}
            />
            <text
              x={toggleX + toggleWidth / 2}
              y={toggleY + 15.5}
              textAnchor="middle"
              className={cn(
                "select-none text-xs font-semibold tabular-nums",
                item.isExpanded
                  ? "fill-gray-700 dark:fill-gray-200"
                  : palette.expandPillText,
              )}
              style={{ fontSize: "11px" }}
            >
              {item.isExpanded ? "−" : `+${item.hiddenDescendantCount}`}
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div
      ref={viewportRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn(
        "relative flex min-h-60 flex-1 touch-none overflow-hidden bg-gray-50/95 select-none dark:bg-gpt-canvas",
        isDragging ? "cursor-grabbing" : "cursor-grab",
      )}
    >
      <svg
        role="img"
        aria-label={t("mindMapCanvasAriaLabel")}
        className="h-full w-full"
      >
        <defs>
          <pattern
            id={`mindmap-grid-${patternId}`}
            width={22}
            height={22}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={2}
              cy={2}
              r={1}
              className="fill-gray-300/75 dark:fill-white/10"
            />
          </pattern>

          <linearGradient
            id={`mindmap-root-grad-${patternId}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="var(--color-brand-500)" />
            <stop offset="100%" stopColor="var(--color-brand-700)" />
          </linearGradient>

          <filter
            id={`mindmap-shadow-${patternId}`}
            x="-8%"
            y="-10%"
            width="116%"
            height="128%"
          >
            <feDropShadow
              dx={0}
              dy={2}
              stdDeviation={2.5}
              floodColor="var(--color-gray-900)"
              floodOpacity={0.07}
            />
          </filter>
        </defs>

        <rect
          width="100%"
          height="100%"
          fill={`url(#mindmap-grid-${patternId})`}
        />

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
          {layout.edges.map((edge) => {
            const isHighlighted =
              selectedPathIds.has(edge.sourceId) &&
              selectedPathIds.has(edge.targetId);
            const edgePalette = getMindMapBranchPalette(edge.branchIndex);
            return (
              <path
                key={edge.id}
                d={edge.path}
                fill="none"
                strokeWidth={isHighlighted ? 2.5 : 1.65}
                strokeLinecap="round"
                className={cn(
                  "transition-colors duration-150",
                  isHighlighted ? edgePalette.activeEdge : edgePalette.restEdge,
                )}
              />
            );
          })}

          {layout.nodes.map(renderNode)}
        </g>
      </svg>

      {/* Unified Glassmorphism Bottom Control Dock */}
      <div
        data-mind-map-interactive="true"
        className="pointer-events-auto absolute start-3 bottom-3 z-10 inline-flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1 rounded-2xl border border-gray-200/90 bg-white/92 p-1 shadow-theme-sm backdrop-blur-md dark:border-white/12 dark:bg-gpt-popover/92"
      >
        <div className="inline-flex items-center gap-0.5">
          <button
            type="button"
            onClick={onCollapseDefault}
            className="rounded-xl px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
          >
            {t("mindMapCollapseDefault")}
          </button>
          <button
            type="button"
            onClick={onExpandAll}
            className="rounded-xl px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
          >
            {t("mindMapExpandAll")}
          </button>
          {isFullscreen ? (
            <span className="hidden px-1.5 text-xs text-gray-500 tabular-nums md:inline dark:text-gray-400">
              {t("mindMapVisibleNodesMeta", {
                visible: layout.visibleNodeCount,
                total: layout.totalNodeCount,
              })}
            </span>
          ) : null}
        </div>

        <span
          aria-hidden="true"
          className="h-4 w-px bg-gray-200 dark:bg-white/12"
        />

        <div className="inline-flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label={t("mindMapZoomOut")}
            className="inline-flex size-6.5 items-center justify-center rounded-xl text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
          >
            −
          </button>
          <span className="min-w-10 px-1 text-center text-xs font-semibold text-gray-700 tabular-nums dark:text-gray-200">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label={t("mindMapZoomIn")}
            className="inline-flex size-6.5 items-center justify-center rounded-xl text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleFitView}
            className="ms-0.5 rounded-xl bg-brand-50/80 px-2 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
          >
            {t("mindMapFitView")}
          </button>
        </div>
      </div>
    </div>
  );
}
