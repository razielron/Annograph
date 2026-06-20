/** End-to-end server test: boot on an ephemeral port, hit the REST API.
 *  Uses the committed orders golden graph, so it needs no python — only a bindable port. */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import type { CodevizGraph } from "../../src/ir/types.js";
import { ConfigSchema } from "../../src/discovery/config.js";
import { makeState } from "../../src/server/state.js";
import { startServer } from "../../src/server/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ORDERS_ROOT = resolve(HERE, "..", "fixtures", "orders");
const GOLDEN = resolve(HERE, "..", "fixtures", "golden", "orders.graph.json");

const CREATE_ORDER = "domain.order_service.OrderService.create_order";

let server: Server | undefined;
let base = "";
let bootError: unknown;

beforeAll(async () => {
  try {
    const graph = JSON.parse(readFileSync(GOLDEN, "utf8")) as CodevizGraph;
    const state = makeState(graph, ORDERS_ROOT, ConfigSchema.parse({}));
    const started = await startServer({ state, port: 0 });
    server = started.server;
    base = started.url;
  } catch (err) {
    bootError = err; // e.g. cannot bind in a sandboxed CI — skip gracefully.
  }
});

afterAll(() => {
  server?.close();
});

async function getJson<T>(path: string): Promise<{ status: number; body: T }> {
  const res = await fetch(`${base}${path}`);
  return { status: res.status, body: (await res.json()) as T };
}

describe.skipIf(bootError !== undefined)("codeviz ui server", () => {
  it("serves the full graph", async () => {
    if (bootError) return;
    const { body } = await getJson<CodevizGraph>("/api/graph");
    expect(body.version).toBe("0.2");
    expect(body.nodes.length).toBeGreaterThan(0);
    expect(body.services.some((s) => s.id === "service:stripe")).toBe(true);
  });

  it("returns the boundaries list (shape)", async () => {
    const { body } = await getJson<{ id: string; displayName: string; note?: string }[]>(
      "/api/boundaries",
    );
    expect(Array.isArray(body)).toBe(true);
  });

  it("focuses a neighborhood (handles dotted/colon ids)", async () => {
    const { body } = await getJson<CodevizGraph>(
      `/api/focus/${encodeURIComponent("domain.order_service.OrderService._charge")}?hops=1`,
    );
    const ids = body.nodes.map((n) => n.id);
    expect(ids).toContain("service:stripe");
  });

  it("traces a path from the entrypoint to the service", async () => {
    const { body } = await getJson<{ path: string[] | null }>(
      `/api/path?from=${encodeURIComponent(CREATE_ORDER)}&to=service:stripe`,
    );
    expect(body.path).not.toBeNull();
    expect(body.path![0]).toBe(CREATE_ORDER);
    expect(body.path![body.path!.length - 1]).toBe("service:stripe");
  });

  it("rejects source path traversal", async () => {
    const res = await fetch(
      `${base}/api/source?file=${encodeURIComponent("../../../../etc/passwd")}&line=1`,
    );
    expect(res.status).toBe(400);
  });

  it("404s an unknown api route", async () => {
    const res = await fetch(`${base}/api/nope`);
    expect(res.status).toBe(404);
  });
});
