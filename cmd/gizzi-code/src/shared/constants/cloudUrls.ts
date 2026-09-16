/**
 * Canonical Allternit production hosts.
 *
 * `ai` is the workspace website (https://ai.allternit.com) — not Allternit Cloud.
 * `platform` is the cloud console (https://platform.allternit.com).
 * `api` is the control plane (https://api.allternit.com).
 *
 * Single source of truth for production URLs. Do not hardcode these
 * hostnames elsewhere — import from here so a host change touches one file.
 */
export const CLOUD_URLS = {
  api: "https://api.allternit.com",
  platform: "https://platform.allternit.com",
  clerk: "https://clerk.allternit.com",
  headscale: "https://allternit-headscale.fly.dev",
  install: "https://install.gizziio.com",
  docs: "https://docs.gizziio.com",
  ai: "https://ai.allternit.com",
  remoteControl: "https://remotecontrol.allternit.com",
} as const

/**
 * Read a single env var, falling back when it is unset or blank.
 * Whitespace-only values count as unset.
 */
export function envOr(name: string, fallback: string): string {
  const value = process.env[name]?.trim()
  return value ? value : fallback
}

/**
 * First non-empty env var wins. For legacy-casing chains such as
 * `ALLTERNIT_API_TOKEN ?? Allternit_API_TOKEN` — pass the modern casing
 * first. Whitespace-only values count as unset.
 */
export function legacyEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return undefined
}
