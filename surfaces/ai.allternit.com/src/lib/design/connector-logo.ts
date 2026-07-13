/**
 * Real per-connector brand logos, derived from `base_url` (the sidecar
 * surfaces `homepageUrl` under this field for every provider — see
 * cmd/allternit-api/src/open_connector_proxy.rs) via a favicon service.
 * No per-connector art is hosted or curated by Allternit.
 *
 * Deliberately standalone (not imported from
 * capsules/browser/browserShortcuts.store.ts, which pulls in a zustand
 * persisted store as a side effect of import).
 */
export function getConnectorLogoUrl(baseUrl: string | undefined | null, size: number = 32): string | null {
  if (!baseUrl) return null;
  try {
    const domain = new URL(baseUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
  } catch {
    return null;
  }
}
