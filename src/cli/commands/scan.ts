import { Command } from "commander";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadConfig } from "../../discovery/config.js";
import { discoverFiles } from "../../discovery/files.js";
import { extract } from "../../extract/runner.js";
import { buildGraph } from "../../ir/builder.js";
import { serializeGraph } from "../../ir/serialize.js";
import { runAnalysis } from "../../analysis/index.js";
import { coverage } from "../../analysis/coverage.js";
import { log } from "../../util/logger.js";
import { reportScan, reportFindings } from "../output/reporter.js";

export function registerScan(program: Command): void {
  program
    .command("scan")
    .argument("[path]", "project root to scan", ".")
    .option("--config <path>", "path to codeviz config")
    .option("--out <path>", "output graph path", ".codeviz/graph.json")
    .option("--python <bin>", "python interpreter override")
    .option("--check", "CI mode: run analysis and exit non-zero on findings")
    .description("statically extract an annotated Python project into a graph")
    .action(async (path: string, opts) => {
      const root = resolve(path);
      const { config, path: configPath } = loadConfig(root, opts.config);
      if (configPath) log.debug(`loaded config from ${configPath}`);

      const { files } = await discoverFiles(root, config);
      if (files.length === 0) {
        log.warn(`no Python files found under ${root}`);
      }
      log.info(`scanning ${files.length} file(s)…`);

      const python = opts.python ?? config.python;
      const result = await extract({ root, files, ...(python ? { python } : {}) });

      const { graph, warnings, collisions } = buildGraph(result.modules, config.layers);
      const cov = coverage(graph);

      reportScan({
        graph,
        summary: result.summary,
        warnings,
        collisions,
        coverage: cov,
      });

      if (opts.check) {
        const findings = runAnalysis(graph, config, warnings);
        reportFindings(findings, cov, config.check);
        const failed = shouldFail(findings, cov.layerCoverage, config.check);
        process.exitCode = failed ? 1 : 0;
        return;
      }

      const outPath = resolve(root, opts.out);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, serializeGraph(graph), "utf8");
      log.info(`wrote ${outPath}`);
    });
}

function shouldFail(
  findings: ReturnType<typeof runAnalysis>,
  layerCoverage: number,
  check: { minCoverage: number; failOn: string[] },
): boolean {
  if (layerCoverage < check.minCoverage) return true;
  return findings.some((f) => check.failOn.includes(f.type));
}
