/** Spawn the Python helper, stream its NDJSON output, and validate envelopes. */

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { ExtractError } from "../util/errors.js";
import { log } from "../util/logger.js";
import { helperMainPath } from "./helper-path.js";
import { locatePython } from "./python-locator.js";
import type { ExtractionResult, ModuleEnvelope, Summary } from "./envelope.js";
import { parseLine } from "./envelope.js";

export interface ExtractOptions {
  root: string;
  files: string[];
  /** Explicit interpreter override from config. */
  python?: string;
}

/**
 * Run extraction over the given files. One helper process handles the whole
 * batch; the file list goes over stdin and NDJSON comes back over stdout.
 */
export async function extract(opts: ExtractOptions): Promise<ExtractionResult> {
  const { bin, version } = locatePython(opts.python);
  const script = helperMainPath();
  log.debug(`using python ${version} (${bin}); helper ${script}`);

  return await new Promise<ExtractionResult>((resolve, reject) => {
    const child = spawn(bin, [script], { stdio: ["pipe", "pipe", "pipe"] });

    const modules: ModuleEnvelope[] = [];
    let summary: Summary | undefined;
    let parseFailure: Error | undefined;
    let stderr = "";

    const rl = createInterface({ input: child.stdout });
    rl.on("line", (line) => {
      if (!line.trim()) return;
      try {
        const parsed = parseLine(line);
        if (parsed.type === "summary") summary = parsed;
        else modules.push(parsed);
      } catch (err) {
        // Keep the first failure; let the stream drain so we can report cleanly.
        parseFailure ??= err instanceof Error ? err : new Error(String(err));
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      reject(new ExtractError(`failed to launch Python helper: ${err.message}`));
    });

    child.on("close", (code) => {
      if (parseFailure) {
        reject(new ExtractError(`could not parse helper output: ${parseFailure.message}`));
        return;
      }
      if (code !== 0) {
        reject(
          new ExtractError(
            `Python helper exited with code ${code}`,
            stderr.trim() || undefined,
          ),
        );
        return;
      }
      resolve({ modules, summary });
    });

    child.stdin.write(JSON.stringify({ root: opts.root, files: opts.files }));
    child.stdin.end();
  });
}
