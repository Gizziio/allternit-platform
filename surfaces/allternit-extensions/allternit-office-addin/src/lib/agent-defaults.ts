/**
 * Agent runtime defaults.
 *
 * DEFAULT_OFFICE_MODEL is the last-resort chat model, used only when the
 * settings panel has no explicit model AND the backend's model catalog
 * (GET {baseURL}/v1/models) cannot be fetched. The add-in targets Allternit
 * desktop deployments, whose gizzi config (~/.config/gizzi-code/config.json)
 * provides the `kimi-cli` provider — a Kimi CLI subprocess whose model id is
 * `kimi-for-coding`. That id is verified end-to-end against the local
 * gateway (minted ak- key → POST /v1/chat/completions → 200 real reply).
 * Operators can still override it server-side (`agent.default_model` in
 * config/allternit.json, `ALLTERNIT_DEFAULT_MODEL` env, or per-user
 * `default_model`), and advanced users can override it per add-in in the
 * settings panel. Catalog auto-resolution (see resolveRuntimeConfig) still
 * wins whenever the gateway exposes an ak--readable model list.
 */
export const DEFAULT_OFFICE_MODEL = 'kimi-for-coding'

/**
 * The pre-resolution hard-coded default. Stored settings values equal to
 * this id are treated as unset (see resolveRuntimeConfig) — they predate
 * model resolution, and on backends whose catalog lacks this model they
 * fail every chat request with 400 model_not_found.
 */
export const LEGACY_OFFICE_MODEL = 'claude-3-5-sonnet'
