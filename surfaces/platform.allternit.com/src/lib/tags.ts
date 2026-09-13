/**
 * Resource tag client.
 *
 * Endpoints (cmd/allternit-api/src/tag_routes.rs:35-37):
 *   GET    /api/v1/tags[?resource_type=&resource_id=&key=] -> { tags }
 *   POST   /api/v1/tags  { resource_type, resource_id, key, value }
 *           — upserts on (resource_type, resource_id, key); a re-POST of the
 *             same key replaces the value and returns { tag, updated: true }.
 *   DELETE /api/v1/tags/:id -> 204
 *
 * Constraints (tag_routes.rs:73-84): key 1-128 chars, value ≤ 128 chars.
 * Valid resource types: agent, session, gateway_key, deployment.
 */

import { api } from "@/lib/api-client";

export const TAG_RESOURCE_TYPES = ["agent", "session", "gateway_key", "deployment"] as const;

export type TagResourceType = (typeof TAG_RESOURCE_TYPES)[number];

export interface ResourceTag {
  id: string;
  resource_type: TagResourceType;
  resource_id: string;
  key: string;
  value: string;
  created_at: string;
}

export async function listTags(filters: { resource_type?: string; resource_id?: string } = {}): Promise<ResourceTag[]> {
  const params = new URLSearchParams();
  if (filters.resource_type) params.set("resource_type", filters.resource_type);
  if (filters.resource_id) params.set("resource_id", filters.resource_id);
  const qs = params.toString();
  const data = await api.get<{ tags: ResourceTag[] }>(`/api/v1/tags${qs ? `?${qs}` : ""}`);
  return data.tags ?? [];
}

export async function createTag(input: {
  resource_type: TagResourceType;
  resource_id: string;
  key: string;
  value: string;
}): Promise<{ tag: ResourceTag; updated: boolean }> {
  return api.post<{ tag: ResourceTag; updated: boolean }>("/api/v1/tags", {
    resource_type: input.resource_type,
    resource_id: input.resource_id.trim(),
    key: input.key.trim(),
    value: input.value.trim(),
  });
}

export async function deleteTag(id: string): Promise<void> {
  await api.delete(`/api/v1/tags/${id}`);
}
