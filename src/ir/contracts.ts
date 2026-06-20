/** Tier-B contract assembly from @contract decorators and type annotations. */

import type { Decorator, FuncEnvelope } from "../extract/envelope.js";
import type { Contract } from "./types.js";

/**
 * Build a Tier-B contract for a function. Prefers explicit @contract args;
 * falls back to the function's own parameter/return annotations so even
 * un-decorated functions surface a ref-level contract where types are present.
 */
export function buildContract(fn: FuncEnvelope): Contract | undefined {
  const decorator = fn.decorators.find((d) => d.name === "contract");

  const inputRef = decorator ? typeRefKwarg(decorator, "input") : inferInputRef(fn);
  const outputRef = decorator ? typeRefKwarg(decorator, "output") : fn.returns ?? undefined;
  const errors = decorator ? stringArrayKwarg(decorator, "errors") : undefined;

  if (inputRef === undefined && outputRef === undefined && errors === undefined) {
    return undefined;
  }

  const contract: Contract = {};
  if (inputRef !== undefined) contract.input = { ref: inputRef };
  if (outputRef !== undefined) contract.output = { ref: outputRef };
  if (errors !== undefined && errors.length > 0) contract.errors = errors;
  return contract;
}

/** Read a type-ref kwarg (e.g. input=CreateOrderRequest) as a string. */
function typeRefKwarg(decorator: Decorator, key: string): string | undefined {
  const value = decorator.kwargs[key];
  return typeof value === "string" ? value : undefined;
}

function stringArrayKwarg(decorator: Decorator, key: string): string[] | undefined {
  const value = decorator.kwargs[key];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return undefined;
}

/** Use the first non-self parameter's annotation as the input ref. */
function inferInputRef(fn: FuncEnvelope): string | undefined {
  for (const p of fn.params) {
    if (p.name === "self" || p.name === "cls") continue;
    if (p.annotation) return p.annotation;
    return undefined;
  }
  return undefined;
}
