// §S5 — Artifact; ArtifactFile + ProviderArtifactRef
// feed §A1 readThread/fetchArtifact/exportArtifact
import { z } from "zod";
import { artifactTypeSchema, capabilityIdSchema, providerIdSchema, sensitivitySchema } from "./capability";

export const artifactSchema = z.object({
  artifact_id: z.string(),
  type: artifactTypeSchema,
  mime_type: z.string().nullable(),
  format: z.string().nullable(),
  title: z.string().nullable(),
  source: z.object({
    task_id: z.string(),
    attempt_no: z.number().int(),
    capability: capabilityIdSchema,
    provider: providerIdSchema,
    account_id: z.string(),
    adapter_id: z.string(),
    adapter_version: z.string(),
    provider_artifact_id: z.string().nullable(),
    provider_url: z.string().nullable(),
    provider_url_expires_at: z.string().nullable(),
  }),
  context: z.object({
    thread_id: z.string().nullable(),
    project_id: z.string().nullable(),
    bot_id: z.string().nullable(),
  }),
  storage: z.object({
    retrieval_state: z.enum(["remote_only", "downloading", "local", "failed", "expired"]),
    local_path: z.string().nullable(),
    sha256: z.string().nullable(),
    size_bytes: z.number().nullable(),
    local_preview_path: z.string().nullable(),
  }),
  lineage: z.object({
    version: z.number().int(),
    parent_artifact_id: z.string().nullable(),
  }),
  capabilities: z.object({
    editable_via: z.array(capabilityIdSchema),
    export_formats: z.array(z.string()),
  }),
  trust: z.literal("untrusted_provider_output"),
  sensitivity: sensitivitySchema,
  created_at: z.string(),
});
export type Artifact = z.infer<typeof artifactSchema>;

export const providerArtifactRefSchema = z.object({
  provider: providerIdSchema,
  provider_artifact_id: z.string(),
  provider_url: z.string(),
  provider_url_expires_at: z.string().nullable(),
});
export type ProviderArtifactRef = z.infer<typeof providerArtifactRefSchema>;

export const artifactFileSchema = z.object({
  data: z.instanceof(Uint8Array),
  mime_type: z.string(),
  format: z.string(),
  sha256: z.string(),
  size_bytes: z.number().int(),
});
export type ArtifactFile = z.infer<typeof artifactFileSchema>;
