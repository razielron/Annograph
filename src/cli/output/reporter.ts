/** Human-readable console reporting for scan and check output. */

import type { CodevizGraph } from "../../ir/types.js";
import type { Summary } from "../../extract/envelope.js";
import type { BuildWarning } from "../../ir/builder.js";
import type { Coverage } from "../../analysis/coverage.js";
import type { Finding } from "../../analysis/findings.js";
import type { CheckConfig } from "../../discovery/config.js";
import { kvBlock, pct, plural } from "./format.js";

export interface ScanReport {
  graph: CodevizGraph;
  summary: Summary | undefined;
  warnings: BuildWarning[];
  collisions: number;
  coverage: Coverage;
}

export function reportScan(r: ScanReport): void {
  const { graph, coverage: cov } = r;
  const counts = countKinds(graph);

  const lines = [
    "",
    "codeviz scan",
    kvBlock([
      ["nodes", String(graph.nodes.length)],
      ["  modules", String(counts.module ?? 0)],
      ["  classes", String(counts.class ?? 0)],
      ["  functions", String((counts.function ?? 0) + (counts.entrypoint ?? 0))],
      ["  services", String(counts.service ?? 0)],
      ["  grey (unresolved)", String(cov.greyNodes)],
      ["edges", String(graph.edges.length)],
      ["layer coverage", pct(cov.layerCoverage)],
      ["contract coverage", pct(cov.contractCoverage)],
    ]),
  ];

  if (r.summary && r.summary.files_errored > 0) {
    lines.push(`  ${plural(r.summary.files_errored, "file")} failed to parse`);
  }
  if (r.collisions > 0) {
    lines.push(`  ${plural(r.collisions, "id collision")} (suffixed with #n)`);
  }

  const nonStatic = r.warnings.filter((w) => w.kind === "non-static-arg");
  if (nonStatic.length > 0) {
    lines.push(`  ${plural(nonStatic.length, "non-static decorator argument")} (ignored)`);
  }

  console.log(lines.join("\n"));
}

export function reportFindings(findings: Finding[], cov: Coverage, check: CheckConfig): void {
  console.log("");
  console.log("codeviz check");
  console.log(
    kvBlock([
      ["layer coverage", `${pct(cov.layerCoverage)} (min ${pct(check.minCoverage)})`],
      ["findings", String(findings.length)],
    ]),
  );

  if (findings.length === 0) {
    console.log("  no findings");
    return;
  }

  console.log("");
  for (const f of findings) {
    const loc = f.source ? ` (${f.source.file}:${f.source.line})` : "";
    console.log(`  [${f.severity}] ${f.type}: ${f.message}${loc}`);
  }
}

function countKinds(graph: CodevizGraph): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const node of graph.nodes) {
    if (node.unresolved) continue;
    counts[node.kind] = (counts[node.kind] ?? 0) + 1;
  }
  return counts;
}
