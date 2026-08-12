// @ts-nocheck
import { feature } from 'bun:bundle'
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '@/Tool.js'
import { lazySchema } from '../../../shared/utils/lazySchema.js'
import { parseAddress } from '../../../shared/utils/peerAddress.js'
import { sendToUdsSocket } from '../../../shared/utils/udsClient.js'
import {
  getAgentName,
  getTeamName,
  getTeammateColor,
  isTeammate,
} from '../../../shared/utils/teammate.js'
import { TEAM_LEAD_NAME } from '../../../shared/utils/swarm/constants.js'
import { writeToMailbox } from '../../../shared/utils/teammateMailbox.js'
import { errorMessage } from '../../../shared/utils/errors.js'
import { truncate } from '../../../shared/utils/format.js'
import { jsonStringify } from '../../../shared/utils/slowOperations.js'
import {
  getAllternitApiConfig,
  sendApiPeerMessage,
} from '../../services/api/allternitApi.js'
import { SEND_MESSAGE_TOOL_NAME } from './constants.js'
import { DESCRIPTION, getPrompt } from './prompt.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    to: z
      .string()
      .describe(
        'Recipient: a Rails peer name discovered via ListPeers, a teammate name, "uds:/path/to.sock", or "bridge:session_id"',
      ),
    summary: z
      .string()
      .optional()
      .describe('A 5-10 word summary shown as a preview'),
    message: z.string().describe('Plain text message content'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    success: z.boolean(),
    message: z.string(),
    recipient: z.string(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>

export type Output = z.infer<OutputSchema>

async function sendToTeammate(
  recipientName: string,
  content: string,
  summary: string | undefined,
): Promise<Output> {
  const teamName = getTeamName()
  const senderName =
    getAgentName() || (isTeammate() ? 'teammate' : TEAM_LEAD_NAME)
  const senderColor = getTeammateColor()

  await writeToMailbox(
    recipientName,
    {
      from: senderName,
      text: content,
      summary,
      timestamp: new Date().toISOString(),
      color: senderColor,
    },
    teamName,
  )

  return {
    data: {
      success: true,
      message: `Message sent to teammate ${recipientName}`,
      recipient: recipientName,
    },
  }
}

async function sendToRailsPeer(
  name: string,
  content: string,
): Promise<Output> {
  const config = getAllternitApiConfig()
  const from = getAgentName() || 'gizzi'
  const response = await sendApiPeerMessage(config, name, content, from)
  if (response.delivered) {
    return {
      data: {
        success: true,
        message: `Message delivered to Rails peer ${name}`,
        recipient: name,
      },
    }
  }
  throw new Error(response.error || 'delivery failed')
}

export const SendMessageTool = buildTool({
  name: SEND_MESSAGE_TOOL_NAME,
  aliases: ['SendMessageToPeer'],
  searchHint: 'send messages to local agent peers or teammates',
  maxResultSizeChars: 100_000,
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return getPrompt()
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  userFacingName() {
    return 'SendMessage'
  },
  shouldDefer: true,
  isEnabled() {
    return true
  },
  isConcurrencySafe() {
    return true
  },
  isReadOnly() {
    return false
  },
  toAutoClassifierInput(input) {
    return `to ${input.to}: ${truncate(input.message, 50)}`
  },
  renderToolUseMessage() {
    return null
  },
  async validateInput(input) {
    if (input.to.trim().length === 0) {
      return { result: false, message: 'to must not be empty', errorCode: 9 }
    }
    if (input.message.trim().length === 0) {
      return {
        result: false,
        message: 'message must not be empty',
        errorCode: 9,
      }
    }
    return { result: true }
  },
  async call({ to, message, summary }) {
    const addr = parseAddress(to)

    if (addr.scheme === 'uds') {
      await sendToUdsSocket(addr.target, message)
      const preview = summary || truncate(message, 50)
      return {
        data: {
          success: true,
          message: `"${preview}" → ${to}`,
          recipient: to,
        },
      }
    }

    if (addr.scheme === 'bridge') {
      if (!feature('UDS_INBOX')) {
        throw new Error('bridge messaging is not enabled')
      }
      const { postInterClaudeMessage } = await import(
        '../../../../cli/ui/ink-app/bridge/peerSessions.js'
      )
      const result = await postInterClaudeMessage(addr.target, message)
      const preview = summary || truncate(message, 50)
      return {
        data: {
          success: result.ok,
          message: result.ok
            ? `"${preview}" → ${to}`
            : `Failed to send to ${to}: ${result.error ?? 'unknown'}`,
          recipient: to,
        },
      }
    }

    // Plain name: try Rails peer first, then teammate mailbox.
    const name = to
    try {
      return await sendToRailsPeer(name, message)
    } catch (railsError) {
      // If no Rails peer matches, this is likely a teammate name.
      try {
        return await sendToTeammate(name, message, summary)
      } catch (teammateError) {
        throw new Error(
          `Could not deliver to ${name}. Rails: ${errorMessage(railsError)}; Teammate: ${errorMessage(teammateError)}`,
        )
      }
    }
  },
  mapToolResultToToolResultBlockParam(content, toolUseID) {
    const { success, message, recipient } = content as Output
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: [
        {
          type: 'text',
          text: success
            ? `Sent to ${recipient}: ${message}`
            : `Failed to send to ${recipient}: ${message}`,
        },
      ],
    }
  },
} satisfies ToolDef<InputSchema, Output>)
