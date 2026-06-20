/** REST API: thin wrappers over the existing query + analysis functions. */

import { focus, subgraphToGraph } from "../query/focus.js";
import { layerFilter } from "../query/layer-filter.js";
import { shortestPath } from "../query/path.js";
import { serviceMap } from "../query/service-map.js";
import { contractFor } from "../query/contract.js";
import { declaredPatterns } from "../query/patterns.js";
import { boundaries } from "../query/boundaries.js";
import { runAnalysis } from "../analysis/index.js";
import { coverage } from "../analysis/coverage.js";
import { readSourceSlice } from "./source.js";
import { Router } from "./router.js";
import type { ServerState } from "./state.js";

/** Build the API router bound to a fixed server state. */
export function buildApi(state: ServerState): Router {
  const { index, graph, config, warnings, root } = state;
  const router = new Router();

  router.get("/api/graph", () => graph);

  router.get("/api/focus/*id", ({ params, query }) => {
    const hops = intParam(query.get("hops"), 1);
    const sub = focus(index, params.id!, hops);
    return subgraphToGraph(graph, sub);
  });

  router.get("/api/layers", ({ query }) => {
    const ids = (query.get("ids") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const hops = intParam(query.get("hops"), 0);
    const sub = layerFilter(index, ids, hops);
    return subgraphToGraph(graph, sub);
  });

  router.get("/api/path", ({ query }) => {
    const from = query.get("from") ?? "";
    const to = query.get("to") ?? "";
    return { from, to, path: shortestPath(index, from, to) };
  });

  router.get("/api/services", () => serviceMap(index));

  router.get("/api/contract/*id", ({ params }) => contractFor(index, params.id!) ?? null);

  router.get("/api/patterns", () => declaredPatterns(index));

  router.get("/api/boundaries", () => boundaries(index));

  router.get("/api/findings", () => runAnalysis(graph, config, warnings));

  router.get("/api/coverage", () => coverage(graph));

  router.get("/api/source", ({ query }) => {
    const file = query.get("file") ?? "";
    const line = intParam(query.get("line"), 1);
    return readSourceSlice(root, file, line);
  });

  return router;
}

function intParam(raw: string | null, fallback: number): number {
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
