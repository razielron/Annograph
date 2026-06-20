/** In-memory adjacency index over the IR — shared by queries and analysis. */

import type { CodevizGraph, EdgeKind, IREdge, IRNode } from "../ir/types.js";

export class GraphIndex {
  readonly nodes = new Map<string, IRNode>();
  private readonly outgoing = new Map<string, IREdge[]>();
  private readonly incoming = new Map<string, IREdge[]>();

  constructor(readonly graph: CodevizGraph) {
    for (const node of graph.nodes) this.nodes.set(node.id, node);
    for (const edge of graph.edges) {
      push(this.outgoing, edge.from, edge);
      push(this.incoming, edge.to, edge);
    }
  }

  static from(graph: CodevizGraph): GraphIndex {
    return new GraphIndex(graph);
  }

  node(id: string): IRNode | undefined {
    return this.nodes.get(id);
  }

  /** Outgoing edges from `id`, optionally filtered to specific kinds. */
  out(id: string, kinds?: EdgeKind[]): IREdge[] {
    const edges = this.outgoing.get(id) ?? [];
    return kinds ? edges.filter((e) => kinds.includes(e.kind)) : edges;
  }

  /** Incoming edges to `id`, optionally filtered to specific kinds. */
  in(id: string, kinds?: EdgeKind[]): IREdge[] {
    const edges = this.incoming.get(id) ?? [];
    return kinds ? edges.filter((e) => kinds.includes(e.kind)) : edges;
  }

  allNodes(): IRNode[] {
    return [...this.nodes.values()];
  }

  allEdges(): IREdge[] {
    return this.graph.edges;
  }
}

function push(map: Map<string, IREdge[]>, key: string, value: IREdge): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
