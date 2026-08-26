// @ts-nocheck
import { LIST_PEERS_TOOL_NAME } from './constants.js'

export { LIST_PEERS_TOOL_NAME }

export const DESCRIPTION = 'List discoverable agent peers'

export const PROMPT = `
# ListPeers

Return all agent sessions visible to Rails: local gizzi-code sessions, mux sessions, and explicitly-registered peers.

Each peer has:
- \`peer_id\`: use this as the \`to\` field in SendMessage
- \`display_name\`: human-readable label
- \`address\`: \`uds:<socket>\` or \`bridge:<session>\`
- \`kind\`: gizzi, claude, kimi, codex, mux, executor, human
- \`cwd\`: working directory

Call this before SendMessage when you need to discover a target.
`.trim()
