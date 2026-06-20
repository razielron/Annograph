/** Inline source slice viewer, fetched from /api/source. */

import { api } from "../api.js";

export async function renderSource(host: HTMLElement, file: string, line: number): Promise<void> {
  host.innerHTML = `<div class="muted">loading ${escapeHtml(file)}…</div>`;
  try {
    const slice = await api.source(file, line);
    const rows = slice.lines
      .map((text, i) => {
        const ln = slice.start + i;
        const cls = ln === slice.line ? "src-line cur" : "src-line";
        return `<div class="${cls}"><span class="ln">${ln}</span><code>${escapeHtml(text)}</code></div>`;
      })
      .join("");
    host.innerHTML = `<div class="src-head">${escapeHtml(file)}:${slice.line}</div><pre class="src">${rows}</pre>`;
  } catch (err) {
    host.innerHTML = `<div class="muted">could not load source: ${escapeHtml((err as Error).message)}</div>`;
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
