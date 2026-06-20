# Specification — Decorator-Based Code Visualization System

> Design spec • v0.2 • Language-agnostic (Python + TypeScript as first-class) • **Static**, deterministic extraction • Installable, drop-in package

---

## 1. Vision & Problem

In a world where AI writes most of the code, volume grows faster than any human's ability to follow it. The hard part isn't writing — it's **trust**. When a model hands back a whole module, it's difficult to know what connects to what, where data flows, which third-party services are touched, and where bottlenecks formed.

This system produces a **live map of the codebase, built from the code itself**, so you can:

- See the connections between components at a glance.
- Filter the picture by architectural layer.
- Inspect the contract (input/output data) at any connection point.
- Map integrations with third-party services.
- Isolate any interesting part and inspect a specific integration visually.
- See recognized **design patterns** surfaced clearly.
- Find congested areas and improve weak processes.

**One-line summary:** the AI produces *annotated* code, the tool turns it into a graph, and a human (or, optionally, the model) explores the graph instead of reading thousands of lines.

---

## 2. Design Principles

These six principles drive every decision in this document.

**P1 — Infer structure, annotate meaning.**
The graph skeleton (who calls whom, who inherits from whom, what imports what) is extracted automatically from the AST. Decorators add *only* what the code can't express: which layer a component belongs to, its contract, which call is a third-party service, what's an entry point, and which design patterns are in play. Annotation stays lightweight; coverage never requires re-declaring what the code already states.

**P2 — Decorators are inert metadata.**
A tag must be pure pass-through: it changes no behavior, breaks no execution, and is readable without running the code. Its arguments must be statically analyzable (literals and type references, not runtime-computed values).

**P3 — One IR, many languages.**
The decorator syntax and the extractor are a *per-language adapter*. The IR, the query engine, and the visualization are shared. "Language-agnostic" means **the IR is the contract**, and a new language is just a new adapter.

**P4 — The IR is the product; the visualization is one consumer of it.**
The same IR feeds the UI, optional model queries, and CI checks (e.g., fail the build on a layer violation or an undocumented new service). This multiplies the value of the same annotation effort.

**P5 — Deterministic, LLM-free core.**
Extraction, the IR, filtering, pattern detection, and rendering are 100% deterministic static analysis. **No LLM is involved in producing or displaying the map.** This is what makes the map reproducible and auditable rather than "something a model generated." A language model is an *optional* downstream consumer only (§12) — never required, never on the extraction path.

**P6 — Drop-in and progressive.**
Install a package, add a few decorators, run a command. The default view is high-level (layers + services); from there you drill into a subgraph, then a contract, then the source. No hairball.

---

## 3. Packaging & Usage (drop into any project)

The system ships as an installable package per ecosystem. The decorator library and extractor are language-specific; the **IR schema and the UI are shared**.

### 3.1 What's in the package

- **Decorator library** — tiny, inert, pass-through tags (P2).
- **`codeviz scan`** — the static extractor CLI. Parses the project, writes the IR to `.codeviz/graph.json`. No network, no LLM, deterministic.
- **`codeviz ui`** — launches a local web server (e.g., `localhost:7000`) serving the bundled viewer, which reads `graph.json`.
- **Optional `codeviz.config.{yaml,json}`** — declares layers and their allowed dependencies, toggles pattern rules, and sets ignore globs.

### 3.2 Install & run

```bash
# Python
pip install codeviz
# TypeScript / JS
npm install --save-dev codeviz
```

```python
# annotate
from codeviz import component, contract, uses_service, entrypoint
```

```bash
codeviz scan            # static extraction → .codeviz/graph.json   (deterministic, no LLM)
codeviz ui              # open the local visual UI in the browser
codeviz scan --check    # CI mode: non-zero exit on layer violations / low coverage (no UI)
```

### 3.3 Zero-config defaults

`scan` works with no configuration: it infers modules, calls, imports, and inheritance, and renders an unlabeled graph. Configuration only *refines* the picture — defining named layers with `mayDependOn` rules, enabling pattern heuristics, or excluding paths.

### 3.4 The language-agnostic seam, made concrete

Decorators + extractor are per-ecosystem (`pip`/`npm`). Everything downstream — the `graph.json` schema, the viewer, the query engine, the pattern rules, the CI checks — is shared and language-independent. Adding a third language means writing one adapter that emits the same IR; nothing else changes.

---

## 4. Architecture — a five-stage pipeline

```
[1] Annotation layer      [2] Static extractor      [3] Canonical IR
decorators in code   →    parser per language   →   graph.json
(Python / TS)             (AST + type info)         (nodes/edges/...)
                                                          │
                              ┌────────────────────────────┤
                              ▼                             ▼
                  [4] Query / filter / detect    [5] Consumers
                  layers · paths · patterns ·     • Visual UI  (default)
                  hotspots                        • CI checks
                                                  • LLM queries (optional)
```

Every stage is decoupled through the IR. You can swap an extractor, add a language, or write a new consumer without touching the rest.

---

## 5. Meta-Model (the ontology)

This is the heart. Everything the system can express lives here.

### 5.1 Nodes

| kind | represents | source |
|---|---|---|
| `module` | file / module | inferred |
| `class` | class | inferred |
| `function` | function / method | inferred |
| `service` | third-party service (Stripe, OpenAI, DB) | declared |
| `entrypoint` | entry point (route, CLI, job) | declared |

Each node carries: a unique `id`, `name`, `layer`, a list of `tags`, an optional `contract`, optional `patterns`, and `source` (file + line).

### 5.2 Edges

| kind | meaning | default |
|---|---|---|
| `calls` | A calls B | inferred |
| `imports` | A imports B | inferred |
| `implements` / `extends` | inheritance / implementation | inferred |
| `data-flow` | A produces a value B consumes | inferred / declared |
| `uses-service` | A reaches a third-party service | declared |

Every edge carries `inferred: true/false`, so the view distinguishes what the system discovered on its own from what was declared by hand.

### 5.3 Contract

Attached to a `function` / `entrypoint` node:

```jsonc
"contract": {
  "input":  { "ref": "CreateOrderRequest", "fields": [...] },
  "output": { "ref": "Order",              "fields": [...] },
  "errors": ["OutOfStock", "PaymentFailed"]   // optional
}
```

The `ref` (type name) is always captured statically. The `fields` (field-level schema) are captured at a deeper tier — see §7.

### 5.4 Layers

A layer isn't just a label — it carries **allowed dependencies**, which is what makes violation detection possible:

```jsonc
"layers": [
  { "id": "presentation", "order": 0, "mayDependOn": ["domain"] },
  { "id": "domain",       "order": 1, "mayDependOn": ["data", "integration"] },
  { "id": "data",         "order": 2, "mayDependOn": [] },
  { "id": "integration",  "order": 3, "mayDependOn": [] }
]
```

An edge from `presentation` to `data` (skipping `domain`) is a **layer violation**, flagged automatically.

---

## 6. The Annotation DSL

A minimal, orthogonal set. Same semantics, per-language syntax. Every decorator is pass-through (P2).

### 6.1 Vocabulary

- **`@component(layer, name?, tags?)`** — declares a node and assigns it to a layer.
- **`@contract(input, output, errors?)`** — attaches a contract to a function (type references).
- **`@uses_service(name, op?)`** — marks that this call reaches a third-party service.
- **`@entrypoint(kind, path?)`** — marks an entry point (natural start points for flow tracing).
- **`@boundary(note?)`** — marks an interesting integration boundary to highlight in the view.
- **`@pattern(name, role?)`** — declares participation in a design pattern (authoritative; see §10).
- **`@link(to, kind?)`** — manually declares an edge the static analysis *can't* see (DI, reflection, dynamic dispatch). A safety net around static limits.

### 6.2 Python

```python
@component(layer="domain", tags=["orders", "critical"])
class OrderService:

    @contract(input=CreateOrderRequest, output=Order,
              errors=["OutOfStock", "PaymentFailed"])
    @entrypoint(kind="http", path="POST /orders")
    def create_order(self, req: CreateOrderRequest) -> Order:
        self.inventory.reserve(req.items)        # → calls edge, inferred
        self._charge(req.payment)
        ...

    @uses_service("stripe", op="charge")
    def _charge(self, p): ...
```

### 6.3 TypeScript

```typescript
@Component({ layer: "domain", tags: ["orders", "critical"] })
class OrderService {

  @Contract({ input: CreateOrderRequest, output: Order,
              errors: ["OutOfStock", "PaymentFailed"] })
  @Entrypoint({ kind: "http", path: "POST /orders" })
  createOrder(req: CreateOrderRequest): Order {
    this.inventory.reserve(req.items);           // → calls edge, inferred
    this.charge(req.payment);
  }

  @UsesService({ name: "stripe", op: "charge" })
  private charge(p: Payment) {}
}
```

Both examples produce **the exact same IR**. The only difference is the adapter.

> P1 in action: the `OrderService → InventoryService` edge is *not* annotated — it's inferred from `self.inventory.reserve(...)`. We annotated only the layer, the contract, the external service, and the entry point.

---

## 7. Extraction Engine

One extractor per language, uniform output. **No regex, no LLM** — real language tooling, fully deterministic:

- **Python:** the `ast` module to read decorators, calls, and imports; for contract fields, read the dataclass / Pydantic / type definitions.
- **TypeScript:** the TypeScript Compiler API (not just an AST but a type resolver), enabling field-level resolution of interfaces / types / Zod schemas.

### Extraction depth — three tiers

1. **Tier A — skeleton:** nodes, layers, `calls` / `imports` / `extends` edges. Available in any minimal extractor.
2. **Tier B — contract at the ref level:** input/output type names. Static and cheap.
3. **Tier C — contract at the field level:** full schema (field names, types, required/optional). Requires a full type resolver; via the Compiler API in TS, via model parsing in Python.

**Honest note:** pure static analysis delivers A and B easily; C costs more and depends on the language toolchain. Build A→B→C incrementally rather than promising C on day one.

### Coverage & blind spots

- Un-annotated code appears as **grey** nodes ("inferred, unlabeled") — not hidden, just marked undocumented.
- An **annotation-coverage** metric (% of nodes with a layer/contract) is exposed and enforceable in CI.
- What static analysis can't see (DI, reflection) is bridged manually with `@link` (§6.1).

---

## 8. Query & Filter Engine

The IR is a graph; every feature is a query over it:

- **Layer filter:** show only nodes in selected layers (+ neighbors within N hops).
- **Focus / isolate:** pick a node → show only its neighborhood up to N hops. This is "isolate any interesting part."
- **Path:** find a path from A to B (e.g., from an `entrypoint` to a `service`).
- **Service map:** all `service` nodes and the `uses-service` edges leading to them.
- **Contract:** pull a node/edge's contract to compare in/out.
- **Patterns:** list detected design patterns and highlight their participants (§10).
- **Hotspots:** see §11.

The query interface is also exposed as a simple API — which is what lets an *optional* model explore the codebase (§12).

---

## 9. Visualization Views

Every need you raised maps to a dedicated view:

| Your need | The view |
|---|---|
| See the connections | **Architecture graph** — nodes + edges, laid out by layer (swimlanes) |
| Filter by layers | **Layers** — toggle chips + swimlanes |
| See input/output contract | **Contract inspector** — clicking a node/edge opens a panel with input vs. output side by side |
| Third-party integrations | **Service map** — external services as distinct nodes, with operation labels |
| Isolate an interesting part | **Focus mode** — a subgraph of just the selected neighborhood |
| Recognized design patterns | **Patterns panel** — grouped by type; click to highlight participants (§10) |
| Congested areas | **Heatmap** — color nodes by load / problems (§11) |

Progressive disclosure (P6): open at a layer + service overview; drill down to a subgraph → contract → source.

---

## 10. Design Pattern Detection

The system recognizes design patterns and surfaces them clearly. Detection works in two modes, and the distinction matters for trust.

### 10.1 Declared patterns (authoritative)

The `@pattern(name, role?)` decorator marks a node's participation explicitly:

```python
@component(layer="domain")
@pattern("strategy", role="context")
class Checkout:
    def __init__(self, method: PaymentMethod): ...   # PaymentMethod = strategy interface
```

Declared patterns are authoritative (confidence 1.0), have zero false positives, and are the recommended path when you want certainty — especially for patterns that are unreliable to detect statically (e.g., Singleton).

### 10.2 Inferred patterns (candidates, deterministic)

Each pattern is expressed as a **graph-motif rule** matched over the IR — **rule-based, deterministic, no LLM** (P5). Inferred patterns are shown as *candidates* with a confidence score, never asserted as fact. A few example motifs:

- **Strategy:** an interface I with ≥2 implementers, plus a holder that depends on I (not on a concrete type).
- **Factory:** a function whose return type is an abstract type and which constructs ≥2 concrete subtypes.
- **Adapter:** a class that implements interface I while delegating to an unrelated class D.
- **Facade:** a single node with high fan-out to a cluster, where external callers reach only it, not the cluster.
- **Observer / Pub-Sub:** a subject with `subscribe`/`notify` edges to multiple observers sharing an interface.
- **Repository:** a data-layer class abstracting a `service`/DB with CRUD-like methods, depended on by the domain.
- **Decorator (GoF):** a class that implements I and also wraps an I (same interface in and out).

Each detection records its **confidence** and the **roles** (which node plays which part). The UI distinguishes declared (solid badge) from inferred (dashed badge) so candidates are never confused with certainties.

### 10.3 Presentation

The **Patterns panel** groups findings by type. Selecting one — e.g., "Strategy: PaymentMethod" — highlights the participating nodes on the graph (the interface, its implementations, and the context) and labels each role. This turns an abstract pattern into something you can see and click.

**Honest note:** heuristic detection suggests; it does not prove. Declared patterns are authoritative; inferred ones are candidates and may surface false positives. Treat §10.2 as a discovery aid, §10.1 as ground truth.

---

## 11. Analysis — "congested areas and weak processes"

All computable statically over the graph:

- **High fan-in** — many things depend on one node → bottleneck / failure point.
- **High fan-out** — a node depending on many → "god object," a candidate for splitting.
- **Cycles** — circular dependencies between components/modules.
- **Layer violations** — an edge that breaks `mayDependOn` (§5.4).
- **Deep chains** — long paths from an entry point to a service (potential latency/fragility).
- **Unmapped services** — outbound calls flagged as external but without `@uses_service` (suspected undocumented integration).

Output: a heatmap plus a severity-ordered findings list, where each item links directly to the node/source.

---

## 12. Optional LLM Layer (strictly off the core path)

Per P5, the entire map — extraction, IR, filtering, patterns, hotspots, rendering — is produced **without any LLM**. The model is an optional, downstream convenience only.

Because the IR is structured JSON, you can point a model at it to ask questions in natural language — "show me the order-creation flow" → the model runs a `path` query over the IR and returns a highlighted route plus the contracts at each hop. The model relies on the IR as a source of truth rather than guessing from raw code, so its answers are verifiable against the deterministic graph.

This layer can be removed entirely with no loss to the core product. It never participates in producing or displaying the map.

---

## 13. Limitations & Tradeoffs (honestly)

- **Annotation drift:** string-based references (`@link("X.y")`) can go stale. Mitigation: a validation pass that fails on dangling references; prefer symbol references where possible.
- **Static limits:** DI, reflection, and dynamic dispatch are invisible → bridged via `@link`, but that's manual work.
- **Field-level schema (Tier C)** is costly and language-dependent. Don't promise it in phase one.
- **Partial coverage = partial picture.** The coverage metric and grey nodes keep this honest and avoid a false sense of completeness.
- **Pattern false positives:** inferred patterns are candidates, not facts (§10.3).
- **True agnosticism** is proven the moment you add a third language — if the IR didn't leak into Python/TS assumptions, the addition is cheap.

---

## 14. Recommended Phasing

- **MVP (phase 1):** Python adapter only → extraction tiers A+B → IR → architecture graph + layer filter + ref-level contract inspector. Shipped as `pip install codeviz` with `scan` and `ui`. Value already lands here.
- **Phase 2:** service map + focus mode + flow tracing; basic hotspot analysis (fan-in/out, cycles, layer violations); declared-pattern detection (`@pattern`).
- **Phase 3:** TypeScript adapter (proves agnosticism); Tier-C extraction; inferred (heuristic) pattern detection.
- **Phase 4:** CI integration (`scan --check` for coverage/layers/new-service enforcement); full heatmap; optional LLM query layer.

---

## Appendix A — IR schema sketch

```jsonc
{
  "version": "0.2",
  "layers": [
    { "id": "domain", "order": 1, "mayDependOn": ["data", "integration"] }
  ],
  "services": [
    { "id": "stripe", "kind": "payment", "operations": ["charge", "refund"] }
  ],
  "nodes": [
    {
      "id": "domain.OrderService.create_order",
      "kind": "function",
      "name": "create_order",
      "layer": "domain",
      "tags": ["orders", "critical"],
      "entrypoint": { "kind": "http", "path": "POST /orders" },
      "patterns": [ { "name": "strategy", "role": "context", "declared": true } ],
      "contract": {
        "input":  { "ref": "CreateOrderRequest", "fields": [ {"name":"items","type":"Item[]","required":true} ] },
        "output": { "ref": "Order", "fields": [ {"name":"id","type":"string"} ] },
        "errors": ["OutOfStock", "PaymentFailed"]
      },
      "source": { "file": "domain/order_service.py", "line": 42 },
      "lang": "python"
    }
  ],
  "edges": [
    { "from": "domain.OrderService.create_order",
      "to":   "domain.InventoryService.reserve",
      "kind": "calls", "inferred": true },
    { "from": "domain.OrderService._charge",
      "to":   "stripe",
      "kind": "uses-service", "op": "charge", "inferred": false }
  ],
  "patterns_detected": [
    { "name": "strategy", "confidence": 0.82, "declared": false,
      "roles": { "context": ["domain.Checkout"],
                 "interface": ["domain.PaymentMethod"],
                 "concrete": ["integration.StripeMethod", "integration.PaypalMethod"] } }
  ]
}
```
