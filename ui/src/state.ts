/** Single mutable app state + a tiny subscribe/notify bus. */

import type { CodevizGraph, IRNode } from "./types";

export interface AppState {
  /** The full graph, fetched once at boot. */
  full: CodevizGraph;
  /** Node id -> node, for O(1) inspector lookups. */
  byId: Map<string, IRNode>;
  /** Currently selected node id (drives the inspector). */
  selected: string | null;
  /** Active sidebar tab. */
  tab: string;
}

type Listener = () => void;

const listeners = new Set<Listener>();

export const state: AppState = {
  full: { version: "0.2", layers: [], services: [], nodes: [], edges: [], patterns_detected: [] },
  byId: new Map(),
  selected: null,
  tab: "inspector",
};

export function initState(graph: CodevizGraph): void {
  state.full = graph;
  state.byId = new Map(graph.nodes.map((n) => [n.id, n]));
}

export function onChange(fn: Listener): void {
  listeners.add(fn);
}

export function notify(): void {
  for (const fn of listeners) fn();
}

export function setSelected(id: string | null): void {
  state.selected = id;
  notify();
}

export function setTab(tab: string): void {
  state.tab = tab;
  notify();
}
