/**
 * Gallery relay provenance — A:// Artifacts org relay tier
 * (docs/design/artifacts-api.md §6 relay tier).
 *
 * Presentational line under a gallery card: when the entry's gateway
 * artifact was RECEIVED from a peer gateway (the gateway minted a new local
 * id and recorded the origin id + relay path in provenance.relay), show the
 * origin. Purely a consumer of `content-artifact-api` (the client) — the
 * gallery stores and the publish actions are untouched.
 *
 * The gateway is best-effort from this surface: any failure (unreachable,
 * artifact deleted, locally-created artifact with no relay provenance)
 * renders nothing.
 */

import { useCallback, useEffect, useState } from 'react';
import { ArrowsLeftRight } from '@phosphor-icons/react';

import {
  getContentArtifact,
  listContentArtifacts,
  type ContentArtifactRelayProvenance,
} from '../../lib/design/content-artifact-api';
import type { GalleryEntry } from '../../lib/design/gallery-store';

interface Props {
  entry: GalleryEntry;
}

/** Same resolution rule as the publish row: gateway-backed entries carry the
 * `art_…` id directly; cache entries resolve through the project filter. */
async function resolveArtifactId(entry: GalleryEntry): Promise<string | null> {
  if (entry.id.startsWith('art_')) return entry.id;
  try {
    const res = await listContentArtifacts({ project: entry.projectId, limit: 1 });
    return res.artifacts?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

export function GalleryRelayProvenance({ entry }: Props) {
  const [relay, setRelay] = useState<ContentArtifactRelayProvenance | null>(null);

  const refresh = useCallback(async () => {
    const id = await resolveArtifactId(entry);
    if (!id) return;
    try {
      const { artifact } = await getContentArtifact(id);
      setRelay(artifact?.provenance?.relay ?? null);
    } catch {
      // Gateway unreachable or artifact gone — no relay line.
    }
  }, [entry]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  // Locally-created artifacts and unreachable gateways render nothing.
  if (!relay?.originGateway || !relay.originArtifactId) return null;

  const originAddress = `a://artifact/${relay.originArtifactId}@${relay.originGateway}`;
  const hops = relay.relayPath?.length ?? 0;

  return (
    <span className="ad-gallery-relay" data-testid="gallery-relay-provenance" title={originAddress}>
      <ArrowsLeftRight size={11} aria-hidden />
      Relayed from {relay.originGateway}
      {hops > 1 ? ` · ${hops} hops` : ''}
    </span>
  );
}
