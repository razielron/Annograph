/** Fan-in (bottleneck) and fan-out (god-object) detection. */

import type { GraphIndex } from "../query/graph.js";
import type { Finding } from "./findings.js";

const DEPENDENCY_KINDS = ["calls", "uses-service"] as const;

export interface FanThresholds {
  fanIn: number;
  fanOut: number;
}

export const DEFAULT_FAN: FanThresholds = { fanIn: 5, fanOut: 8 };

export function detectFan(index: GraphIndex, thresholds: FanThresholds = DEFAULT_FAN): Finding[] {
  const findings: Finding[] = [];

  for (const node of index.allNodes()) {
    if (node.unresolved || node.kind === "service") continue;

    const fanIn = distinct(index.in(node.id, [...DEPENDENCY_KINDS]).map((e) => e.from));
    const fanOut = distinct(index.out(node.id, [...DEPENDENCY_KINDS]).map((e) => e.to));

    if (fanIn >= thresholds.fanIn) {
      findings.push({
        type: "fan-in",
        severity: "info",
        message: `${node.displayName} has high fan-in (${fanIn} dependents) — potential bottleneck`,
        nodes: [node.id],
        ...(node.source ? { source: node.source } : {}),
      });
    }
    if (fanOut >= thresholds.fanOut) {
      findings.push({
        type: "fan-out",
        severity: "warning",
        message: `${node.displayName} has high fan-out (${fanOut} dependencies) — candidate for splitting`,
        nodes: [node.id],
        ...(node.source ? { source: node.source } : {}),
      });
    }
  }

  return findings;
}

function distinct(items: string[]): number {
  return new Set(items).size;
}
