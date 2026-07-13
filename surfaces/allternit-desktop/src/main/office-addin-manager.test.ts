import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OfficeAddinManager, type OfficeProductId } from './office-addin-manager.js';

const products: OfficeProductId[] = ['word', 'excel', 'powerpoint'];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'allternit-office-'));
  const manifests = join(root, 'manifests');
  mkdirSync(manifests);
  for (const [index, product] of products.entries()) {
    writeFileSync(join(manifests, `${product}.xml`), `<OfficeApp><Id>id-${product}</Id><Version>1.0.0.${index}</Version></OfficeApp>`);
  }
  const hostStatus = Object.fromEntries(products.map((product) => [product, { installed: true, running: false, bundlePath: `/Applications/${product}.app` }])) as Record<OfficeProductId, { installed: boolean; running: boolean; bundlePath: string | null }>;
  return { root, manifests, hostStatus };
}

describe('OfficeAddinManager', () => {
  it('installs and removes only the selected macOS product manifest', () => {
    const f = fixture();
    const manager = new OfficeAddinManager({ platform: 'darwin', homeDir: f.root, manifestDir: f.manifests, hostStatus: f.hostStatus });
    expect(manager.getStatus('word').health).toBe('not-installed');
    expect(manager.install('word').ok).toBe(true);
    expect(manager.getStatus('word').health).toBe('installed');
    expect(manager.getStatus('excel').health).toBe('not-installed');
    expect(manager.remove('word').ok).toBe(true);
    expect(manager.getStatus('word').health).toBe('not-installed');
  });

  it('detects a version update without changing the installed file', () => {
    const f = fixture();
    const manager = new OfficeAddinManager({ platform: 'darwin', homeDir: f.root, manifestDir: f.manifests, hostStatus: f.hostStatus });
    manager.install('excel');
    const source = join(f.manifests, 'excel.xml');
    writeFileSync(source, readFileSync(source, 'utf8').replace('1.0.0.1', '1.1.0.0'));
    expect(manager.getStatus('excel').health).toBe('update-available');
  });

  it('never reports a non-mac developer integration as installed', () => {
    const f = fixture();
    const manager = new OfficeAddinManager({ platform: 'linux', homeDir: f.root, manifestDir: f.manifests, hostStatus: f.hostStatus });
    expect(manager.getStatus('word').health).toBe('unsupported');
    expect(manager.install('word').ok).toBe(false);
  });
});
