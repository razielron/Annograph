/** Immutable in-memory state the server reads on every request. */

import type { CodevizGraph } from "../ir/types.js";
import type { CodevizConfig } from "../discovery/config.js";
import type { BuildWarning } from "../ir/builder.js";
import { GraphIndex } from "../query/graph.js";

export interface ServerState {
  /** Adjacency-indexed graph; every query reads this. */
  index: GraphIndex;
  /** The raw graph (== index.graph), for endpoints that return it whole. */
  graph: CodevizGraph;
  /** Absolute scanned root — the only directory /api/source may read from. */
  root: string;
  /** Loaded config; feeds findings analysis. */
  config: CodevizConfig;
  /**
   * Build warnings. v1 has none persisted in graph.json, so dangling-link
   * findings are absent (see plan §2). Reserved for a future findings sidecar.
   */
  warnings: BuildWarning[];
}

export function makeState(
  graph: CodevizGraph,
  root: string,
  config: CodevizConfig,
  warnings: BuildWarning[] = [],
): ServerState {
  return { index: GraphIndex.from(graph), graph, root, config, warnings };
}
