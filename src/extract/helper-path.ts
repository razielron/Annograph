/** Resolve the bundled Python helper entry script in both dev and published layouts. */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

/**
 * The `python/` tree sits beside `dist/` in the published package and beside
 * `src/` in dev. From this module's location we walk up until we find it.
 */
export function helperMainPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // here is .../dist/extract (published) or .../src/extract (ts-node/dev).
  const candidates = [
    join(here, "..", "..", "python", "extractor", "main.py"),
    join(here, "..", "..", "..", "python", "extractor", "main.py"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Fall back to the first candidate; the runner surfaces a clear error if missing.
  return candidates[0]!;
}

/** Root of the bundled `python/codeviz` decorator package (for `codeviz init`). */
export function decoratorPackageDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "..", "..", "python", "codeviz"),
    join(here, "..", "..", "..", "python", "codeviz"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0]!;
}
