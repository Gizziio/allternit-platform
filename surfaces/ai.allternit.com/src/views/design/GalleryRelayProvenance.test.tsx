/**
 * GalleryRelayProvenance — org relay tier provenance display (§6 relay tier).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { getContentArtifact } from '../../lib/design/content-artifact-api';
import type { GalleryEntry } from '../../lib/design/gallery-store';
import { GalleryRelayProvenance } from './GalleryRelayProvenance';

vi.mock('../../lib/design/content-artifact-api', () => ({
  getContentArtifact: vi.fn(),
  listContentArtifacts: vi.fn(),
}));

const mockedGet = vi.mocked(getContentArtifact);

function entry(extra: Partial<GalleryEntry> = {}): GalleryEntry {
  return {
    id: 'art_received123',
    projectId: 'proj-1',
    projectName: 'Relayed deck',
    prompt: 'make a deck',
    type: 'text/html',
    artifactHtml: '<html></html>',
    createdAt: 1,
    updatedAt: 1,
    ...extra,
  };
}

describe('GalleryRelayProvenance', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('shows the origin gateway + origin address for a relayed artifact', async () => {
    mockedGet.mockResolvedValue({
      artifact: {
        id: 'art_received123',
        provenance: {
          relay: {
            originGateway: 'gateway-a',
            originArtifactId: 'art_origin456',
            originVersion: 3,
            relayPath: [
              { gateway: 'gateway-a', artifactId: 'art_origin456', version: 3 },
              { gateway: 'gateway-b', artifactId: 'art_mid789', version: 1 },
            ],
            bundleHash: 'h1',
            receivedAt: '2026-09-12T00:00:00Z',
          },
        },
      },
    });
    render(<GalleryRelayProvenance entry={entry()} />);
    const el = await screen.findByTestId('gallery-relay-provenance');
    expect(el.textContent).toContain('Relayed from gateway-a');
    expect(el.textContent).toContain('2 hops');
    expect(el.getAttribute('title')).toBe('a://artifact/art_origin456@gateway-a');
  });

  it('renders nothing for a locally-created artifact (no relay provenance)', async () => {
    mockedGet.mockResolvedValue({ artifact: { id: 'art_local', provenance: {} } });
    const { container } = render(<GalleryRelayProvenance entry={entry()} />);
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="gallery-relay-provenance"]')).toBeNull();
  });

  it('renders nothing when the gateway read fails', async () => {
    mockedGet.mockRejectedValue(new Error('gateway down'));
    const { container } = render(<GalleryRelayProvenance entry={entry()} />);
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="gallery-relay-provenance"]')).toBeNull();
  });
});
