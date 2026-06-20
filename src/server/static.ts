/** Serve the prebuilt viewer (dist/ui) with a SPA fallback to index.html. */

import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extname, isAbsolute, join, normalize, relative, sep } from "node:path";
import type { ServerResponse } from "node:http";

/** dist/ui, resolved relative to this compiled module (dist/server/static.js). */
const UI_ROOT = fileURLToPath(new URL("../ui/", import.meta.url));

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

/** Serve a static asset for `pathname`, falling back to index.html (SPA). */
export function serveStatic(pathname: string, res: ServerResponse): void {
  const asset = resolveAsset(pathname);
  if (!asset) {
    sendIndex(res);
    return;
  }
  try {
    const body = readFileSync(asset);
    res.writeHead(200, { "content-type": mimeFor(asset) });
    res.end(body);
  } catch {
    sendIndex(res);
  }
}

function resolveAsset(pathname: string): string | null {
  const rel = decodeURIComponent(pathname).replace(/^\/+/, "");
  if (rel === "" || rel.endsWith("/")) return null; // -> index fallback
  const candidate = normalize(join(UI_ROOT, rel));
  // Guard against traversal out of the UI root.
  const within = relative(UI_ROOT, candidate);
  if (within.startsWith("..") || isAbsolute(within) || within.split(sep)[0] === "..") return null;
  try {
    if (statSync(candidate).isFile()) return candidate;
  } catch {
    /* not found -> fallback */
  }
  return null;
}

function sendIndex(res: ServerResponse): void {
  try {
    const html = readFileSync(join(UI_ROOT, "index.html"));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end(
      "viewer assets not found. Run `npm run build:ui` to build the UI, then `codeviz ui`.",
    );
  }
}

function mimeFor(file: string): string {
  return MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
}
