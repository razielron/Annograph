/** Re-export the server-side IR + query return types for the typed API client.
 *  These are `import type` only — erased at build, so no Node code reaches the bundle. */

export type {
  CodevizGraph,
  IRNode,
  IREdge,
  LayerDef,
  ServiceDef,
  Contract,
  NodeKind,
  EdgeKind,
} from "../../src/ir/types";

export type { ServiceUsage } from "../../src/query/service-map";
export type { ContractView } from "../../src/query/contract";
export type { PatternGroup } from "../../src/query/patterns";
export type { BoundaryNode } from "../../src/query/boundaries";
export type { Finding } from "../../src/analysis/findings";
export type { Coverage } from "../../src/analysis/coverage";

/** Mirror of the server's source slice DTO (defined here to avoid importing Node-typed server code). */
export interface SourceSlice {
  file: string;
  line: number;
  start: number;
  end: number;
  lines: string[];
}
