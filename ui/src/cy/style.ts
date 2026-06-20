/** Cytoscape stylesheet: color by layer, shape by kind, dashed = declared. */

import type cytoscape from "cytoscape";
import type { LayerDef } from "../types";

// The object-form stylesheet entry ({ selector, style }); union member of Stylesheet.
type Stylesheet = cytoscape.StylesheetStyle;

// A stable, readable palette assigned to layers by ascending order.
const PALETTE = ["#4f83cc", "#5aa469", "#c98a3a", "#9466bd", "#cc5a6e", "#3aa6a6", "#8a8f3a"];
const GREY = "#9aa0a6";
const SERVICE = "#d98c3a";

export function layerColors(layers: LayerDef[]): Map<string, string> {
  const sorted = [...layers].sort((a, b) => a.order - b.order);
  const map = new Map<string, string>();
  sorted.forEach((l, i) => map.set(l.id, PALETTE[i % PALETTE.length]!));
  return map;
}

export function buildStyle(layers: LayerDef[]): Stylesheet[] {
  const colors = layerColors(layers);

  const layerSelectors: Stylesheet[] = [...colors.entries()].map(([id, color]) => ({
    selector: `node[layer = "${id}"]`,
    style: { "background-color": color, "border-color": color },
  }));

  return [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "font-size": 9,
        color: "#1a1a1a",
        "text-valign": "center",
        "text-halign": "center",
        "text-wrap": "wrap",
        "text-max-width": "90px",
        width: "label",
        height: 22,
        padding: "6px",
        shape: "round-rectangle",
        "background-color": "#cfd8dc",
        "border-width": 1.5,
        "border-color": "#90a4ae",
      },
    },
    ...layerSelectors,
    { selector: 'node[kind = "class"]', style: { shape: "round-rectangle" } },
    { selector: 'node[kind = "function"]', style: { shape: "ellipse" } },
    { selector: 'node[kind = "module"]', style: { shape: "rectangle" } },
    {
      selector: 'node[entrypoint = "1"]',
      style: { "border-width": 3, "border-color": "#1b5e20" },
    },
    {
      selector: 'node[kind = "service"]',
      style: { shape: "hexagon", "background-color": SERVICE, "border-color": "#a8651f" },
    },
    {
      selector: 'node[grey = "1"]',
      style: {
        "background-color": GREY,
        "border-color": GREY,
        "border-style": "dashed",
        color: "#37474f",
      },
    },
    {
      selector: 'node[boundary = "1"]',
      style: { "border-width": 3, "border-color": "#d50000", "border-style": "double" },
    },
    {
      selector: "edge",
      style: {
        width: 1.4,
        "line-color": "#90a4ae",
        "target-arrow-color": "#90a4ae",
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
        "arrow-scale": 0.8,
        label: "data(label)",
        "font-size": 7,
        color: "#607d8b",
        "text-rotation": "autorotate",
      },
    },
    // Declared edges (inferred:false) render dashed; inferred stay solid.
    { selector: 'edge[inferred = "0"]', style: { "line-style": "dashed" } },
    {
      selector: 'edge[kind = "uses-service"]',
      style: { "line-color": SERVICE, "target-arrow-color": SERVICE },
    },
    {
      selector: 'edge[kind = "imports"]',
      style: { "line-color": "#b0bec5", "target-arrow-color": "#b0bec5", width: 1 },
    },
    // Interaction classes.
    { selector: ".dimmed", style: { opacity: 0.18 } },
    { selector: ".highlighted", style: { "border-width": 3, "border-color": "#ff6d00" } },
    {
      selector: ".path-edge",
      style: { "line-color": "#ff6d00", "target-arrow-color": "#ff6d00", width: 3, opacity: 1 },
    },
    {
      selector: ".pattern-participant",
      style: { "border-width": 3, "border-color": "#6a1b9a" },
    },
    { selector: "node:selected", style: { "border-width": 4, "border-color": "#000" } },
  ];
}
