import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { GraphIndex } from "../../src/query/graph.js";
import { shortestPath } from "../../src/query/path.js";
import { runAnalysis } from "../../src/analysis/index.js";
import { loadConfig } from "../../src/discovery/config.js";
import { FIXTURES, pythonAvailable, scanFixture } from "./scan-helper.js";

const run = pythonAvailable() ? describe : describe.skip;
if (!pythonAvailable()) {
  console.warn("skipping scan e2e tests: python3 (>=3.9) not found");
}

const GOLDEN = resolve(FIXTURES, "golden");
// Set CODEVIZ_UPDATE_GOLDEN=1 to (re)write golden snapshots.
const UPDATE = process.env.CODEVIZ_UPDATE_GOLDEN === "1";

function checkGolden(name: string, json: string): void {
  const path = resolve(GOLDEN, `${name}.graph.json`);
  if (UPDATE || !existsSync(path)) {
    writeFileSync(path, json, "utf8");
    return;
  }
  expect(json).toBe(readFileSync(path, "utf8"));
}

run("scan end-to-end", () => {
  it("orders fixture matches golden and reproduces the spec edges", async () => {
    const { graph, json } = await scanFixture("orders");
    checkGolden("orders", json);

    const index = GraphIndex.from(graph);
    // Headline inferred edge from the spec.
    expect(
      graph.edges.some(
        (e) =>
          e.from === "domain.order_service.OrderService.create_order" &&
          e.to === "domain.inventory_service.InventoryService.reserve" &&
          e.kind === "calls",
      ),
    ).toBe(true);
    // entrypoint -> service path exists.
    const path = shortestPath(
      index,
      "domain.order_service.OrderService.create_order",
      "service:stripe",
    );
    expect(path).not.toBeNull();
  });

  it("minimal fixture (zero-config) matches golden", async () => {
    const { json } = await scanFixture("minimal");
    checkGolden("minimal", json);
  });

  it("is deterministic across runs", async () => {
    const a = await scanFixture("orders");
    const b = await scanFixture("orders");
    expect(a.json).toBe(b.json);
  });

  it("detects a layer violation under --check config", async () => {
    const { graph } = await scanFixture("layer-violation");
    const { config } = loadConfig(resolve(FIXTURES, "layer-violation"));
    const findings = runAnalysis(graph, config);
    expect(findings.some((f) => f.type === "layer-violation")).toBe(true);
  });

  it("detects an import/call cycle", async () => {
    const { graph } = await scanFixture("cycles");
    const { config } = loadConfig(resolve(FIXTURES, "cycles"));
    const findings = runAnalysis(graph, config);
    expect(findings.some((f) => f.type === "cycle")).toBe(true);
  });

  it("flags an unmapped service", async () => {
    const { graph } = await scanFixture("unmapped-service");
    const { config } = loadConfig(resolve(FIXTURES, "unmapped-service"));
    const findings = runAnalysis(graph, config);
    expect(findings.some((f) => f.type === "unmapped-service")).toBe(true);
  });

  it("flags a dangling @link", async () => {
    const { graph, warnings } = await scanFixture("links");
    const { config } = loadConfig(resolve(FIXTURES, "links"));
    const findings = runAnalysis(graph, config, warnings);
    expect(findings.some((f) => f.type === "dangling-link")).toBe(true);
    // The resolvable link became a real edge.
    expect(graph.edges.some((e) => e.via === "link" && e.to === "wiring.Worker.process")).toBe(true);
  });
});
