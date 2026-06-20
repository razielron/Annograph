/** Path queries: shortest path A→B and bounded all-simple-paths. */

import type { EdgeKind } from "../ir/types.js";
import { GraphIndex } from "./graph.js";

const FLOW_KINDS: EdgeKind[] = ["calls", "uses-service"];

/** Shortest directed path from `from` to `to` over flow edges, or null. */
export function shortestPath(index: GraphIndex, from: string, to: string): string[] | null {
  if (from === to) return [from];
  if (!index.node(from) || !index.node(to)) return null;

  const prev = new Map<string, string>();
  const queue: string[] = [from];
  const visited = new Set<string>([from]);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const e of index.out(cur, FLOW_KINDS)) {
      if (visited.has(e.to)) continue;
      visited.add(e.to);
      prev.set(e.to, cur);
      if (e.to === to) return reconstruct(prev, from, to);
      queue.push(e.to);
    }
  }
  return null;
}

/** All simple directed paths from `from` to `to`, bounded by `maxLen` hops. */
export function allPaths(
  index: GraphIndex,
  from: string,
  to: string,
  maxLen = 12,
): string[][] {
  const results: string[][] = [];
  const onPath = new Set<string>([from]);

  function dfs(cur: string, path: string[]): void {
    if (path.length - 1 > maxLen) return;
    if (cur === to) {
      results.push([...path]);
      return;
    }
    for (const e of index.out(cur, FLOW_KINDS)) {
      if (onPath.has(e.to)) continue;
      onPath.add(e.to);
      dfs(e.to, [...path, e.to]);
      onPath.delete(e.to);
    }
  }

  if (index.node(from) && index.node(to)) dfs(from, [from]);
  return results;
}

function reconstruct(prev: Map<string, string>, from: string, to: string): string[] {
  const path = [to];
  let cur = to;
  while (cur !== from) {
    const p = prev.get(cur)!;
    path.push(p);
    cur = p;
  }
  return path.reverse();
}
