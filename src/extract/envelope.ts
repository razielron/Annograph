/**
 * Zod schemas + types for the Python<->TS extraction envelope.
 *
 * The helper (python/extractor) emits NDJSON: one `module` object per file, then
 * a final `summary`. We validate at the boundary so malformed helper output
 * becomes a typed error instead of a deep crash in the IR builder.
 */

import { z } from "zod";

export const ImportNameSchema = z.object({
  name: z.string(),
  asname: z.string().nullable().default(null),
});

export const ImportSchema = z.object({
  kind: z.enum(["import", "from"]),
  module: z.string().nullable(),
  names: z.array(ImportNameSchema).default([]),
  level: z.number().int().default(0),
});

export const DecoratorSchema = z.object({
  name: z.string(),
  qualifier: z.string().nullable().default(null),
  args: z.array(z.unknown()).default([]),
  kwargs: z.record(z.unknown()).default({}),
  type_ref_kwargs: z.array(z.string()).default([]),
  unresolved_kwargs: z.array(z.string()).default([]),
  line: z.number().int().default(0),
});

export const ParamSchema = z.object({
  name: z.string(),
  annotation: z.string().nullable().default(null),
});

export const CallSchema = z.object({
  callee_repr: z.string(),
  kind: z.enum(["name", "attribute"]),
  attr_chain: z.array(z.string()),
  root: z.string(),
  line: z.number().int().default(0),
});

export const BaseSchema = z.object({
  expr: z.string(),
  kind: z.enum(["name", "attribute", "other"]),
});

export const InstanceAttrSchema = z.object({
  name: z.string(),
  type_ref: z.string().nullable().default(null),
  line: z.number().int().default(0),
});

export const FuncSchema = z.object({
  name: z.string(),
  line: z.number().int().default(0),
  decorators: z.array(DecoratorSchema).default([]),
  params: z.array(ParamSchema).default([]),
  returns: z.string().nullable().default(null),
  calls: z.array(CallSchema).default([]),
  is_property: z.boolean().default(false),
});

export const ClassSchema = z.object({
  name: z.string(),
  line: z.number().int().default(0),
  bases: z.array(BaseSchema).default([]),
  decorators: z.array(DecoratorSchema).default([]),
  methods: z.array(FuncSchema).default([]),
  instance_attrs: z.array(InstanceAttrSchema).default([]),
});

export const ParseErrorSchema = z.object({
  message: z.string(),
  line: z.number().int().nullable().default(null),
});

export const ModuleEnvelopeSchema = z.object({
  type: z.literal("module"),
  path: z.string(),
  module_dotted: z.string(),
  parse_error: ParseErrorSchema.nullable().default(null),
  imports: z.array(ImportSchema).default([]),
  classes: z.array(ClassSchema).default([]),
  functions: z.array(FuncSchema).default([]),
  module_calls: z.array(CallSchema).default([]),
});

export const SummarySchema = z.object({
  type: z.literal("summary"),
  files_total: z.number().int(),
  files_parsed: z.number().int(),
  files_errored: z.number().int(),
  python_version: z.string(),
  helper_version: z.string(),
});

export type ImportEntry = z.infer<typeof ImportSchema>;
export type Decorator = z.infer<typeof DecoratorSchema>;
export type Param = z.infer<typeof ParamSchema>;
export type CallSite = z.infer<typeof CallSchema>;
export type BaseEntry = z.infer<typeof BaseSchema>;
export type InstanceAttr = z.infer<typeof InstanceAttrSchema>;
export type FuncEnvelope = z.infer<typeof FuncSchema>;
export type ClassEnvelope = z.infer<typeof ClassSchema>;
export type ModuleEnvelope = z.infer<typeof ModuleEnvelopeSchema>;
export type Summary = z.infer<typeof SummarySchema>;

export interface ExtractionResult {
  modules: ModuleEnvelope[];
  summary: Summary | undefined;
}

/** Parse one NDJSON line into a module envelope or summary (throws on schema mismatch). */
export function parseLine(line: string): ModuleEnvelope | Summary {
  const obj = JSON.parse(line) as { type?: string };
  if (obj.type === "summary") return SummarySchema.parse(obj);
  return ModuleEnvelopeSchema.parse(obj);
}
