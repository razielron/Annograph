/**
 * Deterministic, stable-sorted serialization of the IR (P5).
 *
 * Output must be byte-identical across runs given the same input, so every
 * collection is sorted by a stable key and object keys are emitted in a fixed
 * order. Timestamps live in a sidecar, never in graph.json.
 */

import { byKeys, byString, sorted } from "../util/sort.js";
import type {
  CodevizGraph,
  IREdge,
  IRNode,
  LayerDef,
  PatternDetected,
  ServiceDef,
} from "./types.js";

/** Return a new graph with all collections deterministically ordered. */
export function canonicalize(graph: CodevizGraph): CodevizGraph {
  return {
    version: graph.version,
    layers: sorted(graph.layers, byKeys<LayerDef>((l) => String(l.order).padStart(6, "0"), (l) => l.id)),
    services: sorted(graph.services, byKeys<ServiceDef>((s) => s.id)),
    nodes: sorted(graph.nodes, byKeys<IRNode>((n) => n.id)).map(canonNode),
    edges: sorted(
      graph.edges,
      byKeys<IREdge>((e) => e.from, (e) => e.to, (e) => e.kind, (e) => e.op ?? ""),
    ).map(canonEdge),
    patterns_detected: sorted(
      graph.patterns_detected,
      byKeys<PatternDetected>((p) => p.name, (p) => JSON.stringify(p.roles)),
    ),
  };
}

function canonNode(n: IRNode): IRNode {
  const out: IRNode = {
    id: n.id,
    kind: n.kind,
    name: n.name,
    displayName: n.displayName,
    tags: sorted(n.tags, byString),
  };
  if (n.layer !== undefined) out.layer = n.layer;
  if (n.entrypoint !== undefined) out.entrypoint = n.entrypoint;
  if (n.patterns !== undefined && n.patterns.length > 0) {
    out.patterns = sorted(n.patterns, byKeys((p) => p.name, (p) => p.role ?? ""));
  }
  if (n.contract !== undefined) out.contract = n.contract;
  if (n.source !== undefined) out.source = n.source;
  if (n.lang !== undefined) out.lang = n.lang;
  if (n.unresolved) out.unresolved = true;
  if (n.boundary !== undefined) out.boundary = n.boundary;
  return out;
}

function canonEdge(e: IREdge): IREdge {
  const out: IREdge = { from: e.from, to: e.to, kind: e.kind, inferred: e.inferred };
  if (e.op !== undefined) out.op = e.op;
  if (e.via !== undefined) out.via = e.via;
  if (e.source !== undefined) out.source = e.source;
  return out;
}

/** Serialize a canonicalized graph to a stable JSON string (2-space indent + trailing newline). */
export function serializeGraph(graph: CodevizGraph): string {
  return JSON.stringify(canonicalize(graph), null, 2) + "\n";
}
