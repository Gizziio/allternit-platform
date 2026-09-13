/**
 * Gallery publish actions — A:// Artifacts Phase 3 hosted publish
 * (docs/design/artifacts-api.md §6 publish tier).
 *
 * Presentational row under a gallery card: publish / unpublish / status for
 * the entry's gateway artifact. Purely a consumer of `content-artifact-api`
 * (the client) — gallery-store / content-artifact-sync are untouched.
 *
 * Publish snapshots an immutable version (decision 2) and is gated on the
 * sandbox policy (decision 4): a gateway rejection (e.g. a network-requesting
 * policy) surfaces as a plain message instead of publishing.
 *
 * The gateway is best-effort from this surface: any failure leaves the row in
 * its previous state and never throws out of the component.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  getContentArtifactPublishStatus,
  listContentArtifacts,
  publishContentArtifact,
  unpublishContentArtifact,
  type ContentArtifactPublishStatus,
} from '../../lib/design/content-artifact-api';
import type { GalleryEntry } from '../../lib/design/gallery-store';

interface Props {
  entry: GalleryEntry;
}

/**
 * Resolve the gateway artifact id for a gallery entry. Gateway-backed entries
 * carry it in `entry.id` (`art_…`); locally-created entries have a
 * `gallery-<projectId>` cache id and are resolved through the project filter.
 */
async function resolveArtifactId(entry: GalleryEntry): Promise<string | null> {
  if (entry.id.startsWith('art_')) return entry.id;
  try {
    const res = await listContentArtifacts({ project: entry.projectId, limit: 1 });
    return res.artifacts?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

export function GalleryPublishActions({ entry }: Props) {
  const [status, setStatus] = useState<ContentArtifactPublishStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const id = await resolveArtifactId(entry);
    if (!id) return;
    try {
      setStatus(await getContentArtifactPublishStatus(id));
    } catch {
      // Gateway unreachable — the row stays hidden (status null → no render).
    }
  }, [entry]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const act = useCallback(
    async (fn: (id: string) => Promise<unknown>, failureNotice: (e: unknown) => string) => {
      const id = await resolveArtifactId(entry);
      if (!id || busy) return;
      setBusy(true);
      setNotice(null);
      try {
        await fn(id);
        await refresh();
      } catch (e) {
        setNotice(failureNotice(e));
      } finally {
        setBusy(false);
      }
    },
    [entry, busy, refresh],
  );

  // Gateway not reachable for this entry — no publish surface.
  if (!status) return null;

  const published = status.published === true;

  return (
    <span className="ad-gallery-publish">
      {published ? (
        <>
          <span className="ad-gallery-publish__status">
            Published{status.version != null ? ` · v${status.version}` : ''}
          </span>
          {status.url?.startsWith('http') && (
            <a
              className="ad-gallery-publish__link"
              href={status.url}
              target="_blank"
              rel="noreferrer"
            >
              Open
            </a>
          )}
          <button
            type="button"
            className="ad-gallery-publish__btn"
            disabled={busy}
            onClick={() =>
              act(unpublishContentArtifact, () => 'Unpublish failed — gateway rejected it')
            }
          >
            Unpublish
          </button>
        </>
      ) : (
        <button
          type="button"
          className="ad-gallery-publish__btn"
          disabled={busy}
          onClick={() =>
            act(
              (id) => publishContentArtifact(id),
              (e) =>
                e instanceof Error && /sandbox_policy/.test(e.message)
                  ? 'Publish rejected: this artifact’s sandbox policy requests network access'
                  : 'Publish failed — gateway rejected it',
            )
          }
        >
          Publish
        </button>
      )}
      {notice && <small className="ad-gallery-publish__notice">{notice}</small>}
    </span>
  );
}
