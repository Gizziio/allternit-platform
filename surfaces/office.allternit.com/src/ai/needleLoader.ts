import type { NeedleWasm } from 'needle-rs'

const NEEDLE_WEIGHTS_URL =
  'https://huggingface.co/Abdalrahman/needle-rs-safetensors/resolve/main/needle.safetensors'
const NEEDLE_VOCAB_URL =
  'https://huggingface.co/Abdalrahman/needle-rs-safetensors/resolve/main/vocab.txt'

export interface NeedleProgress {
  phase: 'init' | 'weights' | 'vocab' | 'ready'
  loaded: number
  total: number
  message: string
}

export type ProgressCallback = (progress: NeedleProgress) => void

interface NeedleBundle {
  engine: NeedleWasm
}

let moduleCache: typeof import('needle-rs') | null = null
let bundleCache: NeedleBundle | null = null
let loadingPromise: Promise<NeedleBundle> | null = null

async function fetchWithProgress(
  url: string,
  label: string,
  phase: NeedleProgress['phase'],
  onProgress?: ProgressCallback,
): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`failed to load ${label} (${response.status})`)
  const total = Number(response.headers.get('content-length')) || 0
  const reader = response.body?.getReader()
  if (!reader) throw new Error(`no response body for ${label}`)

  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      loaded += value.length
      onProgress?.({ phase, loaded, total, message: `Downloading ${label}…` })
    }
  }

  const all = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    all.set(chunk, offset)
    offset += chunk.length
  }
  return all.buffer
}

/**
 * Preload the Needle WASM runtime, weights, and vocab.
 *
 * Safe to call multiple times; caches the result and broadcasts progress on
 * every call so the UI can show a download wizard even if the load started
 * elsewhere.
 */
export function loadNeedle(onProgress?: ProgressCallback): Promise<NeedleBundle> {
  if (bundleCache) {
    onProgress?.({ phase: 'ready', loaded: 1, total: 1, message: 'Model ready' })
    return Promise.resolve(bundleCache)
  }
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    onProgress?.({ phase: 'init', loaded: 0, total: 1, message: 'Initializing local model…' })
    const mod = await import('needle-rs')
    await mod.default()
    moduleCache = mod

    onProgress?.({ phase: 'weights', loaded: 0, total: 0, message: 'Downloading model weights…' })
    const weightsBuffer = await fetchWithProgress(
      NEEDLE_WEIGHTS_URL,
      'model weights',
      'weights',
      onProgress,
    )

    onProgress?.({ phase: 'vocab', loaded: 0, total: 0, message: 'Downloading tokenizer…' })
    const vocabResponse = await fetch(NEEDLE_VOCAB_URL)
    if (!vocabResponse.ok) throw new Error(`failed to load vocab (${vocabResponse.status})`)
    const vocab = await vocabResponse.text()
    onProgress?.({ phase: 'vocab', loaded: vocab.length, total: vocab.length, message: 'Tokenizer ready' })

    const engine = mod.NeedleWasm.load(new Uint8Array(weightsBuffer), vocab)
    if (!engine) throw new Error('NeedleWasm.load returned undefined')

    bundleCache = { engine }
    onProgress?.({ phase: 'ready', loaded: 1, total: 1, message: 'Model ready' })
    return bundleCache
  })()

  return loadingPromise
}

export function getNeedleEngine(): NeedleWasm | null {
  return bundleCache?.engine ?? null
}

export function getNeedleModule(): typeof import('needle-rs') | null {
  return moduleCache
}
