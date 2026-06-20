import { Command } from "commander";
import { resolve } from "node:path";
import { loadConfig } from "../../discovery/config.js";
import { makeState } from "../../server/state.js";
import { startServer } from "../../server/index.js";
import { openBrowser } from "../../server/open-browser.js";
import { loadGraph } from "../load-graph.js";
import { log } from "../../util/logger.js";

export function registerUi(program: Command): void {
  program
    .command("ui")
    .argument("[path]", "project root (for source viewing + config)", ".")
    .option("-g, --graph <path>", "graph file", ".codeviz/graph.json")
    .option("-p, --port <n>", "port", "7000")
    .option("--host <host>", "bind host", "localhost")
    .option("--no-open", "do not open the browser")
    .option("--config <path>", "path to codeviz config")
    .description("serve a local web viewer for an existing graph.json")
    .action(async (path: string, opts) => {
      const root = resolve(path);
      const index = loadGraph(opts.graph);
      const { config } = loadConfig(root, opts.config);
      const state = makeState(index.graph, root, config);

      const { server, url } = await startServer({
        state,
        host: opts.host,
        port: Number(opts.port),
      });

      log.info(`codeviz ui → ${url}`);
      if (opts.open) openBrowser(url);

      const shutdown = () => {
        server.close(() => process.exit(0));
        // Force-exit if connections linger past a grace period.
        setTimeout(() => process.exit(0), 500).unref();
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    });
}
