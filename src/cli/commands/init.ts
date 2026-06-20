import { Command } from "commander";
import { cpSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { decoratorPackageDir } from "../../extract/helper-path.js";
import { log } from "../../util/logger.js";

const STARTER_CONFIG = `# codeviz configuration
# Layers carry allowed dependencies (mayDependOn); an edge that breaks them is a violation.
root: "."
layers:
  - { id: presentation, order: 0, mayDependOn: [domain] }
  - { id: domain,       order: 1, mayDependOn: [data, integration] }
  - { id: data,         order: 2, mayDependOn: [] }
  - { id: integration,  order: 3, mayDependOn: [] }
ignore:
  - "**/tests/**"
check:
  minCoverage: 0.0
  failOn: [layer-violation]
`;

export function registerInit(program: Command): void {
  program
    .command("init")
    .argument("[path]", "project root", ".")
    .option("--no-decorators", "do not copy the codeviz decorator package")
    .description("scaffold a config and copy the codeviz decorator package into the project")
    .action((path: string, opts) => {
      const root = resolve(path);

      const configPath = join(root, "codeviz.config.yaml");
      if (existsSync(configPath)) {
        log.warn(`config already exists at ${configPath}; leaving it untouched`);
      } else {
        writeFileSync(configPath, STARTER_CONFIG, "utf8");
        log.info(`wrote ${configPath}`);
      }

      if (opts.decorators !== false) {
        const src = decoratorPackageDir();
        const dest = join(root, "codeviz");
        if (existsSync(dest)) {
          log.warn(`${dest} already exists; not overwriting the decorator package`);
        } else if (existsSync(src)) {
          mkdirSync(dest, { recursive: true });
          cpSync(src, dest, { recursive: true });
          log.info(`copied decorator package to ${dest} (import: from codeviz import component, …)`);
        } else {
          log.warn(`bundled decorator package not found at ${src}`);
        }
      }
    });
}
