/** Focus / isolate: the N-hop neighborhood subgraph around a node. */

import type { CodevizGraph, IREdge, IRNode } from "../ir/types.js";
import { GraphIndex } from "./graph.js";

export interface Subgraph {
  nodes: IRNode[];
  edges: IREdge[];
}

/**
 * BFS outward from `start` in both directions up to `hops`, returning the
 * induced subgraph (the neighborhood plus the edges connecting it).
 */
export function focus(index: GraphIndex, start: string, hops: number): Subgraph {
  const root = index.node(start);
  if (!root) return { nodes: [], edges: [] };

  const reached = new Set<string>([start]);
  let frontier = [start];

  for (let depth = 0; depth < hops; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of index.out(id)) if (!reached.has(e.to)) reach(reached, next, e.to);
      for (const e of index.in(id)) if (!reached.has(e.from)) reach(reached, next, e.from);
    }
    frontier = next;
    if (frontier.length === 0) break;
  }

  return induced(index, reached);
}

function reach(reached: Set<string>, next: string[], id: string): void {
  reached.add(id);
  next.push(id);
}

/** The subgraph induced by a node-id set: those nodes + edges with both ends inside. */
export function induced(index: GraphIndex, ids: Set<string>): Subgraph {
  const nodes = [...ids].map((id) => index.node(id)).filter((n): n is IRNode => n !== undefined);
  const edges = index.allEdges().filter((e) => ids.has(e.from) && ids.has(e.to));
  return { nodes, edges };
}

/** Build a standalone CodevizGraph from a subgraph, preserving layers/services context. */
export function subgraphToGraph(parent: CodevizGraph, sub: Subgraph): CodevizGraph {
  const nodeIds = new Set(sub.nodes.map((n) => n.id));
  return {
    version: parent.version,
    layers: parent.layers,
    services: parent.services.filter((s) => nodeIds.has(s.id)),
    nodes: sub.nodes,
    edges: sub.edges,
    patterns_detected: [],
  };
}
