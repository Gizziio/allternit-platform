// @ts-nocheck
import { isCanonicalBotSession } from '@/runtime/bots/canonical-chat'
import { getSessionId } from '../../bootstrap/state'
import type { LocalCommandCall } from '../../types/command'
import { clearConversation } from './conversation'

export const call: LocalCommandCall = async (_, context) => {
  // Bot Mode composer guard (D2): /new, /reset and /clear all resolve to this
  // command, which regenerates the session id and would fork the bot's
  // pinned relationship. Inside a canonical bot chat, reroute to /compact so
  // the conversation is summarized in place and the pinned session keeps its
  // identity (the pointer never dangles).
  if (await isCanonicalBotSession(getSessionId())) {
    const { call: compact } = await import('../compact/compact.js')
    const result = await compact(_, context)
    const note =
      "This is a bot's canonical chat — /new would fork the relationship, so this was rerouted to /compact (Bot Mode, D2).\n"
    if (result && typeof result === 'object' && 'displayText' in result) {
      result.displayText = note + result.displayText
    }
    return result
  }
  await clearConversation(context)
  return { type: 'text', value: '' }
}
