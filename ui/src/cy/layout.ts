/** Layered swimlane layout: dagre for spread, then snap rows by layer.order. */

import type cytoscape from "cytoscape";
import type { Core } from "cytoscape";
import type { LayerDef } from "../types";

const BAND_HEIGHT = 130;

/** A layer's rank band; grey/unlayered and services get their own trailing bands. */
function bandIndex(layers: LayerDef[]): Map<string, number> {
  const sorted = [...layers].sort((a, b) => a.order - b.order);
  const map = new Map<string, number>();
  sorted.forEach((l, i) => map.set(l.id, i));
  return map;
}

// dagre is a layout extension; its options aren't in the base LayoutOptions union.
export const dagreOptions = {
  name: "dagre",
  rankDir: "TB",
  nodeSep: 24,
  rankSep: 60,
  animate: false,
  fit: true,
  padding: 30,
} as unknown as cytoscape.LayoutOptions;

/**
 * Run dagre, then snap each node's y to its layer band so layers read as
 * horizontal swimlanes ordered by `layer.order`. Services and grey nodes get
 * dedicated bands below the named layers.
 */
export function applySwimlanes(cy: Core, layers: LayerDef[]): void {
  const bands = bandIndex(layers);
  const serviceBand = bands.size; // services below the deepest layer
  const greyBand = bands.size + 1; // unresolved at the very bottom

  cy.nodes().forEach((n) => {
    const kind = n.data("kind") as string;
    const layer = n.data("layer") as string;
    const grey = n.data("grey") === "1";
    let band: number;
    if (kind === "service") band = serviceBand;
    else if (grey || layer === "") band = greyBand;
    else band = bands.get(layer) ?? greyBand;
    const pos = n.position();
    n.position({ x: pos.x, y: band * BAND_HEIGHT });
  });
  cy.fit(undefined, 40);
}
