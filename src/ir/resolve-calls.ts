/**
 * Static call-target resolution + grey-node synthesis.
 *
 * Given a raw call site (an attr_chain like ["self","inventory","reserve"]) and
 * the enclosing context, resolve it to a target node id, or fall back to a
 * synthesized `unresolved:` grey node. Builtins are filtered to cut noise.
 */

import type { CallSite } from "../extract/envelope.js";
import { classId, methodId, functionId, unresolvedId } from "./ids.js";
import { SymbolTable } from "./symbol-table.js";

/** Common builtins whose calls would only add noise to the graph. */
export const BUILTIN_DENYLIST = new Set([
  "print",
  "len",
  "range",
  "str",
  "int",
  "float",
  "bool",
  "list",
  "dict",
  "set",
  "tuple",
  "isinstance",
  "issubclass",
  "getattr",
  "setattr",
  "hasattr",
  "super",
  "enumerate",
  "zip",
  "map",
  "filter",
  "sorted",
  "min",
  "max",
  "sum",
  "any",
  "all",
  "abs",
  "repr",
  "type",
  "open",
  "format",
  "next",
  "iter",
]);

export interface ResolveContext {
  table: SymbolTable;
  /** Set of all real (non-grey) node ids that exist in the graph. */
  knownIds: Set<string>;
  /** The module the call originates in. */
  moduleDotted: string;
  /** The enclosing class name, if the call is inside a method. */
  enclosingClass?: string;
  /** instance attr name -> the module-local class name it was inferred to be. */
  instanceAttrTypes?: Map<string, string>;
}

export interface ResolvedCall {
  /** Target node id (real or `unresolved:`). */
  to: string;
  /** Whether the target is a synthesized grey node. */
  unresolved: boolean;
  /** Best-effort display name for a synthesized grey node. */
  greyName?: string;
}

/**
 * Resolve a single call site. Returns null when the call should be dropped
 * (e.g. a builtin), otherwise a target (resolved id or synthesized grey node).
 */
export function resolveCall(call: CallSite, ctx: ResolveContext): ResolvedCall | null {
  const chain = call.attr_chain;
  const last = chain[chain.length - 1]!;

  // Bare name: module-level function, local class, or imported callable.
  if (call.kind === "name") {
    if (BUILTIN_DENYLIST.has(last)) return null;
    return resolveBareName(last, ctx);
  }

  // self.method() — resolve within the enclosing class.
  if (call.root === "self" && chain.length === 2 && ctx.enclosingClass) {
    const id = methodId(ctx.moduleDotted, ctx.enclosingClass, last);
    if (ctx.knownIds.has(id)) return { to: id, unresolved: false };
    return grey(last);
  }

  // self.attr.method() — infer the attr's type, then resolve the method on it.
  if (call.root === "self" && chain.length === 3 && ctx.enclosingClass) {
    const attr = chain[1]!;
    const attrType = ctx.instanceAttrTypes?.get(attr);
    if (attrType) {
      const resolved = resolveClassMethod(attrType, last, ctx);
      if (resolved) return resolved;
    }
    return grey(last);
  }

  // module_alias.func() / module_alias.Class() — resolve via imports.
  if (chain.length >= 2) {
    const binding = ctx.table.modules.get(ctx.moduleDotted)?.imports.get(call.root);
    if (binding && !binding.external) {
      // import-as-module: alias points at a module; `last` is a member of it.
      const resolved = resolveModuleMember(binding.module, chain.slice(1), ctx);
      if (resolved) return resolved;
    }
  }

  return grey(call.callee_repr);
}

function resolveBareName(name: string, ctx: ResolveContext): ResolvedCall | null {
  // Local module-level function.
  if (ctx.table.functionExists(ctx.moduleDotted, name)) {
    return { to: functionId(ctx.moduleDotted, name), unresolved: false };
  }
  // Local class instantiation -> treat as a reference to the class node.
  if (ctx.table.classExists(ctx.moduleDotted, name)) {
    return { to: classId(ctx.moduleDotted, name), unresolved: false };
  }
  // Imported callable.
  const binding = ctx.table.modules.get(ctx.moduleDotted)?.imports.get(name);
  if (binding && !binding.external) {
    const target = binding.originalName === "*" ? name : binding.originalName;
    if (ctx.table.functionExists(binding.module, target)) {
      return { to: functionId(binding.module, target), unresolved: false };
    }
    if (ctx.table.classExists(binding.module, target)) {
      return { to: classId(binding.module, target), unresolved: false };
    }
  }
  return grey(name);
}

/** Resolve `method` invoked on an instance of a class named `className`. */
function resolveClassMethod(
  className: string,
  method: string,
  ctx: ResolveContext,
): ResolvedCall | null {
  // The class may be local or imported into the current module.
  const localClass = stripGenerics(className);

  if (ctx.table.classExists(ctx.moduleDotted, localClass)) {
    const id = methodId(ctx.moduleDotted, localClass, method);
    return ctx.knownIds.has(id) ? { to: id, unresolved: false } : grey(method);
  }

  const binding = ctx.table.modules.get(ctx.moduleDotted)?.imports.get(localClass);
  if (binding && !binding.external) {
    const id = methodId(binding.module, localClass, method);
    return ctx.knownIds.has(id) ? { to: id, unresolved: false } : grey(method);
  }
  return null;
}

/** Resolve a member access chain rooted at an imported module. */
function resolveModuleMember(
  moduleDotted: string,
  rest: string[],
  ctx: ResolveContext,
): ResolvedCall | null {
  if (!ctx.table.hasModule(moduleDotted)) return null;
  const member = rest[0]!;
  if (rest.length === 1) {
    if (ctx.table.functionExists(moduleDotted, member)) {
      return { to: functionId(moduleDotted, member), unresolved: false };
    }
    if (ctx.table.classExists(moduleDotted, member)) {
      return { to: classId(moduleDotted, member), unresolved: false };
    }
  }
  // module.Class.method() — two-segment access into a class.
  if (rest.length === 2 && ctx.table.classExists(moduleDotted, member)) {
    const id = methodId(moduleDotted, member, rest[1]!);
    return ctx.knownIds.has(id) ? { to: id, unresolved: false } : null;
  }
  return null;
}

function grey(name: string): ResolvedCall {
  return { to: unresolvedId(name), unresolved: true, greyName: name };
}

/** Strip subscript generics, e.g. "Optional[Foo]" stays as-is but "list[Foo]" -> "list". */
function stripGenerics(typeRef: string): string {
  const idx = typeRef.indexOf("[");
  return idx === -1 ? typeRef : typeRef.slice(0, idx);
}
