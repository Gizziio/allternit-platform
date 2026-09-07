/**
 * Structured input schema for `generateArtifactHtml` (see generateHtml.ts).
 *
 * Deliberately narrower than gizzi-code's project-artifact template (no
 * free-form markup) — every field here is data, not HTML, so the generator
 * can stay a pure function: byte-identical input always produces
 * byte-identical output. There is no "as of" timestamp, no generated id,
 * nothing sourced from Date.now()/Math.random() anywhere in this schema.
 */

export type ArtifactTone = 'accent' | 'warn' | 'danger' | 'neutral'

export interface ArtifactStatus {
  label: string
  tone?: ArtifactTone
}

export interface ArtifactCallout {
  text: string
  tone?: ArtifactTone
}

export interface ArtifactStat {
  label: string
  value: string
}

export interface ArtifactTable {
  headers: string[]
  rows: string[][]
}

export interface ArtifactSection {
  heading?: string
  /** Paragraphs of plain text — one <p> per entry. */
  body?: string[]
  list?: string[]
  table?: ArtifactTable
  stats?: ArtifactStat[]
}

export interface ArtifactTab {
  /** Stable slug — used verbatim as the DOM id, so keep it identifier-safe
   * ([a-z0-9-]) and unique within the input. Not auto-generated: the caller
   * owns it so re-generating with the same input is guaranteed byte-stable. */
  id: string
  label: string
  callout?: ArtifactCallout
  sections: ArtifactSection[]
}

export interface ArtifactInput {
  title: string
  subtitle?: string
  status?: ArtifactStatus
  tabs: ArtifactTab[]
}
