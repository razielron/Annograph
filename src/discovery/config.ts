/** Load and validate codeviz.config.{yaml,yml,json}; supply zero-config defaults (P6). */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { ConfigError } from "../util/errors.js";

export const LayerSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  mayDependOn: z.array(z.string()).default([]),
});

export const CheckSchema = z.object({
  minCoverage: z.number().min(0).max(1).default(0),
  failOn: z
    .array(z.enum(["layer-violation", "cycle", "unmapped-service", "dangling-link"]))
    .default(["layer-violation"]),
});

export const ConfigSchema = z.object({
  /** Source root stripped from module ids (e.g. "src"). */
  root: z.string().default("."),
  layers: z.array(LayerSchema).default([]),
  include: z.array(z.string()).default(["**/*.py"]),
  ignore: z.array(z.string()).default([]),
  /** Explicit interpreter override. */
  python: z.string().optional(),
  check: CheckSchema.default({}),
});

export type LayerConfig = z.infer<typeof LayerSchema>;
export type CheckConfig = z.infer<typeof CheckSchema>;
export type CodevizConfig = z.infer<typeof ConfigSchema>;

/** Ignore globs always applied on top of user config. */
export const DEFAULT_IGNORE = [
  "**/__pycache__/**",
  "**/.venv/**",
  "**/venv/**",
  "**/node_modules/**",
  "**/.git/**",
  "**/build/**",
  "**/dist/**",
  // The copied codeviz annotation package is metadata, not project code.
  "**/codeviz/decorators.py",
  "**/codeviz/__init__.py",
];

const CONFIG_FILENAMES = ["codeviz.config.yaml", "codeviz.config.yml", "codeviz.config.json"];

/**
 * Resolve config: explicit path -> first found in `root` -> zero-config defaults.
 * Returns the validated config plus the path it was loaded from (if any).
 */
export function loadConfig(
  root: string,
  explicitPath?: string,
): { config: CodevizConfig; path: string | undefined } {
  const path = explicitPath ?? findConfigFile(root);
  if (!path) {
    return { config: ConfigSchema.parse({}), path: undefined };
  }

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    throw new ConfigError(`could not read config at ${path}: ${(err as Error).message}`);
  }

  let data: unknown;
  try {
    data = path.endsWith(".json") ? JSON.parse(raw) : parseYaml(raw);
  } catch (err) {
    throw new ConfigError(`could not parse config at ${path}: ${(err as Error).message}`);
  }

  const result = ConfigSchema.safeParse(data ?? {});
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("\n");
    throw new ConfigError(`invalid config at ${path}:\n${issues}`);
  }
  return { config: result.data, path };
}

function findConfigFile(root: string): string | undefined {
  for (const name of CONFIG_FILENAMES) {
    const candidate = join(root, name);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}
