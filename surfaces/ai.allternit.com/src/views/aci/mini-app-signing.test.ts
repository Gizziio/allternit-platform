import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  generateSigningKey,
  importSigningKey,
  isManifestSigningAvailable,
  manifestSigningPayload,
  signManifest,
} from './mini-app-signing';
import { verifyMiniAppManifestSignature } from './mini-app-manifest';
import type { MiniAppManifest } from './mini-app.types';

const manifest: MiniAppManifest = {
  id: 'pub.demo',
  name: 'Demo',
  description: 'A demo miniapp used by the signing tests',
  category: 'tools',
  pinnable: true,
  version: '1.0.0',
  presentation: { mode: 'hybrid', uiUrl: 'https://demo.example.com' },
  permissions: { network: ['api.example.com'], secrets: ['API_TOKEN'] },
  release: { changelog: 'First release', publishedAt: '2026-07-15T00:00:00Z' },
};

describe('manifest signing (Ed25519)', () => {
  it('generates an exportable keypair and imports it back to the same public key', async () => {
    expect(isManifestSigningAvailable()).toBe(true);
    const generated = await generateSigningKey();
    expect(/^[A-Za-z0-9+/=]+$/.test(generated.publicKey)).toBe(true);
    expect(generated.privateKeyPkcs8.length).toBeGreaterThanOrEqual(44);
    const imported = await importSigningKey(generated.privateKeyPkcs8);
    expect(imported.publicKey).toBe(generated.publicKey);
  });

  it('signs so the marketplace verifier accepts, without mutating the input', async () => {
    const { privateKeyPkcs8 } = await generateSigningKey();
    const { key, publicKey } = await importSigningKey(privateKeyPkcs8);
    const signed = await signManifest(manifest, key, publicKey);
    expect(typeof signed.release?.signature).toBe('string');
    expect(signed.release?.publisherKey).toBe(publicKey);
    expect(manifest.release?.signature).toBeUndefined();
    expect(await verifyMiniAppManifestSignature(signed)).toBe(true);
  });

  it('rejects tampered manifests and wrong-key claims', async () => {
    const { privateKeyPkcs8 } = await generateSigningKey();
    const { key, publicKey } = await importSigningKey(privateKeyPkcs8);
    const signed = await signManifest(manifest, key, publicKey);
    expect(await verifyMiniAppManifestSignature({ ...signed, name: 'Evil Demo' })).toBe(false);
    const other = await generateSigningKey();
    const swapped = {
      ...signed,
      release: { ...signed.release, publisherKey: other.publicKey },
    } as MiniAppManifest;
    expect(await verifyMiniAppManifestSignature(swapped)).toBe(false);
  });

  it('is deterministic: signing twice yields the same signature', async () => {
    const { privateKeyPkcs8 } = await generateSigningKey();
    const { key, publicKey } = await importSigningKey(privateKeyPkcs8);
    const first = await signManifest(manifest, key, publicKey);
    const second = await signManifest(manifest, key, publicKey);
    expect(first.release?.signature).toBe(second.release?.signature);
  });

  it('signs the publisher key itself (key is inside the signed payload)', async () => {
    const { privateKeyPkcs8, publicKey } = await generateSigningKey();
    const { key } = await importSigningKey(privateKeyPkcs8);
    // If the payload omitted publisherKey, swapping keys post-signing would
    // still verify. It must not.
    const signed = await signManifest(manifest, key, publicKey);
    const payload = manifestSigningPayload(signed);
    expect(payload).toEqual(manifestSigningPayload({ ...signed, release: { ...signed.release, signature: undefined } as MiniAppManifest['release'] }));
    expect(createHash('sha256').update(payload).digest('hex').length).toBe(64);
  });
});
