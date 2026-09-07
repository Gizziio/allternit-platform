// @ts-nocheck
import type {
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
} from '../../types/command.js'
import { registerRailsPeer } from '@/runtime/gizzi-core/services/railsPeer.js'
import {
  buildForkedMessages,
  buildWorktreeNotice,
  FORK_AGENT,
} from '../../tools/AgentTool/forkSubagent.js'
import { runAgent } from '../../tools/AgentTool/runAgent.js'
import { getCwd } from '../../utils/cwd.js'
import { logForDebugging } from '../../utils/debug.js'
import { extractResultText } from '../../utils/forkedAgent.js'
import { logError } from '../../utils/log.js'
import { enqueuePendingNotification } from '../../utils/messageQueueManager.js'
import { createUserMessage, getLastAssistantMessage } from '../../utils/messages.js'
import { createAgentId } from '../../utils/uuid.js'
import { createAgentWorktree } from '../../utils/worktree.js'
import type { Message } from '../../types/message.js'

const DEFAULT_DIRECTIVE =
  'Continue from where the parent left off. Handle any outstanding work, then report.'

type ForkArgs = {
  useWorktree: boolean
  directive: string
}

// Exported for tests: parses [--worktree|--no-worktree] [directive].
export function parseForkArgs(args: string): ForkArgs {
  let useWorktree = false
  const tokens = String(args ?? '').trim().split(/\s+/).filter(Boolean)
  const rest: string[] = []
  for (const token of tokens) {
    if (token === '--worktree') {
      useWorktree = true
    } else if (token === '--no-worktree') {
      useWorktree = false
    } else {
      rest.push(token)
    }
  }
  return { useWorktree, directive: rest.join(' ') }
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
  args: string,
): Promise<null> {
  const { useWorktree, directive } = parseForkArgs(args)

  const messages = context.getAppState().messages ?? []
  const lastAssistant = getLastAssistantMessage(messages)
  if (!lastAssistant) {
    onDone(
      'Nothing to fork yet — this session has no assistant message to branch from.',
      { display: 'system' },
    )
    return null
  }

  const childAgentId = createAgentId()

  let promptMessages: Message[] = buildForkedMessages(
    directive || DEFAULT_DIRECTIVE,
    lastAssistant,
  )

  let worktreePath: string | undefined
  if (useWorktree) {
    const slug = `agent-${childAgentId.slice(0, 8)}`
    try {
      const worktreeInfo = await createAgentWorktree(slug)
      worktreePath = worktreeInfo.worktreePath
      // Prepend (after the fork directive) so it reads as the most recent
      // guidance — mirrors AgentTool's fork+worktree wiring.
      promptMessages = [
        ...promptMessages,
        createUserMessage({
          content: buildWorktreeNotice(getCwd(), worktreePath),
        }),
      ]
    } catch (error) {
      onDone(
        `Failed to create worktree: ${error instanceof Error ? error.message : String(error)}`,
        { display: 'system' },
      )
      return null
    }
  }

  const canUseTool =
    context.canUseTool ??
    (((_tool, input) => ({
      behavior: 'allow',
      updatedInput: input,
    })) as NonNullable<LocalJSXCommandContext['canUseTool']>)

  // Register the child as a Rails peer so the parent (and other local
  // agents) can discover and message it via ListPeers/SendMessage.
  // Best-effort: fork still works when Rails is disabled/unreachable.
  try {
    await registerRailsPeer(childAgentId)
  } catch (error) {
    logForDebugging(
      `Failed to register fork peer with Rails: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const peerName = `gizzi-${childAgentId}`

  // Spawn the background peer. Fire-and-forget: onDone resolves the slash
  // command immediately; the completion report re-enters the queue as a
  // hidden (isMeta) prompt, same pattern as executeForkedSlashCommand's
  // assistant-mode path.
  void (async () => {
    const agentMessages: Message[] = []
    for await (const message of runAgent({
      agentDefinition: FORK_AGENT,
      promptMessages,
      toolUseContext: context,
      canUseTool,
      isAsync: true,
      querySource: 'agent:custom',
      availableTools: context.options.tools,
      override: {
        agentId: childAgentId,
        systemPrompt: context.renderedSystemPrompt,
      },
      // Fork path: byte-identical API request prefix with the parent for
      // prompt-cache hits (mirrors AgentTool's isForkPath wiring).
      useExactTools: true,
      forkContextMessages: context.messages,
      worktreePath,
    })) {
      agentMessages.push(message)
    }
    const resultText = extractResultText(agentMessages, 'Fork completed')
    logForDebugging(`Fork peer ${peerName} completed (agent ${childAgentId})`)
    enqueuePendingNotification({
      value: `<fork-result agent="${peerName}">\n${resultText}\n</fork-result>`,
      mode: 'prompt',
      priority: 'later',
      isMeta: true,
      skipSlashCommands: true,
    })
  })().catch(error => {
    logError(error)
    enqueuePendingNotification({
      value: `<fork-result agent="${peerName}" status="failed">\n${error instanceof Error ? error.message : String(error)}\n</fork-result>`,
      mode: 'prompt',
      priority: 'later',
      isMeta: true,
      skipSlashCommands: true,
    })
  })

  onDone(
    `Forked background peer ${peerName} (agent ${childAgentId}).` +
      (worktreePath ? ` Working in worktree: ${worktreePath}.` : '') +
      ' It inherits this conversation and will report back when done.',
    { display: 'system' },
  )
  return null
}
