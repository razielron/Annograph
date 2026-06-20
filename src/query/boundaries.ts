/** Boundaries query: nodes marked with @boundary, to highlight in the view (spec §6.1, §9). */

import { GraphIndex } from "./graph.js";

export interface BoundaryNode {
  id: string;
  displayName: string;
  note?: string;
}

export function boundaries(index: GraphIndex): BoundaryNode[] {
  const result: BoundaryNode[] = [];

  for (const node of index.allNodes()) {
    if (!node.boundary) continue;
    const entry: BoundaryNode = { id: node.id, displayName: node.displayName };
    if (node.boundary.note !== undefined) entry.note = node.boundary.note;
    result.push(entry);
  }

  return result.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
