/** Tiny GET router: matches a path pattern to a handler, extracting params. */

export interface RouteMatch {
  params: Record<string, string>;
  query: URLSearchParams;
}

export type RouteHandler = (match: RouteMatch) => unknown;

interface Route {
  segments: string[];
  handler: RouteHandler;
}

/**
 * A minimal pattern matcher. Patterns use `/api/x/:id` for a single segment, or
 * `/api/x/*rest` to capture the entire remainder (for ids with `.`, `:` or `/`).
 */
export class Router {
  private readonly routes: Route[] = [];

  get(pattern: string, handler: RouteHandler): this {
    this.routes.push({ segments: split(pattern), handler });
    return this;
  }

  /** Match a decoded pathname; returns the handler + extracted params, or null. */
  match(pathname: string): { handler: RouteHandler; params: Record<string, string> } | null {
    const parts = split(pathname);
    for (const route of this.routes) {
      const params = tryMatch(route.segments, parts);
      if (params) return { handler: route.handler, params };
    }
    return null;
  }
}

function split(path: string): string[] {
  return path.split("/").filter((s) => s.length > 0);
}

function tryMatch(pattern: string[], parts: string[]): Record<string, string> | null {
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    const seg = pattern[i]!;
    if (seg.startsWith("*")) {
      // Rest capture: everything left (may contain slashes), decoded.
      params[seg.slice(1)] = decode(parts.slice(i).join("/"));
      return params;
    }
    const part = parts[i];
    if (part === undefined) return null;
    if (seg.startsWith(":")) params[seg.slice(1)] = decode(part);
    else if (seg !== part) return null;
  }
  return parts.length === pattern.length ? params : null;
}

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
