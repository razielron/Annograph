/** Readers for the remaining annotation decorators: entrypoint, boundary, pattern, link. */

import type { Decorator } from "../extract/envelope.js";
import type { EntrypointInfo, EdgeKind, PatternRef } from "./types.js";

export function entrypointFrom(decorators: Decorator[]): EntrypointInfo | undefined {
  const d = decorators.find((x) => x.name === "entrypoint");
  if (!d) return undefined;
  const kind = strArg(d, 0, "kind");
  if (!kind) return undefined;
  const path = strKwarg(d, "path");
  const info: EntrypointInfo = { kind };
  if (path !== undefined) info.path = path;
  return info;
}

export function boundaryFrom(decorators: Decorator[]): { note?: string } | undefined {
  const d = decorators.find((x) => x.name === "boundary");
  if (!d) return undefined;
  const note = strArg(d, 0, "note");
  return note !== undefined ? { note } : {};
}

export function patternsFrom(decorators: Decorator[]): PatternRef[] {
  return decorators
    .filter((d) => d.name === "pattern")
    .map((d) => {
      const name = strArg(d, 0, "name");
      if (!name) return undefined;
      const role = strKwarg(d, "role");
      const ref: PatternRef = { name, declared: true };
      if (role !== undefined) ref.role = role;
      return ref;
    })
    .filter((p): p is PatternRef => p !== undefined);
}

export interface LinkDecl {
  to: string;
  kind: EdgeKind;
  line: number;
}

const VALID_EDGE_KINDS = new Set<EdgeKind>([
  "calls",
  "imports",
  "extends",
  "implements",
  "data-flow",
  "uses-service",
]);

export function linksFrom(decorators: Decorator[]): LinkDecl[] {
  return decorators
    .filter((d) => d.name === "link")
    .map((d) => {
      const to = strArg(d, 0, "to");
      if (!to) return undefined;
      const kindRaw = strKwarg(d, "kind") ?? "calls";
      const kind: EdgeKind = VALID_EDGE_KINDS.has(kindRaw as EdgeKind)
        ? (kindRaw as EdgeKind)
        : "calls";
      return { to, kind, line: d.line };
    })
    .filter((l): l is LinkDecl => l !== undefined);
}

/** Read positional index `idx` or kwarg `key` as a string. */
function strArg(d: Decorator, idx: number, key: string): string | undefined {
  const positional = d.args[idx];
  if (typeof positional === "string") return positional;
  const kw = d.kwargs[key];
  return typeof kw === "string" ? kw : undefined;
}

function strKwarg(d: Decorator, key: string): string | undefined {
  const v = d.kwargs[key];
  return typeof v === "string" ? v : undefined;
}
