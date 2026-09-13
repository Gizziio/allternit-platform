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
  // cloud-api task control plane (see cmd/allternit-cloud-api/src/routes/tasks.rs)
  // and workspace management. Cowork task lists (hooks/useTasksAPI.ts,
  // useTaskStore.fetchTasks, useTaskRealtime) and the workspace store call
  // these same-origin; without the entries below they were hijacked into the
  // paired-runtime relay and answered with a synthetic "no paired runtime" 503.
  '/api/v1/tasks',
  '/api/v1/workspaces',
] as const;

export function isCloudControlPlanePath(pathname: string): boolean {
  const path = String(pathname || '').split('?')[0];
  return CLOUD_CONTROL_PLANE_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
