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

/** One hop of the org-relay chain — which gateway held the artifact. */
export interface ContentArtifactRelayHop {
  gateway?: string;
  artifactId?: string;
  version?: number;
}

/**
 * Relay provenance (org relay tier, artifacts-api.md §6) — present on
 * artifacts this gateway RECEIVED from a peer. The local id is minted on
 * receive; the origin id + relay path are recorded here for display.
 */
export interface ContentArtifactRelayProvenance {
  originGateway?: string;
  originArtifactId?: string;
  originVersion?: number;
  originSandboxPolicy?: string;
  relayPath?: ContentArtifactRelayHop[];
  bundleHash?: string;
  receivedAt?: string;
}

export interface ContentArtifactProvenance {
  prompt?: string;
  designSystemId?: string;
  skillId?: string;
  skillName?: string;
  sourceSessionId?: string;
  relay?: ContentArtifactRelayProvenance;
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

const ARTIFACT_ADDRESS_RE = /a:\/\/artifact\/[A-Za-z0-9_-]+/g;

/**
 * Split free text into text chunks and `a://artifact/<id>` addresses (in
 * order) so surfaces can render addresses as resolvable cards instead of
 * dead text.
 */
export function splitArtifactAddressText(text: string): Array<
  { kind: 'text'; text: string } | { kind: 'address'; address: string }
> {
  const out: Array<{ kind: 'text'; text: string } | { kind: 'address'; address: string }> = [];
  let last = 0;
  ARTIFACT_ADDRESS_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ARTIFACT_ADDRESS_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: 'text', text: text.slice(last, m.index) });
    out.push({ kind: 'address', address: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
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

// ═══════════════════════════════════════════════════════════════════════════════
// Per-artifact file tree (docs/design/artifacts-api.md §7 Phase 2 multi-file sync)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ContentArtifactFileEntry {
  path: string;
  sha256: string;
  updatedAt: string;
}

export interface ContentArtifactFile extends ContentArtifactFileEntry {
  body: string;
}

function encodeFilePath(path: string): string {
  // Gateway wildcard segment: leading slash is the route separator, so the
  // canonical `/a/b.css` path goes on the wire as `a/b.css`.
  return encodeURIComponent(path.replace(/^\/+/, '')).replace(/%2F/gi, '/');
}

/** Index of the artifact's whole file tree (no bodies). */
export async function listContentArtifactFiles(
  id: string,
): Promise<{ files?: ContentArtifactFileEntry[] }> {
  return (await api.get(`/api/v1/content-artifacts/${encodeURIComponent(id)}/files`)) as {
    files?: ContentArtifactFileEntry[];
  };
}

/** Read one file from the artifact tree. Throws when not found. */
export async function getContentArtifactFile(
  id: string,
  path: string,
): Promise<ContentArtifactFile> {
  return (await api.get(
    `/api/v1/content-artifacts/${encodeURIComponent(id)}/files/${encodeFilePath(path)}`,
  )) as ContentArtifactFile;
}

/** Upsert one file into the artifact tree (write-through; naturally idempotent). */
export async function putContentArtifactFile(
  id: string,
  path: string,
  body: string,
): Promise<ContentArtifactFileEntry> {
  return (await api.put(
    `/api/v1/content-artifacts/${encodeURIComponent(id)}/files/${encodeFilePath(path)}`,
    { body },
  )) as ContentArtifactFileEntry;
}

/** Remove one file from the artifact tree. Missing rows are a no-op. */
export async function deleteContentArtifactFile(
  id: string,
  path: string,
): Promise<void> {
  await api.delete(
    `/api/v1/content-artifacts/${encodeURIComponent(id)}/files/${encodeFilePath(path)}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Hosted publish (docs/design/artifacts-api.md §6 publish tier, Phase 3)
// ═══════════════════════════════════════════════════════════════════════════

export interface ContentArtifactPublishStatus {
  published: boolean;
  artifactId?: string;
  /** Snapshot semantics: the immutable version that is live (decision 2). */
  version?: number;
  routePath?: string;
  url?: string;
  deploymentId?: string;
  deploymentUrl?: string;
  publisher?: string;
  publishedAt?: string;
  unpublishedAt?: string;
}

/** Publish a version snapshot (default: current version) to the shared Pages project. */
export async function publishContentArtifact(
  id: string,
  options: { version?: number } = {},
): Promise<ContentArtifactPublishStatus> {
  return (await api.post(
    `/api/v1/content-artifacts/${encodeURIComponent(id)}/publish`,
    options.version != null ? { version: options.version } : {},
  )) as ContentArtifactPublishStatus;
}

/** Unpublish: removes the route only; the deployment stays immutable (decision 3). */
export async function unpublishContentArtifact(id: string): Promise<{ ok?: boolean; routePath?: string }> {
  return (await api.delete(
    `/api/v1/content-artifacts/${encodeURIComponent(id)}/publish`,
  )) as { ok?: boolean; routePath?: string };
}

/** Publish status for one artifact. */
export async function getContentArtifactPublishStatus(
  id: string,
): Promise<ContentArtifactPublishStatus> {
  return (await api.get(
    `/api/v1/content-artifacts/${encodeURIComponent(id)}/publish`,
  )) as ContentArtifactPublishStatus;
}

// ═══════════════════════════════════════════════════════════════════════════
// Chat persist step (docs/design/artifacts-api.md §5 "Chat")
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Renderable chat artifact kinds → gateway MIME type. The API is html-first;
 * code/jsx/sheet artifacts are not renderable documents and get no persist
 * path in Phase 2.
 */
const CHAT_ARTIFACT_MIME: Record<string, string> = {
  html: 'text/html',
  svg: 'image/svg+xml',
  document: 'text/markdown',
  mermaid: 'application/vnd.allternit.mermaid',
  openui: 'text/html',
};

export function isPersistableChatArtifactKind(kind: string): boolean {
  return kind in CHAT_ARTIFACT_MIME;
}

export interface PersistChatArtifactInput {
  title: string;
  kind: string;
  content: string;
  /** Producing chat session — stored as provenance.sourceSessionId. */
  sourceSessionId?: string;
  prompt?: string;
}

/**
 * Persist a chat-produced artifact through the content-artifacts API (Phase 2
 * chat persist step). Returns the artifact id and its `a://artifact/<id>`
 * address. Throws on gateway rejection — the caller surfaces the error.
 */
export async function persistChatArtifact(
  input: PersistChatArtifactInput,
): Promise<{ id: string; address: string }> {
  const mime = CHAT_ARTIFACT_MIME[input.kind] ?? 'text/html';
  const res = await createContentArtifact({
    title: input.title,
    type: mime,
    body: input.content,
    sourceSessionId: input.sourceSessionId,
    prompt: input.prompt,
    sandboxPolicy: 'standard',
    idempotencyKey: `chat-save-${input.sourceSessionId ?? 'anon'}-${hashString(input.content)}`,
  });
  const id = res.artifact?.id;
  if (!id) throw new Error('gateway did not return an artifact id');
  return { id, address: artifactAddress(id) };
}

/** djb2 — deterministic idempotency-key ingredient for content hashing. */
function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}
