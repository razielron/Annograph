/** Discover Python source files honoring include/ignore globs and .gitignore. */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import fg from "fast-glob";
import ignoreFactory, { type Ignore } from "ignore";
import { DEFAULT_IGNORE, type CodevizConfig } from "./config.js";

// `ignore`'s default export is a function merged with a namespace; the merge
// confuses NodeNext's call-signature resolution, so we cast to the factory type.
const ignore = ignoreFactory as unknown as (options?: object) => Ignore;

export interface DiscoverResult {
  /** Absolute file paths, sorted for determinism. */
  files: string[];
}

/**
 * Returns absolute paths to candidate .py files under `root`, after applying
 * config include/ignore globs, the built-in ignore set, and .gitignore rules.
 */
export async function discoverFiles(
  root: string,
  config: CodevizConfig,
): Promise<DiscoverResult> {
  const matches = await fg(config.include, {
    cwd: root,
    ignore: [...DEFAULT_IGNORE, ...config.ignore],
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: false,
  });

  const gitignore = loadGitignore(root);
  const filtered = gitignore ? matches.filter((rel) => !gitignore.ignores(rel)) : matches;

  const files = filtered.map((rel) => join(root, rel)).sort();
  return { files };
}

function loadGitignore(root: string): Ignore | undefined {
  const path = join(root, ".gitignore");
  if (!existsSync(path)) return undefined;
  try {
    const ig = ignore();
    ig.add(readFileSync(path, "utf8"));
    return ig;
  } catch {
    return undefined;
  }
}
