// §S6 — thread mapping; ThreadSnapshot feeds §A1
// readThread divergence checks
import { z } from "zod";
import { providerIdSchema } from "./capability";

export const threadMappingSchema = z.object({
  mapping_id: z.string(),
  thread_id: z.string(),
  epoch: z.number().int(),
  provider: providerIdSchema,
  account_id: z.string(),
  adapter_id: z.string(),
  provider_thread_id: z.string(),
  provider_project_id: z.string().nullable(),
  provider_url: z.string(),
  last_synced_turn_index: z.number().int(),
  last_turn_fingerprint: z.string(),
  model_class: z.string().nullable(),
  status: z.enum(["active", "diverged", "migrated", "provider_deleted", "archived"]),
  on_divergence: z.enum(["adopt", "fork", "fail"]),
  context_transfer_from: z.string().nullable(),
  created_at: z.string(),
  last_used_at: z.string(),
});
export type ThreadMapping = z.infer<typeof threadMappingSchema>;

export const threadSnapshotSchema = z.object({
  provider_thread_id: z.string(),
  turn_count: z.number().int(),
  last_turn_fingerprint: z.string(),
  observed_at: z.string(),
});
export type ThreadSnapshot = z.infer<typeof threadSnapshotSchema>;
