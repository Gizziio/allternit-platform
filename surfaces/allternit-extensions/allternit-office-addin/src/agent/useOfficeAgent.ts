import { useCallback, useEffect, useRef, useState } from 'react'
import { officeStorage } from '@/lib/storage'
import { loadPlugin, buildPluginSystemPromptPrefix } from '@/lib/plugin-loader'
import { extractCode, executeCode, executeWithRetry, type RetryContext } from '@/lib/code-executor'
import { getToolsForHost, mergeToolCallDelta, finalizeToolCalls, type OpenAITool, type ParsedToolCall } from '@/lib/tool-schemas'
import { buildToolCallCode, describeToolCall, validateToolCall } from '@/lib/tool-dispatcher'
import { checkToolRequirement } from '@/lib/tool-requirements'

// ── Types ────────────────────────────────────────────────────────────────────

export type OfficeAgentStatus = 'idle' | 'running' | 'completed' | 'error'

export interface OfficeAgentConfig {
  apiKey: string
  baseURL: string
  model: string
  maxSteps?: number
  systemInstruction?: string
  language?: 'en' | 'zh'
}

export type OfficeAgentActivity =
  | { type: 'thinking' }
  | { type: 'streaming'; text: string }
  | { type: 'executing'; tool: string; input?: unknown }
  | { type: 'executed'; tool: string; output?: string; duration?: number }
  | { type: 'awaiting_approval'; tool: string; input?: unknown }
  | { type: 'error'; message: string }

export interface PendingToolApproval {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export type OfficeAgentHistoricalEvent =
  | { type: 'user'; content: string }               // user message (for multi-turn)
  | { type: 'step'; content: string; rawResponse?: unknown }
  | { type: 'observation'; content: string }
  | {
      type: 'tool_execution'
      id: string
      tool: string
      description: string
      input: unknown
      output?: string
      status: 'pending' | 'awaiting_approval' | 'running' | 'completed' | 'error' | 'rejected'
      duration?: number
    }
  | { type: 'error'; message: string }

/** Extended API message type that covers tool-use roles */
type ApiMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: AssistantToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string }

interface AssistantToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

/** Return type from callAI — both text content and any structured tool calls */
interface AIResponse {
  content: string
  toolCalls: ParsedToolCall[]
}

const DEFAULT_CONFIG: OfficeAgentConfig = {
  apiKey: '',
  baseURL: '',
  model: 'claude-sonnet-4-6',
  language: 'en',
}

const STORAGE_KEY = 'allternit-office-config'
const HISTORY_STORAGE_KEY = 'allternit-office-history'

export interface UsageStats {
  apiCalls: number
  toolCallsExecuted: number
  totalDurationMs: number
}

export interface UseOfficeAgentResult {
  status: OfficeAgentStatus
  history: OfficeAgentHistoricalEvent[]
  activity: OfficeAgentActivity | null
  currentTask: string
  config: OfficeAgentConfig | null
  pendingApprovals: PendingToolApproval[]
  usage: UsageStats
  execute: (task: string, context: string) => Promise<void>
  stop: () => void
  clearHistory: () => void
  configure: (config: OfficeAgentConfig) => Promise<void>
  approveTool: (toolCallId: string) => void
  rejectTool: (toolCallId: string) => void
}

// ── Hook ─────────────────────────────────────────────────────────────────────

// Tools that can mutate or destroy document content and require user approval
const DESTRUCTIVE_TOOLS = new Set([
  'excel_write_range',
  'excel_delete_rows',
  'excel_add_worksheet',
  'excel_apply_format',
  'excel_create_table',
  'excel_add_data_validation',
  'word_insert_text',
  'word_replace_text',
  'word_insert_table',
  'word_fill_content_control',
  'word_set_track_changes',
  'ppt_write_slide_text',
  'ppt_add_slide',
  'ppt_delete_slide',
  'ppt_add_textbox',
  'ppt_set_notes',
])

function isDestructiveTool(name: string): boolean {
  return DESTRUCTIVE_TOOLS.has(name)
}

export function useOfficeAgent(): UseOfficeAgentResult {
  const [status, setStatus] = useState<OfficeAgentStatus>('idle')
  const [history, setHistory] = useState<OfficeAgentHistoricalEvent[]>([])
  const [activity, setActivity] = useState<OfficeAgentActivity | null>(null)
  const [currentTask, setCurrentTask] = useState('')
  const [config, setConfig] = useState<OfficeAgentConfig | null>(null)
  const [pendingApprovals, setPendingApprovals] = useState<PendingToolApproval[]>([])
  const [usage, setUsage] = useState<UsageStats>({ apiCalls: 0, toolCallsExecuted: 0, totalDurationMs: 0 })
  const abortRef = useRef<AbortController | null>(null)
  // Mirror history into a ref so execute() (useCallback) can read current
  // history without adding it to deps and re-creating the function.
  const historyRef = useRef<OfficeAgentHistoricalEvent[]>([])
  // Approval resolvers keyed by tool_call id
  const approvalResolversRef = useRef<Map<string, (approved: boolean) => void>>(new Map())

  useEffect(() => {
    historyRef.current = history
  }, [history])

  // Persist history to storage (debounced)
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void officeStorage.set(HISTORY_STORAGE_KEY, history)
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [history])

  useEffect(() => {
    officeStorage.get<OfficeAgentConfig>(STORAGE_KEY).then((saved) => {
      setConfig(saved ?? DEFAULT_CONFIG)
    })
    officeStorage.get<OfficeAgentHistoricalEvent[]>(HISTORY_STORAGE_KEY).then((saved) => {
      if (saved && saved.length > 0) setHistory(saved)
    })
  }, [])

  const configure = useCallback(async (nextConfig: OfficeAgentConfig) => {
    await officeStorage.set(STORAGE_KEY, nextConfig)
    setConfig(nextConfig)
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setStatus('idle')
    setActivity(null)
    // Reject any pending approvals so the loop can exit
    for (const [, resolve] of approvalResolversRef.current) {
      resolve(false)
    }
    approvalResolversRef.current.clear()
    setPendingApprovals([])
  }, [])

  /** Check whether the current execution has been stopped by the user. */
  const isAborted = useCallback(() => {
    return abortRef.current?.signal.aborted ?? false
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    void officeStorage.set(HISTORY_STORAGE_KEY, [])
  }, [])

  const approveTool = useCallback((toolCallId: string) => {
    const resolve = approvalResolversRef.current.get(toolCallId)
    if (resolve) {
      resolve(true)
      approvalResolversRef.current.delete(toolCallId)
      setPendingApprovals((prev) => prev.filter((p) => p.id !== toolCallId))
    }
  }, [])

  const rejectTool = useCallback((toolCallId: string) => {
    const resolve = approvalResolversRef.current.get(toolCallId)
    if (resolve) {
      resolve(false)
      approvalResolversRef.current.delete(toolCallId)
      setPendingApprovals((prev) => prev.filter((p) => p.id !== toolCallId))
    }
  }, [])

  // ── Core streaming fetch ──────────────────────────────────────────────────

  /**
   * Sends a request to the OpenAI-compatible completions endpoint and streams
   * the response. Handles both plain text delta chunks and tool_call deltas.
   *
   * Returns the full text content and any structured tool calls extracted from
   * the stream.
   */
  const callAI = useCallback(
    async (
      messages: ApiMessage[],
      tools: OpenAITool[],
      onDelta?: (delta: string) => void,
    ): Promise<AIResponse> => {
      if (!config?.baseURL || !config?.apiKey) {
        throw new Error('API key and base URL must be configured.')
      }

      const body: Record<string, unknown> = {
        model: config.model,
        stream: true,
        max_tokens: 4096,
        messages,
      }
      if (tools.length > 0) {
        body['tools'] = tools
        body['tool_choice'] = 'auto'
      }

      const response = await fetch(`${config.baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        signal: abortRef.current?.signal,
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error(`API error ${response.status}: ${await response.text()}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body from API.')

      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''
      // Indexed by the delta's `index` field so partial tool calls can be assembled
      const toolCallAccum = new Map<number, import('@/lib/tool-schemas').ToolCallAccumulator>()
      const streamStartTime = Date.now()
      const STREAM_TIMEOUT_MS = 60000

      while (true) {
        if (isAborted()) {
          reader.cancel().catch(() => {})
          throw new DOMException('Execution stopped by user.', 'AbortError')
        }
        if (Date.now() - streamStartTime > STREAM_TIMEOUT_MS) {
          reader.cancel().catch(() => {})
          throw new Error('Streaming response timed out after 60 seconds.')
        }
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const chunk = JSON.parse(data) as {
              choices: Array<{
                delta: {
                  content?: string
                  tool_calls?: Array<{
                    index?: number
                    id?: string
                    type?: string
                    function?: { name?: string; arguments?: string }
                  }>
                }
              }>
            }
            const delta = chunk.choices[0]?.delta

            // Accumulate plain text content
            const textDelta = delta?.content ?? ''
            if (textDelta) {
              fullContent += textDelta
              onDelta?.(textDelta)
            }

            // Accumulate tool call fragments
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                mergeToolCallDelta(toolCallAccum, tc)
              }
            }
          } catch {
            // skip malformed SSE chunks
          }
        }
      }

      return {
        content: fullContent,
        toolCalls: finalizeToolCalls(toolCallAccum),
      }
    },
    [config],
  )

  // ── Execute ───────────────────────────────────────────────────────────────

  const execute = useCallback(
    async (task: string, context: string) => {
      if (!config?.baseURL || !config?.apiKey) {
        setStatus('error')
        setHistory((prev) => [
          ...prev,
          { type: 'error', message: 'Configure API key and base URL first.' },
        ])
        return
      }

      abortRef.current = new AbortController()
      setStatus('running')
      setCurrentTask(task)
      setActivity({ type: 'thinking' })
      setPendingApprovals([])
      setUsage({ apiCalls: 0, toolCallsExecuted: 0, totalDurationMs: 0 })

      // Append user message to history for multi-turn display
      setHistory((prev) => [...prev, { type: 'user', content: task }])

      const executionStart = performance.now()
      let apiCalls = 0
      let toolCallsExecuted = 0

      try {
        // Build system prompt: plugin prefix + document context + custom instruction
        const systemPrompt = buildSystemPrompt(context, config)

        // Build multi-turn message history from accumulated events
        const historyMessages: ApiMessage[] = historyRef.current.flatMap((event): ApiMessage[] => {
          if (event.type === 'user') return [{ role: 'user', content: event.content }]
          if (event.type === 'step') return [{ role: 'assistant', content: event.content }]
          return []
        })

        const plugin = loadPlugin()
        const maxRetries = plugin?.executionConfig.errorRecovery.maxRetries ?? 2
        const tools = getToolsForHost()

        // Agentic tool-use loop: run until the model produces a final text response
        // or the step limit is reached. Each iteration may produce tool calls that
        // get executed and fed back as tool messages before the next AI turn.
        const MAX_TOOL_STEPS = config?.maxSteps ?? 10
        const messages: ApiMessage[] = [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content: task },
        ]

        let finalContent = ''
        let stepCount = 0

        while (stepCount < MAX_TOOL_STEPS) {
          if (isAborted()) throw new DOMException('Execution stopped by user.', 'AbortError')
          stepCount++
          setActivity({ type: 'thinking' })

          const { content, toolCalls } = await callAI(
            messages,
            tools,
            (delta) =>
              setActivity((prev) =>
                prev?.type === 'streaming'
                  ? { type: 'streaming', text: prev.text + delta }
                  : { type: 'streaming', text: delta },
              ),
          )
          apiCalls++

          // Capture ANY text the model emits — both from tool-call turns (thinking
          // aloud) and the final text-only turn. Concatenate across iterations.
          if (content) {
            finalContent = finalContent ? `${finalContent}\n\n${content}` : content
          }

          if (toolCalls.length === 0) {
            // Model produced no tool calls — this turn is the final answer
            break
          }

          // Append the assistant turn with its tool calls to the message chain
          messages.push({
            role: 'assistant',
            content: content || null,
            tool_calls: toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
            })),
          })

          // Emit pending tool_execution history events for each tool call
          for (const toolCall of toolCalls) {
            setHistory((prev) => [
              ...prev,
              {
                type: 'tool_execution',
                id: toolCall.id,
                tool: toolCall.name,
                description: describeToolCall(toolCall.name, toolCall.arguments),
                input: toolCall.arguments,
                status: 'pending',
              },
            ])
          }

          // Execute each tool call and append the results as tool messages
          for (const toolCall of toolCalls) {
            if (isAborted()) throw new DOMException('Execution stopped by user.', 'AbortError')

            // Helper to update a tool_execution event by id
            const updateToolStatus = (
              status: OfficeAgentHistoricalEvent & { type: 'tool_execution' } extends { status: infer S } ? S : never,
              extra?: Partial<Extract<OfficeAgentHistoricalEvent, { type: 'tool_execution' }>>,
            ) => {
              setHistory((prev) =>
                prev.map((e) =>
                  e.type === 'tool_execution' && e.id === toolCall.id
                    ? { ...e, status, ...extra }
                    : e,
                ),
              )
            }

            // Validate required arguments are present and non-empty
            const validation = validateToolCall(toolCall)
            if (!validation.valid) {
              const errMsg = `Invalid tool call: ${validation.errors.join(', ')}`
              setActivity({ type: 'error', message: errMsg })
              updateToolStatus('error', { output: errMsg })
              messages.push({
                role: 'tool',
                content: errMsg,
                tool_call_id: toolCall.id,
              })
              continue
            }

            toolCallsExecuted++

            // Check if this tool requires user approval
            if (isDestructiveTool(toolCall.name)) {
              setActivity({ type: 'awaiting_approval', tool: toolCall.name, input: toolCall.arguments })
              updateToolStatus('awaiting_approval')
              setPendingApprovals((prev) => [
                ...prev,
                { id: toolCall.id, name: toolCall.name, arguments: toolCall.arguments },
              ])

              const approved = await new Promise<boolean>((resolve) => {
                approvalResolversRef.current.set(toolCall.id, resolve)
              })

              if (isAborted()) throw new DOMException('Execution stopped by user.', 'AbortError')

              if (!approved) {
                const rejectionMsg = `Tool "${toolCall.name}" was rejected by user.`
                setActivity({ type: 'error', message: rejectionMsg })
                updateToolStatus('rejected', { output: rejectionMsg })
                messages.push({
                  role: 'tool',
                  content: rejectionMsg,
                  tool_call_id: toolCall.id,
                })
                continue
              }
            }

            // Check Office API requirements before generating code
            const reqCheck = checkToolRequirement(toolCall.name)
            if (!reqCheck.supported) {
              const errMsg = `Unsupported: ${reqCheck.message}`
              setActivity({ type: 'error', message: errMsg })
              updateToolStatus('error', { output: errMsg })
              messages.push({
                role: 'tool',
                content: errMsg,
                tool_call_id: toolCall.id,
              })
              continue
            }

            if (isAborted()) throw new DOMException('Execution stopped by user.', 'AbortError')

            setActivity({ type: 'executing', tool: toolCall.name, input: toolCall.arguments })
            updateToolStatus('running')

            let toolResult: string
            let toolDuration = 0
            try {
              const code = buildToolCallCode(toolCall)
              const execStart = performance.now()
              const execResult = await executeCode(code)
              toolDuration = Math.round(performance.now() - execStart)
              if (execResult.success) {
                toolResult = typeof execResult.output === 'string'
                  ? execResult.output
                  : JSON.stringify(execResult.output ?? null)
                setActivity({ type: 'executed', tool: toolCall.name, output: toolResult, duration: toolDuration })
                updateToolStatus('completed', { output: toolResult, duration: toolDuration })
              } else {
                toolResult = `Error: ${execResult.error?.message ?? 'Unknown error'}`
                setActivity({ type: 'error', message: toolResult })
                updateToolStatus('error', { output: toolResult })
              }
            } catch (err) {
              toolResult = `Error: ${err instanceof Error ? err.message : String(err)}`
              setActivity({ type: 'error', message: toolResult })
              updateToolStatus('error', { output: toolResult })
            }

            messages.push({
              role: 'tool',
              content: toolResult,
              tool_call_id: toolCall.id,
            })
          }
        }

        // If we exited the loop without a final text response (hit max steps),
        // ask the model to summarize what it did
        if (!finalContent && stepCount >= MAX_TOOL_STEPS) {
          if (isAborted()) throw new DOMException('Execution stopped by user.', 'AbortError')
          const { content } = await callAI(
            [...messages, { role: 'user', content: 'Please summarize what you did.' }],
            [], // no tools for the summary turn
          )
          finalContent = content
        }

        // Extract and execute any code block in the final text response
        // (code-generation path — the model may still produce code alongside tool use)
        const code = extractCode(finalContent)
        let displayText = finalContent

        if (code) {
          setActivity({ type: 'executing', tool: 'office-js' })

          const result = await executeWithRetry(code, {
            maxRetries,
            onRetry: async (ctx: RetryContext, retryPrompt: string) => {
              if (isAborted()) throw new DOMException('Execution stopped by user.', 'AbortError')
              setActivity({
                type: 'executing',
                tool: 'retry-fix',
                input: `Fixing error (attempt ${ctx.attemptNumber})`,
              })
              return (await callAI([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: task },
                { role: 'assistant', content: finalContent },
                { role: 'user', content: retryPrompt },
              ], [])).content
            },
          })

          if (result.success) {
            const ms = result.durationMs.toFixed(0)
            displayText = `${finalContent}\n\n*✓ Done (${ms}ms)*`
          } else {
            const errMsg = result.error?.message ?? 'Unknown error'
            displayText = `${finalContent}\n\n*⚠ Execution failed: ${errMsg}*`
          }
        }

        setHistory((prev) => [...prev, { type: 'step', content: displayText }])
        setStatus('completed')
        setActivity(null)
        setUsage({ apiCalls, toolCallsExecuted, totalDurationMs: Math.round(performance.now() - executionStart) })
      } catch (err) {
        setUsage({ apiCalls, toolCallsExecuted, totalDurationMs: Math.round(performance.now() - executionStart) })
        const isAbort =
          (err instanceof DOMException && err.name === 'AbortError') ||
          (err instanceof Error && err.name === 'AbortError')
        if (isAbort) return
        const message = err instanceof Error ? err.message : String(err)
        setHistory((prev) => [...prev, { type: 'error', message }])
        setStatus('error')
        setActivity(null)
      }
    },
    [config, callAI],
  )

  return { status, history, activity, currentTask, config, pendingApprovals, usage, execute, stop, clearHistory, configure, approveTool, rejectTool }
}

// ── System prompt builder ─────────────────────────────────────────────────────

/**
 * Builds the AI system prompt by composing three layers:
 * 1. Plugin prefix — commands, execution rules, forbidden ops (from plugin-loader)
 * 2. Document context — current sheet/slide/document state (from bridge)
 * 3. Custom instruction — user-set override appended at end (never replaces #1)
 */
function buildSystemPrompt(documentContext: string, config: OfficeAgentConfig | null): string {
  const plugin = loadPlugin()
  const pluginPrefix = plugin ? buildPluginSystemPromptPrefix(plugin) : ''

  const parts: string[] = [
    pluginPrefix,
    '',
    '## Document Context',
    documentContext,
    '',
    'When your response includes executable Office.js code (in a ```javascript block), it will be automatically executed in the document. Use the Office.js API patterns from your skills. Return code blocks only when direct document manipulation is needed.',
  ]

  if (config?.systemInstruction?.trim()) {
    parts.push('', '## Custom Instructions', config.systemInstruction.trim())
  }

  return parts.join('\n')
}
