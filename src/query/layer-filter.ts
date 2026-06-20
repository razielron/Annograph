/** Layer filter: nodes in the selected layers plus their N-hop neighbors. */

import { GraphIndex } from "./graph.js";
import { focus, induced, type Subgraph } from "./focus.js";

/**
 * Return the subgraph of nodes whose layer is in `layers`, expanded by `hops`
 * to include neighboring context.
 */
export function layerFilter(index: GraphIndex, layers: string[], hops = 0): Subgraph {
  const selected = new Set(layers);
  const seeds = index.allNodes().filter((n) => n.layer !== undefined && selected.has(n.layer));

  if (hops <= 0) {
    return induced(index, new Set(seeds.map((n) => n.id)));
  }

  const all = new Set<string>();
  for (const seed of seeds) {
    const sub = focus(index, seed.id, hops);
    for (const n of sub.nodes) all.add(n.id);
  }
  return induced(index, all);
}
