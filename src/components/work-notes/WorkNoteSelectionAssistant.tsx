"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SelectionAnchor } from "@/lib/queries/work-notes/work-note-agent.api";

export type SelectionAnchorPoint = {
  top: number;
  left: number;
  boxWidth: number;
};

const MIRROR_STYLE_PROPS = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "tabSize",
] as const;

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Computes floating trigger coordinates inside the textarea wrapper:
 * - Prefers exact pointer release coordinates (right next to the cursor when drag ends).
 * - Falls back to offscreen mirror caret measurement at selectionEnd for keyboard selection.
 */
export function computeTextareaSelectionPoint(
  textarea: HTMLTextAreaElement,
  selectionEnd: number,
  pointerClient?: { clientX: number; clientY: number } | null,
): SelectionAnchorPoint {
  const rect = textarea.getBoundingClientRect();
  const boxWidth = textarea.clientWidth || rect.width || 360;
  const boxHeight = textarea.clientHeight || rect.height || 220;

  if (
    pointerClient &&
    (pointerClient.clientX !== 0 || pointerClient.clientY !== 0) &&
    rect.width > 0 &&
    rect.height > 0
  ) {
    const relX = pointerClient.clientX - rect.left;
    const relY = pointerClient.clientY - rect.top;
    const preferredTop = relY - 36 >= 8 ? relY - 36 : relY + 12;
    return {
      top: clamp(Math.round(preferredTop), 8, Math.max(8, boxHeight - 44)),
      left: clamp(Math.round(relX + 8), 10, Math.max(10, boxWidth - 82)),
      boxWidth,
    };
  }

  if (typeof document === "undefined") {
    return { top: 12, left: 12, boxWidth };
  }

  const mirror = document.createElement("div");
  try {
    const computed = window.getComputedStyle(textarea);
    mirror.style.position = "absolute";
    mirror.style.visibility = "hidden";
    mirror.style.pointerEvents = "none";
    mirror.style.top = "0";
    mirror.style.left = "-9999px";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.overflowWrap = "break-word";
    for (const prop of MIRROR_STYLE_PROPS) {
      mirror.style[prop] = computed[prop];
    }
    if (!mirror.style.width || mirror.style.width === "0px") {
      mirror.style.width = `${boxWidth}px`;
    }

    mirror.appendChild(
      document.createTextNode(textarea.value.slice(0, selectionEnd)),
    );
    const marker = document.createElement("span");
    marker.textContent = "\u200b";
    mirror.appendChild(marker);
    document.body.appendChild(mirror);

    const rawTop = marker.offsetTop - textarea.scrollTop;
    const rawLeft = marker.offsetLeft - textarea.scrollLeft;
    const preferredTop = rawTop - 34 >= 8 ? rawTop - 34 : rawTop + 24;

    return {
      top: clamp(Math.round(preferredTop), 8, Math.max(8, boxHeight - 44)),
      left: clamp(Math.round(rawLeft + 8), 10, Math.max(10, boxWidth - 82)),
      boxWidth,
    };
  } finally {
    mirror.remove();
  }
}

export default function WorkNoteSelectionAssistant({
  selection,
  point,
  disabled,
  onActivate,
}: {
  selection: SelectionAnchor | null;
  point: SelectionAnchorPoint;
  disabled: boolean;
  onActivate: () => void;
}) {
  const t = useTranslations("workNotes.agent");

  if (!selection || !selection.quote.trim()) return null;

  return (
    <div style={{ top: point.top, left: point.left }} className="absolute z-20">
      <button
        type="button"
        aria-label={t("inlineRefineTrigger")}
        title={t("inlineRefineTrigger")}
        disabled={disabled}
        onMouseDown={(event) => {
          // Keep the browser's visual highlight inside the textarea intact.
          event.preventDefault();
        }}
        onClick={onActivate}
        className="group flex items-center gap-1.5 rounded-full border border-brand-200 bg-white py-1 pr-3 pl-1 text-xs font-bold text-brand-700 shadow-lg ring-4 ring-brand-500/15 transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 dark:border-brand-500/40 dark:bg-gray-900 dark:text-brand-300 dark:hover:bg-gray-800"
      >
        <span
          aria-hidden="true"
          className="flex size-6 items-center justify-center rounded-full bg-brand-600 text-white shadow-2xs transition-transform group-hover:scale-105"
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
        </span>
        <span aria-hidden="true">{t("assistantBadge")}</span>
      </button>
    </div>
  );
}
