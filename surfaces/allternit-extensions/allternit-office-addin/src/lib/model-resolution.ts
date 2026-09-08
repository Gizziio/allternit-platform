/**
 * Runtime chat-model resolution.
 *
 * The pane must not assume a fixed model id: a gateway's chat backend only
 * accepts models its upstream catalog actually offers, and a hard-coded id
 * that isn't in the catalog fails every request with 400 model_not_found.
 *
 * Resolution order (enforced by `resolveRuntimeConfig` in useOfficeAgent):
 *   1. A model explicitly chosen in the settings panel.
 *   2. The first (or default-flagged) model from the backend's OpenAI-style
 *      `GET {baseURL}/v1/models`, authenticated with the minted `ak-…` key.
 *      The result is cached for the session; any failure (non-2xx, malformed
 *      body, network error, timeout) resolves to null so the caller falls
 *      through to its own last-resort default.
 *   3. Caller-provided hard-coded default.
 */

const MODEL_LIST_TIMEOUT_MS = 8000

/** Session-scoped cache: one resolution attempt per pane session. */
let sessionModelPromise: Promise<string | null> | null = null

/** Test hook: clear the session cache. */
export function resetResolvedModelForTests(): void {
  sessionModelPromise = null
}

interface ModelListEntry {
  id?: unknown
  default?: unknown
}

/**
 * Pick the model id to use from a `/v1/models` `data` array. An entry
 * explicitly flagged `default: true` wins; otherwise the first entry with a
 * non-empty string id. Returns null for an empty/invalid list.
 */
export function pickModelFromList(entries: unknown): string | null {
  if (!Array.isArray(entries)) return null
  const ids: string[] = []
  for (const entry of entries as ModelListEntry[]) {
    if (entry && typeof entry === 'object' && typeof entry.id === 'string') {
      const id = entry.id.trim()
      if (id) ids.push(id)
    }
  }
  if (ids.length === 0) return null
  const flagged = (entries as ModelListEntry[]).find(
    (entry) => entry && typeof entry === 'object' && entry.default === true,
  )
  if (flagged && typeof flagged.id === 'string' && flagged.id.trim()) {
    return flagged.id.trim()
  }
  return ids[0]
}

/**
 * Resolve the model from the chat backend's model list. Returns null when
 * the backend does not serve a usable list (so the caller falls through).
 * Cached per session: the first call's outcome is reused for the rest of the
 * pane session, success or failure.
 */
export function resolveBackendModel(baseURL: string, apiKey: string): Promise<string | null> {
  if (!baseURL || !apiKey) return Promise.resolve(null)
  if (!sessionModelPromise) {
    sessionModelPromise = fetchModelList(baseURL, apiKey).catch(() => null)
  }
  return sessionModelPromise
}

async function fetchModelList(baseURL: string, apiKey: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), MODEL_LIST_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${baseURL.replace(/\/+$/, '')}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
  if (!response.ok) return null
  const payload: unknown = await response.json().catch(() => null)
  if (!payload || typeof payload !== 'object') return null
  return pickModelFromList((payload as { data?: unknown }).data)
}
