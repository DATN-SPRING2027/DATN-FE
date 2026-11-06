import { describe, expect, it } from "vitest";
import {
  findKnowledgeCluster,
  groupUnitsByDocument,
  knowledgeClusterTrail,
  projectUnitsToOrbitalGraph,
} from "../universe-knowledge-projection";
import {
  disambiguateUnitTitles,
  knowledgeDocumentTitle,
  knowledgeRegionCandidates,
  knowledgeUnitTitle,
} from "../knowledge-presentation";
import type {
  UniverseKnowledgeEdge,
  UniverseKnowledgeUnit,
  UniverseTree,
} from "@/lib/queries/knowledge-universe/knowledge-universe.types";

const sampleUnits: UniverseKnowledgeUnit[] = [
  {
    id: "unit-1",
    label: "DOC001 Authentication Architecture",
    preview: "OAuth2 and JWT session verification pipeline.",
    source_id: "src-1",
    source_name: "Security Spec",
    document_id: "doc-1",
    document_version_id: "ver-1",
    document_name: "Security_Spec.pdf",
    version_no: 1,
    block_id: "blk-1",
    heading: "Security > Authentication Architecture",
    page_from: 3,
    page_to: 4,
    anchor: "p3-b1",
    neural_tier: "E2",
    importance: 0.9,
    entities: ["OAuth2", "JWT", "DOC"],
    evidence_count: 3,
    cross_doc_synapse_count: 2,
    checksum: "chk-1",
  },
  {
    id: "unit-2",
    label: "API Gateway Rate Limiting",
    preview: "Token bucket throttling per workspace.",
    source_id: "src-2",
    source_name: "Gateway Guide",
    document_id: "doc-2",
    document_version_id: "ver-2",
    document_name: "Gateway_Guide.pdf",
    version_no: 2,
    block_id: "blk-2",
    heading: "Gateway > Rate Limiting",
    page_from: 10,
    page_to: 12,
    anchor: "p10-b2",
    neural_tier: "E0_E1",
    importance: 0.7,
    entities: ["JWT", "Redis"],
    evidence_count: 1,
    checksum: "chk-2",
  },
];

const sampleEdges: UniverseKnowledgeEdge[] = [
  {
    source: "unit-1",
    target: "unit-2",
    weight: 0.85,
    kind: "similarity",
    shared_entities: ["JWT"],
    cross_document: true,
  },
];

describe("universe-knowledge-projection", () => {
  it("resolves cluster and ancestor breadcrumb trail from tree nodes", () => {
    const trees: UniverseTree[] = [
      {
        project_id: "proj-1",
        tree_version: "v1",
        node_count: 2,
        unit_count: 2,
        source_count: 2,
        nodes: [
          {
            id: "root",
            depth: 0,
            parent_id: null,
            is_leaf: false,
            unit_count: 2,
            source_count: 2,
            label: "Root Domain",
          },
          {
            id: "child-1",
            depth: 1,
            parent_id: "root",
            is_leaf: true,
            unit_count: 2,
            source_count: 2,
            label: "Auth Subcluster",
          },
        ],
      },
    ];

    const found = findKnowledgeCluster(trees, {
      project_id: "proj-1",
      tree_version: "v1",
      node_id: "child-1",
    });
    expect(found?.node.label).toBe("Auth Subcluster");

    const trail = knowledgeClusterTrail(trees, {
      project_id: "proj-1",
      tree_version: "v1",
      node_id: "child-1",
    });
    expect(trail.map((n) => n.id)).toEqual(["root", "child-1"]);
  });

  it("groups units by document and aggregates E2 & cross-doc synapse counts", () => {
    const groups = groupUnitsByDocument(sampleUnits, sampleEdges);
    expect(groups).toHaveLength(2);
    const doc1 = groups.find((g) => g.document_id === "doc-1");
    const doc2 = groups.find((g) => g.document_id === "doc-2");
    expect(doc1?.e2_count).toBe(1);
    expect(doc1?.cross_doc_synapse_count).toBe(2);
    expect(doc2?.e2_count).toBe(0);
    expect(doc2?.cross_doc_synapse_count).toBe(1);
  });

  it("projects ACL-safe knowledge units and edges into Orbital Sphere SourceGraphResponse", () => {
    const graph = projectUnitsToOrbitalGraph("proj-1", sampleUnits, sampleEdges);
    expect(graph.source_id).toBe("proj-1");
    expect(graph.events).toHaveLength(2);
    expect(graph.events[0]?.title).toBe("Authentication Architecture");
    expect(graph.entities.length).toBeGreaterThanOrEqual(4);
    // "DOC" stop-code should be filtered out from entities
    expect(graph.entities.some((e) => e.name === "DOC")).toBe(false);
    expect(graph.relations.length).toBeGreaterThan(0);
    expect(graph.counts.events).toBe(2);
  });

  it("cleans connector dsid hashes, outline prefixes, duplicate unit titles, and noisy region labels", () => {
    expect(
      knowledgeDocumentTitle(
        "confluence__dsid_08585f025bd74d50bafd23843caae7bb.md",
        "Security Faq What We Do And Dont Say > Golden rules (read first)",
      ),
    ).toBe("Security FAQ: What We Do and Don't Say");

    const unitA: UniverseKnowledgeUnit = {
      ...sampleUnits[0],
      id: "u-dup-1",
      label: "/v1/rollouts/{rollout_id}",
      document_name: "confluence__dsid_08585f025bd74d50bafd23843caae7bb.md",
      heading:
        "Security Faq What We Do And Dont Say > Topic-by-topic guidance > G) “No customer data used for training”",
      preview: "Approved response for customer training policy inquiries.",
    };
    const unitB: UniverseKnowledgeUnit = {
      ...unitA,
      id: "u-dup-2",
      preview: "Escalation traps when negotiating custom DPAs.",
    };

    expect(knowledgeUnitTitle(unitA)).toBe(
      "“No customer data used for training”",
    );

    const disambiguated = disambiguateUnitTitles([unitA, unitB]);
    expect(disambiguated.get("u-dup-1")).not.toBe(disambiguated.get("u-dup-2"));

    const regionCandidates = knowledgeRegionCandidates(
      [unitA, unitB],
      "Document ID",
      "Region 1",
    );
    expect(regionCandidates[0]).not.toBe("Document ID");
    expect(regionCandidates[0]).toBe("Compliance & Policy Guidance");
  });
});
