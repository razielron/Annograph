/** Deep-chain detection: long paths from an entrypoint to a service (spec §11). */

import type { GraphIndex } from "../query/graph.js";
import type { Finding } from "./findings.js";

const CALL_KINDS = ["calls", "uses-service"] as const;
const DEFAULT_DEPTH_THRESHOLD = 5;
const MAX_DEPTH = 32; // guard against pathological graphs.

export function detectDeepChains(
  index: GraphIndex,
  threshold = DEFAULT_DEPTH_THRESHOLD,
): Finding[] {
  const findings: Finding[] = [];
  const entrypoints = index.allNodes().filter((n) => n.kind === "entrypoint");

  for (const ep of entrypoints) {
    const chain = deepestPathToService(index, ep.id);
    if (chain && chain.length - 1 >= threshold) {
      const names = chain.map((id) => index.node(id)?.displayName ?? id);
      findings.push({
        type: "deep-chain",
        severity: "info",
        message: `deep path (${chain.length - 1} hops) from entrypoint ${ep.displayName} to a service: ${names.join(" → ")}`,
        nodes: chain,
        ...(ep.source ? { source: ep.source } : {}),
      });
    }
  }
  return findings;
}

/** DFS for the longest simple path from `start` ending at a service node. */
function deepestPathToService(index: GraphIndex, start: string): string[] | undefined {
  let best: string[] | undefined;
  const visiting = new Set<string>();

  function dfs(id: string, path: string[]): void {
    if (path.length > MAX_DEPTH) return;
    const node = index.node(id);
    if (node?.kind === "service") {
      if (!best || path.length > best.length) best = [...path];
      return;
    }
    visiting.add(id);
    for (const edge of index.out(id, [...CALL_KINDS])) {
      if (visiting.has(edge.to)) continue;
      dfs(edge.to, [...path, edge.to]);
    }
    visiting.delete(id);
  }

  dfs(start, [start]);
  return best;
}
