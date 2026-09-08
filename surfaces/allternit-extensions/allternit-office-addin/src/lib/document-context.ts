/**
 * Live document context for the in-pane agent.
 *
 * At conversation start (every execute()) the open document is fed to the
 * agent as context, layered as:
 *   1. Bridge summary — host APIs (selection, active sheet/slide, samples)
 *   2. Markdown export — the whole document converted via the gateway's
 *      anydoc proxy (best-effort; degrades to omitted when export/convert fails)
 *   3. Gateway snapshot note — the officecli backend doc id, when a snapshot
 *      sync succeeded (best-effort; failures never break the chat)
 *
 * composeDocumentContext() is pure so the layering/truncation rules are
 * unit-testable; buildLiveDocumentContext() performs the Office.js/gateway IO.
 */
import { getBridge } from './bridge-factory'
import { ensureFreshSnapshot } from './document-sync'
import {
  convertBytesToMarkdown,
  filenameForConversion,
  readCurrentDocumentBytes,
} from './markdown-conversion'
import { getOfficeHost } from './host-detector'

/** Total character budget for the composed context. */
const CONTEXT_BUDGET_CHARS = 24_000
/** Character budget reserved for the markdown export section. */
const MARKDOWN_BUDGET_CHARS = 16_000

export interface DocumentContextParts {
  /** Bridge-provided live summary (host APIs). Always present when readable. */
  bridgeSummary: string
  /** Markdown conversion of the exported document (may be empty). */
  markdown?: string
  /** Gateway snapshot doc id backing officecli tools (may be absent). */
  snapshotDocId?: string
}

/**
 * Layer the available document-context parts into the context string the
 * agent receives. Sections with no content are omitted; the markdown export
 * is truncated to its budget and the total is capped.
 */
export function composeDocumentContext(parts: DocumentContextParts): string {
  const sections: string[] = []

  const summary = parts.bridgeSummary.trim()
  if (summary) sections.push(summary)

  const markdown = (parts.markdown ?? '').trim()
  if (markdown) {
    const clipped =
      markdown.length > MARKDOWN_BUDGET_CHARS
        ? `${markdown.slice(0, MARKDOWN_BUDGET_CHARS)}\n\n[… document export truncated]`
        : markdown
    sections.push(`## Document export (markdown)\n${clipped}`)
  }

  if (parts.snapshotDocId) {
    sections.push(
      `A server-side snapshot of this document is available to officecli tools (snapshot doc id: ${parts.snapshotDocId}).`,
    )
  }

  const composed = sections.join('\n\n')
  return composed.length > CONTEXT_BUDGET_CHARS
    ? `${composed.slice(0, CONTEXT_BUDGET_CHARS)}\n\n[… document context truncated]`
    : composed
}

/**
 * Best-effort assembly of the live document context. Markdown export and
 * snapshot sync failures degrade to omitted sections — they never throw.
 * Only a total bridge failure rejects (the caller then falls back to a plain
 * "context unavailable" note).
 */
export async function buildLiveDocumentContext(): Promise<string> {
  const context = await getBridge().getContext()

  const [markdownResult, snapshotResult] = await Promise.allSettled([
    (async () => {
      const bytes = await readCurrentDocumentBytes()
      const documentUrl = typeof Office !== 'undefined' ? Office.context?.document?.url : undefined
      const result = await convertBytesToMarkdown(bytes, filenameForConversion(getOfficeHost(), documentUrl))
      return result.markdown
    })(),
    (async () => {
      const { docId } = await ensureFreshSnapshot()
      return docId
    })(),
  ])

  if (markdownResult.status === 'rejected') {
    console.warn('[document-context] markdown export unavailable:', markdownResult.reason)
  }
  if (snapshotResult.status === 'rejected') {
    console.warn('[document-context] officecli snapshot sync unavailable:', snapshotResult.reason)
  }

  return composeDocumentContext({
    bridgeSummary: context.summary,
    markdown: markdownResult.status === 'fulfilled' ? markdownResult.value : undefined,
    snapshotDocId: snapshotResult.status === 'fulfilled' ? snapshotResult.value : undefined,
  })
}
