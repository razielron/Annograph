/** Read-only source slice, sandboxed to the scanned root (no path traversal). */

import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { CodevizError } from "../util/errors.js";

export interface SourceSlice {
  file: string;
  line: number;
  start: number;
  end: number;
  lines: string[];
}

/** Files we are willing to serve back — project source, not arbitrary content. */
const ALLOWED_EXT = new Set([".py", ".pyi", ".yaml", ".yml", ".json", ".cfg", ".toml", ".txt"]);

/**
 * Return a bounded window of source around `line` for `file` (relative to `root`).
 * Rejects any path that escapes `root` or has a disallowed extension.
 */
export function readSourceSlice(
  root: string,
  file: string,
  line: number,
  context = 12,
): SourceSlice {
  const abs = resolve(root, file);
  const rel = relative(root, abs);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new CodevizError(`refusing to read outside project root: ${file}`);
  }
  const dot = abs.lastIndexOf(".");
  const ext = dot >= 0 ? abs.slice(dot).toLowerCase() : "";
  if (!ALLOWED_EXT.has(ext)) {
    throw new CodevizError(`refusing to read unsupported file type: ${file}`);
  }

  let raw: string;
  try {
    raw = readFileSync(abs, "utf8");
  } catch (err) {
    throw new CodevizError(`could not read source ${file}: ${(err as Error).message}`);
  }

  const all = raw.split("\n");
  const target = Number.isFinite(line) && line > 0 ? Math.floor(line) : 1;
  const start = Math.max(1, target - context);
  const end = Math.min(all.length, target + context);
  return { file, line: target, start, end, lines: all.slice(start - 1, end) };
}
