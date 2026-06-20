/** Cycle detection via Tarjan's strongly-connected-components algorithm. */

import type { EdgeKind } from "../ir/types.js";
import type { GraphIndex } from "../query/graph.js";
import type { Finding } from "./findings.js";

/** Detect cycles among `calls` edges and (separately) `imports` edges. */
export function detectCycles(index: GraphIndex): Finding[] {
  const findings: Finding[] = [];
  findings.push(...cyclesForKinds(index, ["calls"], "call"));
  findings.push(...cyclesForKinds(index, ["imports"], "import"));
  return findings;
}

function cyclesForKinds(index: GraphIndex, kinds: EdgeKind[], label: string): Finding[] {
  const sccs = tarjan(index, kinds);
  const findings: Finding[] = [];
  for (const scc of sccs) {
    if (scc.length < 2) continue;
    const names = scc.map((id) => index.node(id)?.displayName ?? id);
    findings.push({
      type: "cycle",
      severity: "error",
      message: `circular ${label} dependency: ${names.join(" → ")} → ${names[0]}`,
      nodes: [...scc].sort(),
    });
  }
  return findings;
}

/** Iterative Tarjan SCC, restricted to edges of the given kinds. */
function tarjan(index: GraphIndex, kinds: EdgeKind[]): string[][] {
  let counter = 0;
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];

  const nodes = index.allNodes().map((n) => n.id).sort(); // deterministic order

  for (const start of nodes) {
    if (indices.has(start)) continue;
    // Iterative DFS with an explicit work stack to avoid recursion limits.
    const work: { node: string; succs: string[]; i: number }[] = [];
    indices.set(start, counter);
    lowlink.set(start, counter);
    counter += 1;
    stack.push(start);
    onStack.add(start);
    work.push({ node: start, succs: successors(index, start, kinds), i: 0 });

    while (work.length > 0) {
      const frame = work[work.length - 1]!;
      if (frame.i < frame.succs.length) {
        const succ = frame.succs[frame.i]!;
        frame.i += 1;
        if (!indices.has(succ)) {
          indices.set(succ, counter);
          lowlink.set(succ, counter);
          counter += 1;
          stack.push(succ);
          onStack.add(succ);
          work.push({ node: succ, succs: successors(index, succ, kinds), i: 0 });
        } else if (onStack.has(succ)) {
          lowlink.set(frame.node, Math.min(lowlink.get(frame.node)!, indices.get(succ)!));
        }
      } else {
        // Done with this node: pop and propagate lowlink to parent.
        if (lowlink.get(frame.node) === indices.get(frame.node)) {
          const scc: string[] = [];
          for (;;) {
            const w = stack.pop()!;
            onStack.delete(w);
            scc.push(w);
            if (w === frame.node) break;
          }
          sccs.push(scc);
        }
        work.pop();
        const parent = work[work.length - 1];
        if (parent) {
          lowlink.set(parent.node, Math.min(lowlink.get(parent.node)!, lowlink.get(frame.node)!));
        }
      }
    }
  }

  return sccs;
}

function successors(index: GraphIndex, id: string, kinds: EdgeKind[]): string[] {
  return index
    .out(id, kinds)
    .map((e) => e.to)
    .sort();
}
