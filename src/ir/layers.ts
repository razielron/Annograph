/** Layer extraction from @component decorators + propagation to methods. */

import type { Decorator } from "../extract/envelope.js";

/** Extract the layer string from a @component decorator, if present. */
export function layerFromComponent(decorators: Decorator[]): string | undefined {
  const component = decorators.find((d) => d.name === "component");
  if (!component) return undefined;
  const layer = component.kwargs["layer"];
  return typeof layer === "string" ? layer : undefined;
}

/** Extract tags from a @component decorator (kwarg `tags`), else empty. */
export function tagsFromComponent(decorators: Decorator[]): string[] {
  const component = decorators.find((d) => d.name === "component");
  if (!component) return [];
  const tags = component.kwargs["tags"];
  if (Array.isArray(tags)) return tags.filter((t): t is string => typeof t === "string");
  return [];
}

/** True when any of the decorators is @component. */
export function hasComponent(decorators: Decorator[]): boolean {
  return decorators.some((d) => d.name === "component");
}
