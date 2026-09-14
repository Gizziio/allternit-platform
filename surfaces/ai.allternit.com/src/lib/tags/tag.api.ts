"use client";

/**
 * Allternit Tagging Subsystem — typed API client.
 *
 * Talks to the Rust gateway endpoints under /api/v1/tags and /api/v1/taggings.
 */

import { api } from "@/integration/api-client";
import type { Tag, Tagging, TagScope } from "./tag.types";

export interface TagsResponse {
  tags: Tag[];
}

export interface TaggingsResponse {
  taggings: Tagging[];
}

export interface DeleteResponse {
  deleted: boolean;
  id: string;
}

export type CreateTagInput = Omit<Tag, "id" | "createdAt" | "updatedAt">;
export type UpdateTagInput = Partial<CreateTagInput>;

export async function listTags(scope?: TagScope | "global"): Promise<Tag[]> {
  const query = scope && scope !== "global" ? `?scope=${encodeURIComponent(scope)}` : "";
  const res = await api.get<TagsResponse>(`/api/v1/tags${query}`);
  return res.tags;
}

export async function createTag(input: CreateTagInput): Promise<Tag> {
  return api.post<Tag>("/api/v1/tags", input);
}

export async function updateTag(id: string, input: UpdateTagInput): Promise<Tag> {
  return api.patch<Tag>(`/api/v1/tags/${id}`, input);
}

export async function deleteTag(id: string): Promise<DeleteResponse> {
  return api.delete<DeleteResponse>(`/api/v1/tags/${id}`);
}

export async function getTagsForTarget(targetType: TagScope, targetId: string): Promise<Tag[]> {
  const res = await api.get<TagsResponse>(`/api/v1/tags/target/${targetType}/${targetId}`);
  return res.tags;
}

export async function listTaggings(options?: {
  tagId?: string;
  targetId?: string;
  targetType?: TagScope;
}): Promise<Tagging[]> {
  const params = new URLSearchParams();
  if (options?.tagId) params.set("tagId", options.tagId);
  if (options?.targetId) params.set("targetId", options.targetId);
  if (options?.targetType) params.set("targetType", options.targetType);
  const query = params.toString();
  const res = await api.get<TaggingsResponse>(`/api/v1/taggings${query ? `?${query}` : ""}`);
  return res.taggings;
}

export async function createTagging(
  tagId: string,
  targetId: string,
  targetType: TagScope
): Promise<Tagging> {
  return api.post<Tagging>("/api/v1/taggings", { tagId, targetId, targetType });
}

export async function deleteTagging(id: string): Promise<DeleteResponse> {
  return api.delete<DeleteResponse>(`/api/v1/taggings/${id}`);
}
