/**
 * Canonical Intermediate Representation (IR) — the product of the system (P4).
 *
 * Mirrors the schema sketch in code-viz-spec.md Appendix A. This is the shared
 * contract: extractors emit it, the query engine and analysis read it, and any
 * future language adapter targets it (P3).
 */

export const IR_VERSION = "0.2" as const;

export type Lang = "python";

export type NodeKind = "module" | "class" | "function" | "service" | "entrypoint";

export type EdgeKind =
  | "calls"
  | "imports"
  | "extends"
  | "implements"
  | "data-flow"
  | "uses-service";

export interface SourceRef {
  file: string;
  line: number;
}

/**
 * A captured type reference. Tier B records only the type `ref` (name); the
 * field-level `fields` schema (Tier C) is deferred and never populated in MVP.
 */
export interface ContractTypeRef {
  ref: string;
  fields?: ContractField[];
}

export interface ContractField {
  name: string;
  type: string;
  required?: boolean;
}

export interface Contract {
  input?: ContractTypeRef;
  output?: ContractTypeRef;
  errors?: string[];
}

export interface EntrypointInfo {
  kind: string;
  path?: string;
}

/** A node's declared participation in a design pattern (authoritative when declared). */
export interface PatternRef {
  name: string;
  role?: string;
  declared: boolean;
}

export interface IRNode {
  /** Path-derived canonical id, e.g. "domain.order_service.OrderService.create_order". */
  id: string;
  kind: NodeKind;
  name: string;
  /** Prettified label for display; canonical id stays stable across config changes. */
  displayName: string;
  /** Undefined => grey / unlabeled node (counts against coverage). */
  layer?: string;
  tags: string[];
  entrypoint?: EntrypointInfo;
  patterns?: PatternRef[];
  contract?: Contract;
  source?: SourceRef;
  lang?: Lang;
  /** Synthesized placeholder for an unresolved call/import target. */
  unresolved?: boolean;
  boundary?: { note?: string };
}

export interface IREdge {
  from: string;
  to: string;
  kind: EdgeKind;
  /** true => discovered by static analysis; false => declared by hand (P2). */
  inferred: boolean;
  /** Operation label for uses-service edges. */
  op?: string;
  /** Set to "link" when bridged manually via @link. */
  via?: "link";
  source?: SourceRef;
}

export interface LayerDef {
  id: string;
  order: number;
  mayDependOn: string[];
}

export interface ServiceDef {
  id: string;
  kind?: string;
  operations: string[];
}

export interface PatternDetected {
  name: string;
  confidence: number;
  declared: boolean;
  roles: Record<string, string[]>;
}

export interface CodevizGraph {
  version: typeof IR_VERSION;
  layers: LayerDef[];
  services: ServiceDef[];
  nodes: IRNode[];
  edges: IREdge[];
  patterns_detected: PatternDetected[];
}
