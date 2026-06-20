/** Map the IR graph to Cytoscape elements. */

import type cytoscape from "cytoscape";
import type { CodevizGraph } from "../types";

type ElementDefinition = cytoscape.ElementDefinition;

export function toElements(graph: CodevizGraph): ElementDefinition[] {
  const els: ElementDefinition[] = [];
  const ids = new Set(graph.nodes.map((n) => n.id));

  for (const node of graph.nodes) {
    els.push({
      data: {
        id: node.id,
        label: node.displayName,
        kind: node.kind,
        layer: node.layer ?? "",
        grey: node.unresolved ? "1" : "0",
        boundary: node.boundary ? "1" : "0",
        entrypoint: node.entrypoint ? "1" : "0",
      },
    });
  }

  for (const edge of graph.edges) {
    // subgraphToGraph guarantees both ends exist; guard anyway for safety.
    if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
    const id = `${edge.from}->${edge.to}:${edge.kind}:${edge.op ?? ""}`;
    els.push({
      data: {
        id,
        source: edge.from,
        target: edge.to,
        kind: edge.kind,
        inferred: edge.inferred ? "1" : "0",
        label: edge.kind === "uses-service" && edge.op ? edge.op : "",
      },
    });
  }

  return els;
}
