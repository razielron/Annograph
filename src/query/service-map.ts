/** Service map: every service node, its operations, and who reaches it. */

import { GraphIndex } from "./graph.js";

export interface ServiceUsage {
  id: string;
  name: string;
  operations: string[];
  callers: { id: string; displayName: string; op?: string }[];
}

export function serviceMap(index: GraphIndex): ServiceUsage[] {
  const result: ServiceUsage[] = [];

  for (const node of index.allNodes()) {
    if (node.kind !== "service") continue;
    const def = index.graph.services.find((s) => s.id === node.id);
    const callers = index.in(node.id, ["uses-service"]).map((e) => {
      const caller = index.node(e.from);
      const entry: ServiceUsage["callers"][number] = {
        id: e.from,
        displayName: caller?.displayName ?? e.from,
      };
      if (e.op !== undefined) entry.op = e.op;
      return entry;
    });

    result.push({
      id: node.id,
      name: node.name,
      operations: def?.operations ?? [],
      callers,
    });
  }

  return result.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
