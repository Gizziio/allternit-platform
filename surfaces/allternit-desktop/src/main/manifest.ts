/**
 * Allternit Platform Manifest
 *
 * Single source of truth for version lock between Desktop and Backend.
 * Desktop 1.x.y requires Backend 1.x.y. Always version-locked.
 */

export const PLATFORM_MANIFEST = {
  /** Desktop version */
  version: '1.0.0',

  /** Release timestamp */
  releasedAt: '2026-04-08T00:00:00Z',

  /** Backend is locked to this exact version */
  backend: {
    version: '1.0.0',

    /** Minimum compatible backend version (grace period for rolling updates) */
    minimumCompatible: '1.0.0',

    /** Download URLs for bundled backend binaries (GitHub Releases) */
    downloads: {
      'x86_64-linux':   'https://github.com/allternit/platform/releases/download/v1.0.0/allternit-api-1.0.0-x86_64-unknown-linux-gnu.tar.gz',
      'aarch64-linux':  'https://github.com/allternit/platform/releases/download/v1.0.0/allternit-api-1.0.0-aarch64-unknown-linux-gnu.tar.gz',
      'x86_64-macos':   'https://github.com/allternit/platform/releases/download/v1.0.0/allternit-api-1.0.0-x86_64-apple-darwin.tar.gz',
      'aarch64-macos':  'https://github.com/allternit/platform/releases/download/v1.0.0/allternit-api-1.0.0-aarch64-apple-darwin.tar.gz',
      'x86_64-windows': 'https://github.com/allternit/platform/releases/download/v1.0.0/allternit-api-1.0.0-x86_64-pc-windows-msvc.zip',
    } as Record<string, string>,

    /** SHA256 checksums — populate per release before shipping */
    checksums: {
      'x86_64-linux':   '',
      'aarch64-linux':  '',
      'x86_64-macos':   '',
      'aarch64-macos':   '426d91ad17db7dec27185816e4bfc7fb538a79ee3a1ff526bb85ac6f50ece272',
      'x86_64-windows': '',
    } as Record<string, string>,
  },

  /** Update endpoints */
  update: {
    /** Desktop auto-updates via electron-updater (GitHub Releases) */
    desktopFeedUrl: 'https://github.com/allternit/desktop/releases/latest',

    /** Backend version check */
    backendVersionUrl: 'https://api.allternit.com/versions/latest',
  },
} as const;

/** Download URL for the bundled backend on the current platform */
export function getBackendDownloadUrl(): string {
  const platform = getPlatformId();
  const url = PLATFORM_MANIFEST.backend.downloads[platform];
  if (!url) throw new Error(`No backend download URL for platform: ${platform}`);
  return url;
}

/** Expected SHA256 checksum for the bundled backend on the current platform */
export function getBackendChecksum(): string {
  const platform = getPlatformId();
  return PLATFORM_MANIFEST.backend.checksums[platform] ?? '';
}

/** Normalised platform identifier used as download map key */
function getPlatformId(): string {
  const arch = process.arch === 'x64' ? 'x86_64' : 'aarch64';
  const os = process.platform === 'darwin' ? 'macos'
           : process.platform === 'linux'  ? 'linux'
           : 'windows';
  return `${arch}-${os}`;
}

/** Returns true if the given backend version is compatible with this desktop */
export function isBackendCompatible(backendVersion: string): boolean {
  if (backendVersion === PLATFORM_MANIFEST.backend.version) return true;

  const [major, minor] = backendVersion.split('.').map(Number);
  const [minMajor, minMinor] = PLATFORM_MANIFEST.backend.minimumCompatible.split('.').map(Number);

  if (major > minMajor) return true;
  if (major === minMajor && minor >= minMinor) return true;
  return false;
}

/** Returns true if the backend should be updated */
export function shouldUpdateBackend(backendVersion: string): boolean {
  return backendVersion !== PLATFORM_MANIFEST.backend.version;
}
