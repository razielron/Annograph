/** Typed fetch wrappers over the codeviz REST API. */

import type {
  CodevizGraph,
  ServiceUsage,
  ContractView,
  PatternGroup,
  BoundaryNode,
  Finding,
  Coverage,
  SourceSlice,
} from "./types";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) detail = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`${path}: ${detail}`);
  }
  return (await res.json()) as T;
}

const enc = encodeURIComponent;

export const api = {
  graph: () => get<CodevizGraph>("/api/graph"),
  focus: (id: string, hops: number) => get<CodevizGraph>(`/api/focus/${enc(id)}?hops=${hops}`),
  layers: (ids: string[], hops: number) =>
    get<CodevizGraph>(`/api/layers?ids=${enc(ids.join(","))}&hops=${hops}`),
  path: (from: string, to: string) =>
    get<{ from: string; to: string; path: string[] | null }>(
      `/api/path?from=${enc(from)}&to=${enc(to)}`,
    ),
  services: () => get<ServiceUsage[]>("/api/services"),
  contract: (id: string) => get<ContractView | null>(`/api/contract/${enc(id)}`),
  patterns: () => get<PatternGroup[]>("/api/patterns"),
  boundaries: () => get<BoundaryNode[]>("/api/boundaries"),
  findings: () => get<Finding[]>("/api/findings"),
  coverage: () => get<Coverage>("/api/coverage"),
  source: (file: string, line: number) =>
    get<SourceSlice>(`/api/source?file=${enc(file)}&line=${line}`),
};
