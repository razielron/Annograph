# codeviz

Static, deterministic extraction of an architecture graph from **annotated Python code**.

You add a few inert decorators to your code, run `codeviz scan`, and get a canonical
graph (`.codeviz/graph.json`) describing nodes (modules, classes, functions, services,
entrypoints), edges (calls, imports, inheritance, service usage), layers, contracts, and
declared design patterns. From there you query the graph, trace flows, explore it in a
local web viewer (`codeviz ui`), and enforce architectural rules in CI — **no LLM
anywhere on the path**.

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

# explore in the browser (local server + bundled viewer)
node bin/codeviz.js ui path/to/project        # opens http://localhost:7000

# explore from the CLI
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
- `codeviz ui [path]` — serve a local web viewer for an existing `graph.json`
  (`-p/--port`, `--host`, `--no-open`, `-g/--graph`).
- `codeviz query focus <id> --hops N` — N-hop neighborhood subgraph.
- `codeviz query path <from> <to>` — shortest flow path.
- `codeviz query services` — service map with operations and callers.
- `codeviz query contract <id>` — a node's input/output contract.
- `codeviz query layers <l1,l2> --hops N` — filter by layer.
- `codeviz query patterns` — declared design patterns.
- `codeviz query boundaries` — nodes marked with `@boundary`.
- `codeviz init [path]` — scaffold config + copy the decorator package.

All `query` commands accept `-g/--graph <path>` and `--json`.

## Web UI (`codeviz ui`)

`codeviz ui` boots a local Node HTTP server (default `localhost:7000`) that serves a
bundled [Cytoscape.js](https://js.cytoscape.org/) viewer and a small read-only REST API
(`/api/graph`, `/api/focus/:id`, `/api/path`, `/api/services`, `/api/contract/:id`,
`/api/patterns`, `/api/boundaries`, `/api/findings`, `/api/coverage`, `/api/source`). Every
endpoint is a thin wrapper over the same query/analysis functions the CLI uses — the
browser never re-implements graph logic, and **no LLM is involved**.

The viewer lays nodes out in layer swimlanes (solid edges = inferred, dashed = declared),
lets you toggle layers, click a node to inspect its contract/tags/source, trace a path from
an entrypoint to a service, and browse the service map, declared patterns, and analysis
findings. `/api/source` is sandboxed to the scanned project root (no path traversal).

> Note: `dangling-link` findings require `scan --check` (they're produced at scan time and
> aren't stored in `graph.json`); the UI's findings panel notes this. All other findings
> are computed from `graph.json` alone.

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
npm run build       # build:server (tsc -> dist/) + build:ui (vite -> dist/ui/)
npm run build:ui    # build just the viewer bundle
npm run typecheck   # tsc over src + tests (Node)
npm run typecheck:ui # tsc over ui/ (DOM)
npm test            # vitest (unit + integration; integration skips if no python3)
npm run lint
CODEVIZ_UPDATE_GOLDEN=1 npm test   # regenerate golden snapshots
```

For UI development with hot reload, run the API server and the Vite dev server side by
side (Vite proxies `/api` to the running server):

```bash
node bin/codeviz.js ui path/to/project --no-open   # API on :7000
npm run dev:ui                                       # Vite on :5173, /api -> :7000
```

## Status & limits

Contracts are **Tier B** (type names only; no field-level schema). Pattern detection is
**declared-only** (`@pattern`); heuristic inference (and the `patterns_detected` array) is
future work. The web UI renders the deterministic graph but does not detect inferred
patterns or `data-flow` edges (neither is produced yet). Static analysis can't see
DI/reflection/dynamic dispatch — bridge those with `@link`. Unresolved call/import targets
appear as grey (`unresolved:`) nodes rather than being hidden.
