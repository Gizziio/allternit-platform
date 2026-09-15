// @ts-nocheck
import type { LocalCommandCall } from '../../types/command'
import { listHarnesses, listNativeSessions } from '@allternit/native-sessions'
import { NativeSource } from '@/runtime/session/native-source'
import { getSessionId } from '../../bootstrap/state'

export const call: LocalCommandCall = async (args) => {
  const parts = String(args ?? '').trim().split(/\s+/).filter(Boolean)
  const cmd = parts[0] || 'list'

  if (cmd === 'harnesses') {
    const rows = listHarnesses()
      .map((h) => `${h.present ? '*' : ' '} ${h.id.padEnd(14)} ${h.label}  ${h.resumeHint}`)
      .join('\n')
    return { type: 'text', value: `Native harness adapters (* = store present on this machine)\n${rows}` }
  }

  if (cmd === 'pickup') {
    const harness = parts[1]
    const sessionId = parts[2]
    if (!harness || !sessionId) {
      return { type: 'text', value: 'Usage: /native pickup <harness> <session-id>' }
    }
    try {
      const result = await NativeSource.pickup({ harness, sessionId })
      return {
        type: 'text',
        value: `Picked up ${harness} ${sessionId} → ${result.session.id}\nOrigin file unchanged. ${result.eventCount} events imported. Fetch later with /native fetch`,
      }
    } catch (error) {
      return { type: 'text', value: error instanceof Error ? error.message : String(error) }
    }
  }

  if (cmd === 'export') {
    const sessionID = parts[1]?.startsWith('ses') ? parts[1] : getSessionId()
    const harness = parts[1]?.startsWith('ses') ? parts[2] : parts[1]
    if (!sessionID) return { type: 'text', value: 'Usage: /native export [ses_id] [harness]' }
    try {
      const result = await NativeSource.export(sessionID, harness)
      return {
        type: 'text',
        value: `Exported NEW ${result.harness} session ${result.sessionId}\n${result.resumeHint}\n${result.path}\nOrigin file was not modified.`,
      }
    } catch (error) {
      return { type: 'text', value: error instanceof Error ? error.message : String(error) }
    }
  }

  if (cmd === 'fetch') {
    const sessionID = parts[1] || getSessionId()
    if (!sessionID) return { type: 'text', value: 'No current session. Pass /native fetch <ses_id>' }
    try {
      const result = await NativeSource.fetch(sessionID)
      return {
        type: 'text',
        value: `Origin ${result.divergence}; fetched ${result.fetched} new native turns into session_source_event (Allternit turns unchanged).`,
      }
    } catch (error) {
      return { type: 'text', value: error instanceof Error ? error.message : String(error) }
    }
  }

  const harness = cmd !== 'list' ? cmd : undefined
  const sessions = listNativeSessions({ harnesses: harness ? [harness] : undefined }).slice(0, 30)
  if (sessions.length === 0) {
    return { type: 'text', value: 'No native CLI sessions found. /native harnesses to see adapters.' }
  }
  const lines = sessions.map((s) => {
    const when = s.updatedAt ? new Date(s.updatedAt > 1e12 ? s.updatedAt : s.updatedAt).toISOString() : ''
    return `${s.harness.padEnd(12)} ${s.sessionId}  ${s.title || s.cwd || ''}  ${when}`
  })
  return {
    type: 'text',
    value: `Native CLI sessions (newest first, 30 max)\nPickup: /native pickup <harness> <id>\n\n${lines.join('\n')}`,
  }
}
