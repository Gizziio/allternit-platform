/**
 * Agent-loop stub — Allternit does not port GenOffice's Genspark-bound AI
 * layer. Same interface as @genoffice/agent-core's AgentLoop so the vendored
 * UI compiles and behaves sanely: any run immediately reports the assistant
 * as unavailable and finishes.
 */

export interface AgentImage {
  base64: string
  mime?: string
}

export interface AgentToolCall {
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input?: any
}

export interface ToolDisplayItem {
  url: string
  title?: string
}

export interface ToolDisplay {
  kind?: 'images' | 'links' | 'text' | string
  title?: string
  items?: ToolDisplayItem[]
  text?: string
  [key: string]: unknown
}

export interface AgentToolDef {
  name: string
  [key: string]: unknown
}

export interface AgentToolExecution {
  output?: string
  isError?: boolean
  summary: string
  mutated: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  display?: any
}

export interface AgentSkill {
  id?: string
  tools: AgentToolDef[]
  buildContext?: () => string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  executeTool?: (call: any, ...rest: any[]) => any
  [key: string]: unknown
}

export interface AgentTransport {
  send(...args: unknown[]): Promise<unknown>
}

export function createIpcTransport<S>(_config: {
  onStream?: (listener: (chunk: unknown) => void) => () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  start?: (request: any) => Promise<void>
  cancel?: (requestId: string) => void
  getSettings?: () => S
  unknownErrorText?: () => string
  timeoutErrorText?: () => string
  creditsErrorText?: () => string
}): AgentTransport {
  return {
    send: () => Promise.reject(new Error('AI is not available in this build')),
  }
}

/**
 * Merge several skills into one (tool names must be globally unique).
 * `intro` becomes the shared preamble of the combined system prompt.
 * Mirrors @genoffice/agent-core's composeSkills.
 */
export function composeSkills(id: string, intro: string, skills: AgentSkill[]): AgentSkill {
  const owner = new Map<string, AgentSkill>()
  for (const skill of skills) {
    for (const tool of skill.tools ?? []) {
      if (owner.has(tool.name)) throw new Error(`duplicate tool name: ${tool.name}`)
      owner.set(tool.name, skill)
    }
  }
  return {
    id,
    systemPrompt: [
      intro,
      ...skills.map((s) => (typeof s.systemPrompt === 'string' ? s.systemPrompt : '')),
    ]
      .filter(Boolean)
      .join('\n\n'),
    tools: skills.flatMap((s) => s.tools ?? []),
    buildContext: () =>
      skills
        .map((s) => s.buildContext?.() ?? '')
        .filter(Boolean)
        .join('\n\n'),
    executeTool: (call: AgentToolCall, ...rest: unknown[]) => {
      const fn = owner.get(call.name)?.executeTool
      if (!fn) {
        return { output: `Unknown tool: ${call.name}`, isError: true, summary: call.name, mutated: false }
      }
      return (fn as (...args: unknown[]) => unknown)(call, ...rest)
    },
  }
}

interface AgentLoopEvents {
  onText?: (text: string) => void
  onToolStart?: (call: AgentToolCall) => void
  onToolExecuted?: (payload: { call: AgentToolCall; execution: AgentToolExecution }) => void
  onDone?: (result: { text: string; cancelled: boolean; turnLimit: boolean }) => void
  onTurnEnd?: (payload: unknown) => void
  onError?: (error: string) => void
}

// The real loop: streams the Allternit agent-chat endpoint (see
// @allternit/office-ai). Interface-compatible with the upstream AgentLoop.
export { OfficeAgentLoop as AgentLoop } from '@allternit/allternit-office-suite/ai' 
