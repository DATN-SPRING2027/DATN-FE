"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/utils";
import type {
  MindMapLayoutResult,
  PositionedMindMapNode,
} from "./mind-map-layout";

const MIN_SCALE = 0.4;
const MAX_SCALE = 1.75;
const ZOOM_STEP = 0.15;

export type AiChatMindMapCanvasProps = Readonly<{
  layout: MindMapLayoutResult;
  selectedNodeId: string | null;
  isFullscreen: boolean;
  onSelectNode: (nodeId: string) => void;
  onToggleNode: (nodeId: string) => void;
  onExpandAll: () => void;
  onCollapseDefault: () => void;
}>;

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(value.toFixed(2))));
}

export default function AiChatMindMapCanvas({
  layout,
  selectedNodeId,
  isFullscreen,
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
        pan: { x: 12, y: 12 },
      };
    }
    const fitX = (containerSize.width - 20) / Math.max(1, layout.width);
    const fitY = (containerSize.height - 54) / Math.max(1, layout.height);
    const nextScale = clampScale(
      Math.min(isFullscreen ? 1.05 : 0.96, fitX, fitY),
    );
    const offsetX = Math.max(
      8,
      Math.round((containerSize.width - layout.width * nextScale) / 2),
    );
    const offsetY = Math.max(
      8,
      Math.round((containerSize.height - 40 - layout.height * nextScale) / 2),
    );
    return {
      scale: nextScale,
      pan: { x: offsetX, y: offsetY },
    };
  }, [containerSize, isFullscreen, layout.height, layout.width]);

  const activeCamera = userCamera ?? autoFitCamera;
  const scale = activeCamera.scale;
  const pan = activeCamera.pan;

  const selectedPathIds = useMemo(() => {
    const active = new Set<string>();
    if (!selectedNodeId) return active;
    active.add(selectedNodeId);
    // Trace edges backwards from selectedNodeId up to root
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
        scale: clampScale(base.scale + ZOOM_STEP),
        pan: base.pan,
      };
    });
  }, [autoFitCamera]);

  const handleZoomOut = useCallback(() => {
    setUserCamera((prev) => {
      const base = prev ?? autoFitCamera;
      return {
        scale: clampScale(base.scale - ZOOM_STEP),
        pan: base.pan,
      };
    });
  }, [autoFitCamera]);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const delta = event.deltaY < 0 ? 0.1 : -0.1;
        setUserCamera((prev) => {
          const base = prev ?? autoFitCamera;
          return {
            scale: clampScale(base.scale + delta),
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
    [autoFitCamera],
  );

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
    const citeCount = item.node.citationNumbers.length;
    const textStartX = item.x + (isRoot ? 16 : 18);
    const firstLineY =
      item.y +
      (item.lines.length === 2
        ? citeCount > 0
          ? 24
          : 27
        : citeCount > 0
          ? 24
          : Math.round(item.height / 2 + 4));

    const toggleWidth = item.isExpanded ? 24 : Math.max(28, 20 + String(item.hiddenDescendantCount).length * 7);
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
            rx={12}
            ry={12}
            strokeWidth={isSelected ? 2 : 1.25}
            className={cn(
              "transition-colors duration-150",
              isRoot
                ? isSelected
                  ? "fill-brand-700 stroke-brand-300 dark:fill-brand-600 dark:stroke-brand-300"
                  : "fill-brand-600 stroke-brand-700 hover:fill-brand-700 dark:fill-brand-600 dark:stroke-brand-400"
                : isSelected
                  ? "fill-brand-50 stroke-brand-500 dark:fill-brand-950 dark:stroke-brand-400"
                  : "fill-white stroke-gray-200 hover:stroke-brand-300 dark:fill-gpt-popover dark:stroke-white/15 dark:hover:stroke-brand-400/70",
            )}
          />

          {!isRoot && (
            <rect
              x={item.x + 5}
              y={item.y + 10}
              width={3.5}
              height={Math.max(16, item.height - 20)}
              rx={2}
              className={cn(
                item.depth === 1
                  ? "fill-brand-500 dark:fill-brand-400"
                  : item.depth === 2
                    ? "fill-blue-light-500 dark:fill-blue-light-400"
                    : "fill-success-500 dark:fill-success-400",
              )}
            />
          )}

          <text
            x={textStartX}
            y={firstLineY}
            className={cn(
              "select-none text-[12.5px] font-semibold",
              isRoot
                ? "fill-white"
                : isSelected
                  ? "fill-brand-950 dark:fill-white"
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
            <text
              x={textStartX}
              y={item.y + item.height - 10}
              className={cn(
                "select-none text-[10.5px] font-medium tabular-nums",
                isRoot
                  ? "fill-brand-100"
                  : isSelected
                    ? "fill-brand-700 dark:fill-brand-300"
                    : "fill-gray-500 dark:fill-gray-400",
              )}
            >
              {t("mindMapNodeSourcesCount", { count: citeCount })}
            </text>
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
                  ? "fill-gray-100 stroke-gray-300 hover:fill-gray-200 dark:fill-gpt-composer dark:stroke-white/20 dark:hover:fill-gpt-bubble"
                  : "fill-brand-50 stroke-brand-300 hover:fill-brand-100 dark:fill-brand-950 dark:stroke-brand-400/60 dark:hover:fill-brand-900",
              )}
            />
            <text
              x={toggleX + toggleWidth / 2}
              y={toggleY + 15.5}
              textAnchor="middle"
              className={cn(
                "select-none text-[11px] font-semibold tabular-nums",
                item.isExpanded
                  ? "fill-gray-700 dark:fill-gray-200"
                  : "fill-brand-700 dark:fill-brand-300",
              )}
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
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn(
        "relative flex min-h-64 flex-1 touch-none overflow-hidden bg-gray-50/90 select-none dark:bg-gpt-canvas",
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
            width={20}
            height={20}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={2}
              cy={2}
              r={1}
              className="fill-gray-300/70 dark:fill-white/10"
            />
          </pattern>
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
            return (
              <path
                key={edge.id}
                d={edge.path}
                fill="none"
                strokeWidth={isHighlighted ? 2.25 : 1.5}
                strokeLinecap="round"
                className={cn(
                  "transition-colors duration-150",
                  isHighlighted
                    ? "stroke-brand-500 dark:stroke-brand-400"
                    : "stroke-gray-300 dark:stroke-white/20",
                )}
              />
            );
          })}

          {layout.nodes.map(renderNode)}
        </g>
      </svg>

      {/* Floating Bottom Controls */}
      <div
        data-mind-map-interactive="true"
        className="pointer-events-auto absolute start-3 end-3 bottom-3 flex flex-wrap items-center justify-between gap-2"
      >
        <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200/90 bg-white/95 p-1 shadow-theme-xs backdrop-blur-xs dark:border-white/10 dark:bg-gpt-popover/95">
          <button
            type="button"
            onClick={onCollapseDefault}
            className="rounded-lg px-2 py-1 text-[11px] font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
          >
            {t("mindMapCollapseDefault")}
          </button>
          <button
            type="button"
            onClick={onExpandAll}
            className="rounded-lg px-2 py-1 text-[11px] font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
          >
            {t("mindMapExpandAll")}
          </button>
          <span className="hidden px-1.5 text-[11px] text-gray-500 tabular-nums sm:inline dark:text-gray-400">
            {t("mindMapVisibleNodesMeta", {
              visible: layout.visibleNodeCount,
              total: layout.totalNodeCount,
            })}
          </span>
        </div>

        <div className="inline-flex items-center gap-0.5 rounded-xl border border-gray-200/90 bg-white/95 p-1 shadow-theme-xs backdrop-blur-xs dark:border-white/10 dark:bg-gpt-popover/95">
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label={t("mindMapZoomOut")}
            className="inline-flex size-6 items-center justify-center rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
          >
            −
          </button>
          <span className="min-w-11 px-1 text-center text-[11px] font-medium text-gray-700 tabular-nums dark:text-gray-200">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label={t("mindMapZoomIn")}
            className="inline-flex size-6 items-center justify-center rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleFitView}
            className="ms-0.5 rounded-lg px-2 py-1 text-[11px] font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/15"
          >
            {t("mindMapFitView")}
          </button>
        </div>
      </div>
    </div>
  );
}
