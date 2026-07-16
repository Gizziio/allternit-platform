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
  /** Chrome extension native-messaging bridge */
  EXTENSION_BRIDGE: 3011,
  /** ACU (Python assistant) extension relay */
  ACU_RELAY: 3012,
  /** Open Notebook research backend */
  NOTEBOOK: 5055,
  /** Local speech-to-text and text-to-speech service */
  VOICE: 8001,
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
  EXTENSION_BRIDGE: `http://${HOSTS.LOOPBACK}:${PORTS.EXTENSION_BRIDGE}`,
  ACU_RELAY: `http://${HOSTS.LOOPBACK}:${PORTS.ACU_RELAY}`,
  NOTEBOOK: `http://${HOSTS.LOOPBACK}:${PORTS.NOTEBOOK}`,
  VOICE: `http://${HOSTS.LOOPBACK}:${PORTS.VOICE}`,
  /** Canonical Allternit control plane. Human Clerk sessions approve runtime pairing here. */
  CLOUD_API: 'https://allternit-cloud-api.fly.dev',
  /** Canonical browser experience. Pairing must never follow a local static UI URL. */
  PLATFORM: 'https://platform.allternit.com',
  PRODUCTION_UI: 'https://ai.allternit.com',
  /** Local static platform UI fallback served by the Rust API at the root path. */
  PLATFORM_STATIC: `http://${HOSTS.LOOPBACK}:${PORTS.API}`,
} as const;

/** Build a URL for the local API with an optional path. */
export function apiUrl(path?: string): string {
  return path ? `${URLS.API}${path}` : URLS.API;
}

/** Build a URL for the local Gizzi runtime with an optional path. */
export function gizziUrl(path?: string): string {
  return path ? `${URLS.GIZZI}${path}` : URLS.GIZZI;
}

/** Build a URL for the local static platform UI fallback served by the Rust API. */
export function staticUiUrl(path?: string): string {
  return path ? `${URLS.PLATFORM_STATIC}${path}` : URLS.PLATFORM_STATIC;
}

/** Build a URL for the development UI server with an optional path. */
export function devUiUrl(path?: string): string {
  return path ? `${URLS.DEV_UI}${path}` : URLS.DEV_UI;
}

/** Build a URL for the Chrome extension bridge with an optional path. */
export function extensionBridgeUrl(path?: string): string {
  return path ? `${URLS.EXTENSION_BRIDGE}${path}` : URLS.EXTENSION_BRIDGE;
}

/** Build a URL for the ACU extension relay with an optional path. */
export function acuRelayUrl(path?: string): string {
  return path ? `${URLS.ACU_RELAY}${path}` : URLS.ACU_RELAY;
}

/** Build a URL for the research notebook backend with an optional path. */
export function notebookUrl(path?: string): string {
  return path ? `${URLS.NOTEBOOK}${path}` : URLS.NOTEBOOK;
}
