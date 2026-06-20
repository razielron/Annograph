/** Layer toggle chips: hide/show nodes by layer (client-side filter). */

import { state } from "../state.js";
import { getCy } from "./graph-canvas.js";
import { layerColors } from "../cy/style.js";

const active = new Set<string>();

export function renderLayerChips(container: HTMLElement): void {
  const layers = [...state.full.layers].sort((a, b) => a.order - b.order);
  const colors = layerColors(state.full.layers);
  container.innerHTML = "";

  // Default: all layers active.
  if (active.size === 0) for (const l of layers) active.add(l.id);

  for (const layer of layers) {
    const chip = document.createElement("button");
    chip.className = "chip" + (active.has(layer.id) ? " on" : "");
    chip.textContent = layer.id;
    chip.style.setProperty("--chip-color", colors.get(layer.id) ?? "#90a4ae");
    chip.addEventListener("click", () => {
      if (active.has(layer.id)) active.delete(layer.id);
      else active.add(layer.id);
      chip.classList.toggle("on");
      applyFilter();
    });
    container.appendChild(chip);
  }
}

function applyFilter(): void {
  const cy = getCy();
  cy.nodes().forEach((n) => {
    const layer = n.data("layer") as string;
    const kind = n.data("kind") as string;
    // Services, modules, and grey nodes are always shown; layer chips gate layered nodes.
    const gated = layer !== "" && kind !== "service" && kind !== "module";
    n.style("display", gated && !active.has(layer) ? "none" : "element");
  });
}
