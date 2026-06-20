/** Shared graph loader for CLI commands that read an existing graph.json. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CodevizGraph } from "../ir/types.js";
import { GraphIndex } from "../query/graph.js";
import { CodevizError } from "../util/errors.js";

/** Read and parse a graph.json, returning an indexed view; errors with a hint if missing. */
export function loadGraph(graphPath: string): GraphIndex {
  let raw: string;
  try {
    raw = readFileSync(resolve(graphPath), "utf8");
  } catch (err) {
    throw new CodevizError(
      `could not read graph at ${graphPath}: ${(err as Error).message}`,
      "Run `codeviz scan` first to produce .codeviz/graph.json.",
    );
  }
  const graph = JSON.parse(raw) as CodevizGraph;
  return GraphIndex.from(graph);
}
