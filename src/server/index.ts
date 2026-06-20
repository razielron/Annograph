/** Local HTTP server: REST API over the IR + the bundled static viewer. */

import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { buildApi } from "./api.js";
import { serveStatic } from "./static.js";
import type { ServerState } from "./state.js";
import { CodevizError } from "../util/errors.js";

export interface ServerOptions {
  state: ServerState;
  host?: string;
  port?: number;
}

/** Build the HTTP server (does not listen). */
export function createServer(opts: ServerOptions): Server {
  const api = buildApi(opts.state);

  return createHttpServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "method not allowed" });
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathname = url.pathname;

    if (pathname.startsWith("/api/")) {
      const route = api.match(pathname);
      if (!route) {
        sendJson(res, 404, { error: `no route ${pathname}` });
        return;
      }
      try {
        const data = route.handler({ params: route.params, query: url.searchParams });
        sendJson(res, 200, data);
      } catch (err) {
        const status = err instanceof CodevizError ? 400 : 500;
        sendJson(res, status, { error: (err as Error).message });
      }
      return;
    }

    serveStatic(pathname, res);
  });
}

/**
 * Start listening. On EADDRINUSE, retry the next port (up to `maxTries`).
 * Pass port 0 for an OS-assigned ephemeral port (used by tests).
 */
export async function startServer(
  opts: ServerOptions,
  maxTries = 20,
): Promise<{ server: Server; url: string; port: number }> {
  const host = opts.host ?? "localhost";
  const basePort = opts.port ?? 7000;
  const server = createServer(opts);

  for (let attempt = 0; attempt < maxTries; attempt++) {
    const port = basePort === 0 ? 0 : basePort + attempt;
    try {
      const bound = await listen(server, host, port);
      const url = `http://${host}:${bound}`;
      return { server, url, port: bound };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EADDRINUSE" && basePort !== 0) continue;
      throw err;
    }
  }
  throw new CodevizError(
    `could not bind a port near ${basePort} after ${maxTries} attempts`,
    "Pass --port to choose a free port.",
  );
}

function listen(server: Server, host: string, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => {
      server.off("listening", onListening);
      reject(err);
    };
    const onListening = () => {
      server.off("error", onError);
      const addr = server.address();
      resolve(typeof addr === "object" && addr ? addr.port : port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data ?? null);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(body);
}
