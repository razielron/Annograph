import { describe, it, expect } from "vitest";
import { buildGraph } from "../../src/ir/builder.js";
import { GraphIndex } from "../../src/query/graph.js";
import { detectCycles } from "../../src/analysis/cycles.js";
import { detectLayerViolations } from "../../src/analysis/layer-violations.js";
import { detectFan } from "../../src/analysis/fan.js";
import { detectUnmappedServices } from "../../src/analysis/unmapped-services.js";
import { coverage } from "../../src/analysis/coverage.js";
import type { LayerConfig } from "../../src/discovery/config.js";
import { call, cls, dec, fn, fromImport, mod } from "./helpers.js";

const LAYERS: LayerConfig[] = [
  { id: "presentation", order: 0, mayDependOn: ["domain"] },
  { id: "domain", order: 1, mayDependOn: ["data"] },
  { id: "data", order: 2, mayDependOn: [] },
];

describe("cycle detection", () => {
  it("finds a call cycle between two functions", () => {
    const a = mod("a", { functions: [fn("af", { calls: [call(["bf"])] })], imports: [fromImport("a", "bf")] });
    // model cross-module: put bf in same module to keep it simple
    const m = mod("m", {
      functions: [
        fn("af", { calls: [call(["bf"])] }),
        fn("bf", { calls: [call(["af"])] }),
      ],
    });
    void a;
    const { graph } = buildGraph([m], LAYERS);
    const findings = detectCycles(GraphIndex.from(graph));
    expect(findings.some((f) => f.type === "cycle")).toBe(true);
  });
});

describe("layer violations", () => {
  it("flags presentation -> data (skipping domain)", () => {
    const view = mod("presentation.view", {
      imports: [fromImport("data.repo", "Repo")],
      classes: [
        cls("View", {
          decorators: [dec("component", { kwargs: { layer: "presentation" } })],
          instance_attrs: [{ name: "repo", type_ref: "Repo", line: 1 }],
          methods: [fn("show", { calls: [call(["self", "repo", "fetch"])] })],
        }),
      ],
    });
    const repo = mod("data.repo", {
      classes: [
        cls("Repo", {
          decorators: [dec("component", { kwargs: { layer: "data" } })],
          methods: [fn("fetch")],
        }),
      ],
    });
    const { graph } = buildGraph([view, repo], LAYERS);
    const findings = detectLayerViolations(GraphIndex.from(graph), graph);
    expect(findings.some((f) => f.type === "layer-violation")).toBe(true);
  });

  it("reports nothing with zero-config (no layers)", () => {
    const view = mod("a", { classes: [cls("V", { methods: [fn("m")] })] });
    const { graph } = buildGraph([view], []);
    expect(detectLayerViolations(GraphIndex.from(graph), graph)).toHaveLength(0);
  });
});

describe("fan analysis", () => {
  it("flags high fan-in", () => {
    const target = fn("hot");
    const callers = Array.from({ length: 6 }, (_, i) =>
      fn(`c${i}`, { calls: [call(["hot"])] }),
    );
    const m = mod("a", { functions: [target, ...callers] });
    const { graph } = buildGraph([m], LAYERS);
    const findings = detectFan(GraphIndex.from(graph), { fanIn: 5, fanOut: 99 });
    expect(findings.some((f) => f.type === "fan-in")).toBe(true);
  });
});

describe("unmapped services", () => {
  it("flags an outbound requests call with no @uses_service", () => {
    const m = mod("a", {
      imports: [{ kind: "import", module: "requests", names: [{ name: "requests", asname: null }], level: 0 }],
      classes: [cls("C", { methods: [fn("f", { calls: [call(["requests", "get"])] })] })],
    });
    const { graph } = buildGraph([m], LAYERS);
    const findings = detectUnmappedServices(GraphIndex.from(graph));
    expect(findings.some((f) => f.type === "unmapped-service")).toBe(true);
  });
});

describe("coverage", () => {
  it("computes layer and contract coverage", () => {
    const m = mod("a", {
      classes: [
        cls("C", {
          decorators: [dec("component", { kwargs: { layer: "domain" } })],
          methods: [
            fn("withContract", {
              decorators: [dec("contract", { kwargs: { output: "X" }, type_ref_kwargs: ["output"] })],
            }),
            fn("noContract"),
          ],
        }),
      ],
    });
    const { graph } = buildGraph([m], LAYERS);
    const cov = coverage(graph);
    expect(cov.layerCoverage).toBe(1); // class + both methods all inherit domain
    expect(cov.contractCoverage).toBeCloseTo(0.5);
  });
});
