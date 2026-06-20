/** Layer-violation detection: edges that break mayDependOn rules (spec §5.4). */

import type { CodevizGraph, IRNode } from "../ir/types.js";
import type { GraphIndex } from "../query/graph.js";
import type { Finding } from "./findings.js";

/** Edge kinds that count as a dependency for layering purposes. */
const DEP_KINDS = new Set(["calls", "imports", "uses-service", "extends", "implements"]);

export function detectLayerViolations(index: GraphIndex, graph: CodevizGraph): Finding[] {
  const mayDependOn = new Map<string, Set<string>>();
  for (const layer of graph.layers) {
    mayDependOn.set(layer.id, new Set(layer.mayDependOn));
  }
  if (mayDependOn.size === 0) return []; // zero-config: no rules, no violations.

  const findings: Finding[] = [];
  for (const edge of index.allEdges()) {
    if (!DEP_KINDS.has(edge.kind)) continue;
    const from = index.node(edge.from);
    const to = index.node(edge.to);
    if (!from?.layer || !to?.layer) continue; // need both layers to judge.
    if (from.layer === to.layer) continue; // same-layer is always allowed.

    const allowed = mayDependOn.get(from.layer);
    if (allowed && !allowed.has(to.layer)) {
      findings.push({
        type: "layer-violation",
        severity: "error",
        message: `${describe(from)} (${from.layer}) depends on ${describe(to)} (${to.layer}) — not allowed by mayDependOn`,
        nodes: [edge.from, edge.to],
        ...(edge.source ? { source: edge.source } : {}),
      });
    }
  }
  return findings;
}

function describe(node: IRNode): string {
  return node.displayName;
}
