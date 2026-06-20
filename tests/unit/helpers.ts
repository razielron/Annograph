/** Factories for synthetic extraction envelopes — lets us test the builder
 *  and resolvers without spawning Python. */

import type {
  CallSite,
  ClassEnvelope,
  Decorator,
  FuncEnvelope,
  ImportEntry,
  ModuleEnvelope,
} from "../../src/extract/envelope.js";

export function mod(
  module_dotted: string,
  parts: Partial<Omit<ModuleEnvelope, "type" | "module_dotted" | "path">> = {},
): ModuleEnvelope {
  return {
    type: "module",
    path: `${module_dotted.replace(/\./g, "/")}.py`,
    module_dotted,
    parse_error: null,
    imports: parts.imports ?? [],
    classes: parts.classes ?? [],
    functions: parts.functions ?? [],
    module_calls: parts.module_calls ?? [],
  };
}

export function cls(name: string, parts: Partial<ClassEnvelope> = {}): ClassEnvelope {
  return {
    name,
    line: parts.line ?? 1,
    bases: parts.bases ?? [],
    decorators: parts.decorators ?? [],
    methods: parts.methods ?? [],
    instance_attrs: parts.instance_attrs ?? [],
  };
}

export function fn(name: string, parts: Partial<FuncEnvelope> = {}): FuncEnvelope {
  return {
    name,
    line: parts.line ?? 1,
    decorators: parts.decorators ?? [],
    params: parts.params ?? [],
    returns: parts.returns ?? null,
    calls: parts.calls ?? [],
    is_property: parts.is_property ?? false,
  };
}

export function call(chain: string[], line = 1): CallSite {
  return {
    callee_repr: chain.join("."),
    kind: chain.length === 1 ? "name" : "attribute",
    attr_chain: chain,
    root: chain[0]!,
    line,
  };
}

export function dec(name: string, parts: Partial<Decorator> = {}): Decorator {
  return {
    name,
    qualifier: parts.qualifier ?? null,
    args: parts.args ?? [],
    kwargs: parts.kwargs ?? {},
    type_ref_kwargs: parts.type_ref_kwargs ?? [],
    unresolved_kwargs: parts.unresolved_kwargs ?? [],
    line: parts.line ?? 1,
  };
}

export function fromImport(module: string, ...names: string[]): ImportEntry {
  return {
    kind: "from",
    module,
    names: names.map((name) => ({ name, asname: null })),
    level: 0,
  };
}

export function importMod(module: string, asname: string | null = null): ImportEntry {
  return { kind: "import", module, names: [{ name: module, asname }], level: 0 };
}
