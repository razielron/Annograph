/** Patterns query: declared patterns from node annotations (MVP: declared only). */

import { GraphIndex } from "./graph.js";

export interface PatternGroup {
  name: string;
  participants: { id: string; displayName: string; role?: string; declared: boolean }[];
}

export function declaredPatterns(index: GraphIndex): PatternGroup[] {
  const byName = new Map<string, PatternGroup>();

  for (const node of index.allNodes()) {
    if (!node.patterns) continue;
    for (const p of node.patterns) {
      const group = byName.get(p.name) ?? { name: p.name, participants: [] };
      const participant: PatternGroup["participants"][number] = {
        id: node.id,
        displayName: node.displayName,
        declared: p.declared,
      };
      if (p.role !== undefined) participant.role = p.role;
      group.participants.push(participant);
      byName.set(p.name, group);
    }
  }

  return [...byName.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
