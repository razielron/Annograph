# codeviz

Static, deterministic extraction of an architecture graph from **annotated Python code**.

You add a few inert decorators to your code, run `codeviz scan`, and get a canonical
graph (`.codeviz/graph.json`) describing nodes (modules, classes, functions, services,
entrypoints), edges (calls, imports, inheritance, service usage), layers, contracts, and
declared design patterns. From there you query the graph, trace flows, and enforce
architectural rules in CI — **no LLM anywhere on the path**.

The graph skeleton (who calls whom, who imports what, who inherits from whom) is
**inferred** from the AST. Decorators add only what the code can't express: the layer a
component belongs to, its contract, which call reaches a third-party service, what's an
entry point, and which design patterns are in play.

> The tooling is Node/TypeScript; the first language adapter analyzes Python. The TS tool
> shells out to a small bundled `python3` helper (stdlib `ast` only) and does all
> resolution, querying, and analysis itself. See [code-viz-spec.md](code-viz-spec.md).

## Requirements

- Node ≥ 24
- Python ≥ 3.9 on `PATH` (or set `CODEVIZ_PYTHON=/path/to/python3`). Used only to parse
  the target Python; never to run your code.

## Quick start

```bash
npm install        # install deps
npm run build      # compile TS -> dist/

# scaffold config + copy the decorator package into a project
node bin/codeviz.js init path/to/project

# scan -> .codeviz/graph.json
node bin/codeviz.js scan path/to/project

# explore
node bin/codeviz.js query path <entrypointId> service:stripe
node bin/codeviz.js query services
node bin/codeviz.js query focus <nodeId> --hops 2

# CI mode: non-zero exit on configured findings
node bin/codeviz.js scan path/to/project --check
```

## Annotating your code

The decorators are pure pass-through — they change no behavior and run no logic:

```python
from codeviz import component, contract, uses_service, entrypoint, pattern, link, boundary

@component(layer="domain", tags=["orders", "critical"])
class OrderService:
    def __init__(self, inventory: InventoryService):
        self.inventory = inventory

    @contract(input=CreateOrderRequest, output=Order, errors=["OutOfStock"])
    @entrypoint(kind="http", path="POST /orders")
    def create_order(self, req: CreateOrderRequest) -> Order:
        self.inventory.reserve(req.items)   # → inferred calls edge
        self._charge(req.payment)

    @uses_service("stripe", op="charge")    # → declared uses-service edge
    def _charge(self, p): ...
```

The `OrderService → InventoryService` edge is **not** annotated — it's inferred from
`self.inventory.reserve(...)` (the type of `self.inventory` is read from `__init__`). You
annotate only the layer, contract, service, and entry point.

| Decorator | Purpose |
|---|---|
| `@component(layer, name?, tags?)` | declare a node + assign a layer |
| `@contract(input, output, errors?)` | attach a ref-level contract (type names) |
| `@uses_service(name, op?)` | mark a call that reaches a third-party service |
| `@entrypoint(kind, path?)` | mark an entry point (route, CLI, job) |
| `@boundary(note?)` | mark an integration boundary to highlight |
| `@pattern(name, role?)` | declare participation in a design pattern (authoritative) |
| `@link(to, kind?)` | bridge an edge static analysis can't see (DI, reflection) |

## Configuration (`codeviz.config.yaml`)

`scan` works with **zero config** (infers modules/calls/imports/inheritance; all nodes
grey-layered). Config only refines: named layers with `mayDependOn` rules enable
violation detection, `ignore` prunes paths, `check` sets CI thresholds.

```yaml
root: "."                # source root stripped from node ids
layers:
  - { id: presentation, order: 0, mayDependOn: [domain] }
  - { id: domain,       order: 1, mayDependOn: [data, integration] }
  - { id: data,         order: 2, mayDependOn: [] }
  - { id: integration,  order: 3, mayDependOn: [] }
ignore: ["**/tests/**"]
check:
  minCoverage: 0.0
  failOn: [layer-violation, cycle]   # which findings fail `scan --check`
```

## Commands

- `codeviz scan [path]` — extract the graph to `.codeviz/graph.json`.
- `codeviz scan [path] --check` — run analysis, print findings, exit non-zero per config.
- `codeviz query focus <id> --hops N` — N-hop neighborhood subgraph.
- `codeviz query path <from> <to>` — shortest flow path.
- `codeviz query services` — service map with operations and callers.
- `codeviz query contract <id>` — a node's input/output contract.
- `codeviz query layers <l1,l2> --hops N` — filter by layer.
- `codeviz query patterns` — declared design patterns.
- `codeviz init [path]` — scaffold config + copy the decorator package.

All `query` commands accept `-g/--graph <path>` and `--json`.

## Analysis (`--check`)

Computed statically over the graph: **layer violations**, **cycles** (call + import),
**high fan-in/fan-out**, **deep entrypoint→service chains**, **unmapped services**
(I/O-looking outbound calls with no `@uses_service`), **dangling `@link`s**, and an
**annotation-coverage** metric. `failOn` decides which fail the build.

## Architecture

```
decorators (python/codeviz)  →  ast helper (python/extractor)  →  IR builder (src/ir)
                                                                       │
                                          ┌────────────────────────────┤
                                          ▼                            ▼
                                query engine (src/query)       analysis (src/analysis)
```

Everything downstream of the IR (`graph.json`) is language-independent. Adding a new
language means writing one adapter that emits the same IR.

## Development

```bash
npm run typecheck   # tsc over src + tests
npm test            # vitest (unit + integration; integration skips if no python3)
npm run lint
CODEVIZ_UPDATE_GOLDEN=1 npm test   # regenerate golden snapshots
```

## Status & limits

This is the MVP core (no web UI). Contracts are **Tier B** (type names only; no
field-level schema). Pattern detection is **declared-only** (`@pattern`); heuristic
inference is future work. Static analysis can't see DI/reflection/dynamic dispatch —
bridge those with `@link`. Unresolved call/import targets appear as grey
(`unresolved:`) nodes rather than being hidden.
