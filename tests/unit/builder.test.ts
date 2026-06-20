import { describe, it, expect } from "vitest";
import { buildGraph } from "../../src/ir/builder.js";
import type { LayerConfig } from "../../src/discovery/config.js";
import { call, cls, dec, fn, fromImport, mod } from "./helpers.js";

const LAYERS: LayerConfig[] = [
  { id: "domain", order: 1, mayDependOn: ["integration"] },
  { id: "integration", order: 3, mayDependOn: [] },
];

describe("buildGraph", () => {
  it("resolves self.attr.method() across files via instance-attr inference", () => {
    const inv = mod("domain.inventory_service", {
      classes: [
        cls("InventoryService", {
          decorators: [dec("component", { kwargs: { layer: "domain" } })],
          methods: [fn("reserve")],
        }),
      ],
    });
    const order = mod("domain.order_service", {
      imports: [fromImport("domain.inventory_service", "InventoryService")],
      classes: [
        cls("OrderService", {
          decorators: [dec("component", { kwargs: { layer: "domain" } })],
          instance_attrs: [{ name: "inventory", type_ref: "InventoryService", line: 2 }],
          methods: [
            fn("create_order", { calls: [call(["self", "inventory", "reserve"])] }),
          ],
        }),
      ],
    });

    const { graph } = buildGraph([inv, order], LAYERS);
    const edge = graph.edges.find((e) => e.kind === "calls");
    expect(edge?.from).toBe("domain.order_service.OrderService.create_order");
    expect(edge?.to).toBe("domain.inventory_service.InventoryService.reserve");
    expect(edge?.inferred).toBe(true);
  });

  it("propagates the class layer to its methods", () => {
    const m = mod("domain.svc", {
      classes: [
        cls("Svc", {
          decorators: [dec("component", { kwargs: { layer: "domain" } })],
          methods: [fn("do")],
        }),
      ],
    });
    const { graph } = buildGraph([m], LAYERS);
    const method = graph.nodes.find((n) => n.id === "domain.svc.Svc.do");
    expect(method?.layer).toBe("domain");
  });

  it("synthesizes a grey node for unresolved calls", () => {
    const m = mod("a", {
      classes: [
        cls("C", { methods: [fn("m", { calls: [call(["self", "mystery", "go"])] })] }),
      ],
    });
    const { graph } = buildGraph([m], LAYERS);
    const grey = graph.nodes.find((n) => n.unresolved);
    expect(grey?.id).toBe("unresolved:go");
    expect(graph.edges.some((e) => e.to === "unresolved:go")).toBe(true);
  });

  it("creates a service node + uses-service edge from @uses_service", () => {
    const m = mod("a", {
      classes: [
        cls("C", {
          methods: [
            fn("charge", {
              decorators: [dec("uses_service", { args: ["stripe"], kwargs: { op: "charge" } })],
            }),
          ],
        }),
      ],
    });
    const { graph } = buildGraph([m], LAYERS);
    expect(graph.services).toContainEqual({ id: "service:stripe", operations: ["charge"] });
    const edge = graph.edges.find((e) => e.kind === "uses-service");
    expect(edge).toMatchObject({ to: "service:stripe", op: "charge", inferred: false });
  });

  it("captures a Tier-B contract from @contract type refs", () => {
    const m = mod("a", {
      classes: [
        cls("C", {
          methods: [
            fn("h", {
              decorators: [
                dec("contract", {
                  kwargs: { input: "Req", output: "Res", errors: ["Boom"] },
                  type_ref_kwargs: ["input", "output"],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    const { graph } = buildGraph([m], LAYERS);
    const node = graph.nodes.find((n) => n.id === "a.C.h");
    expect(node?.contract).toEqual({
      input: { ref: "Req" },
      output: { ref: "Res" },
      errors: ["Boom"],
    });
  });

  it("marks @entrypoint nodes and reads declared @pattern", () => {
    const m = mod("a", {
      classes: [
        cls("C", {
          decorators: [dec("pattern", { args: ["strategy"], kwargs: { role: "context" } })],
          methods: [
            fn("get", { decorators: [dec("entrypoint", { kwargs: { kind: "http", path: "/x" } })] }),
          ],
        }),
      ],
    });
    const { graph } = buildGraph([m], LAYERS);
    expect(graph.nodes.find((n) => n.id === "a.C.get")?.kind).toBe("entrypoint");
    expect(graph.nodes.find((n) => n.id === "a.C")?.patterns).toEqual([
      { name: "strategy", role: "context", declared: true },
    ]);
  });

  it("flags dangling @link targets and bridges resolvable ones", () => {
    const m = mod("a", {
      classes: [
        cls("C", {
          methods: [
            fn("h", {
              decorators: [
                dec("link", { args: ["a.C.real"], kwargs: { kind: "calls" } }),
                dec("link", { args: ["a.Nope.x"], kwargs: { kind: "calls" } }),
              ],
            }),
            fn("real"),
          ],
        }),
      ],
    });
    const { graph, warnings } = buildGraph([m], LAYERS);
    expect(graph.edges.some((e) => e.via === "link" && e.to === "a.C.real")).toBe(true);
    expect(warnings.some((w) => w.kind === "dangling-link")).toBe(true);
  });

  it("emits a warning for non-static decorator args", () => {
    const m = mod("a", {
      classes: [
        cls("C", {
          decorators: [dec("component", { kwargs: { layer: "domain" }, unresolved_kwargs: ["tags"] })],
          methods: [fn("m")],
        }),
      ],
    });
    const { warnings } = buildGraph([m], LAYERS);
    expect(warnings.some((w) => w.kind === "non-static-arg")).toBe(true);
  });

  it("skips imports of the codeviz annotation library", () => {
    const m = mod("a", { imports: [fromImport("codeviz", "component")] });
    const { graph } = buildGraph([m], LAYERS);
    expect(graph.edges.some((e) => e.to.includes("codeviz"))).toBe(false);
  });
});
