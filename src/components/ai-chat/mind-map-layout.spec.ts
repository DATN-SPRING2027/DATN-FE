import { describe, expect, it } from "vitest";
import type { AiChatMindMapNode } from "@/lib/queries/ai-chat/ai-chat.types";
import {
  buildBranchDeepDivePrompt,
  computeMindMapLayout,
  createAllExpandedIds,
  createDefaultExpandedIds,
  wrapNodeLabel,
} from "./mind-map-layout";

function makeSampleTree(): AiChatMindMapNode {
  return {
    id: "root",
    label: "Continuum Core Architecture & Handover Governance",
    summary: "Project-wide knowledge map across verified documents.",
    citationNumbers: [],
    children: [
      {
        id: "b1",
        label: "Service-Owned MongoDB Topology",
        summary: "Each bounded context owns an isolated logical database.",
        citationNumbers: [1, 2],
        children: [
          {
            id: "b1_1",
            label: "Transactional Outbox & Audit",
            summary: "Encrypted delivery events and cross-cutting audit.",
            citationNumbers: [2],
            children: [
              {
                id: "b1_1_1",
                label: "Idempotent Consumer Lease",
                summary: "Prevents duplicate ingestion during worker failover.",
                citationNumbers: [2],
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: "b2",
        label: "SAG Hybrid Retrieval & ECCE Session Memory",
        summary: "Strict single-project partition ACL with citation provenance.",
        citationNumbers: [3],
        children: [
          {
            id: "b2_1",
            label: "Revocation Fail-Closed Guard",
            summary: "Revoked DocumentVersion blocks search and shares.",
            citationNumbers: [3],
            children: [],
          },
        ],
      },
    ],
  };
}

describe("mind-map-layout", () => {
  it("opens only the first 2 levels (depth 0..1) by default and reveals deeper levels when expanded", () => {
    const tree = makeSampleTree();
    const defaultExpanded = createDefaultExpandedIds(tree);
    expect(defaultExpanded.has("root")).toBe(true);
    expect(defaultExpanded.has("b1")).toBe(false);
    expect(defaultExpanded.has("b2")).toBe(false);

    const initialLayout = computeMindMapLayout(tree, defaultExpanded);
    expect(initialLayout.totalNodeCount).toBe(6);
    expect(initialLayout.visibleNodeCount).toBe(3);
    expect(initialLayout.maxVisibleDepth).toBe(1);
    expect(initialLayout.nodes.map((item) => item.node.id)).toEqual([
      "root",
      "b1",
      "b2",
    ]);

    const b1Node = initialLayout.nodes.find((item) => item.node.id === "b1");
    expect(b1Node?.hiddenDescendantCount).toBe(2);
    expect(b1Node?.hasChildren).toBe(true);
    expect(b1Node?.isExpanded).toBe(false);

    const fullExpanded = createAllExpandedIds(tree);
    const fullLayout = computeMindMapLayout(tree, fullExpanded);
    expect(fullLayout.visibleNodeCount).toBe(6);
    expect(fullLayout.maxVisibleDepth).toBe(3);
    expect(fullLayout.edges).toHaveLength(5);
  });

  it("wraps long labels into at most 2 bounded lines and guarantees zero vertical box overlap per depth column", () => {
    const lines = wrapNodeLabel(
      "Extremely Long Enterprise Governance Architecture Branch Title Exceeding Two Lines Easily",
      26,
    );
    expect(lines.length).toBe(2);
    expect(lines[1]?.endsWith("…")).toBe(true);

    const manySiblings: AiChatMindMapNode = {
      id: "root",
      label: "Project Overview",
      summary: null,
      citationNumbers: [],
      children: Array.from({ length: 8 }, (_, idx) => ({
        id: `c_${idx}`,
        label: ` Very Long Branch Title Number ${idx + 1} Covering Security And Provenance `,
        summary: "Detailed branch summary.",
        citationNumbers: [1],
        children: [
          {
            id: `c_${idx}_sub_1`,
            label: `Sub-topic ${idx + 1}.1 with multi-word description`,
            summary: null,
            citationNumbers: [1],
            children: [],
          },
          {
            id: `c_${idx}_sub_2`,
            label: `Sub-topic ${idx + 1}.2 with multi-word description`,
            summary: null,
            citationNumbers: [1],
            children: [],
          },
        ],
      })),
    };

    const layout = computeMindMapLayout(
      manySiblings,
      createAllExpandedIds(manySiblings),
    );
    expect(layout.width).toBeGreaterThan(600);
    expect(layout.height).toBeGreaterThan(400);

    for (const depth of [0, 1, 2]) {
      const col = layout.nodes
        .filter((n) => n.depth === depth)
        .sort((a, b) => a.y - b.y);
      for (let i = 1; i < col.length; i += 1) {
        const prev = col[i - 1]!;
        const curr = col[i]!;
        expect(curr.y).toBeGreaterThanOrEqual(prev.y + prev.height + 8);
      }
    }
  });

  it("builds a contextual deep-dive prompt using ancestor path and branch label", () => {
    const tree = makeSampleTree();
    const layout = computeMindMapLayout(tree, createAllExpandedIds(tree));
    const leaf = layout.nodes.find((item) => item.node.id === "b1_1_1")!;
    const prompt = buildBranchDeepDivePrompt(leaf, "vi");
    expect(prompt).toContain("Idempotent Consumer Lease");
    expect(prompt).toContain("Service-Owned MongoDB Topology");
  });
});
