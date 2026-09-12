/**
 * Content-artifact gateway sync — A:// Artifacts API Phase 1
 * (docs/design/artifacts-api.md §4–§5).
 *
 * The gateway (`POST /api/v1/content-artifacts`, served by allternit-api) is
 * canonical; IndexedDB (`gallery-store`) stays as the offline/read-through
 * cache in Phase 1:
 *
 * - Save (design-session gallery capture): writes IndexedDB first, then
 *   through the API — find the artifact for the project, append a version if
 *   it exists, create it (with version 1) otherwise. Idempotency keys make
 *   retries safe.
 * - Read (gallery list): gateway-first; on any gateway failure the IndexedDB
 *   cache answers instead.
 *
 * Mapping notes:
 * - The gateway `type` is MIME-style (html-first). The gallery's `type` is a
 *   UI category slug (prototype/slides/…), which is not part of the gateway
 *   data model — gateway entries reuse the local category when the project
 *   was saved from this browser, and fall back to 'other'.
 */

import { api } from '@/integration/api-client';

import { listGalleryEntries, type GalleryEntry } from './gallery-store';

interface ContentArtifactProvenance {
  prompt?: string;
  designSystemId?: string;
  skillId?: string;
  skillName?: string;
  sourceSessionId?: string;
}

interface ContentArtifactRecord {
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

interface ContentArtifactListResponse {
  artifacts?: ContentArtifactRecord[];
  next_cursor?: string | null;
}

/** MIME type for the gateway; gallery category slugs map to html-first. */
function gatewayType(entry: GalleryEntry): string {
  return entry.type.includes('/') ? entry.type : 'text/html';
}

/**
 * Write one gallery entry through the content-artifacts API. Appends a
 * version when the project already has an artifact; creates it otherwise.
 * Throws when the gateway rejects the write — callers keep IndexedDB as the
 * offline fallback and swallow per the P0 capture's best-effort semantics.
 */
export async function saveGalleryEntryToGateway(entry: GalleryEntry): Promise<void> {
  const existing = await api.get<ContentArtifactListResponse>(
    `/api/v1/content-artifacts?project=${encodeURIComponent(entry.projectId)}&limit=1`,
  );
  const found = existing?.artifacts?.[0];
  if (found?.id) {
    await api.put(`/api/v1/content-artifacts/${found.id}/versions`, {
      body: entry.artifactHtml,
      thumbnail: entry.thumbnail,
      idempotencyKey: `gallery-append-${entry.projectId}-${entry.updatedAt}`,
    });
    return;
  }
  await api.post('/api/v1/content-artifacts', {
    title: entry.projectName,
    type: gatewayType(entry),
    body: entry.artifactHtml,
    projectId: entry.projectId,
    prompt: entry.prompt,
    designSystemId: entry.designSystemId,
    skillId: entry.skillId,
    skillName: entry.skillName,
    sandboxPolicy: 'standard',
    thumbnail: entry.thumbnail,
    idempotencyKey: `gallery-create-${entry.projectId}`,
  });
}

/**
 * Gallery list, gateway-first. Merges the gateway's canonical artifact list
 * with the IndexedDB cache: bodies come from the local cache when the entry
 * was saved from this browser (sync-on-save), and are fetched once per
 * gateway-only artifact. Local-only entries (saved while the gateway was
 * unreachable) are kept so nothing disappears. Falls back to the pure
 * IndexedDB list when the gateway cannot be reached.
 */
export async function listGalleryEntriesGatewayFirst(): Promise<GalleryEntry[]> {
  try {
    const res = await api.get<ContentArtifactListResponse>('/api/v1/content-artifacts?limit=100');
    const remote = res?.artifacts;
    if (!Array.isArray(remote)) return listGalleryEntries();

    const local = await listGalleryEntries();
    const localByProject = new Map(local.map((e) => [e.projectId, e]));

    const merged = await Promise.all(
      remote.map(async (a): Promise<GalleryEntry> => {
        const localEntry = a.projectId ? localByProject.get(a.projectId) : undefined;
        let artifactHtml = localEntry?.artifactHtml ?? '';
        if (!artifactHtml && a.id) {
          try {
            const full = await api.get<{ artifact?: { body?: string } }>(
              `/api/v1/content-artifacts/${a.id}`,
            );
            artifactHtml = full?.artifact?.body ?? '';
          } catch {
            // Body fetch is best-effort; thumbnails still render.
          }
        }
        const provenance = a.provenance ?? {};
        return {
          id: a.id,
          projectId: a.projectId ?? localEntry?.projectId ?? '',
          projectName: a.title || localEntry?.projectName || 'Untitled',
          prompt: provenance.prompt ?? localEntry?.prompt ?? '',
          // Gateway stores MIME types; the UI category comes from the local
          // cache when available, else 'other'.
          type: localEntry?.type ?? 'other',
          designSystemId: provenance.designSystemId ?? localEntry?.designSystemId,
          skillId: provenance.skillId ?? localEntry?.skillId,
          skillName: provenance.skillName ?? localEntry?.skillName,
          artifactHtml,
          thumbnail: a.thumbnail ?? localEntry?.thumbnail,
          createdAt: (a.createdAt ? Date.parse(a.createdAt) : NaN) || localEntry?.createdAt || Date.now(),
          updatedAt: (a.updatedAt ? Date.parse(a.updatedAt) : NaN) || Date.now(),
        };
      }),
    );

    const remoteProjects = new Set(remote.map((a) => a.projectId).filter(Boolean));
    const localOnly = local.filter((e) => !remoteProjects.has(e.projectId));
    return [...merged, ...localOnly].sort((x, y) => y.updatedAt - x.updatedAt);
  } catch {
    return listGalleryEntries();
  }
}
