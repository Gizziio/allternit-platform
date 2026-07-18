/**
 * Parses `[artifact:{...}]` / `[watch:{...}]` markers embedded in officecli
 * tool output strings (see officecli-tools.ts `formatArtifact` /
 * `formatWatchMarker`) and resolves artifacts to displayable object URLs via
 * the authenticated gateway client.
 */

import { fetchArtifact } from './officecli-client'

export interface OutputArtifact {
  doc_id: string
  name: string
  kind: string
  url: string
}

export interface OutputWatch {
  url: string
}

export interface ParsedOutputMarkers {
  artifacts: OutputArtifact[]
  watches: OutputWatch[]
  /** The output text with all recognized markers stripped. */
  cleanText: string
}

/**
 * Marker shape: `[artifact:{"doc_id":..,"name":..,"kind":..,"url":..}]` /
 * `[watch:{"url":..}]`. The JSON payload cannot contain `]` (artifact names
 * are gateway-sanitized bare filenames), so a simple non-`]` scan suffices.
 */
const MARKER_RE = /\[(artifact|watch):(\{[^\]]*\})\]/g

export function parseOutputMarkers(text: string): ParsedOutputMarkers {
  const artifacts: OutputArtifact[] = []
  const watches: OutputWatch[] = []
  const cleanText = text.replace(MARKER_RE, (_match, kind: string, payload: string) => {
    try {
      const data = JSON.parse(payload) as Record<string, unknown>
      if (kind === 'artifact' && typeof data.doc_id === 'string' && typeof data.name === 'string') {
        artifacts.push(data as unknown as OutputArtifact)
      } else if (kind === 'watch' && typeof data.url === 'string') {
        watches.push(data as unknown as OutputWatch)
      }
    } catch {
      // Malformed marker payload — drop it silently, keep the rest.
    }
    return ''
  })
  return { artifacts, watches, cleanText: cleanText.trim() }
}

/**
 * Fetches an artifact through the authenticated gateway client and returns a
 * revocable object URL. Callers must URL.revokeObjectURL when done.
 */
export async function resolveArtifactUrl(docId: string, name: string): Promise<string> {
  const blob = await fetchArtifact(docId, name)
  return URL.createObjectURL(blob)
}
