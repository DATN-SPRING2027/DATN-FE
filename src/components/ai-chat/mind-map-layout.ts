import type { AiChatMindMapNode } from "@/lib/queries/ai-chat/ai-chat.types";

export const MIND_MAP_MAX_DEPTH = 3;
export const MIND_MAP_MAX_NODES = 60;
export const MIND_MAP_MAX_CHILDREN = 8;

const CANVAS_PADDING_X = 36;
const CANVAS_PADDING_Y = 36;
const ROOT_NODE_WIDTH = 244;
const BRANCH_NODE_WIDTH = 224;
const COLUMN_GAP = 84;
const SIBLING_VERTICAL_GAP = 16;
const SUBTREE_GROUP_GAP = 24;

export type PositionedMindMapNode = Readonly<{
  node: AiChatMindMapNode;
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  centerY: number;
  lines: readonly [string] | readonly [string, string];
  hasChildren: boolean;
  isExpanded: boolean;
  hiddenDescendantCount: number;
  ancestorLabels: readonly string[];
}>;

export type MindMapEdge = Readonly<{
  id: string;
  sourceId: string;
  targetId: string;
  depth: number;
  path: string;
}>;

export type MindMapLayoutResult = Readonly<{
  nodes: readonly PositionedMindMapNode[];
  edges: readonly MindMapEdge[];
  width: number;
  height: number;
  totalNodeCount: number;
  visibleNodeCount: number;
  maxVisibleDepth: number;
}>;

function countDescendants(node: AiChatMindMapNode, depth = 0): number {
  if (depth >= MIND_MAP_MAX_DEPTH) return 0;
  let total = 0;
  for (const child of node.children.slice(0, MIND_MAP_MAX_CHILDREN)) {
    total += 1 + countDescendants(child, depth + 1);
  }
  return total;
}

export function wrapNodeLabel(
  rawLabel: string,
  maxCharsPerLine = 26,
): readonly [string] | readonly [string, string] {
  const normalized = rawLabel.trim().replace(/\s+/g, " ") || "Untitled";
  if (normalized.length <= maxCharsPerLine) {
    return [normalized];
  }

  const words = normalized.split(" ");
  let line1 = "";
  let restStartIdx = 0;

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i]!;
    const candidate = line1 ? `${line1} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      line1 = candidate;
      restStartIdx = i + 1;
    } else if (!line1) {
      line1 = word.slice(0, maxCharsPerLine);
      const remainder = [word.slice(maxCharsPerLine), ...words.slice(1)]
        .filter(Boolean)
        .join(" ");
      if (!remainder) return [line1];
      const line2 =
        remainder.length <= maxCharsPerLine
          ? remainder
          : `${remainder.slice(0, Math.max(1, maxCharsPerLine - 1)).trimEnd()}…`;
      return [line1, line2];
    } else {
      break;
    }
  }

  const remainingText = words.slice(restStartIdx).join(" ").trim();
  if (!remainingText) {
    return [line1];
  }
  const line2 =
    remainingText.length <= maxCharsPerLine
      ? remainingText
      : `${remainingText.slice(0, Math.max(1, maxCharsPerLine - 1)).trimEnd()}…`;
  return [line1, line2];
}

export function createDefaultExpandedIds(
  root: AiChatMindMapNode | null,
): Set<string> {
  if (!root) return new Set<string>();
  // Expand only depth 0 so initial view shows at most 2 levels (depth 0 and depth 1).
  return new Set<string>([root.id]);
}

export function createAllExpandedIds(
  root: AiChatMindMapNode | null,
): Set<string> {
  const expanded = new Set<string>();
  if (!root) return expanded;
  const visit = (node: AiChatMindMapNode, depth: number) => {
    if (depth >= MIND_MAP_MAX_DEPTH || node.children.length === 0) return;
    expanded.add(node.id);
    for (const child of node.children.slice(0, MIND_MAP_MAX_CHILDREN)) {
      visit(child, depth + 1);
    }
  };
  visit(root, 0);
  return expanded;
}

function columnXForDepth(depth: number): number {
  if (depth === 0) return CANVAS_PADDING_X;
  return (
    CANVAS_PADDING_X +
    ROOT_NODE_WIDTH +
    COLUMN_GAP +
    (depth - 1) * (BRANCH_NODE_WIDTH + COLUMN_GAP)
  );
}

function nodeWidthForDepth(depth: number): number {
  return depth === 0 ? ROOT_NODE_WIDTH : BRANCH_NODE_WIDTH;
}

function nodeHeightForLines(
  lineCount: 1 | 2,
  hasCitations: boolean,
  depth: number,
): number {
  const base = lineCount === 2 ? 64 : 46;
  const metaExtra = hasCitations ? 10 : 0;
  const rootExtra = depth === 0 ? 6 : 0;
  return base + metaExtra + rootExtra;
}

export function computeMindMapLayout(
  root: AiChatMindMapNode,
  expandedIds: ReadonlySet<string>,
): MindMapLayoutResult {
  const totalNodeCount = Math.min(
    MIND_MAP_MAX_NODES,
    1 + countDescendants(root, 0),
  );
  const positioned: PositionedMindMapNode[] = [];
  const edges: MindMapEdge[] = [];
  let maxRight = 0;
  let maxBottom = 0;
  let maxVisibleDepth = 0;
  let visitedVisible = 0;

  let cursorY = CANVAS_PADDING_Y;

  const layoutSubtree = (
    node: AiChatMindMapNode,
    depth: number,
    ancestorLabels: readonly string[],
  ): PositionedMindMapNode | null => {
    if (depth > MIND_MAP_MAX_DEPTH || visitedVisible >= MIND_MAP_MAX_NODES) {
      return null;
    }
    visitedVisible += 1;
    maxVisibleDepth = Math.max(maxVisibleDepth, depth);

    const maxChars = depth === 0 ? 27 : 25;
    const lines = wrapNodeLabel(node.label, maxChars);
    const width = nodeWidthForDepth(depth);
    const height = nodeHeightForLines(
      lines.length as 1 | 2,
      node.citationNumbers.length > 0,
      depth,
    );
    const x = columnXForDepth(depth);

    const boundedChildren =
      depth < MIND_MAP_MAX_DEPTH
        ? node.children.slice(0, MIND_MAP_MAX_CHILDREN)
        : [];
    const hasChildren = boundedChildren.length > 0;
    const isExpanded = hasChildren && expandedIds.has(node.id);
    const hiddenDescendantCount =
      hasChildren && !isExpanded ? countDescendants(node, depth) : 0;

    if (!isExpanded) {
      const y = cursorY;
      const centerY = y + height / 2;
      cursorY += height + SIBLING_VERTICAL_GAP;

      const item: PositionedMindMapNode = {
        node,
        depth,
        x,
        y,
        width,
        height,
        centerY,
        lines,
        hasChildren,
        isExpanded: false,
        hiddenDescendantCount,
        ancestorLabels,
      };
      positioned.push(item);
      maxRight = Math.max(maxRight, x + width + (hasChildren ? 38 : 0));
      maxBottom = Math.max(maxBottom, y + height);
      return item;
    }

    const subtreeTop = cursorY;
    const childAncestors = [...ancestorLabels, node.label];
    const placedChildren: PositionedMindMapNode[] = [];
    for (let idx = 0; idx < boundedChildren.length; idx += 1) {
      const child = boundedChildren[idx]!;
      const placed = layoutSubtree(child, depth + 1, childAncestors);
      if (placed) {
        placedChildren.push(placed);
      }
    }

    if (placedChildren.length === 0) {
      const y = subtreeTop;
      const centerY = y + height / 2;
      cursorY = y + height + SIBLING_VERTICAL_GAP;
      const item: PositionedMindMapNode = {
        node,
        depth,
        x,
        y,
        width,
        height,
        centerY,
        lines,
        hasChildren,
        isExpanded: false,
        hiddenDescendantCount: countDescendants(node, depth),
        ancestorLabels,
      };
      positioned.push(item);
      maxRight = Math.max(maxRight, x + width);
      maxBottom = Math.max(maxBottom, y + height);
      return item;
    }

    const firstChild = placedChildren[0]!;
    const lastChild = placedChildren[placedChildren.length - 1]!;
    const idealCenterY = (firstChild.centerY + lastChild.centerY) / 2;
    const y = Math.max(subtreeTop, idealCenterY - height / 2);
    const centerY = y + height / 2;
    const parentBottom = y + height;

    // Ensure subsequent siblings below this subtree never collide with the parent box either.
    cursorY = Math.max(cursorY, parentBottom + SIBLING_VERTICAL_GAP) +
      (depth === 1 ? SUBTREE_GROUP_GAP - SIBLING_VERTICAL_GAP : 0);

    const item: PositionedMindMapNode = {
      node,
      depth,
      x,
      y,
      width,
      height,
      centerY,
      lines,
      hasChildren,
      isExpanded: true,
      hiddenDescendantCount: 0,
      ancestorLabels,
    };
    positioned.push(item);
    maxRight = Math.max(maxRight, x + width + 38);
    maxBottom = Math.max(maxBottom, parentBottom);

    const startX = x + width;
    for (const childItem of placedChildren) {
      const endX = childItem.x;
      const midX = startX + (endX - startX) * 0.5;
      edges.push({
        id: `${node.id}->${childItem.node.id}`,
        sourceId: node.id,
        targetId: childItem.node.id,
        depth: depth + 1,
        path: `M ${startX} ${centerY} C ${midX} ${centerY}, ${midX} ${childItem.centerY}, ${endX} ${childItem.centerY}`,
      });
    }

    return item;
  };

  layoutSubtree(root, 0, []);

  // Order positioned nodes in pre-order / depth-then-y so root comes first.
  positioned.sort((a, b) => (a.depth !== b.depth ? a.depth - b.depth : a.y - b.y));

  return {
    nodes: positioned,
    edges,
    width: Math.max(480, Math.ceil(maxRight + CANVAS_PADDING_X)),
    height: Math.max(300, Math.ceil(maxBottom + CANVAS_PADDING_Y)),
    totalNodeCount,
    visibleNodeCount: positioned.length,
    maxVisibleDepth,
  };
}

export function buildBranchDeepDivePrompt(
  target: PositionedMindMapNode,
  locale: "vi" | "en" = "en",
): string {
  const trail = [...target.ancestorLabels, target.node.label].join(" → ");
  if (locale === "vi") {
    return `Hãy phân tích chi tiết nhánh "${target.node.label}" (thuộc mạch chủ đề: ${trail}) dựa trên các tài liệu được cấp quyền trong dự án này và dẫn nguồn cụ thể.`;
  }
  return `Provide a detailed, source-grounded explanation of "${target.node.label}" (context path: ${trail}) from the authorized documents in this project.`;
}
