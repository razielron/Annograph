import { describe, it, expect } from "vitest";
import { resolveCall, type ResolveContext } from "../../src/ir/resolve-calls.js";
import { SymbolTable } from "../../src/ir/symbol-table.js";
import { call, cls, fn, fromImport, mod } from "./helpers.js";

function ctx(
  envelopes: Parameters<typeof SymbolTable.build>[0],
  knownIds: string[],
  over: Partial<ResolveContext> = {},
): ResolveContext {
  return {
    table: SymbolTable.build(envelopes),
    knownIds: new Set(knownIds),
    moduleDotted: over.moduleDotted ?? "a",
    ...over,
  };
}

describe("resolveCall", () => {
  it("resolves self.method() to the enclosing class method", () => {
    const env = mod("a", { classes: [cls("C", { methods: [fn("m"), fn("other")] })] });
    const c = ctx([env], ["a.C.m", "a.C.other"], { enclosingClass: "C" });
    const r = resolveCall(call(["self", "other"]), c);
    expect(r).toEqual({ to: "a.C.other", unresolved: false });
  });

  it("resolves a module-level function call", () => {
    const env = mod("a", { functions: [fn("run")] });
    const c = ctx([env], ["a.run"]);
    expect(resolveCall(call(["run"]), c)).toEqual({ to: "a.run", unresolved: false });
  });

  it("resolves an imported function call", () => {
    const a = mod("a", { imports: [fromImport("b", "helper")] });
    const b = mod("b", { functions: [fn("helper")] });
    const c = ctx([a, b], ["b.helper"]);
    expect(resolveCall(call(["helper"]), c)).toEqual({ to: "b.helper", unresolved: false });
  });

  it("falls back to a grey node for unknown targets", () => {
    const env = mod("a", { classes: [cls("C", { methods: [fn("m")] })] });
    const c = ctx([env], ["a.C.m"], { enclosingClass: "C" });
    const r = resolveCall(call(["self", "unknown", "go"]), c);
    expect(r).toMatchObject({ to: "unresolved:go", unresolved: true });
  });

  it("filters builtins", () => {
    const env = mod("a");
    const c = ctx([env], []);
    expect(resolveCall(call(["print"]), c)).toBeNull();
    expect(resolveCall(call(["len"]), c)).toBeNull();
  });

  it("resolves self.attr.method() via instance-attr type", () => {
    const inv = mod("b", { classes: [cls("Inv", { methods: [fn("reserve")] })] });
    const a = mod("a", {
      imports: [fromImport("b", "Inv")],
      classes: [cls("C", { methods: [fn("m")] })],
    });
    const c = ctx([a, inv], ["b.Inv.reserve", "a.C.m"], {
      enclosingClass: "C",
      instanceAttrTypes: new Map([["inv", "Inv"]]),
    });
    const r = resolveCall(call(["self", "inv", "reserve"]), c);
    expect(r).toEqual({ to: "b.Inv.reserve", unresolved: false });
  });
});

describe("relative import resolution", () => {
  it("resolves level-1 relative imports against the package", () => {
    // module pkg.sub.a does `from .b import f` -> pkg.sub.b
    const a = mod("pkg.sub.a", {
      imports: [{ kind: "from", module: "b", names: [{ name: "f", asname: null }], level: 1 }],
    });
    const b = mod("pkg.sub.b", { functions: [fn("f")] });
    const c = ctx([a, b], ["pkg.sub.b.f"], { moduleDotted: "pkg.sub.a" });
    expect(resolveCall(call(["f"]), c)).toEqual({ to: "pkg.sub.b.f", unresolved: false });
  });
});
