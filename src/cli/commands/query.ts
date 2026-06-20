import { Command } from "commander";
import { focus, subgraphToGraph } from "../../query/focus.js";
import { layerFilter } from "../../query/layer-filter.js";
import { shortestPath } from "../../query/path.js";
import { serviceMap } from "../../query/service-map.js";
import { contractFor } from "../../query/contract.js";
import { declaredPatterns } from "../../query/patterns.js";
import { boundaries } from "../../query/boundaries.js";
import { loadGraph } from "../load-graph.js";

function emit(json: boolean, data: unknown, text: () => void): void {
  if (json) console.log(JSON.stringify(data, null, 2));
  else text();
}

export function registerQuery(program: Command): void {
  const query = program.command("query").description("explore an existing graph.json");
  const graphOpt = (cmd: Command) =>
    cmd.option("-g, --graph <path>", "graph file", ".codeviz/graph.json").option("--json", "JSON output");

  graphOpt(query.command("focus"))
    .argument("<id>", "node id to focus")
    .option("--hops <n>", "neighborhood radius", "1")
    .action((id: string, opts) => {
      const index = loadGraph(opts.graph);
      const sub = focus(index, id, Number(opts.hops));
      const graph = subgraphToGraph(index.graph, sub);
      emit(opts.json, graph, () => {
        console.log(`focus ${id} (${sub.nodes.length} nodes, ${sub.edges.length} edges)`);
        for (const n of sub.nodes) console.log(`  ${n.displayName} [${n.kind}]`);
      });
    });

  graphOpt(query.command("path"))
    .argument("<from>", "source node id")
    .argument("<to>", "target node id")
    .action((from: string, to: string, opts) => {
      const index = loadGraph(opts.graph);
      const path = shortestPath(index, from, to);
      emit(opts.json, { from, to, path }, () => {
        if (!path) console.log(`no path from ${from} to ${to}`);
        else console.log(path.map((id) => index.node(id)?.displayName ?? id).join(" → "));
      });
    });

  graphOpt(query.command("services"))
    .action((opts) => {
      const index = loadGraph(opts.graph);
      const map = serviceMap(index);
      emit(opts.json, map, () => {
        for (const s of map) {
          console.log(`${s.name} [${s.operations.join(", ") || "—"}]`);
          for (const c of s.callers) console.log(`  ← ${c.displayName}${c.op ? ` (${c.op})` : ""}`);
        }
      });
    });

  graphOpt(query.command("contract"))
    .argument("<id>", "node id")
    .action((id: string, opts) => {
      const index = loadGraph(opts.graph);
      const view = contractFor(index, id);
      emit(opts.json, view ?? null, () => {
        if (!view) return console.log(`no node ${id}`);
        const c = view.contract;
        console.log(view.displayName);
        console.log(`  input:  ${c?.input?.ref ?? "—"}`);
        console.log(`  output: ${c?.output?.ref ?? "—"}`);
        if (c?.errors?.length) console.log(`  errors: ${c.errors.join(", ")}`);
      });
    });

  graphOpt(query.command("layers"))
    .argument("<layers>", "comma-separated layer ids")
    .option("--hops <n>", "neighborhood radius", "0")
    .action((layers: string, opts) => {
      const index = loadGraph(opts.graph);
      const sub = layerFilter(index, layers.split(",").map((s) => s.trim()), Number(opts.hops));
      const graph = subgraphToGraph(index.graph, sub);
      emit(opts.json, graph, () => {
        console.log(`layers ${layers} (${sub.nodes.length} nodes)`);
        for (const n of sub.nodes) console.log(`  ${n.displayName} [${n.layer ?? "grey"}]`);
      });
    });

  graphOpt(query.command("patterns"))
    .action((opts) => {
      const index = loadGraph(opts.graph);
      const groups = declaredPatterns(index);
      emit(opts.json, groups, () => {
        if (groups.length === 0) return console.log("no declared patterns");
        for (const g of groups) {
          console.log(g.name);
          for (const p of g.participants) console.log(`  ${p.displayName}${p.role ? ` (${p.role})` : ""}`);
        }
      });
    });

  graphOpt(query.command("boundaries"))
    .action((opts) => {
      const index = loadGraph(opts.graph);
      const list = boundaries(index);
      emit(opts.json, list, () => {
        if (list.length === 0) return console.log("no boundary nodes");
        for (const b of list) console.log(`${b.displayName}${b.note ? ` — ${b.note}` : ""}`);
      });
    });
}
