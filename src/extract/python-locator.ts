/** Locate a usable python3 (>=3.9, needed for ast.unparse) interpreter. */

import { spawnSync } from "node:child_process";
import { PythonNotFoundError } from "../util/errors.js";

const MIN_MAJOR = 3;
const MIN_MINOR = 9;

interface Probe {
  ok: boolean;
  version?: string;
}

function probe(bin: string): Probe {
  try {
    const res = spawnSync(bin, ["--version"], { encoding: "utf8" });
    if (res.status !== 0 || res.error) return { ok: false };
    const out = `${res.stdout}${res.stderr}`.trim();
    const m = out.match(/Python\s+(\d+)\.(\d+)\.(\d+)/);
    if (!m) return { ok: false };
    const major = Number(m[1]);
    const minor = Number(m[2]);
    const ok = major > MIN_MAJOR || (major === MIN_MAJOR && minor >= MIN_MINOR);
    return { ok, version: `${m[1]}.${m[2]}.${m[3]}` };
  } catch {
    return { ok: false };
  }
}

/**
 * Resolve the interpreter, probing in priority order:
 *   CODEVIZ_PYTHON env -> explicit config override -> python3 -> python.
 */
export function locatePython(configured?: string): { bin: string; version: string } {
  const ordered = [process.env.CODEVIZ_PYTHON, configured, "python3", "python"].filter(
    (b): b is string => typeof b === "string" && b.length > 0,
  );

  let sawOldVersion: string | undefined;
  for (const bin of ordered) {
    const p = probe(bin);
    if (p.ok) return { bin, version: p.version! };
    if (p.version) sawOldVersion = p.version;
  }

  if (sawOldVersion) {
    throw new PythonNotFoundError(
      `found Python ${sawOldVersion}, but codeviz needs >= ${MIN_MAJOR}.${MIN_MINOR}`,
      "ast.unparse (used for type extraction) requires Python 3.9+. Install a newer Python or set CODEVIZ_PYTHON.",
    );
  }
  throw new PythonNotFoundError(
    "could not find a python3 interpreter on PATH",
    "Install Python 3.9+ or point codeviz at it via CODEVIZ_PYTHON=/path/to/python3 (or the `python` config key).",
  );
}
