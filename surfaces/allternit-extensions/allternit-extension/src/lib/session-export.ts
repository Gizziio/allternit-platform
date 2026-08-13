/**
 * Allternit Extension — Session Export
 *
 * Export agent sessions to shareable formats: JSON, Markdown, or clipboard.
 */

import type { SessionRecord } from './db'
import { getSession, listSessions } from './db'

export type ExportFormat = 'json' | 'markdown' | 'clipboard'

export interface ExportOptions {
  format: ExportFormat
  includeMetadata?: boolean
}

/** Export a single session to the specified format */
export async function exportSession(
  sessionId: string,
  options: ExportOptions = { format: 'json' },
): Promise<string> {
  const session = await getSession(sessionId)
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  switch (options.format) {
    case 'json':
      return exportAsJson(session, options.includeMetadata ?? true)
    case 'markdown':
      return exportAsMarkdown(session, options.includeMetadata ?? true)
    case 'clipboard':
      return exportAsClipboard(session)
    default:
      throw new Error(`Unknown export format: ${options.format}`)
  }
}

/** Export all sessions as a JSON bundle */
export async function exportAllSessions(): Promise<string> {
  const sessions = await listSessions()
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      extensionVersion: chrome.runtime.getManifest().version,
      sessionCount: sessions.length,
      sessions,
    },
    null,
    2,
  )
}

/** Trigger a browser download for the exported content */
export function triggerDownload(content: string, filename: string, mimeType = 'application/json'): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)

  chrome.downloads?.download({
    url,
    filename,
    saveAs: true,
  })

  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function exportAsJson(session: SessionRecord, includeMetadata: boolean): string {
  const exportData: Record<string, unknown> = {
    task: session.task,
    history: session.history,
    status: session.status,
  }

  if (includeMetadata) {
    exportData.id = session.id
    exportData.createdAt = new Date(session.createdAt).toISOString()
    exportData.extensionVersion = chrome.runtime.getManifest().version
  }

  return JSON.stringify(exportData, null, 2)
}

function exportAsMarkdown(session: SessionRecord, includeMetadata: boolean): string {
  const lines: string[] = []

  lines.push(`# Task: ${session.task}`)
  lines.push('')

  if (includeMetadata) {
    lines.push(`- **Status:** ${session.status}`)
    lines.push(`- **Created:** ${new Date(session.createdAt).toLocaleString()}`)
    lines.push(`- **Session ID:** ${session.id}`)
    lines.push('')
  }

  lines.push('## Conversation')
  lines.push('')

  for (const event of session.history) {
    if ('role' in event) {
      const role = event.role === 'user' ? '**You**' : '**Allternit**'
      const content = typeof event.content === 'string'
        ? event.content
        : JSON.stringify(event.content)
      lines.push(`${role}: ${content}`)
      lines.push('')
    } else if ('type' in event) {
      lines.push(`_${event.type}: ${JSON.stringify(event)}_`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

function exportAsClipboard(session: SessionRecord): string {
  const summary = [
    `Task: ${session.task}`,
    `Status: ${session.status}`,
    `Steps: ${session.history.length}`,
    '',
    ...session.history.map((event) => {
      if ('role' in event) {
        const label = event.role === 'user' ? 'You' : 'Allternit'
        const content = typeof event.content === 'string'
          ? event.content
          : JSON.stringify(event.content)
        return `${label}: ${content}`
      }
      return `(${event.type ?? 'event'})`
    }),
  ].join('\n')

  navigator.clipboard.writeText(summary).catch(() => {
    /* Clipboard API may not be available in service worker context */
  })

  return summary
}
