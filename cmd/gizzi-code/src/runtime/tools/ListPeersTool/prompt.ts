// @ts-nocheck
export const DESCRIPTION = 'List local agent peers registered with Rails'

export function getPrompt(): string {
  return `
# ListPeers

Discover local agent sessions on this machine that are registered with the Allternit Rails peer registry. Use this before calling SendMessage to find a recipient.

Returned peers include:
- name: human-readable addressable name
- vendor: agent family (gizzi, claude, kimi, codex, agy, ao)
- cwd: working directory
- status: active, idle, or dead
- inbox_socket: UDS socket path (can be used as a SendMessage target)

Filter by status or vendor if you only want active sessions or a specific agent family.
`.trim()
}
