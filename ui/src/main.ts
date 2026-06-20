/** App bootstrap: fetch the graph, render swimlanes, wire panels + interactions. */

import { api } from "./api.js";
import { initState, onChange, state, setSelected, setTab } from "./state.js";
import {
  clearHighlights,
  focusNode,
  highlightNodes,
  initCanvas,
  setElements,
} from "./components/graph-canvas.js";
import { renderLayerChips } from "./components/layer-chips.js";
import { renderPanel } from "./components/panels.js";

async function main(): Promise<void> {
  const graph = await api.graph();
  initState(graph);

  const cyEl = document.getElementById("cy")!;
  const cy = initCanvas(cyEl, graph);

  renderLayerChips(document.getElementById("layer-chips")!);
  void renderCoverage();
  wireTabs();
  wireSearch();
  wireReset();

  // Tap a node -> select it (inspector) + highlight 1-hop neighborhood.
  cy.on("tap", "node", (evt) => {
    const id = evt.target.id();
    setTab("inspector");
    setSelected(id);
    void highlightFocus(id);
  });
  cy.on("tap", (evt) => {
    if (evt.target === cy) {
      clearHighlights();
      setSelected(null);
    }
  });

  const panelHost = document.getElementById("panel")!;
  onChange(() => {
    syncTabButtons();
    void renderPanel(panelHost);
  });
  void renderPanel(panelHost);
}

async function highlightFocus(id: string): Promise<void> {
  try {
    const sub = await api.focus(id, 1);
    highlightNodes(sub.nodes.map((n) => n.id));
  } catch {
    /* ignore */
  }
}

async function renderCoverage(): Promise<void> {
  try {
    const c = await api.coverage();
    const pct = (n: number) => `${Math.round(n * 100)}%`;
    document.getElementById("coverage")!.textContent =
      `layers ${pct(c.layerCoverage)} · contracts ${pct(c.contractCoverage)} · ${c.greyNodes} grey`;
  } catch {
    /* ignore */
  }
}

function wireTabs(): void {
  document.querySelectorAll<HTMLButtonElement>("#tabs button").forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab!));
  });
}

function syncTabButtons(): void {
  document.querySelectorAll<HTMLButtonElement>("#tabs button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === state.tab);
  });
}

function wireSearch(): void {
  const input = document.getElementById("search") as HTMLInputElement;
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const q = input.value.trim().toLowerCase();
    if (!q) return;
    const hit = state.full.nodes.find(
      (n) => n.displayName.toLowerCase().includes(q) || n.id.toLowerCase().includes(q),
    );
    if (hit) {
      setTab("inspector");
      setSelected(hit.id);
      focusNode(hit.id);
      void highlightFocus(hit.id);
    }
  });
}

function wireReset(): void {
  document.getElementById("reset-btn")!.addEventListener("click", () => {
    setElements(state.full);
    clearHighlights();
    setSelected(null);
  });
}

void main();
