export type MindMapBranchPalette = Readonly<{
  accentFill: string;
  selectedCard: string;
  restCardHover: string;
  activeEdge: string;
  restEdge: string;
  sourcePillFill: string;
  sourcePillText: string;
  expandPillRect: string;
  expandPillText: string;
  dotBg: string;
  inspectorBadgeBg: string;
  inspectorBadgeText: string;
}>;

const BRANCH_PALETTES: readonly MindMapBranchPalette[] = [
  // 0: Brand Indigo
  {
    accentFill: "fill-brand-500 dark:fill-brand-400",
    selectedCard:
      "fill-brand-50 stroke-brand-500 dark:fill-brand-950 dark:stroke-brand-400",
    restCardHover:
      "hover:stroke-brand-300 dark:hover:stroke-brand-400/70",
    activeEdge: "stroke-brand-500 dark:stroke-brand-400",
    restEdge: "stroke-brand-300/80 dark:stroke-brand-400/35",
    sourcePillFill: "fill-brand-50 dark:fill-brand-500/15",
    sourcePillText: "fill-brand-700 dark:fill-brand-300",
    expandPillRect:
      "fill-brand-50 stroke-brand-300 hover:fill-brand-100 dark:fill-brand-950 dark:stroke-brand-400/60 dark:hover:fill-brand-900",
    expandPillText: "fill-brand-700 dark:fill-brand-300",
    dotBg: "bg-brand-500 dark:bg-brand-400",
    inspectorBadgeBg: "bg-brand-50 dark:bg-brand-500/15",
    inspectorBadgeText: "text-brand-700 dark:text-brand-300",
  },
  // 1: Sky / Blue-Light
  {
    accentFill: "fill-blue-light-500 dark:fill-blue-light-400",
    selectedCard:
      "fill-blue-light-50 stroke-blue-light-500 dark:fill-blue-light-950 dark:stroke-blue-light-400",
    restCardHover:
      "hover:stroke-blue-light-300 dark:hover:stroke-blue-light-400/70",
    activeEdge: "stroke-blue-light-500 dark:stroke-blue-light-400",
    restEdge: "stroke-blue-light-300/80 dark:stroke-blue-light-400/35",
    sourcePillFill: "fill-blue-light-50 dark:fill-blue-light-500/15",
    sourcePillText: "fill-blue-light-700 dark:fill-blue-light-300",
    expandPillRect:
      "fill-blue-light-50 stroke-blue-light-300 hover:fill-blue-light-100 dark:fill-blue-light-950 dark:stroke-blue-light-400/60 dark:hover:fill-blue-light-900",
    expandPillText: "fill-blue-light-700 dark:fill-blue-light-300",
    dotBg: "bg-blue-light-500 dark:bg-blue-light-400",
    inspectorBadgeBg: "bg-blue-light-50 dark:bg-blue-light-500/15",
    inspectorBadgeText: "text-blue-light-700 dark:text-blue-light-300",
  },
  // 2: Emerald / Success
  {
    accentFill: "fill-success-500 dark:fill-success-400",
    selectedCard:
      "fill-success-50 stroke-success-500 dark:fill-success-950 dark:stroke-success-400",
    restCardHover:
      "hover:stroke-success-300 dark:hover:stroke-success-400/70",
    activeEdge: "stroke-success-500 dark:stroke-success-400",
    restEdge: "stroke-success-300/80 dark:stroke-success-400/35",
    sourcePillFill: "fill-success-50 dark:fill-success-500/15",
    sourcePillText: "fill-success-700 dark:fill-success-300",
    expandPillRect:
      "fill-success-50 stroke-success-300 hover:fill-success-100 dark:fill-success-950 dark:stroke-success-400/60 dark:hover:fill-success-900",
    expandPillText: "fill-success-700 dark:fill-success-300",
    dotBg: "bg-success-500 dark:bg-success-400",
    inspectorBadgeBg: "bg-success-50 dark:bg-success-500/15",
    inspectorBadgeText: "text-success-700 dark:text-success-300",
  },
  // 3: Amber / Warning
  {
    accentFill: "fill-warning-500 dark:fill-warning-400",
    selectedCard:
      "fill-warning-50 stroke-warning-500 dark:fill-warning-950 dark:stroke-warning-400",
    restCardHover:
      "hover:stroke-warning-300 dark:hover:stroke-warning-400/70",
    activeEdge: "stroke-warning-500 dark:stroke-warning-400",
    restEdge: "stroke-warning-300/85 dark:stroke-warning-400/35",
    sourcePillFill: "fill-warning-50 dark:fill-warning-500/15",
    sourcePillText: "fill-warning-800 dark:fill-warning-300",
    expandPillRect:
      "fill-warning-50 stroke-warning-300 hover:fill-warning-100 dark:fill-warning-950 dark:stroke-warning-400/60 dark:hover:fill-warning-900",
    expandPillText: "fill-warning-800 dark:fill-warning-300",
    dotBg: "bg-warning-500 dark:bg-warning-400",
    inspectorBadgeBg: "bg-warning-50 dark:bg-warning-500/15",
    inspectorBadgeText: "text-warning-800 dark:text-warning-300",
  },
  // 4: Coral / Orange
  {
    accentFill: "fill-orange-500 dark:fill-orange-400",
    selectedCard:
      "fill-orange-50 stroke-orange-500 dark:fill-orange-950 dark:stroke-orange-400",
    restCardHover:
      "hover:stroke-orange-300 dark:hover:stroke-orange-400/70",
    activeEdge: "stroke-orange-500 dark:stroke-orange-400",
    restEdge: "stroke-orange-300/80 dark:stroke-orange-400/35",
    sourcePillFill: "fill-orange-50 dark:fill-orange-500/15",
    sourcePillText: "fill-orange-700 dark:fill-orange-300",
    expandPillRect:
      "fill-orange-50 stroke-orange-300 hover:fill-orange-100 dark:fill-orange-950 dark:stroke-orange-400/60 dark:hover:fill-orange-900",
    expandPillText: "fill-orange-700 dark:fill-orange-300",
    dotBg: "bg-orange-500 dark:bg-orange-400",
    inspectorBadgeBg: "bg-orange-50 dark:bg-orange-500/15",
    inspectorBadgeText: "text-orange-700 dark:text-orange-300",
  },
];

export function getMindMapBranchPalette(
  branchIndex: number,
): MindMapBranchPalette {
  if (branchIndex < 0) {
    return BRANCH_PALETTES[0]!;
  }
  return BRANCH_PALETTES[branchIndex % BRANCH_PALETTES.length]!;
}

