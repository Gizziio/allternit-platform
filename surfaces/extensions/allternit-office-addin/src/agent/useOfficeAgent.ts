import { useCallback, useEffect, useRef, useState } from 'react'
import { officeStorage } from '@/lib/storage'
import { loadPlugin, buildPluginSystemPromptPrefix } from '@/lib/plugin-loader'
import { extractCode, executeCode, executeWithRetry, type RetryContext } from '@/lib/code-executor'
import { getToolsForHost, mergeToolCallDelta, finalizeToolCalls, type OpenAITool, type ParsedToolCall } from '@/lib/tool-schemas'
import { buildToolCallCode } from '@/lib/tool-dispatcher'

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
  | { type: 'executing'; tool: string; input?: unknown }
  | { type: 'executed'; tool: string; output?: string; duration?: number }
  | { type: 'error'; message: string }

export type OfficeAgentHistoricalEvent =
  | { type: 'user'; content: string }               // user message (for multi-turn)
  | { type: 'step'; content: string; rawResponse?: unknown }
  | { type: 'observation'; content: string }
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

export interface UseOfficeAgentResult {
  status: OfficeAgentStatus
  history: OfficeAgentHistoricalEvent[]
  activity: OfficeAgentActivity | null
  currentTask: string
  config: OfficeAgentConfig | null
  execute: (task: string, context: string) => Promise<void>
  stop: () => void
  clearHistory: () => void
  configure: (config: OfficeAgentConfig) => Promise<void>
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useOfficeAgent(): UseOfficeAgentResult {
  const [status, setStatus] = useState<OfficeAgentStatus>('idle')
  const [history, setHistory] = useState<OfficeAgentHistoricalEvent[]>([])
  const [activity, setActivity] = useState<OfficeAgentActivity | null>(null)
  const [currentTask, setCurrentTask] = useState('')
  const [config, setConfig] = useState<OfficeAgentConfig | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Mirror history into a ref so execute() (useCallback) can read current
  // history without adding it to deps and re-creating the function.
  const historyRef = useRef<OfficeAgentHistoricalEvent[]>([])

  useEffect(() => {
    historyRef.current = history
  }, [history])

  useEffect(() => {
    officeStorage.get<OfficeAgentConfig>(STORAGE_KEY).then((saved) => {
      setConfig(saved ?? DEFAULT_CONFIG)
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
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
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

      while (true) {
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

      // Append user message to history for multi-turn display
      setHistory((prev) => [...prev, { type: 'user', content: task }])

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
          stepCount++
          setActivity({ type: 'thinking' })

          const { content, toolCalls } = await callAI(
            messages,
            tools,
            (delta) => setActivity({ type: 'executing', tool: 'stream', input: delta }),
          )

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

          // Execute each tool call and append the results as tool messages
          for (const toolCall of toolCalls) {
            setActivity({ type: 'executing', tool: toolCall.name, input: toolCall.arguments })

            let toolResult: string
            try {
              const code = buildToolCallCode(toolCall)
              const execResult = await executeCode(code)
              if (execResult.success) {
                toolResult = typeof execResult.output === 'string'
                  ? execResult.output
                  : JSON.stringify(execResult.output ?? null)
              } else {
                toolResult = `Error: ${execResult.error?.message ?? 'Unknown error'}`
              }
            } catch (err) {
              toolResult = `Error: ${err instanceof Error ? err.message : String(err)}`
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
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        const message = err instanceof Error ? err.message : String(err)
        setHistory((prev) => [...prev, { type: 'error', message }])
        setStatus('error')
        setActivity(null)
      }
    },
    [config, callAI],
  )

  return { status, history, activity, currentTask, config, execute, stop, clearHistory, configure }
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
