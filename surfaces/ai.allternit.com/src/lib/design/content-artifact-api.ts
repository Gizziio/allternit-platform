/**
 * Content-artifact gateway client — A:// Artifacts API (docs/design/artifacts-api.md §3).
 *
 * Raw CRUD over `/api/v1/content-artifacts` served by allternit-api (canonical
 * store). This module intentionally has NO store dependencies: gallery-store /
 * project-file-store build their read-through caches on top of it, and the
 * chat persist step + cowork address resolution call it directly.
 *
 * Error convention follows the rest of the surface: `api.get/post/put/del`
 * reject on non-2xx; callers decide whether a failure is fatal (writes are
 * best-effort for caches) or user-visible (CLI, save buttons).
 */

import { api } from '@/integration/api-client';

export interface ContentArtifactProvenance {
  prompt?: string;
  designSystemId?: string;
  skillId?: string;
  skillName?: string;
  sourceSessionId?: string;
}

export interface ContentArtifactRecord {
  id: string;
  address?: string;
  title?: string;
  type?: string;
  version?: number;
  projectId?: string;
  provenance?: ContentArtifactProvenance;
  sandboxPolicy?: string;
  thumbnail?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContentArtifactListResponse {
  artifacts?: ContentArtifactRecord[];
  next_cursor?: string | null;
}

export interface CreateContentArtifactInput {
  title: string;
  type?: string;
  body: string;
  projectId?: string;
  sourceSessionId?: string;
  prompt?: string;
  designSystemId?: string;
  skillId?: string;
  skillName?: string;
  sandboxPolicy?: string;
  thumbnail?: string;
  idempotencyKey?: string;
}

export interface ContentArtifactListQuery {
  type?: string;
  project?: string;
  q?: string;
  limit?: number;
  cursor?: string;
}

export function artifactAddress(id: string): string {
  return `a://artifact/${id}`;
}

/** Parse an `a://artifact/<id>` address. Returns null for anything else. */
export function parseArtifactAddress(
  address: string,
): { id: string } | null {
  const m = /^a:\/\/artifact\/([A-Za-z0-9_-]+)$/.exec(address.trim());
  return m ? { id: m[1]! } : null;
}

function listQueryString(query: ContentArtifactListQuery = {}): string {
  const params = new URLSearchParams();
  if (query.type) params.set('type', query.type);
  if (query.project) params.set('project', query.project);
  if (query.q) params.set('q', query.q);
  if (query.limit != null) params.set('limit', String(query.limit));
  if (query.cursor) params.set('cursor', query.cursor);
  const s = params.toString();
  return s ? `?${s}` : '';
}

export async function listContentArtifacts(
  query: ContentArtifactListQuery = {},
): Promise<ContentArtifactListResponse> {
  return (
    (await api.get<ContentArtifactListResponse>(
      `/api/v1/content-artifacts${listQueryString(query)}`,
    )) ?? {}
  );
}

/** Read one artifact (current version, body inline). Throws when not found. */
export async function getContentArtifact(
  id: string,
): Promise<{ artifact?: ContentArtifactRecord & { body?: string; bodySha256?: string } }> {
  return (await api.get(`/api/v1/content-artifacts/${encodeURIComponent(id)}`)) as {
    artifact?: ContentArtifactRecord & { body?: string; bodySha256?: string };
  };
}

/** Create an artifact with version 1. Returns the created record. */
export async function createContentArtifact(
  input: CreateContentArtifactInput,
): Promise<{ artifact?: ContentArtifactRecord }> {
  const { idempotencyKey, ...body } = input;
  return (await api.post('/api/v1/content-artifacts', { ...body, idempotencyKey })) as {
    artifact?: ContentArtifactRecord;
  };
}

/** Append an immutable version. Returns the new version number. */
export async function appendContentArtifactVersion(
  id: string,
  body: string,
  options: { idempotencyKey?: string; thumbnail?: string } = {},
): Promise<{ version?: number; artifactId?: string }> {
  return (await api.put(`/api/v1/content-artifacts/${encodeURIComponent(id)}/versions`, {
    body,
    idempotencyKey: options.idempotencyKey,
    thumbnail: options.thumbnail,
  })) as { version?: number; artifactId?: string };
}

/** Soft delete. Missing rows are a no-op on the gateway side. */
export async function deleteContentArtifact(id: string): Promise<void> {
  await api.delete(`/api/v1/content-artifacts/${encodeURIComponent(id)}`);
}
