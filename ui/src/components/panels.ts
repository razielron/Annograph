/** Sidebar tab panels: inspector, services, patterns, findings, path. */

import { api } from "../api.js";
import { state, setSelected } from "../state.js";
import {
  clearHighlights,
  focusNode,
  highlightNodes,
  highlightPath,
} from "./graph-canvas.js";
import { renderSource, escapeHtml } from "./source-view.js";

export async function renderPanel(host: HTMLElement): Promise<void> {
  switch (state.tab) {
    case "inspector":
      return renderInspector(host);
    case "services":
      return renderServices(host);
    case "patterns":
      return renderPatterns(host);
    case "findings":
      return renderFindings(host);
    case "path":
      return renderPath(host);
    default:
      host.innerHTML = "";
  }
}

// ---- Inspector ----------------------------------------------------------

async function renderInspector(host: HTMLElement): Promise<void> {
  const id = state.selected;
  if (!id) {
    host.innerHTML = `<div class="muted">Click a node to inspect its contract, tags, and source.</div>`;
    return;
  }
  const node = state.byId.get(id);
  if (!node) {
    host.innerHTML = `<div class="muted">unknown node ${escapeHtml(id)}</div>`;
    return;
  }

  const tags = node.tags.length
    ? `<div class="row"><span class="k">tags</span><span>${node.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(" ")}</span></div>`
    : "";
  const boundary = node.boundary
    ? `<div class="row"><span class="k">boundary</span><span>${escapeHtml(node.boundary.note ?? "—")}</span></div>`
    : "";
  const entry = node.entrypoint
    ? `<div class="row"><span class="k">entrypoint</span><span>${escapeHtml(node.entrypoint.kind)}${node.entrypoint.path ? " · " + escapeHtml(node.entrypoint.path) : ""}</span></div>`
    : "";

  host.innerHTML = `
    <h3>${escapeHtml(node.displayName)}</h3>
    <div class="row"><span class="k">kind</span><span>${escapeHtml(node.kind)}</span></div>
    <div class="row"><span class="k">layer</span><span>${escapeHtml(node.layer ?? "—")}</span></div>
    ${entry}${tags}${boundary}
    <div id="contract-block" class="muted">loading contract…</div>
    ${node.source ? `<button id="view-src" class="link">View source</button><div id="src-host"></div>` : ""}
  `;

  const contractBlock = host.querySelector("#contract-block")!;
  try {
    const view = await api.contract(id);
    const c = view?.contract;
    if (!c || (!c.input && !c.output && !c.errors?.length)) {
      contractBlock.outerHTML = `<div class="muted" id="contract-block">no contract</div>`;
    } else {
      contractBlock.outerHTML = `
        <div id="contract-block">
          <h4>Contract</h4>
          <div class="contract">
            <div class="io"><span class="k">input</span><code>${escapeHtml(c.input?.ref ?? "—")}</code></div>
            <div class="io"><span class="k">output</span><code>${escapeHtml(c.output?.ref ?? "—")}</code></div>
            ${c.errors?.length ? `<div class="io"><span class="k">errors</span><span>${c.errors.map((e) => `<span class="tag err">${escapeHtml(e)}</span>`).join(" ")}</span></div>` : ""}
          </div>
        </div>`;
    }
  } catch {
    contractBlock.outerHTML = `<div class="muted" id="contract-block">contract unavailable</div>`;
  }

  if (node.source) {
    const btn = host.querySelector<HTMLButtonElement>("#view-src")!;
    const srcHost = host.querySelector<HTMLElement>("#src-host")!;
    btn.addEventListener("click", () => renderSource(srcHost, node.source!.file, node.source!.line));
  }
}

// ---- Services -----------------------------------------------------------

async function renderServices(host: HTMLElement): Promise<void> {
  host.innerHTML = `<div class="muted">loading services…</div>`;
  const services = await api.services();
  if (services.length === 0) {
    host.innerHTML = `<div class="muted">No third-party services declared (@uses_service).</div>`;
    return;
  }
  host.innerHTML = services
    .map(
      (s) => `
      <div class="card">
        <h4>${escapeHtml(s.name)} ${s.operations.length ? `<span class="ops">${s.operations.map((o) => escapeHtml(o)).join(", ")}</span>` : ""}</h4>
        <ul class="callers">
          ${s.callers
            .map(
              (c) =>
                `<li><a data-id="${escapeHtml(c.id)}">${escapeHtml(c.displayName)}</a>${c.op ? ` <span class="muted">(${escapeHtml(c.op)})</span>` : ""}</li>`,
            )
            .join("")}
        </ul>
      </div>`,
    )
    .join("");
  wireNodeLinks(host);
}

// ---- Patterns -----------------------------------------------------------

async function renderPatterns(host: HTMLElement): Promise<void> {
  host.innerHTML = `<div class="muted">loading patterns…</div>`;
  const groups = await api.patterns();
  if (groups.length === 0) {
    host.innerHTML = `<div class="muted">No declared patterns (@pattern). Inferred detection is future work.</div>`;
    return;
  }
  host.innerHTML = groups
    .map(
      (g) => `
      <div class="card pattern" data-pattern="${escapeHtml(g.name)}">
        <h4>${escapeHtml(g.name)} <span class="badge solid">declared</span></h4>
        <ul class="roles">
          ${g.participants
            .map(
              (p) =>
                `<li><a data-id="${escapeHtml(p.id)}">${escapeHtml(p.displayName)}</a>${p.role ? ` <span class="muted">${escapeHtml(p.role)}</span>` : ""}</li>`,
            )
            .join("")}
        </ul>
      </div>`,
    )
    .join("");
  wireNodeLinks(host);

  host.querySelectorAll<HTMLElement>(".pattern h4").forEach((h) => {
    h.style.cursor = "pointer";
    h.addEventListener("click", () => {
      const card = h.closest(".pattern") as HTMLElement;
      const name = card.dataset.pattern!;
      const group = groups.find((g) => g.name === name);
      if (group) highlightNodes(group.participants.map((p) => p.id), "pattern-participant");
    });
  });
}

// ---- Findings -----------------------------------------------------------

async function renderFindings(host: HTMLElement): Promise<void> {
  host.innerHTML = `<div class="muted">loading findings…</div>`;
  const findings = await api.findings();
  const note = `<div class="muted small">dangling-link findings require <code>scan --check</code>.</div>`;
  if (findings.length === 0) {
    host.innerHTML = `<div class="ok">No findings 🎉</div>${note}`;
    return;
  }
  host.innerHTML =
    findings
      .map(
        (f, i) => `
      <div class="finding sev-${escapeHtml(f.severity)}" data-i="${i}">
        <span class="ftype">${escapeHtml(f.type)}</span>
        <span class="fmsg">${escapeHtml(f.message)}</span>
        ${f.source ? `<span class="muted small">${escapeHtml(f.source.file)}:${f.source.line}</span>` : ""}
      </div>`,
      )
      .join("") + note;

  host.querySelectorAll<HTMLElement>(".finding").forEach((el) => {
    el.addEventListener("click", () => {
      const f = findings[Number(el.dataset.i)]!;
      if (f.nodes.length) {
        highlightNodes(f.nodes);
        focusNode(f.nodes[0]!);
      }
    });
  });
}

// ---- Path ---------------------------------------------------------------

function renderPath(host: HTMLElement): void {
  const opts = state.full.nodes
    .map((n) => `<option value="${escapeHtml(n.id)}">${escapeHtml(n.displayName)}</option>`)
    .join("");
  host.innerHTML = `
    <label class="field">from
      <input id="path-from" list="node-list" placeholder="entrypoint id" value="${state.selected ? escapeHtml(state.selected) : ""}" />
    </label>
    <label class="field">to
      <input id="path-to" list="node-list" placeholder="service id" />
    </label>
    <datalist id="node-list">${opts}</datalist>
    <button id="trace-btn">Trace path</button>
    <div id="path-result"></div>
  `;
  const from = host.querySelector<HTMLInputElement>("#path-from")!;
  const to = host.querySelector<HTMLInputElement>("#path-to")!;
  const result = host.querySelector<HTMLElement>("#path-result")!;

  host.querySelector("#trace-btn")!.addEventListener("click", async () => {
    if (!from.value || !to.value) return;
    result.innerHTML = `<div class="muted">tracing…</div>`;
    const res = await api.path(from.value, to.value);
    if (!res.path) {
      clearHighlights();
      result.innerHTML = `<div class="muted">no path from ${escapeHtml(from.value)} to ${escapeHtml(to.value)}</div>`;
      return;
    }
    highlightPath(res.path);
    result.innerHTML =
      `<div class="path-seq">` +
      res.path
        .map((id) => `<a data-id="${escapeHtml(id)}">${escapeHtml(state.byId.get(id)?.displayName ?? id)}</a>`)
        .join(' <span class="arrow">→</span> ') +
      `</div>`;
    wireNodeLinks(result);
  });
}

// ---- shared -------------------------------------------------------------

function wireNodeLinks(host: HTMLElement): void {
  host.querySelectorAll<HTMLElement>("a[data-id]").forEach((a) => {
    a.addEventListener("click", () => {
      const id = a.dataset.id!;
      setSelected(id);
      focusNode(id);
    });
  });
}
