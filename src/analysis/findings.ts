/** Unified finding type for all static analyses. */

import type { SourceRef } from "../ir/types.js";

export type FindingType =
  | "fan-in"
  | "fan-out"
  | "cycle"
  | "layer-violation"
  | "deep-chain"
  | "unmapped-service"
  | "dangling-link";

export type Severity = "info" | "warning" | "error";

export interface Finding {
  type: FindingType;
  severity: Severity;
  message: string;
  /** Node ids the finding pertains to. */
  nodes: string[];
  source?: SourceRef;
}

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

/** Sort findings most-severe first, then by type, then by message (stable). */
export function orderFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    if (a.type !== b.type) return a.type < b.type ? -1 : 1;
    return a.message < b.message ? -1 : a.message > b.message ? 1 : 0;
  });
}
