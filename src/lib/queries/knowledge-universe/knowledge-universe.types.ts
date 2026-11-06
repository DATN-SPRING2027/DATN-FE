export type UniverseNodeKind = "event" | "entity";
export type UniverseNodeState = "latent" | "active";

export interface UniverseTimeBucket {
  start: string;
  end: string;
  count: number;
}

export interface UniversePartition {
  id: string;
  source_id: string;
  parent_id?: string | null;
  kind: "source" | "topic";
  key: string;
  label: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  node_count: number;
  event_count: number;
  entity_count: number;
  relation_count: number;
  density: number;
  time_buckets: UniverseTimeBucket[];
  importance: number;
}

export interface UniversePolicy {
  source_limit: number;
  timeline_event_page_size: number;
  event_entity_limit: number;
  lod_orbit_px: number;
  lod_near_px: number;
  lod_deep_px: number;
  lod_hysteresis_px: number;
  lod_debounce_ms: number;
  proxy_budget_desktop: number;
  proxy_budget_mobile: number;
  node_budget_desktop: number;
  node_budget_mobile: number;
  edge_budget_desktop: number;
  edge_budget_mobile: number;
}

export interface UniverseTreeNode {
  id: string;
  parent_id?: string | null;
  depth: number;
  label: string;
  is_leaf: boolean;
  unit_count: number;
  source_count: number;
  document_count?: number;
  top_entities?: string[];
}

export interface UniverseTree {
  projection?: "routing" | "source";
  project_id: string;
  tree_version: string;
  search_epoch?: number | null;
  active_slot?: string | null;
  routing_recall_at_k?: number | null;
  escape_win_rate?: number | null;
  acl_blackhole_rate?: number | null;
  node_count: number;
  unit_count: number;
  source_count: number;
  nodes: UniverseTreeNode[];
}

export interface UniverseManifest {
  version: string | null;
  status: "empty" | "building" | "ready" | "stale" | "failed";
  stale?: boolean;
  as_of: string | null;
  bounds: Record<string, number>;
  partitions: UniversePartition[];
  trees?: UniverseTree[];
  counts: Record<string, number>;
  policy: UniversePolicy;
}

export interface UniverseKnowledgeUnit {
  id: string;
  label: string;
  preview: string;
  source_id: string;
  source_name: string;
  document_id: string;
  document_version_id: string;
  document_name: string;
  version_no: number;
  block_id: string;
  heading: string;
  page_from: number;
  page_to: number;
  anchor: string;
  neural_tier?: "E0_E1" | "E2";
  importance: number;
  local_confidence?: number;
  e2_reason?: string | null;
  entities: string[];
  evidence_count: number;
  cross_doc_synapse_count?: number;
  checksum: string;
}

export interface UniverseKnowledgeEdge {
  source: string;
  target: string;
  weight: number;
  kind: "similarity";
  cross_document?: boolean;
  source_document_id?: string | null;
  target_document_id?: string | null;
  source_document_name?: string | null;
  target_document_name?: string | null;
  shared_entities?: string[];
  signals?: Record<string, number | null>;
}

export interface UniverseKnowledgePage {
  project_id: string;
  tree_version: string;
  node_id: string;
  scope_key: string;
  units: UniverseKnowledgeUnit[];
  edges: UniverseKnowledgeEdge[];
  total: number;
  next_cursor?: string | null;
}

export interface UniverseKnowledgeEvidence {
  id: string;
  tier: string;
  kind: string;
  quote: string;
  confidence: number;
  candidate: boolean;
  start: number;
  end: number;
  label?: string | null;
  subject?: string | null;
  predicate?: string | null;
  object?: string | null;
  extractor_version: string;
}

export interface UniverseKnowledgeSynapse {
  target_unit_id: string;
  target_node_id?: string | null;
  target_label: string;
  target_preview: string;
  target_heading: string;
  target_document_id: string;
  target_document_name: string;
  target_source_id: string;
  target_source_name: string;
  target_page_from: number;
  target_neural_tier?: "E0_E1" | "E2";
  weight: number;
  cross_document?: boolean;
  shared_entities?: string[];
  signals?: Record<string, number | null>;
}

export interface UniverseKnowledgeDetail extends UniverseKnowledgeUnit {
  project_id: string;
  tree_version: string;
  scope_key: string;
  content: string;
  evidence: UniverseKnowledgeEvidence[];
  synapses?: UniverseKnowledgeSynapse[];
}

export interface UniverseKnowledgeReference {
  source_id: string;
  document_version_id?: string | null;
  search_unit_id?: string | null;
  block_id?: string | null;
}

export interface UniverseKnowledgeMatch {
  project_id: string;
  tree_version: string;
  node_id: string;
  unit_ids: string[];
}

export interface UniverseKnowledgeResolve {
  matches: UniverseKnowledgeMatch[];
}

export interface SourceGraphEvent {
  id: string;
  source_id: string;
  chunk_id?: string | null;
  title: string;
  summary: string;
  content: string;
  category: string;
  start_time?: string | null;
  end_time?: string | null;
  references: string[];
  extra_data: Record<string, unknown>;
}

export interface Entity {
  id: string;
  source_id: string;
  type: string;
  normalized_name: string;
  name: string;
  description?: string | null;
  synonyms: string[];
  weight: number;
  extra_data: Record<string, unknown>;
}

export interface SourceGraphRelation {
  source_kind: "event" | "entity";
  source_id: string;
  target_kind: "event" | "entity";
  target_id: string;
  kind: "mentions" | "subevent";
  weight: number;
  description: string;
}

export interface SourceGraphResponse {
  source_id: string;
  events: SourceGraphEvent[];
  entities: Entity[];
  relations: SourceGraphRelation[];
  counts: { events: number; entities: number; relations: number };
  truncated: boolean;
}
