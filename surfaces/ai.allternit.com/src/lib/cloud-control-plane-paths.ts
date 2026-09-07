/**
 * Cloud control-plane paths that must never be rewritten onto a paired
 * runtime. Listing devices, pairing, relay tickets, and billing live on
 * allternit-cloud-api — not on the local operator gateway.
 *
 * On fabrictransport.allternit.com these same-origin `/api/*` URLs are
 * forwarded by the fabrictransport API worker. Treating them as runtime
 * API paths made the PWA invent a 503 "no paired runtime" while the
 * desktop was already online.
 */
export const CLOUD_CONTROL_PLANE_PATH_PREFIXES = [
  '/api/v1/runtime-devices',
  '/api/v1/runtime-pairings',
  '/api/v1/runtime-relay',
  '/api/v1/billing',
  '/api/v1/api-keys',
  '/api/v1/hosted-runtimes',
] as const;

export function isCloudControlPlanePath(pathname: string): boolean {
  const path = String(pathname || '').split('?')[0];
  return CLOUD_CONTROL_PLANE_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
