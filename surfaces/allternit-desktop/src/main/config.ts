/**
 * Centralized desktop port and URL configuration.
 *
 * All hard-coded ports should live here so the desktop, backend, gizzi,
 * and tunnel managers agree on a single source of truth.
 */

export const PORTS = {
  /** Rust operator API (allternit-api) */
  API: 8013,
  /** Gizzi Code AI runtime terminal server */
  GIZZI: 4096,
  /** Local development Next.js UI server */
  DEV_UI: 3013,
  /** Rails backend (when running locally) */
  RAILS: 3021,
} as const;

export const HOSTS = {
  LOOPBACK: '127.0.0.1',
  LOCALHOST: 'localhost',
} as const;

export const URLS = {
  API: `http://${HOSTS.LOOPBACK}:${PORTS.API}`,
  GIZZI: `http://${HOSTS.LOOPBACK}:${PORTS.GIZZI}`,
  DEV_UI: `http://${HOSTS.LOCALHOST}:${PORTS.DEV_UI}`,
  RAILS: `http://${HOSTS.LOOPBACK}:${PORTS.RAILS}`,
  PRODUCTION_UI: 'https://ai.allternit.com',
} as const;

/** Build a URL for the local API with an optional path. */
export function apiUrl(path?: string): string {
  return path ? `${URLS.API}${path}` : URLS.API;
}

/** Build a URL for the local Gizzi runtime with an optional path. */
export function gizziUrl(path?: string): string {
  return path ? `${URLS.GIZZI}${path}` : URLS.GIZZI;
}

/** Build a URL for the local static UI fallback served by the Rust API. */
export function staticUiUrl(path?: string): string {
  return path ? `${URLS.API}${path}` : URLS.API;
}

/** Build a URL for the development UI server with an optional path. */
export function devUiUrl(path?: string): string {
  return path ? `${URLS.DEV_UI}${path}` : URLS.DEV_UI;
}
