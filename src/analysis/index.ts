/** Run all static analyses over the IR and return ordered findings. */

import type { CodevizGraph } from "../ir/types.js";
import type { CodevizConfig } from "../discovery/config.js";
import type { BuildWarning } from "../ir/builder.js";
import { GraphIndex } from "../query/graph.js";
import { detectFan } from "./fan.js";
import { detectCycles } from "./cycles.js";
import { detectLayerViolations } from "./layer-violations.js";
import { detectDeepChains } from "./deep-chains.js";
import { detectUnmappedServices } from "./unmapped-services.js";
import { orderFindings, type Finding } from "./findings.js";

export function runAnalysis(
  graph: CodevizGraph,
  _config: CodevizConfig,
  buildWarnings: BuildWarning[] = [],
): Finding[] {
  const index = GraphIndex.from(graph);

  const findings: Finding[] = [
    ...detectFan(index),
    ...detectCycles(index),
    ...detectLayerViolations(index, graph),
    ...detectDeepChains(index),
    ...detectUnmappedServices(index),
    ...danglingLinkFindings(buildWarnings),
  ];

  return orderFindings(findings);
}

function danglingLinkFindings(warnings: BuildWarning[]): Finding[] {
  return warnings
    .filter((w) => w.kind === "dangling-link")
    .map((w) => ({
      type: "dangling-link" as const,
      severity: "warning" as const,
      message: w.message,
      nodes: [],
      ...(w.source ? { source: w.source } : {}),
    }));
}
