/** The Cytoscape canvas: rendering, layout, and selection/highlight helpers. */

import cytoscape, { type Core } from "cytoscape";
import dagre from "cytoscape-dagre";
import type { CodevizGraph } from "../types";
import { toElements } from "../cy/elements.js";
import { buildStyle } from "../cy/style.js";
import { applySwimlanes, dagreOptions } from "../cy/layout.js";

cytoscape.use(dagre);

let cy: Core | null = null;
let layers: CodevizGraph["layers"] = [];

export function initCanvas(container: HTMLElement, graph: CodevizGraph): Core {
  layers = graph.layers;
  cy = cytoscape({
    container,
    elements: toElements(graph),
    style: buildStyle(graph.layers),
    wheelSensitivity: 0.2,
  });
  runLayout();
  return cy;
}

/** Replace all elements (e.g. when isolating a focus subgraph) and re-layout. */
export function setElements(graph: CodevizGraph): void {
  if (!cy) return;
  cy.elements().remove();
  cy.add(toElements(graph));
  runLayout();
}

function runLayout(): void {
  if (!cy) return;
  const layout = cy.layout(dagreOptions);
  layout.run();
  applySwimlanes(cy, layers);
}

export function getCy(): Core {
  if (!cy) throw new Error("canvas not initialized");
  return cy;
}

/** Clear all transient highlight/dim/path classes. */
export function clearHighlights(): void {
  if (!cy) return;
  cy.elements().removeClass("dimmed highlighted path-edge pattern-participant");
}

/** Dim everything, then highlight the given node ids (and undim them). */
export function highlightNodes(ids: string[], cls = "highlighted"): void {
  if (!cy) return;
  const set = new Set(ids);
  cy.elements().addClass("dimmed");
  cy.nodes()
    .filter((n) => set.has(n.id()))
    .removeClass("dimmed")
    .addClass(cls);
}

/** Highlight a path: the node sequence + the edges between consecutive nodes. */
export function highlightPath(ids: string[]): void {
  if (!cy) return;
  clearHighlights();
  if (ids.length === 0) return;
  cy.elements().addClass("dimmed");
  const set = new Set(ids);
  cy.nodes()
    .filter((n) => set.has(n.id()))
    .removeClass("dimmed")
    .addClass("highlighted");
  for (let i = 0; i < ids.length - 1; i++) {
    const from = ids[i]!;
    const to = ids[i + 1]!;
    cy.edges()
      .filter((e) => e.data("source") === from && e.data("target") === to)
      .removeClass("dimmed")
      .addClass("path-edge");
  }
}

/** Center + select a node by id. */
export function focusNode(id: string): void {
  if (!cy) return;
  const node = cy.getElementById(id);
  if (node.empty()) return;
  cy.elements().unselect();
  node.select();
  cy.animate({ center: { eles: node }, zoom: Math.max(cy.zoom(), 1) }, { duration: 250 });
}
