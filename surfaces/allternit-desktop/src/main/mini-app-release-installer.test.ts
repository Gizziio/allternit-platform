import { generateKeyPairSync, sign } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  canonicalizeForSigning,
  switchCurrent,
  validateArchiveEntries,
  validateExtractedTree,
  verifyManifestSignature,
} from './mini-app-release-installer.js';

const temporaryDirs: string[] = [];

function makeTempDir(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-app-release-test-'));
  temporaryDirs.push(directory);
  return directory;
}

afterEach(() => {
  while (temporaryDirs.length) {
    fs.rmSync(temporaryDirs.pop() as string, { recursive: true, force: true });
  }
});

function signManifest(manifest: Record<string, unknown>): { signature: string; publisherKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const release = { ...((manifest.release ?? {}) as Record<string, unknown>), signature: undefined };
  const unsigned = { ...manifest, release };
  const message = Buffer.from(JSON.stringify(canonicalizeForSigning(unsigned)), 'utf8');
  const signature = sign(null, message, privateKey).toString('base64');
  const publisherKey = (publicKey.export({ format: 'jwk' }) as { x: string }).x;
  return { signature, publisherKey };
}

describe('canonicalizeForSigning', () => {
  it('sorts object keys recursively and keeps array order', () => {
    const canonical = canonicalizeForSigning({ b: 1, a: { d: 4, c: 3 }, z: [{ b: 2, a: 1 }] });
    expect(JSON.stringify(canonical)).toBe('{"a":{"c":3,"d":4},"b":1,"z":[{"a":1,"b":2}]}');
  });

  it('drops undefined values', () => {
    const canonical = canonicalizeForSigning({ a: undefined, b: { c: undefined, d: 1 } });
    expect(JSON.stringify(canonical)).toBe('{"b":{"d":1}}');
  });
});

describe('verifyManifestSignature', () => {
  const manifest = {
    id: 'allternit.example',
    name: 'Example',
    version: '1.0.0',
    release: { publisherKey: 'ignored', changelog: 'initial' },
  };

  it('accepts a valid Ed25519 signature over the canonical manifest', () => {
    const { signature, publisherKey } = signManifest(manifest);
    expect(verifyManifestSignature(manifest, signature, publisherKey)).toBe(true);
  });

  it('ignores a signature field already present on the manifest', () => {
    const { signature, publisherKey } = signManifest(manifest);
    const signed = { ...manifest, release: { ...manifest.release, signature } };
    expect(verifyManifestSignature(signed, signature, publisherKey)).toBe(true);
  });

  it('rejects a tampered manifest', () => {
    const { signature, publisherKey } = signManifest(manifest);
    expect(verifyManifestSignature({ ...manifest, name: 'Evil' }, signature, publisherKey)).toBe(false);
  });

  it('rejects a signature from a different key', () => {
    const { signature } = signManifest(manifest);
    const { publisherKey: otherKey } = signManifest(manifest);
    expect(verifyManifestSignature(manifest, signature, otherKey)).toBe(false);
  });

  it('rejects malformed key or signature material', () => {
    const { signature, publisherKey } = signManifest(manifest);
    expect(verifyManifestSignature(manifest, signature, 'AAAA')).toBe(false);
    expect(verifyManifestSignature(manifest, 'AAAA', publisherKey)).toBe(false);
    expect(verifyManifestSignature(manifest, '', publisherKey)).toBe(false);
  });
});

describe('validateArchiveEntries', () => {
  it('accepts ordinary relative entries', () => {
    const { entries, error } = validateArchiveEntries('dist/\ndist/index.js\npackage.json\n');
    expect(error).toBeUndefined();
    expect(entries).toEqual(['dist/', 'dist/index.js', 'package.json']);
  });

  it('rejects parent-directory traversal', () => {
    expect(validateArchiveEntries('../evil').error).toContain("'..'"); 
    expect(validateArchiveEntries('a/../../evil').error).toContain("'..'"); 
  });

  it('rejects absolute paths and drive-letter paths', () => {
    expect(validateArchiveEntries('/etc/passwd').error).toContain('escapes');
    expect(validateArchiveEntries('C:\\Windows\\system32').error).toContain('escapes');
    expect(validateArchiveEntries('\\\\server\\share').error).toContain('escapes');
  });

  it('rejects backslashes anywhere in an entry', () => {
    expect(validateArchiveEntries('dist\\index.js').error).toContain('backslash');
  });

  it('rejects an empty archive', () => {
    expect(validateArchiveEntries('\n  \n').error).toContain('empty');
  });
});

describe('validateExtractedTree', () => {
  it('accepts a tree of plain files and directories', () => {
    const root = makeTempDir();
    fs.mkdirSync(path.join(root, 'dist'));
    fs.writeFileSync(path.join(root, 'dist', 'index.js'), 'console.log(1)');
    fs.writeFileSync(path.join(root, 'package.json'), '{}');
    expect(validateExtractedTree(root)).toBeNull();
  });

  it('rejects symbolic links', () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, 'real.txt'), 'x');
    fs.symlinkSync(path.join(root, 'real.txt'), path.join(root, 'link.txt'));
    expect(validateExtractedTree(root)).toContain('symbolic link');
  });
});

describe('switchCurrent', () => {
  it('atomically points current at the requested version and replaces it on re-switch', () => {
    const appDir = makeTempDir();
    fs.mkdirSync(path.join(appDir, 'versions', '1.0.0'), { recursive: true });
    fs.mkdirSync(path.join(appDir, 'versions', '2.0.0'), { recursive: true });

    switchCurrent(appDir, '1.0.0');
    expect(fs.readlinkSync(path.join(appDir, 'current'))).toBe(path.join('versions', '1.0.0'));

    switchCurrent(appDir, '2.0.0');
    expect(fs.readlinkSync(path.join(appDir, 'current'))).toBe(path.join('versions', '2.0.0'));
    // No temporary links are left behind.
    expect(fs.readdirSync(appDir).sort()).toEqual(['current', 'versions']);
  });
});
