/** Shared helper: run the full scan pipeline over a fixture directory. */

import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../../src/discovery/config.js";
import { discoverFiles } from "../../src/discovery/files.js";
import { extract } from "../../src/extract/runner.js";
import { buildGraph } from "../../src/ir/builder.js";
import { serializeGraph } from "../../src/ir/serialize.js";
import type { CodevizGraph } from "../../src/ir/types.js";
import type { BuildWarning } from "../../src/ir/builder.js";

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURES = resolve(HERE, "..", "fixtures");

/** True when a usable python3 is available; integration tests skip otherwise. */
export function pythonAvailable(): boolean {
  for (const bin of [process.env.CODEVIZ_PYTHON, "python3", "python"].filter(Boolean) as string[]) {
    const res = spawnSync(bin, ["--version"], { encoding: "utf8" });
    if (res.status === 0) {
      const m = `${res.stdout}${res.stderr}`.match(/Python\s+(\d+)\.(\d+)/);
      if (m && (Number(m[1]) > 3 || (Number(m[1]) === 3 && Number(m[2]) >= 9))) return true;
    }
  }
  return false;
}

export async function scanFixture(
  name: string,
): Promise<{ graph: CodevizGraph; warnings: BuildWarning[]; json: string }> {
  const root = resolve(FIXTURES, name);
  const { config } = loadConfig(root);
  const { files } = await discoverFiles(root, config);
  const result = await extract({ root, files });
  const { graph, warnings } = buildGraph(result.modules, config.layers);
  return { graph, warnings, json: serializeGraph(graph) };
}
