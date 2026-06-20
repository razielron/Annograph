import { describe, it, expect } from "vitest";
import { buildGraph } from "../../src/ir/builder.js";
import { GraphIndex } from "../../src/query/graph.js";
import { focus } from "../../src/query/focus.js";
import { shortestPath } from "../../src/query/path.js";
import { serviceMap } from "../../src/query/service-map.js";
import { contractFor } from "../../src/query/contract.js";
import { layerFilter } from "../../src/query/layer-filter.js";
import type { LayerConfig } from "../../src/discovery/config.js";
import { call, cls, dec, fn, fromImport, mod } from "./helpers.js";

const LAYERS: LayerConfig[] = [
  { id: "domain", order: 1, mayDependOn: ["integration"] },
  { id: "integration", order: 3, mayDependOn: [] },
];

function ordersGraph() {
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
          fn("create_order", {
            decorators: [dec("entrypoint", { kwargs: { kind: "http" } }), dec("contract", { kwargs: { output: "Order" }, type_ref_kwargs: ["output"] })],
            calls: [call(["self", "inventory", "reserve"]), call(["self", "charge"])],
          }),
          fn("charge", { decorators: [dec("uses_service", { args: ["stripe"], kwargs: { op: "charge" } })] }),
        ],
      }),
    ],
  });
  return buildGraph([inv, order], LAYERS).graph;
}

describe("query engine", () => {
  const graph = ordersGraph();
  const index = GraphIndex.from(graph);

  it("focus returns the neighborhood subgraph", () => {
    const sub = focus(index, "domain.order_service.OrderService.create_order", 1);
    const ids = sub.nodes.map((n) => n.id);
    expect(ids).toContain("domain.inventory_service.InventoryService.reserve");
    expect(ids).toContain("domain.order_service.OrderService.charge");
  });

  it("finds a path from the entrypoint to the service", () => {
    const path = shortestPath(
      index,
      "domain.order_service.OrderService.create_order",
      "service:stripe",
    );
    expect(path).toEqual([
      "domain.order_service.OrderService.create_order",
      "domain.order_service.OrderService.charge",
      "service:stripe",
    ]);
  });

  it("builds a service map with callers and ops", () => {
    const map = serviceMap(index);
    expect(map).toHaveLength(1);
    expect(map[0]!.name).toBe("stripe");
    expect(map[0]!.operations).toEqual(["charge"]);
    expect(map[0]!.callers[0]!.op).toBe("charge");
  });

  it("returns a contract for a node", () => {
    const view = contractFor(index, "domain.order_service.OrderService.create_order");
    expect(view?.contract?.output?.ref).toBe("Order");
  });

  it("filters by layer", () => {
    const sub = layerFilter(index, ["domain"], 0);
    expect(sub.nodes.every((n) => n.layer === "domain")).toBe(true);
    expect(sub.nodes.length).toBeGreaterThan(0);
  });
});
