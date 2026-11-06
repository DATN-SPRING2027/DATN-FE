import type {
  Entity,
  SourceGraphEvent,
  SourceGraphRelation,
  SourceGraphResponse,
  UniverseKnowledgeEdge,
  UniverseKnowledgeUnit,
  UniverseTree,
  UniverseTreeNode,
} from "@/lib/queries/knowledge-universe/knowledge-universe.types";
import {
  isNoisyTechnicalLabel,
  knowledgeDocumentTitle,
  knowledgePassage,
  knowledgeUnitTitle,
} from "./knowledge-presentation";

export interface KnowledgeCluster {
  project_id: string;
  tree_version: string;
  node_id: string;
}

export function knowledgeClusterKey(cluster: KnowledgeCluster): string {
  return `cluster:${[cluster.project_id, cluster.tree_version, cluster.node_id].map(encodeURIComponent).join(":")}`;
}

export function knowledgeUnitKey(
  cluster: KnowledgeCluster,
  unitId: string,
): string {
  return `unit:${encodeURIComponent(cluster.project_id)}:${encodeURIComponent(cluster.tree_version)}:${encodeURIComponent(unitId)}`;
}

export function findKnowledgeCluster(
  trees: UniverseTree[],
  cluster: KnowledgeCluster | null,
): { tree: UniverseTree; node: UniverseTreeNode } | null {
  if (!cluster) return null;
  const tree = trees.find(
    (item) =>
      item.project_id === cluster.project_id &&
      item.tree_version === cluster.tree_version,
  );
  const node = tree?.nodes.find((item) => item.id === cluster.node_id);
  return tree && node ? { tree, node } : null;
}

export function knowledgeClusterTrail(
  trees: UniverseTree[],
  cluster: KnowledgeCluster | null,
): UniverseTreeNode[] {
  const current = findKnowledgeCluster(trees, cluster);
  if (!current) return [];
  const byId = new Map(current.tree.nodes.map((node) => [node.id, node]));
  const trail: UniverseTreeNode[] = [];
  const seen = new Set<string>();
  let node: UniverseTreeNode | undefined = current.node;
  while (node && !seen.has(node.id)) {
    seen.add(node.id);
    trail.unshift(node);
    node = node.parent_id ? byId.get(node.parent_id) : undefined;
  }
  return trail;
}

export interface DocumentGanglionGroup {
  document_id: string;
  document_name: string;
  source_id: string;
  source_name: string;
  version_no: number;
  units: UniverseKnowledgeUnit[];
  e2_count: number;
  cross_doc_synapse_count: number;
}

export function groupUnitsByDocument(
  units: UniverseKnowledgeUnit[],
  edges: UniverseKnowledgeEdge[] = [],
): DocumentGanglionGroup[] {
  const byDoc = new Map<string, DocumentGanglionGroup>();
  const docByUnit = new Map<string, string>();
  for (const unit of units) {
    docByUnit.set(unit.id, unit.document_id);
    let group = byDoc.get(unit.document_id);
    if (!group) {
      group = {
        document_id: unit.document_id,
        document_name: knowledgeDocumentTitle(unit.document_name, unit.heading),
        source_id: unit.source_id,
        source_name: unit.source_name,
        version_no: unit.version_no,
        units: [],
        e2_count: 0,
        cross_doc_synapse_count: 0,
      };
      byDoc.set(unit.document_id, group);
    } else if (
      group.document_name === "Project Document" &&
      unit.heading
    ) {
      group.document_name = knowledgeDocumentTitle(
        unit.document_name,
        unit.heading,
      );
    }
    group.units.push(unit);
    if (unit.neural_tier === "E2") {
      group.e2_count += 1;
    }
  }
  for (const group of byDoc.values()) {
    const unitCrossSum = group.units.reduce(
      (acc, u) => acc + (u.cross_doc_synapse_count ?? 0),
      0,
    );
    if (unitCrossSum > 0) {
      group.cross_doc_synapse_count = unitCrossSum;
    } else {
      let edgeCross = 0;
      for (const edge of edges) {
        const dA = docByUnit.get(edge.source);
        const dB = docByUnit.get(edge.target);
        if (
          (dA === group.document_id && dB && dB !== group.document_id) ||
          (dB === group.document_id && dA && dA !== group.document_id) ||
          (edge.cross_document &&
            (dA === group.document_id || dB === group.document_id))
        ) {
          edgeCross += 1;
        }
      }
      group.cross_doc_synapse_count = edgeCross;
    }
  }
  return Array.from(byDoc.values());
}

/**
 * Projects ACL-verified UniverseKnowledgeUnit + UniverseKnowledgeEdge items
 * into the SourceGraphResponse shape used by OrbitalEventEntityGraph (3D Orbital Sphere).
 */
export function projectUnitsToOrbitalGraph(
  projectId: string,
  units: UniverseKnowledgeUnit[],
  edges: UniverseKnowledgeEdge[],
): SourceGraphResponse {
  const events: SourceGraphEvent[] = [];
  const entityMap = new Map<string, Entity>();
  const relations: SourceGraphRelation[] = [];
  const seenRelationKeys = new Set<string>();

  const addMention = (unitId: string, entityId: string, weight = 1) => {
    const key = `${unitId}:${entityId}`;
    if (seenRelationKeys.has(key)) return;
    seenRelationKeys.add(key);
    relations.push({
      source_kind: "event",
      source_id: unitId,
      target_kind: "entity",
      target_id: entityId,
      kind: "mentions",
      weight,
      description: "",
    });
  };

  const ensureEntity = (
    rawName: string,
    typeLabel: string,
    sourceId: string,
    description?: string,
  ): string => {
    const clean = rawName.trim();
    const norm = clean.toLowerCase().replace(/\s+/g, "_");
    const entityId = `ent:${typeLabel}:${norm}`;
    const existing = entityMap.get(entityId);
    if (existing) {
      existing.weight += 1;
      return entityId;
    }
    entityMap.set(entityId, {
      id: entityId,
      source_id: sourceId,
      type: typeLabel,
      normalized_name: norm,
      name: clean,
      description: description ?? null,
      synonyms: [],
      weight: 1,
      extra_data: {},
    });
    return entityId;
  };

  for (const unit of units) {
    const cleanTitle = knowledgeUnitTitle(unit);
    const docTitle = knowledgeDocumentTitle(
      unit.document_name || unit.source_name,
      unit.heading,
    );
    const cleanPreview = knowledgePassage(unit.preview).text || unit.preview;

    events.push({
      id: unit.id,
      source_id: unit.source_id,
      chunk_id: unit.id,
      title: cleanTitle,
      summary: cleanPreview,
      content: cleanPreview,
      category: docTitle || "Knowledge",
      start_time: null,
      end_time: null,
      references: [docTitle || unit.document_name],
      extra_data: {
        page_from: unit.page_from,
        document_name: docTitle || unit.document_name,
        neural_tier: unit.neural_tier,
      },
    });

    const filteredEntities = (unit.entities ?? []).filter(
      (e) =>
        e &&
        e.trim().length >= 2 &&
        !isNoisyTechnicalLabel(e.trim()),
    );

    if (filteredEntities.length > 0) {
      for (const rawEntity of filteredEntities.slice(0, 6)) {
        const entityId = ensureEntity(
          rawEntity,
          "Entity",
          unit.source_id,
          `Appears in ${docTitle} (p. ${unit.page_from})`,
        );
        addMention(unit.id, entityId, 1);
      }
    }

    // Always link unit to its parent document entity so same-document units cluster naturally on the sphere
    if (docTitle) {
      const docEntityId = ensureEntity(
        docTitle,
        "Document",
        unit.source_id,
        unit.document_name,
      );
      addMention(unit.id, docEntityId, 0.8);
    }
  }

  for (const edge of edges) {
    for (const shared of edge.shared_entities ?? []) {
      if (!shared || shared.trim().length < 2 || isNoisyTechnicalLabel(shared.trim())) continue;
      const entityId = ensureEntity(
        shared,
        "Shared Entity",
        projectId,
        "Cross-unit semantic bridge",
      );
      addMention(edge.source, entityId, edge.weight);
      addMention(edge.target, entityId, edge.weight);
    }
  }

  const entities = Array.from(entityMap.values());
  return {
    source_id: projectId,
    events,
    entities,
    relations,
    counts: {
      events: events.length,
      entities: entities.length,
      relations: relations.length,
    },
    truncated: false,
  };
}
