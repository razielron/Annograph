/**
 * Symbol resolution index built from module envelopes.
 *
 * Provides two things the call resolver needs:
 *   1. A global map of module -> { classes, functions } so cross-file lookups work.
 *   2. Per-module import bindings (alias -> origin) with relative imports resolved.
 */

import type { ModuleEnvelope } from "../extract/envelope.js";

/** What an imported name binds to. */
export interface ImportBinding {
  /** The absolute module the name comes from (relative imports resolved). */
  module: string;
  /** The original name in that module ("*" for a whole-module import). */
  originalName: string;
  /** True when the import target module is not part of the scanned project. */
  external: boolean;
}

export interface ModuleInfo {
  dotted: string;
  classes: Set<string>;
  functions: Set<string>;
  /** Local binding name (alias or original) -> binding. */
  imports: Map<string, ImportBinding>;
}

export class SymbolTable {
  /** module dotted -> info */
  readonly modules = new Map<string, ModuleInfo>();

  static build(envelopes: ModuleEnvelope[]): SymbolTable {
    const table = new SymbolTable();
    const known = new Set(envelopes.map((e) => e.module_dotted));

    for (const env of envelopes) {
      const info: ModuleInfo = {
        dotted: env.module_dotted,
        classes: new Set(env.classes.map((c) => c.name)),
        functions: new Set(env.functions.map((f) => f.name)),
        imports: new Map(),
      };

      for (const imp of env.imports) {
        if (imp.kind === "import") {
          // `import a.b.c [as x]` -> bind the alias (or the top name) to the module.
          for (const n of imp.names) {
            const target = n.name;
            const binding: ImportBinding = {
              module: target,
              originalName: "*",
              external: !known.has(target),
            };
            const local = n.asname ?? topLevelName(target);
            info.imports.set(local, binding);
          }
        } else {
          // `from m import a [as b]` (m may be relative via `level`).
          const absModule = resolveRelative(env.module_dotted, imp.module, imp.level);
          for (const n of imp.names) {
            const local = n.asname ?? n.name;
            info.imports.set(local, {
              module: absModule,
              originalName: n.name,
              external: !known.has(absModule),
            });
          }
        }
      }

      table.modules.set(env.module_dotted, info);
    }

    return table;
  }

  hasModule(dotted: string): boolean {
    return this.modules.has(dotted);
  }

  classExists(moduleDotted: string, className: string): boolean {
    return this.modules.get(moduleDotted)?.classes.has(className) ?? false;
  }

  functionExists(moduleDotted: string, funcName: string): boolean {
    return this.modules.get(moduleDotted)?.functions.has(funcName) ?? false;
  }
}

function topLevelName(dotted: string): string {
  const idx = dotted.indexOf(".");
  return idx === -1 ? dotted : dotted.slice(0, idx);
}

/**
 * Resolve a possibly-relative `from` import to an absolute module dotted path.
 * `level` is the number of leading dots (0 = absolute).
 */
export function resolveRelative(
  currentModule: string,
  module: string | null,
  level: number,
): string {
  if (level === 0) return module ?? "";

  // The package of `currentModule` is its parent; each extra dot climbs one more.
  const parts = currentModule.split(".");
  // Drop the module's own name, then climb (level - 1) further packages.
  const keep = Math.max(0, parts.length - level);
  const base = parts.slice(0, keep);
  if (module) base.push(...module.split("."));
  return base.join(".");
}
