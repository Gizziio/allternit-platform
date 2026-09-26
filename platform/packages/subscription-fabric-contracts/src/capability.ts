// §S1 — capability taxonomy + shared primitives
import { z } from "zod";

// Branded/opaque provider identifier — never a union of provider-name literals.
export const providerIdSchema = z.string().brand<"ProviderId">();
export type ProviderId = z.infer<typeof providerIdSchema>;

// Dot-named capability id, `${string}.${string}` — e.g. "presentation.create".
export type CapabilityId = `${string}.${string}`;
export const capabilityIdSchema = z
  .string()
  .refine((v) => /^[^.]+\.[^.]+$/.test(v), {
    message: "CapabilityId must be dot-named (\"<segment>.<segment>\")",
  })
  .transform((v) => v as CapabilityId);

// Minimal recursive JSON-Schema shape; a full draft validator is out of scope
// for contracts, so unknown keywords pass through.
export interface JSONSchema {
  type?: string;
  properties?: { [name: string]: JSONSchema };
  items?: JSONSchema;
  required?: string[];
  enum?: unknown[];
  description?: string;
  additionalProperties?: boolean | JSONSchema;
  [key: string]: unknown;
}

export const jsonSchemaSchema: z.ZodType<JSONSchema, z.ZodTypeDef, unknown> = z.lazy(() =>
  z
    .object({
      type: z.string().optional(),
      properties: z.record(jsonSchemaSchema).optional(),
      items: jsonSchemaSchema.optional(),
      required: z.array(z.string()).optional(),
      enum: z.array(z.unknown()).optional(),
      description: z.string().optional(),
      additionalProperties: z.union([z.boolean(), jsonSchemaSchema]).optional(),
    })
    .passthrough()
);

export const artifactTypeSchema = z.enum([
  "text",
  "image",
  "document",
  "pdf",
  "presentation",
  "spreadsheet",
  "website",
  "code_project",
  "archive",
  "video",
  "audio",
  "html_app",
]);
export type ArtifactType = z.infer<typeof artifactTypeSchema>;

export const sensitivitySchema = z.enum(["public", "internal", "confidential", "local_only"]);
export type Sensitivity = z.infer<typeof sensitivitySchema>;

export const modelClassSchema = z.enum(["fast", "standard", "reasoning", "deep"]);
export type ModelClass = z.infer<typeof modelClassSchema>;

export const sideEffectsSchema = z.enum(["none", "provider_state", "external_publish"]);
export type SideEffects = z.infer<typeof sideEffectsSchema>;

export const capabilityDefSchema = z.object({
  id: capabilityIdSchema,
  version: z.number().int(),
  input_schema: jsonSchemaSchema,
  output_artifact_types: z.array(artifactTypeSchema),
  side_effects: sideEffectsSchema,
  requires_thread: z.boolean(),
  long_running_hint: z.boolean(),
});
export type CapabilityDef = z.infer<typeof capabilityDefSchema>;
