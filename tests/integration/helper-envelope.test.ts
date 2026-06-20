import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { extract } from "../../src/extract/runner.js";
import { FIXTURES, pythonAvailable } from "./scan-helper.js";

const run = pythonAvailable() ? describe : describe.skip;
if (!pythonAvailable()) {
  console.warn("skipping helper-envelope tests: python3 (>=3.9) not found");
}

run("python helper envelope", () => {
  it("emits decorators, type refs, calls and instance attrs", async () => {
    const root = resolve(FIXTURES, "orders");
    const file = resolve(root, "domain/order_service.py");
    const { modules, summary } = await extract({ root, files: [file] });

    expect(summary?.files_parsed).toBe(1);
    const env = modules.find((m) => m.module_dotted === "domain.order_service")!;
    const order = env.classes.find((c) => c.name === "OrderService")!;

    // @component layer kwarg captured.
    expect(order.decorators.find((d) => d.name === "component")?.kwargs.layer).toBe("domain");

    // instance attr resolved to the param's declared type.
    expect(order.instance_attrs).toContainEqual(
      expect.objectContaining({ name: "inventory", type_ref: "InventoryService" }),
    );

    const createOrder = order.methods.find((m) => m.name === "create_order")!;
    // @contract type refs flagged.
    const contract = createOrder.decorators.find((d) => d.name === "contract")!;
    expect(contract.type_ref_kwargs).toEqual(expect.arrayContaining(["input", "output"]));
    // real call sites only — decorator applications excluded.
    expect(createOrder.calls.map((c) => c.callee_repr)).toEqual([
      "self.inventory.reserve",
      "self._charge",
    ]);
  });
});
