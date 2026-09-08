/**
 * Agent runtime defaults.
 *
 * DEFAULT_OFFICE_MODEL is the last-resort chat model, used only when the
 * settings panel has no explicit model AND the backend's model catalog
 * (GET {baseURL}/v1/models) cannot be fetched. It mirrors the gateway's
 * configured default model (`agent.default_model` in config/allternit.json);
 * the gateway operator can change it server-side (`ALLTERNIT_DEFAULT_MODEL`
 * env or per-user `default_model`), and advanced users can override it per
 * add-in in the settings panel.
 *
 * Note: a stored settings value equal to this constant is treated as unset
 * (see resolveRuntimeConfig) — it is the legacy pre-resolution hard-coded
 * default, and on backends whose catalog lacks this model it fails every
 * chat request with 400 model_not_found.
 */
export const DEFAULT_OFFICE_MODEL = 'claude-3-5-sonnet'
