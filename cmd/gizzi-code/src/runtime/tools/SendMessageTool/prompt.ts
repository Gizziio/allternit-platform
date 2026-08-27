// @ts-nocheck
import { feature } from 'bun:bundle'

export const DESCRIPTION = 'Send a message to another agent'

export function getPrompt(): string {
  const udsSection = feature('UDS_INBOX')
    ? `
## Cross-session messaging

Use ListPeers to discover local agents, then send a plain-text message by name:

\`\`\`json
{"to": "ao-researcher", "summary": "check test status", "message": "Do the tests pass in your session?"}
\`\`\`

You can also send directly to a UDS socket or a Remote Control bridge session:

\`\`\`json
{"to": "uds:/tmp/allternit-peers/peer_xxx.sock", "message": "hello"}
{"to": "bridge:session_01AbCd...", "message": "what branch are you on?"}
\`\`\`
`
    : ''

  return `
# SendMessage

Send a plain-text message to another agent.

\`\`\`json
{"to": "researcher", "summary": "assign task 1", "message": "start on task #1"}
\`\`\`

| \`to\` | |
|---|---|
| \`"peer-name"\` | Rails peer name discovered via ListPeers |
| \`"teammate-name"\` | Teammate by name (agent swarm) |${feature('UDS_INBOX') ? '\n| \`"uds:/path/to.sock"\` | Local peer UDS socket |\n| \`"bridge:session_id"\` | Remote Control peer session |' : ''}

Your plain text output is NOT visible to other agents — to communicate, you MUST call this tool.${udsSection}
`.trim()
}
