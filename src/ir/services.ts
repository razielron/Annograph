/** Service-node synthesis and uses-service edges from @uses_service decorators. */

import type { Decorator } from "../extract/envelope.js";

export interface UsesService {
  name: string;
  op?: string;
}

/**
 * Read a @uses_service decorator: name is the first positional arg or `name`
 * kwarg; op is the `op` kwarg. Returns undefined when no such decorator.
 */
export function usesServiceFrom(decorators: Decorator[]): UsesService | undefined {
  const decorator = decorators.find((d) => d.name === "uses_service");
  if (!decorator) return undefined;

  const positional = decorator.args[0];
  const nameKwarg = decorator.kwargs["name"];
  const name =
    typeof positional === "string"
      ? positional
      : typeof nameKwarg === "string"
        ? nameKwarg
        : undefined;
  if (!name) return undefined;

  const op = decorator.kwargs["op"];
  const result: UsesService = { name };
  if (typeof op === "string") result.op = op;
  return result;
}
