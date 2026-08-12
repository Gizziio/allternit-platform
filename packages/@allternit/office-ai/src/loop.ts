/**
 * OfficeAgentLoop — a real multi-turn agent loop for the vendored office
 * editors. Matches the @genoffice/agent-core AgentLoop interface the apps
 * construct (`new AgentLoop({ transport, skill, events, ... })`) but streams
 * through the Allternit agent-chat endpoint via streamOfficeAi.
 *
 * Tool calling — why it is prompt-driven here: the `/api/agent-chat` gateway
 * route (cmd/allternit-api/src/chat_routes.rs → gizzi_chat_stream.rs) only
 * forwards a single user message plus an optional system prompt to the Gizzi
 * runtime; there is no `tools` field on the request and no native tool_use
 * channel back. Tool execution therefore mirrors upstream GenOffice's
 * AgentLoop design (packages/agent-core/src/loop.ts) but with a text wire
 * protocol: the loop appends a tool-call protocol section + the skill's tool
 * catalog to the system prompt, the model emits tool calls as fenced
 * ```tool_call JSON blocks inside its text reply, the loop parses them,
 * executes them through the vendored skill's executeTool, feeds the results
 * back as a `[Tool results]` user message, and continues until the model
 * answers in plain text or maxTurns is hit. Native tool-call SSE chunks are
 * also honored if a future gateway emits them.
 */
import { streamOfficeAi, type OfficeAiMessage } from './stream'

interface ToolDisplayLike {
  kind?: string
  title?: string
  items?: { url: string; title?: string | undefined }[]
  text?: string
  [key: string]: unknown
}

export interface OfficeToolCall {
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input?: any
}

export interface OfficeToolExecution {
  output?: string
  isError?: boolean
  summary: string
  mutated?: boolean
  display?: ToolDisplayLike | undefined
}

export interface OfficeAgentLoopEvents {
  onText?: (text: string) => void
  onToolStart?: (call: { name: string; input?: unknown }) => void
  onToolExecuted?: (payload: {
    call: { name: string; input?: unknown }
    execution: OfficeToolExecution
  }) => void
  onDone?: (result: { text: string; cancelled: boolean; turnLimit: boolean }) => void
  onError?: (error: string) => void
  onTurnEnd?: (payload?: unknown) => void
}

interface OfficeAgentLoopOptions {
  events?: OfficeAgentLoopEvents
  /**
   * Skill descriptor, structurally compatible with the apps' vendored
   * AgentSkill (systemPrompt + tools + buildContext + executeTool). All
   * members are typed loosely so every app's stub AgentSkill (index-signature
   * based) assigns without casts; they are narrowed at runtime.
   */
  skill?: {
    systemPrompt?: unknown
    buildContext?: unknown
    tools?: unknown
    executeTool?: unknown
    [key: string]: unknown
  }
  systemSuffix?: string | (() => string)
  transport?: unknown
  /** Optional model override (provider/model); passed to /api/agent-chat as runtimeModelId */
  modelId?: string | undefined
  /** hard cap on model round-trips per run (default 8) */
  maxTurns?: number
  [key: string]: unknown
}

interface ToolDefLike {
  name: string
  description?: string
  inputSchema?: unknown
}

type HistoryEntry =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolCalls?: OfficeToolCall[] }
  | { role: 'tool'; results: { name: string; output: string; isError: boolean }[] }

const DEFAULT_MAX_TURNS = 8
/** Cap on consecutive tool-block parse failures; abort beyond it so the model can't burn turns on bad JSON */
const MAX_INPUT_PARSE_RETRIES = 3

const TURN_LIMIT_NOTE =
  '[System] The tool-call turn limit for this request has been reached; no more tools may be called this turn. ' +
  'Answer directly from the information already gathered; if the task is unfinished, briefly state what is done and what remains.'

const TOOL_BLOCK_RE = /```(?:tool_call|tool-call)\s*\n?([\s\S]*?)```/g
const JSON_BLOCK_RE = /```json\s*\n?([\s\S]*?)```/g

/** The text wire protocol appended to the system prompt when the skill ships tools. */
function buildToolProtocolSection(tools: readonly ToolDefLike[]): string {
  const catalog = tools
    .map((tool) => {
      const schema = tool.inputSchema === undefined ? '' : `\n  input schema: ${JSON.stringify(tool.inputSchema)}`
      return `- ${tool.name}: ${tool.description ?? '(no description)'}${schema}`
    })
    .join('\n')
  return (
    '# Tool calling protocol (IMPORTANT)\n' +
    'You operate this application THROUGH THE TOOLS LISTED BELOW. This environment has no native tool-call channel: ' +
    'to invoke a tool, output a fenced code block tagged tool_call containing one JSON object {"name": "<tool name>", "input": {...}}, e.g.\n\n' +
    '```tool_call\n{"name": "example_tool", "input": {"arg": "value"}}\n```\n\n' +
    'Rules:\n' +
    '- One block per call; several blocks in one reply execute in order.\n' +
    '- After emitting tool_call block(s), STOP writing and wait — the results come back as a user message starting with [Tool results]. Never write the results yourself.\n' +
    '- Text outside tool_call blocks is shown directly to the user; keep it brief.\n' +
    '- When the task needs no (further) tool, answer in plain text with no tool_call blocks.\n' +
    '- Only call tools from the list below; inputs must satisfy the given JSON schema.\n\n' +
    '# Available tools\n' +
    catalog
  )
}

/** Extract tool calls from the model's text reply (fenced tool_call blocks, with a ```json fallback for known tools). */
function parseToolCalls(
  raw: string,
  knownTools: ReadonlySet<string>,
): { calls: OfficeToolCall[]; errors: string[] } {
  const calls: OfficeToolCall[] = []
  const errors: string[] = []
  const tryPayload = (body: string, fromJsonFallback: boolean): void => {
    let parsed: unknown
    try {
      parsed = JSON.parse(body.trim())
    } catch (e) {
      if (!fromJsonFallback) {
        errors.push(
          `Tool input JSON failed to parse; the tool was not executed: ${e instanceof Error ? e.message : String(e)}\n` +
            'Fix the arguments (make sure quotes inside strings are escaped) and call again.',
        )
      }
      return
    }
    if (!parsed || typeof parsed !== 'object') return
    const obj = parsed as { name?: unknown; input?: unknown; arguments?: unknown }
    if (typeof obj.name !== 'string' || !obj.name.trim()) return
    if (fromJsonFallback && !knownTools.has(obj.name)) return
    calls.push({ name: obj.name, input: obj.input ?? obj.arguments ?? {} })
  }
  for (const match of raw.matchAll(TOOL_BLOCK_RE)) tryPayload(match[1] ?? '', false)
  if (calls.length === 0 && errors.length === 0) {
    for (const match of raw.matchAll(JSON_BLOCK_RE)) tryPayload(match[1] ?? '', true)
  }
  return { calls, errors }
}

/** The reply text shown to the user: tool_call blocks stripped, a trailing still-streaming fence hidden. */
function visibleText(raw: string): string {
  let out = raw.replace(TOOL_BLOCK_RE, '')
  out = out.replace(JSON_BLOCK_RE, (whole, body: string) => {
    // Strip ```json blocks that are really tool calls; keep genuine content.
    try {
      const parsed = JSON.parse(body.trim()) as { name?: unknown } | null
      if (parsed && typeof parsed === 'object' && typeof parsed.name === 'string') return ''
    } catch {
      /* genuine json content */
    }
    return whole
  })
  // Hide a trailing, not-yet-closed fence so the DSL never flashes in the panel
  // mid-stream; complete non-tool fences reappear once closed.
  const fences = out.split('```').length - 1
  if (fences % 2 === 1) out = out.slice(0, out.lastIndexOf('```'))
  return out.trim()
}

/**
 * Generic ReAct loop: user message -> model turn (text + tool calls) ->
 * execute tools -> feed results back -> repeat until the model answers with
 * plain text. History persists across runs, so follow-up questions work.
 */
export class OfficeAgentLoop {
  busy = false
  private readonly events: OfficeAgentLoopEvents
  private readonly skill?: OfficeAgentLoopOptions['skill']
  private readonly systemSuffix: string | (() => string) | undefined
  private modelId: string | undefined
  private readonly maxTurns: number
  private history: HistoryEntry[] = []
  private abort: AbortController | null = null
  private cancelled = false
  private finalizing = false
  private turns = 0
  private inputParseFails = 0
  /** user entry of the in-flight run; a failed run rolls it (and everything after) back out of history */
  private runUserEntry: HistoryEntry | null = null
  /** invalidates stale async continuations after reset */
  private generation = 0

  constructor(options: OfficeAgentLoopOptions) {
    this.events = options.events ?? {}
    this.skill = options.skill
    this.systemSuffix = options.systemSuffix
    this.modelId = options.modelId
    this.maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS
  }

  run(instruction: string, _images?: unknown[]): void {
    if (this.busy || !instruction.trim()) return
    this.busy = true
    this.cancelled = false
    this.finalizing = false
    this.turns = 0
    this.inputParseFails = 0
    this.abort = new AbortController()
    void this.beginRun(instruction)
  }

  cancel(): void {
    if (!this.busy) return
    this.cancelled = true
    this.abort?.abort()
  }

  /** Update the model override at runtime (e.g. when the user picks a different model). */
  setModelId(modelId: string | undefined): void {
    this.modelId = modelId
  }

  /** drop the conversation (e.g. when a different document is opened) */
  reset(): void {
    this.generation++
    this.cancelled = false
    this.abort?.abort()
    this.abort = null
    this.busy = false
    this.history = []
    this.runUserEntry = null
  }

  /**
   * Seed the conversation with restored history (e.g. transcript reloaded when
   * a document reopens), so follow-up instructions keep their context.
   */
  restore(messages: readonly { role: string; text: string }[]): void {
    if (this.busy) return
    this.history = messages
      .filter((m) => m && typeof m.text === 'string')
      .map((m) => ({ role: m.role === 'user' ? ('user' as const) : ('assistant' as const), text: m.text }))
  }

  private toolDefs(): ToolDefLike[] {
    const raw = this.skill?.tools
    if (!Array.isArray(raw)) return []
    return raw
      .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
      .filter((t) => typeof t.name === 'string' && t.name.length > 0)
      .map((t) => ({
        name: t.name as string,
        ...(typeof t.description === 'string' ? { description: t.description } : {}),
        ...(t.inputSchema !== undefined ? { inputSchema: t.inputSchema } : {}),
      }))
  }

  private buildSystemPrompt(): string {
    const parts: string[] = []
    if (typeof this.skill?.systemPrompt === 'string' && this.skill.systemPrompt.trim()) {
      parts.push(this.skill.systemPrompt)
    }
    const tools = this.toolDefs()
    if (tools.length > 0) parts.push(buildToolProtocolSection(tools))
    const suffix =
      typeof this.systemSuffix === 'function' ? this.systemSuffix() : this.systemSuffix
    if (typeof suffix === 'string' && suffix.trim()) parts.push(suffix)
    return parts.join('\n\n')
  }

  private buildContext(): string {
    try {
      const fn = this.skill?.buildContext
      if (typeof fn !== 'function') return ''
      const value = (fn as () => unknown).call(this.skill)
      return typeof value === 'string' ? value : ''
    } catch {
      return '' // context is best-effort
    }
  }

  /** Serialize history for the wire: tool results ride as a [Tool results] user message. */
  private toWireMessages(): OfficeAiMessage[] {
    const out: OfficeAiMessage[] = []
    for (const entry of this.history) {
      if (entry.role === 'tool') {
        const text = entry.results
          .map((r) => `--- ${r.name}${r.isError ? ' (failed)' : ''} ---\n${r.output}`)
          .join('\n')
        out.push({ role: 'user', content: `[Tool results]\n${text}` })
      } else {
        out.push({ role: entry.role, content: entry.text })
      }
    }
    return out
  }

  private rollbackFailedRun(): void {
    const entry = this.runUserEntry
    this.runUserEntry = null
    if (!entry) return
    const i = this.history.lastIndexOf(entry)
    if (i >= 0) this.history.splice(i)
  }

  private async executeSkillTool(call: OfficeToolCall): Promise<OfficeToolExecution> {
    const fn = this.skill?.executeTool
    if (typeof fn !== 'function') {
      return {
        output: `This skill cannot execute tools (no executeTool): ${call.name}`,
        isError: true,
        summary: call.name,
        mutated: false,
      }
    }
    try {
      const raw = await (
        fn as (c: OfficeToolCall, s?: AbortSignal) => unknown
      ).call(this.skill, call, this.abort?.signal)
      const exec = (raw ?? {}) as Partial<OfficeToolExecution>
      return {
        output: exec.output === undefined || exec.output === null ? '' : String(exec.output),
        isError: !!exec.isError,
        summary: typeof exec.summary === 'string' && exec.summary ? exec.summary : call.name,
        mutated: !!exec.mutated,
        display: exec.display,
      }
    } catch (e) {
      return {
        output: e instanceof Error ? e.message : String(e),
        isError: true,
        summary: call.name,
        mutated: false,
      }
    }
  }

  private async beginRun(instruction: string): Promise<void> {
    const generation = this.generation
    const context = this.buildContext()
    // Leftover unanswered user message (a previous run failed before replying):
    // drop it so the model never sees two adjacent user turns as one combined instruction
    while (this.history.at(-1)?.role === 'user') this.history.pop()
    const userMsg: HistoryEntry = {
      role: 'user',
      text: context ? `${instruction}\n\n${context}` : instruction,
    }
    this.runUserEntry = userMsg
    this.history.push(userMsg)
    await this.runLoop(generation)
  }

  private finishRun(result: { text: string; cancelled: boolean; turnLimit: boolean }): void {
    this.busy = false
    this.abort = null
    this.runUserEntry = null
    this.events.onDone?.(result)
  }

  private failRun(error: string): void {
    this.busy = false
    this.abort = null
    this.rollbackFailedRun()
    this.events.onError?.(error)
  }

  private async runLoop(generation: number): Promise<void> {
    for (;;) {
      if (generation !== this.generation) return
      if (this.cancelled) {
        this.finishRun({ text: '', cancelled: true, turnLimit: false })
        return
      }

      const system = this.buildSystemPrompt()
      const messages: OfficeAiMessage[] = [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        ...this.toWireMessages(),
      ]

      let raw = ''
      let streamError: string | null = null
      const nativeCalls: OfficeToolCall[] = []
      await streamOfficeAi({
        messages,
        ...(this.modelId ? { modelId: this.modelId } : {}),
        ...(this.abort ? { signal: this.abort.signal } : {}),
        onChunk: (chunk) => {
          if (generation !== this.generation) return
          if (chunk.type === 'delta' && chunk.text) {
            raw += chunk.text
            this.events.onText?.(visibleText(raw))
          } else if (chunk.type === 'tool-call' && chunk.toolCall) {
            nativeCalls.push({ name: chunk.toolCall.toolName, input: chunk.toolCall.input })
          } else if (chunk.type === 'error' && chunk.error) {
            streamError = chunk.error
          }
        },
      })
      if (generation !== this.generation) return

      const text = visibleText(raw)
      if (streamError && !raw && nativeCalls.length === 0) {
        this.failRun(streamError)
        return
      }
      if (this.cancelled) {
        if (text) this.history.push({ role: 'assistant', text })
        this.finishRun({ text, cancelled: true, turnLimit: false })
        return
      }

      // The finalizing turn (after the turn limit) gets no tools: ignore any
      // blocks the model still emits and take its text as the partial answer.
      const parsed = this.finalizing
        ? { calls: [], errors: [] }
        : parseToolCalls(raw, new Set(this.toolDefs().map((t) => t.name)))
      const calls = [...nativeCalls, ...parsed.calls]

      if (calls.length === 0 && parsed.errors.length === 0) {
        this.history.push({ role: 'assistant', text })
        this.finishRun({ text, cancelled: false, turnLimit: this.finalizing })
        return
      }

      this.history.push({ role: 'assistant', text: raw, toolCalls: calls })

      const results: { name: string; output: string; isError: boolean }[] = []
      for (const call of calls) {
        // The user hit stop while an earlier tool was running: skip remaining tools,
        // but fill in paired error results so the transcript stays coherent.
        if (this.cancelled) {
          results.push({
            name: call.name,
            output: '(the user stopped the run; this tool was not executed)',
            isError: true,
          })
          continue
        }
        this.events.onToolStart?.(call)
        const execution = await this.executeSkillTool(call)
        if (generation !== this.generation) return // reset while a tool was running
        results.push({
          name: call.name,
          output: execution.output ?? '',
          isError: !!execution.isError,
        })
        this.events.onToolExecuted?.({ call, execution })
      }
      for (const error of parsed.errors) {
        this.inputParseFails++
        results.push({ name: 'tool_call', output: error, isError: true })
        this.events.onToolExecuted?.({
          call: { name: 'tool_call' },
          execution: { output: error, isError: true, summary: 'tool_call', mutated: false },
        })
      }
      this.history.push({ role: 'tool', results })

      if (this.cancelled) {
        this.finishRun({ text, cancelled: true, turnLimit: false })
        return
      }

      // Bad-input retries hit the cap: abort instead of burning more turns
      if (this.inputParseFails >= MAX_INPUT_PARSE_RETRIES) {
        this.failRun(
          `Tool input was unusable (unparseable) ${MAX_INPUT_PARSE_RETRIES} times in a row; retries stopped, please send the request again`,
        )
        return
      }

      this.turns++
      if (this.turns >= this.maxTurns && !this.finalizing) {
        // Don't throw away the context already gathered: one no-tools turn for a partial answer
        this.finalizing = true
        this.history.push({ role: 'user', text: TURN_LIMIT_NOTE })
      }
      this.events.onTurnEnd?.()
    }
  }
}
