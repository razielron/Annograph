/** Annotation-coverage metrics over the IR (spec §7). */

import type { CodevizGraph } from "../ir/types.js";

export interface Coverage {
  /** Fraction of layer-eligible code nodes that carry a layer. */
  layerCoverage: number;
  /** Fraction of functions/entrypoints that carry a contract. */
  contractCoverage: number;
  totalCodeNodes: number;
  layeredNodes: number;
  totalFunctions: number;
  contractedFunctions: number;
  greyNodes: number;
}

/** Code-node kinds that participate in layer coverage. */
const CODE_KINDS = new Set(["module", "class", "function", "entrypoint"]);

export function coverage(graph: CodevizGraph): Coverage {
  let totalCodeNodes = 0;
  let layeredNodes = 0;
  let totalFunctions = 0;
  let contractedFunctions = 0;
  let greyNodes = 0;

  for (const node of graph.nodes) {
    if (node.unresolved) {
      greyNodes += 1;
      continue;
    }
    if (!CODE_KINDS.has(node.kind)) continue;
    // Modules are structural; exclude from layer coverage to avoid skewing it.
    if (node.kind !== "module") {
      totalCodeNodes += 1;
      if (node.layer !== undefined) layeredNodes += 1;
    }
    if (node.kind === "function" || node.kind === "entrypoint") {
      totalFunctions += 1;
      if (node.contract !== undefined) contractedFunctions += 1;
    }
  }

  return {
    layerCoverage: ratio(layeredNodes, totalCodeNodes),
    contractCoverage: ratio(contractedFunctions, totalFunctions),
    totalCodeNodes,
    layeredNodes,
    totalFunctions,
    contractedFunctions,
    greyNodes,
  };
}

function ratio(part: number, whole: number): number {
  return whole === 0 ? 1 : part / whole;
}
