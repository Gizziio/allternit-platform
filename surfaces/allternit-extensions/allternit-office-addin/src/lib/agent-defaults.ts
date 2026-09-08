/**
 * Agent runtime defaults.
 *
 * DEFAULT_OFFICE_MODEL mirrors the gateway's configured default model
 * (`agent.default_model` in config/allternit.json). The gateway operator can
 * change it server-side (`ALLTERNIT_DEFAULT_MODEL` env or per-user
 * `default_model`), and advanced users can override it per add-in in the
 * settings panel. No model ID is invented here — this is the ID the Allternit
 * gateway config already advertises.
 */
export const DEFAULT_OFFICE_MODEL = 'claude-3-5-sonnet'
