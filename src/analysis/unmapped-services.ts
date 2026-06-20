/**
 * Unmapped-service detection: outbound calls to I/O-looking external targets
 * that lack an @uses_service declaration (suspected undocumented integration).
 */

import type { GraphIndex } from "../query/graph.js";
import { isUnresolvedId } from "../ir/ids.js";
import type { Finding } from "./findings.js";

/** Names that signal a third-party integration when seen as a grey call target. */
const IO_SIGNATURES = [
  "requests",
  "httpx",
  "urllib",
  "aiohttp",
  "boto3",
  "stripe",
  "openai",
  "redis",
  "psycopg",
  "pymongo",
  "sqlalchemy",
  "kafka",
  "grpc",
  "smtplib",
];

export function detectUnmappedServices(index: GraphIndex): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();

  for (const node of index.allNodes()) {
    if (!node.unresolved || !isUnresolvedId(node.id)) continue;
    const name = node.name.toLowerCase();
    if (!IO_SIGNATURES.some((sig) => name.includes(sig))) continue;
    if (seen.has(node.id)) continue;
    seen.add(node.id);

    const callers = index.in(node.id, ["calls"]).map((e) => e.from);
    findings.push({
      type: "unmapped-service",
      severity: "warning",
      message: `outbound call to "${node.name}" looks like a third-party integration but has no @uses_service`,
      nodes: [node.id, ...new Set(callers)],
    });
  }
  return findings;
}
