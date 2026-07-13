import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { execFileSync } from 'node:child_process';

export type OfficeProductId = 'word' | 'excel' | 'powerpoint';
export type OfficeAddinHealth = 'not-installed' | 'installed' | 'update-available' | 'needs-repair' | 'unsupported';

export interface OfficeAddinProductStatus {
  product: OfficeProductId;
  hostInstalled: boolean;
  hostRunning: boolean;
  health: OfficeAddinHealth;
  installedVersion: string | null;
  availableVersion: string | null;
  manifestPath: string | null;
  installMethod: 'macos-wef' | 'windows-developer' | 'web-guided' | 'unsupported';
  detail: string;
}

export interface OfficeAddinActionResult {
  ok: boolean;
  requiresHostRestart?: boolean;
  requiresUserConfirmation?: boolean;
  manifestPath?: string;
  detail: string;
}

interface HostRuntime {
  installed: boolean;
  running: boolean;
  bundlePath: string | null;
}

interface ManagerOptions {
  platform?: NodeJS.Platform;
  homeDir?: string;
  manifestDir: string;
  hostStatus: Record<OfficeProductId, HostRuntime>;
}

const PRODUCT_META: Record<OfficeProductId, { container: string; manifest: string }> = {
  word: { container: 'com.microsoft.Word', manifest: 'word.xml' },
  excel: { container: 'com.microsoft.Excel', manifest: 'excel.xml' },
  powerpoint: { container: 'com.microsoft.Powerpoint', manifest: 'powerpoint.xml' },
};

function xmlValue(xml: string, tag: string): string | null {
  return xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`))?.[1]?.trim() ?? null;
}

function manifestMetadata(path: string): { id: string | null; version: string | null } {
  if (!existsSync(path)) return { id: null, version: null };
  const xml = readFileSync(path, 'utf8');
  return { id: xmlValue(xml, 'Id'), version: xmlValue(xml, 'Version') };
}

function macInstallPath(product: OfficeProductId, homeDir: string, sourcePath: string): string {
  const { container } = PRODUCT_META[product];
  return join(homeDir, 'Library', 'Containers', container, 'Data', 'Documents', 'wef', `allternit-${basename(sourcePath)}`);
}

function compareManifest(sourcePath: string, installedPath: string): OfficeAddinHealth {
  if (!existsSync(installedPath)) return 'not-installed';
  const source = manifestMetadata(sourcePath);
  const installed = manifestMetadata(installedPath);
  if (!source.id || !source.version || source.id !== installed.id) return 'needs-repair';
  if (source.version !== installed.version) return 'update-available';
  return 'installed';
}

const WINDOWS_DEVELOPER_KEY = 'HKCU\\SOFTWARE\\Microsoft\\Office\\16.0\\Wef\\Developer';

function windowsRegisteredManifest(addinId: string | null): string | null {
  if (!addinId) return null;
  try {
    const output = execFileSync('reg.exe', ['query', WINDOWS_DEVELOPER_KEY, '/v', addinId], { encoding: 'utf8', windowsHide: true });
    return output.match(/REG_SZ\s+(.+)$/m)?.[1]?.trim() ?? null;
  } catch { return null; }
}

function setWindowsRegistration(addinId: string, manifestPath: string): void {
  execFileSync('reg.exe', ['add', WINDOWS_DEVELOPER_KEY, '/v', addinId, '/t', 'REG_SZ', '/d', manifestPath, '/f'], { windowsHide: true });
  execFileSync('reg.exe', ['add', WINDOWS_DEVELOPER_KEY, '/v', 'RefreshAddins', '/t', 'REG_DWORD', '/d', '1', '/f'], { windowsHide: true });
}

function removeWindowsRegistration(addinId: string): void {
  execFileSync('reg.exe', ['delete', WINDOWS_DEVELOPER_KEY, '/v', addinId, '/f'], { windowsHide: true });
}

export class OfficeAddinManager {
  private readonly platform: NodeJS.Platform;
  private readonly homeDir: string;

  constructor(private readonly options: ManagerOptions) {
    this.platform = options.platform ?? process.platform;
    this.homeDir = options.homeDir ?? homedir();
  }

  private sourcePath(product: OfficeProductId): string {
    return join(this.options.manifestDir, PRODUCT_META[product].manifest);
  }

  getStatus(product: OfficeProductId): OfficeAddinProductStatus {
    const host = this.options.hostStatus[product];
    const sourcePath = this.sourcePath(product);
    const availableVersion = manifestMetadata(sourcePath).version;

    if (this.platform === 'darwin') {
      const installedPath = macInstallPath(product, this.homeDir, sourcePath);
      const health = existsSync(sourcePath) ? compareManifest(sourcePath, installedPath) : 'needs-repair';
      return {
        product,
        hostInstalled: host.installed,
        hostRunning: host.running,
        health,
        installedVersion: manifestMetadata(installedPath).version,
        availableVersion,
        manifestPath: sourcePath,
        installMethod: 'macos-wef',
        detail: health === 'installed' ? 'Developer add-in is installed for this Office host.' : 'Install or repair the developer manifest, then restart the Office host.',
      };
    }

    if (this.platform === 'win32') {
      const source = manifestMetadata(sourcePath);
      const registeredPath = windowsRegisteredManifest(source.id);
      const health = !registeredPath ? 'not-installed' : !existsSync(registeredPath) ? 'needs-repair' : compareManifest(sourcePath, registeredPath);
      return {
        product,
        hostInstalled: host.installed,
        hostRunning: host.running,
        health,
        installedVersion: registeredPath ? manifestMetadata(registeredPath).version : null,
        availableVersion,
        manifestPath: sourcePath,
        installMethod: 'windows-developer',
        detail: health === 'installed' ? 'Developer add-in is registered for this Windows user.' : 'Register or repair this host-specific developer manifest, then restart Office.',
      };
    }

    return {
      product,
      hostInstalled: host.installed,
      hostRunning: host.running,
      health: 'unsupported',
      installedVersion: null,
      availableVersion,
      manifestPath: existsSync(sourcePath) ? sourcePath : null,
      installMethod: 'unsupported',
      detail: 'Desktop Office developer installation is not supported on this platform. Use Office on the web.',
    };
  }

  install(product: OfficeProductId): OfficeAddinActionResult {
    const sourcePath = this.sourcePath(product);
    if (!existsSync(sourcePath)) return { ok: false, detail: `Missing Allternit manifest: ${sourcePath}` };
    if (this.platform === 'win32') {
      const id = manifestMetadata(sourcePath).id;
      if (!id) return { ok: false, detail: 'The Allternit manifest has no stable add-in ID.' };
      try {
        setWindowsRegistration(id, sourcePath);
        return { ok: true, manifestPath: sourcePath, requiresHostRestart: true, detail: `Registered Allternit for ${product} in Office developer mode. Restart the Office host to load it.` };
      } catch (error) {
        return { ok: false, detail: error instanceof Error ? error.message : 'Windows developer registration failed.' };
      }
    }
    if (this.platform !== 'darwin') {
      return { ok: false, manifestPath: sourcePath, requiresUserConfirmation: true, detail: this.getStatus(product).detail };
    }
    const target = macInstallPath(product, this.homeDir, sourcePath);
    mkdirSync(join(target, '..'), { recursive: true });
    copyFileSync(sourcePath, target);
    return { ok: true, manifestPath: target, requiresHostRestart: true, detail: `Installed ${product} developer manifest. Restart Microsoft Office to load it.` };
  }

  repair(product: OfficeProductId): OfficeAddinActionResult {
    return this.install(product);
  }

  remove(product: OfficeProductId): OfficeAddinActionResult {
    if (this.platform === 'win32') {
      const id = manifestMetadata(this.sourcePath(product)).id;
      if (!id) return { ok: false, detail: 'The Allternit manifest has no stable add-in ID.' };
      try {
        removeWindowsRegistration(id);
        return { ok: true, requiresHostRestart: true, detail: `Removed only the Allternit ${product} developer registration.` };
      } catch (error) {
        return { ok: false, detail: error instanceof Error ? error.message : 'Windows developer registration removal failed.' };
      }
    }
    if (this.platform !== 'darwin') {
      return { ok: false, requiresUserConfirmation: true, detail: 'Use the Windows developer installer helper to remove this add-in.' };
    }
    const sourcePath = this.sourcePath(product);
    const target = macInstallPath(product, this.homeDir, sourcePath);
    rmSync(target, { force: true });
    return { ok: true, requiresHostRestart: true, detail: `Removed the Allternit ${product} developer manifest. No other add-ins were changed.` };
  }
}
