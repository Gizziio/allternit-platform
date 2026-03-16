/**
 * A2R Platform Manifest
 * 
 * Single source of truth for version lock between Desktop and Backend.
 * Desktop 1.2.3 requires Backend 1.2.3. Always.
 */

export const PLATFORM_MANIFEST = {
  /** Desktop version - drives everything */
  version: '1.0.0',
  
  /** Release timestamp */
  releasedAt: '2026-03-13T00:00:00Z',
  
  /** Backend is LOCKED to this exact version */
  backend: {
    version: '1.0.0',
    
    /** Minimum compatible backend (grace period) */
    minimumCompatible: '1.0.0',
    
    /** Download URLs for each platform */
    downloads: {
      'x86_64-linux': `https://github.com/a2r/backend/releases/download/v1.0.0/a2r-backend-1.0.0-x86_64-linux.tar.gz`,
      'aarch64-linux': `https://github.com/a2r/backend/releases/download/v1.0.0/a2r-backend-1.0.0-aarch64-linux.tar.gz`,
      'x86_64-macos': `https://github.com/a2r/backend/releases/download/v1.0.0/a2r-backend-1.0.0-x86_64-macos.tar.gz`,
      'aarch64-macos': `https://github.com/a2r/backend/releases/download/v1.0.0/a2r-backend-1.0.0-aarch64-macos.tar.gz`,
    } as Record<string, string>,
    
    /** SHA256 checksums for verification */
    checksums: {
      'x86_64-linux': 'PLACEHOLDER_SHA256',
      'aarch64-linux': 'PLACEHOLDER_SHA256',
      'x86_64-macos': 'PLACEHOLDER_SHA256',
      'aarch64-macos': 'PLACEHOLDER_SHA256',
    } as Record<string, string>,
  },
  
  /** Update endpoints */
  update: {
    /** Desktop updates via electron-updater */
    desktopFeedUrl: 'https://github.com/a2r/desktop/releases/latest',
    
    /** Backend version check endpoint */
    backendVersionUrl: 'https://api.a2r.io/versions/latest',
  },
} as const;

/** Get download URL for current platform */
export function getBackendDownloadUrl(): string {
  const platform = getPlatformId();
  return PLATFORM_MANIFEST.backend.downloads[platform];
}

/** Get expected checksum for current platform */
export function getBackendChecksum(): string {
  const platform = getPlatformId();
  return PLATFORM_MANIFEST.backend.checksums[platform];
}

/** Platform identifier for backend downloads */
function getPlatformId(): string {
  const arch = process.arch === 'x64' ? 'x86_64' : 'aarch64';
  const platform = process.platform === 'darwin' ? 'macos' : 
                   process.platform === 'linux' ? 'linux' : 'windows';
  return `${arch}-${platform}`;
}

/** Check if backend version is compatible */
export function isBackendCompatible(backendVersion: string): boolean {
  // Exact match = perfect
  if (backendVersion === PLATFORM_MANIFEST.backend.version) {
    return true;
  }
  
  // Check minimum compatible
  const [major, minor] = backendVersion.split('.').map(Number);
  const [minMajor, minMinor] = PLATFORM_MANIFEST.backend.minimumCompatible.split('.').map(Number);
  
  if (major > minMajor) return true;
  if (major === minMajor && minor >= minMinor) return true;
  
  return false;
}

/** Should we update this backend? */
export function shouldUpdateBackend(backendVersion: string): boolean {
  return backendVersion !== PLATFORM_MANIFEST.backend.version;
}
