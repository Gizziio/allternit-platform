/**
 * Classify allternit-api custom-protocol URLs so Electron injects the
 * desktop device token only onto the local operator API — never onto
 * api.allternit.com (host `cloud`), which expects a Clerk JWT.
 */

export function isCloudControlPlaneUrl(url: string, cloudApiOrigin: string): boolean {
  try {
    const target = new URL(url);
    if (target.protocol === 'allternit-api:') {
      return target.hostname === 'cloud' || target.host === 'cloud';
    }
    return target.origin === cloudApiOrigin;
  } catch {
    return false;
  }
}

/** True when Electron main should attach the paired desktop device identity. */
export function shouldInjectDesktopIdentity(
  url: string,
  localApiOrigin: string,
  cloudApiOrigin: string,
): boolean {
  if (isCloudControlPlaneUrl(url, cloudApiOrigin)) return false;
  try {
    const target = new URL(url);
    return (
      target.origin === localApiOrigin
      || (target.protocol === 'allternit-api:' && target.hostname !== 'cloud')
    );
  } catch {
    return false;
  }
}

/** Rewrite https://api.allternit.com/... to the privileged custom protocol. */
export function rewriteCloudApiToProtocol(url: string, cloudApiOrigin: string): string | null {
  if (!url.startsWith(`${cloudApiOrigin}/`)) return null;
  return url.replace(cloudApiOrigin, 'allternit-api://cloud');
}
