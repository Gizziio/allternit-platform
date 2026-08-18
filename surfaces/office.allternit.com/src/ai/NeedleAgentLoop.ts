import type {
  OfficeAgentLoop,
  OfficeAgentLoopEvents,
  OfficeAgentLoopOptions,
  OfficeToolExecution,
} from '@allternit/allternit-office-suite'
import { getNeedleEngine, loadNeedle } from './needleLoader'

interface ToolDefLike {
  name: string
  description?: string
  inputSchema?: unknown
}

interface NeedleCall {
  name: string
  arguments?: Record<string, unknown>
}

/**
 * Minimal agent loop backed by Cactus Needle via needle-rs.
 *
 * Needle is a 26M-parameter tool-calling model (≈14 MB weights) that runs
 * entirely in the browser. It routes a user query to one of the skill's
 * declared tools, executes it through the skill's executeTool handler, and
 * returns a short summary. It is intentionally simple: no multi-turn chat,
 * no streaming prose — just fast, private, on-device intent routing.
 */
export class NeedleAgentLoop implements OfficeAgentLoop {
  busy = false

  private readonly events: OfficeAgentLoopEvents
  private readonly skill?: OfficeAgentLoopOptions['skill']
  private readonly systemSuffix?: string | (() => string)
  private modelId?: string

  private cancelled = false
  private generation = 0

  constructor(options: OfficeAgentLoopOptions) {
    this.events = options.events ?? {}
    this.skill = options.skill
    this.systemSuffix = options.systemSuffix
    this.modelId = options.modelId
  }

  setModelId(modelId: string | undefined): void {
    this.modelId = modelId
  }

  reset(): void {
    this.generation++
    this.cancelled = false
    this.busy = false
  }

  restore(_messages: readonly { role: string; text: string }[]): void {
    // Needle is stateless/single-turn; history is not used.
  }

  cancel(): void {
    if (!this.busy) return
    this.cancelled = true
  }

  run(instruction: string, _images?: unknown[]): void {
    if (this.busy || !instruction.trim()) return
    this.busy = true
    this.cancelled = false
    const generation = ++this.generation
    void this.runInternal(generation, instruction.trim())
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

  private buildQuery(instruction: string): string {
    const parts: string[] = []
    if (typeof this.skill?.systemPrompt === 'string' && this.skill.systemPrompt.trim()) {
      parts.push(this.skill.systemPrompt.trim())
    }
    const suffix =
      typeof this.systemSuffix === 'function' ? this.systemSuffix() : this.systemSuffix
    if (typeof suffix === 'string' && suffix.trim()) parts.push(suffix)

    // If the skill exposes a buildContext function, prepend its output to the query.
    let context = ''
    try {
      const fn = this.skill?.buildContext
      if (typeof fn === 'function') {
        const value = (fn as () => unknown).call(this.skill)
        context = typeof value === 'string' ? value : ''
      }
    } catch {
      context = ''
    }

    const query = context ? `${instruction}\n\nContext:\n${context}` : instruction
    if (parts.length > 0) {
      return `${parts.join('\n\n')}\n\nUser request: ${query}`
    }
    return query
  }


  private async runInternal(generation: number, instruction: string): Promise<void> {
    try {
      this.events.onText?.('Loading local model…')
      await loadNeedle((progress) => {
        this.events.onText?.(progress.message)
      })
      if (generation !== this.generation || this.cancelled) {
        this.finishRun('', true)
        return
      }

      const engine = getNeedleEngine()
      if (!engine) {
        throw new Error('local model failed to initialize')
      }

      const tools = this.toolDefs()
      if (tools.length === 0) {
        this.events.onText?.('No tools available for this app.')
        this.finishRun('No tools available for this app.')
        return
      }

      const query = this.buildQuery(instruction)
      const toolsJson = JSON.stringify(
        tools.map((t) => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description ?? '',
            parameters: t.inputSchema ?? { type: 'object', properties: {} },
          },
        })),
      )

      this.events.onText?.('Thinking…')
      const result = engine.run(query, toolsJson)
      if (generation !== this.generation || this.cancelled) {
        this.finishRun('', true)
        return
      }

      let calls: NeedleCall[] = []
      try {
        const parsed = JSON.parse(result) as NeedleCall[] | NeedleCall | null | undefined
        if (Array.isArray(parsed)) calls = parsed
        else if (parsed && typeof parsed === 'object') calls = [parsed]
      } catch {
        calls = []
      }

      if (calls.length === 0) {
        const msg = 'I can perform actions in this document through the available tools. Try asking me to read, edit, or summarize.'
        this.events.onText?.(msg)
        this.finishRun(msg)
        return
      }

      const summaries: string[] = []
      for (const call of calls) {
        if (generation !== this.generation || this.cancelled) {
          this.finishRun('', true)
          return
        }
        this.events.onText?.(`Calling ${call.name}…`)
        this.events.onToolStart?.({ name: call.name, input: call.arguments })
        const execution = await this.executeTool(call)
        this.events.onToolExecuted?.({ call: { name: call.name, input: call.arguments }, execution })
        summaries.push(execution.summary)
      }

      const final = summaries.join('\n')
      this.events.onText?.(final)
      this.finishRun(final)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.events.onText?.(`Local model error: ${message}`)
      this.events.onError?.(message)
      this.busy = false
    }
  }

  private async executeTool(call: NeedleCall): Promise<OfficeToolExecution> {
    const fn = this.skill?.executeTool
    if (typeof fn !== 'function') {
      return {
        output: `No executeTool handler for ${call.name}`,
        isError: true,
        summary: call.name,
        mutated: false,
      }
    }
    try {
      const raw = await (fn as (c: { name: string; input?: unknown }) => unknown).call(
        this.skill,
        { name: call.name, input: call.arguments },
      )
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

  private finishRun(text: string, cancelled = false): void {
    this.busy = false
    this.events.onDone?.({ text, cancelled, turnLimit: false })
  }
}
