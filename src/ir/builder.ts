/**
 * IR builder — orchestrates envelopes into the canonical graph.
 *
 * Two passes:
 *   1. Create every code node (module/class/function/method) and register ids,
 *      assigning layers, tags, contracts, entrypoints, patterns, services.
 *   2. Resolve edges: imports, inheritance, calls (via resolve-calls), declared
 *      uses-service edges, and manual @link bridges. Unresolved calls synthesize
 *      grey nodes. Warnings (collisions, dangling links, non-static decorator
 *      args) are collected for the scan report and --check.
 */

import type {
  ClassEnvelope,
  Decorator,
  FuncEnvelope,
  ModuleEnvelope,
} from "../extract/envelope.js";
import type { LayerConfig } from "../discovery/config.js";
import {
  IR_VERSION,
  type CodevizGraph,
  type EdgeKind,
  type IREdge,
  type IRNode,
  type ServiceDef,
  type SourceRef,
} from "./types.js";
import {
  IdAllocator,
  classId,
  displayNameFor,
  functionId,
  isUnresolvedId,
  methodId,
  moduleId,
  serviceId,
  serviceName,
  unresolvedId,
} from "./ids.js";
import { SymbolTable, resolveRelative } from "./symbol-table.js";
import { resolveCall, type ResolveContext } from "./resolve-calls.js";
import { layerFromComponent, tagsFromComponent } from "./layers.js";
import { buildContract } from "./contracts.js";
import { usesServiceFrom } from "./services.js";
import {
  boundaryFrom,
  entrypointFrom,
  linksFrom,
  patternsFrom,
  type LinkDecl,
} from "./decorators.js";

export interface BuildResult {
  graph: CodevizGraph;
  warnings: BuildWarning[];
  collisions: number;
}

export interface BuildWarning {
  kind: "dangling-link" | "non-static-arg" | "unknown-layer" | "id-collision";
  message: string;
  source?: SourceRef;
}

export function buildGraph(
  envelopes: ModuleEnvelope[],
  layers: LayerConfig[],
): BuildResult {
  const builder = new Builder(envelopes, layers);
  return builder.run();
}

class Builder {
  private readonly table: SymbolTable;
  private readonly alloc = new IdAllocator();
  private readonly nodes = new Map<string, IRNode>();
  private readonly edges: IREdge[] = [];
  private readonly services = new Map<string, ServiceDef>();
  private readonly warnings: BuildWarning[] = [];
  private readonly knownLayers: Set<string>;
  /** Deferred edge work that needs the full node registry from pass 1. */
  private readonly pendingLinks: { from: string; links: LinkDecl[]; source: SourceRef }[] = [];

  constructor(
    private readonly envelopes: ModuleEnvelope[],
    private readonly layers: LayerConfig[],
  ) {
    this.table = SymbolTable.build(envelopes);
    this.knownLayers = new Set(layers.map((l) => l.id));
  }

  run(): BuildResult {
    for (const env of this.envelopes) this.createNodes(env);
    const knownIds = new Set(this.nodes.keys());
    for (const env of this.envelopes) this.resolveEdges(env, knownIds);
    this.resolveLinks(knownIds);

    const graph: CodevizGraph = {
      version: IR_VERSION,
      layers: this.layers.map((l) => ({ id: l.id, order: l.order, mayDependOn: l.mayDependOn })),
      services: [...this.services.values()],
      nodes: [...this.nodes.values()],
      edges: dedupeEdges(this.edges),
      patterns_detected: [],
    };
    return { graph, warnings: this.warnings, collisions: this.alloc.collisions };
  }

  // ---- Pass 1: nodes ----

  private createNodes(env: ModuleEnvelope): void {
    if (env.parse_error) return;

    const modId = this.alloc.allocate(moduleId(env.module_dotted));
    this.addNode({
      id: modId,
      kind: "module",
      name: env.module_dotted,
      displayName: displayNameFor(modId, "module"),
      tags: [],
      source: { file: env.path, line: 1 },
      lang: "python",
    });

    for (const cls of env.classes) this.createClassNodes(env, cls);
    for (const fn of env.functions) this.createFunctionNode(env, fn, undefined);
  }

  private createClassNodes(env: ModuleEnvelope, cls: ClassEnvelope): void {
    const layer = this.checkLayer(layerFromComponent(cls.decorators), cls, env);
    const tags = tagsFromComponent(cls.decorators);
    const id = this.alloc.allocate(classId(env.module_dotted, cls.name));

    const node: IRNode = {
      id,
      kind: "class",
      name: cls.name,
      displayName: displayNameFor(id, "class"),
      tags,
      source: { file: env.path, line: cls.line },
      lang: "python",
    };
    if (layer !== undefined) node.layer = layer;
    const patterns = patternsFrom(cls.decorators);
    if (patterns.length > 0) node.patterns = patterns;
    const boundary = boundaryFrom(cls.decorators);
    if (boundary) node.boundary = boundary;
    this.addNode(node);
    this.recordNonStaticArgs(cls.decorators, node.source);

    for (const method of cls.methods) {
      this.createFunctionNode(env, method, { className: cls.name, classLayer: layer });
    }
  }

  private createFunctionNode(
    env: ModuleEnvelope,
    fn: FuncEnvelope,
    owner: { className: string; classLayer: string | undefined } | undefined,
  ): void {
    const id = this.alloc.allocate(
      owner ? methodId(env.module_dotted, owner.className, fn.name) : functionId(env.module_dotted, fn.name),
    );

    const ownLayer = this.checkLayer(layerFromComponent(fn.decorators), fn, env);
    const layer = ownLayer ?? owner?.classLayer;
    const entrypoint = entrypointFrom(fn.decorators);
    const kind = entrypoint ? "entrypoint" : "function";

    const node: IRNode = {
      id,
      kind,
      name: fn.name,
      displayName: displayNameFor(id, kind),
      tags: tagsFromComponent(fn.decorators),
      source: { file: env.path, line: fn.line },
      lang: "python",
    };
    if (layer !== undefined) node.layer = layer;
    if (entrypoint) node.entrypoint = entrypoint;
    const contract = buildContract(fn);
    if (contract) node.contract = contract;
    const patterns = patternsFrom(fn.decorators);
    if (patterns.length > 0) node.patterns = patterns;
    const boundary = boundaryFrom(fn.decorators);
    if (boundary) node.boundary = boundary;
    this.addNode(node);
    this.recordNonStaticArgs(fn.decorators, node.source);

    // Defer @link resolution until all nodes exist.
    const links = linksFrom(fn.decorators);
    if (links.length > 0) {
      this.pendingLinks.push({ from: id, links, source: node.source! });
    }
  }

  // ---- Pass 2: edges ----

  private resolveEdges(env: ModuleEnvelope, knownIds: Set<string>): void {
    if (env.parse_error) return;
    const fromModule = moduleId(env.module_dotted);

    // Import edges (module -> module / external grey module).
    for (const imp of env.imports) {
      const target =
        imp.kind === "import"
          ? imp.names[0]?.name
          : resolveRelative(env.module_dotted, imp.module, imp.level);
      if (!target) continue;
      // The annotation library itself is not a real dependency — skip it.
      if (isAnnotationImport(target)) continue;
      const to = this.table.hasModule(target) ? moduleId(target) : this.greyNode(target);
      this.edges.push({ from: fromModule, to, kind: "imports", inferred: true });
    }

    for (const cls of env.classes) {
      const fromClass = classId(env.module_dotted, cls.name);

      // Inheritance edges.
      for (const base of cls.bases) {
        const to = this.resolveBase(env.module_dotted, base.expr, knownIds);
        const kind: EdgeKind = looksLikeInterface(base.expr) ? "implements" : "extends";
        this.edges.push({ from: fromClass, to, kind, inferred: true });
      }

      const instanceAttrTypes = buildInstanceAttrMap(cls);
      for (const method of cls.methods) {
        this.resolveFunctionEdges(env, method, knownIds, {
          enclosingClass: cls.name,
          instanceAttrTypes,
        });
      }
    }

    for (const fn of env.functions) {
      this.resolveFunctionEdges(env, fn, knownIds, {});
    }
  }

  private resolveFunctionEdges(
    env: ModuleEnvelope,
    fn: FuncEnvelope,
    knownIds: Set<string>,
    scope: { enclosingClass?: string; instanceAttrTypes?: Map<string, string> },
  ): void {
    const fromId = scope.enclosingClass
      ? methodId(env.module_dotted, scope.enclosingClass, fn.name)
      : functionId(env.module_dotted, fn.name);

    // Declared service usage (@uses_service).
    const svc = usesServiceFrom(fn.decorators);
    if (svc) {
      const sid = serviceId(svc.name);
      this.ensureService(svc.name, svc.op);
      const edge: IREdge = { from: fromId, to: sid, kind: "uses-service", inferred: false };
      if (svc.op !== undefined) edge.op = svc.op;
      this.edges.push(edge);
    }

    const ctx: ResolveContext = {
      table: this.table,
      knownIds,
      moduleDotted: env.module_dotted,
    };
    if (scope.enclosingClass !== undefined) ctx.enclosingClass = scope.enclosingClass;
    if (scope.instanceAttrTypes !== undefined) ctx.instanceAttrTypes = scope.instanceAttrTypes;

    for (const call of fn.calls) {
      const resolved = resolveCall(call, ctx);
      if (!resolved) continue;
      if (resolved.unresolved) this.greyNode(resolved.greyName ?? call.callee_repr);
      this.edges.push({
        from: fromId,
        to: resolved.to,
        kind: "calls",
        inferred: true,
        source: { file: env.path, line: call.line },
      });
    }
  }

  private resolveLinks(knownIds: Set<string>): void {
    for (const { from, links, source } of this.pendingLinks) {
      for (const link of links) {
        const to = link.to;
        if (!knownIds.has(to) && !this.nodes.has(to)) {
          this.warnings.push({
            kind: "dangling-link",
            message: `@link target "${to}" does not resolve to a known node`,
            source: { file: source.file, line: link.line },
          });
        }
        this.edges.push({ from, to, kind: link.kind, inferred: false, via: "link" });
      }
    }
  }

  // ---- helpers ----

  private addNode(node: IRNode): void {
    this.nodes.set(node.id, node);
  }

  private greyNode(name: string): string {
    const id = isUnresolvedId(name) ? name : unresolvedId(name);
    if (!this.nodes.has(id)) {
      this.nodes.set(id, {
        id,
        kind: "function",
        name: displayNameFor(id, "function"),
        displayName: displayNameFor(id, "function"),
        tags: [],
        unresolved: true,
      });
    }
    return id;
  }

  private ensureService(name: string, op: string | undefined): void {
    const id = serviceId(name);
    const existing = this.services.get(id);
    if (existing) {
      if (op && !existing.operations.includes(op)) existing.operations.push(op);
      return;
    }
    this.services.set(id, { id, operations: op ? [op] : [] });
    // Services are also nodes so queries/analysis treat them uniformly.
    this.nodes.set(id, {
      id,
      kind: "service",
      name: serviceName(id),
      displayName: serviceName(id),
      tags: [],
    });
  }

  private resolveBase(moduleDotted: string, baseExpr: string, knownIds: Set<string>): string {
    const simple = baseExpr.split(".").pop() ?? baseExpr;
    // Local class?
    const localId = classId(moduleDotted, simple);
    if (knownIds.has(localId)) return localId;
    // Imported class?
    const binding = this.table.modules.get(moduleDotted)?.imports.get(simple);
    if (binding && !binding.external) {
      const importedId = classId(binding.module, simple);
      if (knownIds.has(importedId)) return importedId;
    }
    return this.greyNode(simple);
  }

  private checkLayer(
    layer: string | undefined,
    owner: { name: string },
    env: ModuleEnvelope,
  ): string | undefined {
    if (layer !== undefined && this.knownLayers.size > 0 && !this.knownLayers.has(layer)) {
      this.warnings.push({
        kind: "unknown-layer",
        message: `${owner.name} declares unknown layer "${layer}"`,
        source: { file: env.path, line: 1 },
      });
    }
    return layer;
  }

  private recordNonStaticArgs(decorators: Decorator[], source: SourceRef | undefined): void {
    for (const d of decorators) {
      if (d.unresolved_kwargs.length > 0) {
        const warning: BuildWarning = {
          kind: "non-static-arg",
          message: `@${d.name} has non-static argument(s): ${d.unresolved_kwargs.join(", ")}`,
        };
        if (source) warning.source = { file: source.file, line: d.line };
        this.warnings.push(warning);
      }
    }
  }
}

/** The codeviz annotation package is metadata, not a runtime dependency. */
function isAnnotationImport(module: string): boolean {
  return module === "codeviz" || module.startsWith("codeviz.");
}

function buildInstanceAttrMap(cls: ClassEnvelope): Map<string, string> {
  const map = new Map<string, string>();
  for (const attr of cls.instance_attrs) {
    if (attr.type_ref) map.set(attr.name, attr.type_ref);
  }
  return map;
}

/** Heuristic: PascalCase names ending in common interface suffixes are interfaces. */
function looksLikeInterface(baseExpr: string): boolean {
  const simple = baseExpr.split(".").pop() ?? baseExpr;
  return /(?:ABC|Protocol|Interface|Base|Mixin)$/.test(simple) || simple.startsWith("I");
}

/** Drop exact-duplicate edges (same from/to/kind/op), keeping the first. */
function dedupeEdges(edges: IREdge[]): IREdge[] {
  const seen = new Set<string>();
  const out: IREdge[] = [];
  for (const e of edges) {
    const key = `${e.from} ${e.to} ${e.kind} ${e.op ?? ""} ${e.via ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}
