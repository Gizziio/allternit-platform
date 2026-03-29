/**
 * RemoteTaskHandler (G4)
 *
 * Connects the page-agent extension to the A2R thin-client via native messaging.
 * The extension initiates a `chrome.runtime.connectNative('com.a2r.desktop')`
 * connection; Chrome launches the native host registered by thin-client, which
 * bridges the messages to the thin-client TCP server (port 3016).
 *
 * ── Inbound commands (thin-client → extension) ───────────────────────────────
 *   { id, type: 'execute_task', payload: { task: string }, timestamp }
 *   { id, type: 'stop_task', payload: {}, timestamp }
 *   { id, type: 'get_status', payload: {}, timestamp }
 *
 * ── Outbound events (extension → thin-client) ────────────────────────────────
 *   { id, type: 'status',   payload: { status: AgentStatus }, timestamp }
 *   { id, type: 'activity', payload: AgentActivity, timestamp }
 *   { id, type: 'history',  payload: { events: HistoricalEvent[] }, timestamp }
 *   { id, type: 'done',     payload: { success: boolean; data: string }, timestamp }
 *   { id, type: 'error',    payload: { message: string }, timestamp }
 *   { id, type: 'pong',     payload: {}, timestamp }
 *
 * Native host name: com.a2r.desktop
 * Registered by: thin-client NativeHostServer (task #57)
 */

import type { AgentActivity, AgentStatus, HistoricalEvent } from '@page-agent/core'
import type { LLMConfig } from '@page-agent/llms'

import { MultiPageAgent } from './MultiPageAgent'
import { DEMO_CONFIG, migrateLegacyEndpoint } from './constants'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RemoteMessage {
  id: string
  type: string
  payload?: Record<string, unknown>
  timestamp: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NATIVE_HOST_NAME = 'com.a2r.desktop'
const RECONNECT_DELAY_MS = 3_000
const MAX_RECONNECT_DELAY_MS = 30_000

// ── RemoteTaskHandler ─────────────────────────────────────────────────────────

class RemoteTaskHandler {
  private port: chrome.runtime.Port | null = null
  private agent: MultiPageAgent | null = null
  private reconnectDelay = RECONNECT_DELAY_MS
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private active = false

  /** Call once from background to begin managing the remote connection. */
  start(): void {
    if (this.active) return
    this.active = true
    this._connect()
  }

  /** Tear down — typically only called on extension unload. */
  stop(): void {
    this.active = false
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this._disconnect()
    this._destroyAgent()
  }

  get isConnected(): boolean {
    return this.port !== null
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _connect(): void {
    if (!this.active) return

    try {
      this.port = chrome.runtime.connectNative(NATIVE_HOST_NAME)
    } catch (err) {
      console.warn('[RemoteTaskHandler] connectNative failed:', err)
      this._scheduleReconnect()
      return
    }

    console.log('[RemoteTaskHandler] Connected to', NATIVE_HOST_NAME)
    this.reconnectDelay = RECONNECT_DELAY_MS

    this.port.onMessage.addListener((msg: RemoteMessage) => this._handleMessage(msg))

    this.port.onDisconnect.addListener(() => {
      const err = chrome.runtime.lastError?.message ?? 'unknown reason'
      console.warn('[RemoteTaskHandler] Disconnected from native host:', err)
      this.port = null
      this._scheduleReconnect()
    })

    // Announce connection with current agent status
    this._send({ type: 'status', payload: { status: this.agent?.status ?? 'idle' } })
  }

  private _disconnect(): void {
    try {
      this.port?.disconnect()
    } catch {
      // ignore
    }
    this.port = null
  }

  private _scheduleReconnect(): void {
    if (!this.active) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this._connect()
    }, this.reconnectDelay)
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS)
  }

  private _send(partial: Omit<RemoteMessage, 'id' | 'timestamp'>): void {
    if (!this.port) return
    const msg: RemoteMessage = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...partial,
    }
    try {
      this.port.postMessage(msg)
    } catch (err) {
      console.warn('[RemoteTaskHandler] postMessage failed:', err)
    }
  }

  // ── Message dispatch ───────────────────────────────────────────────────────

  private _handleMessage(msg: RemoteMessage): void {
    switch (msg.type) {
      case 'execute_task':
        this._onExecuteTask(msg)
        break
      case 'stop_task':
        this._onStopTask()
        break
      case 'get_status':
        this._send({ type: 'status', payload: { status: this.agent?.status ?? 'idle' } })
        break
      case 'configure':
        this._onConfigure(msg)
        break
      case 'ping':
        this._send({ type: 'pong', payload: {} })
        break
      default:
        console.warn('[RemoteTaskHandler] Unknown message type:', msg.type)
    }
  }

  private _onConfigure(msg: RemoteMessage): void {
    const {
      apiKey,
      baseURL,
      model,
      language,
      maxSteps,
      systemInstruction,
      experimentalLlmsTxt,
    } = msg.payload ?? {}

    const promises: Promise<void>[] = [
      chrome.storage.local.get(['llmConfig', 'advancedConfig']).then((result) => {
        const nextLlmConfig = {
          ...((result.llmConfig as Record<string, unknown> | undefined) ?? {}),
        }
        const nextAdvancedConfig = {
          ...((result.advancedConfig as Record<string, unknown> | undefined) ?? {}),
        }

        if (typeof apiKey === 'string') nextLlmConfig.apiKey = apiKey
        if (typeof baseURL === 'string') nextLlmConfig.baseURL = baseURL
        if (typeof model === 'string') nextLlmConfig.model = model

        if (typeof maxSteps === 'number') nextAdvancedConfig.maxSteps = maxSteps
        else if (maxSteps === null) delete nextAdvancedConfig.maxSteps

        if (typeof systemInstruction === 'string') nextAdvancedConfig.systemInstruction = systemInstruction
        else if (systemInstruction === null) delete nextAdvancedConfig.systemInstruction

        if (typeof experimentalLlmsTxt === 'boolean') {
          nextAdvancedConfig.experimentalLlmsTxt = experimentalLlmsTxt
        }

        const writes: Promise<void>[] = []
        if (Object.keys(nextLlmConfig).length > 0) {
          writes.push(chrome.storage.local.set({ llmConfig: nextLlmConfig }))
        }

        if (Object.keys(nextAdvancedConfig).length > 0) {
          writes.push(chrome.storage.local.set({ advancedConfig: nextAdvancedConfig }))
        } else {
          writes.push(chrome.storage.local.remove('advancedConfig'))
        }

        return Promise.all(writes).then(() => undefined)
      }),
    ]

    if (typeof language === 'string' && (language === 'en-US' || language === 'zh-CN')) {
      promises.push(chrome.storage.local.set({ language }))
    } else if (language === null) {
      promises.push(chrome.storage.local.remove('language'))
    }

    Promise.all(promises)
      .then(() => this._send({ type: 'configured', payload: {} }))
      .catch((err) => this._send({ type: 'error', payload: { message: String(err) } }))
  }

  private _onStopTask(): void {
    this.agent?.stop()
    this._send({ type: 'status', payload: { status: 'idle' } })
  }

  private async _onExecuteTask(msg: RemoteMessage): Promise<void> {
    const task = (msg.payload?.task as string | undefined) ?? ''
    if (!task) {
      this._send({ type: 'error', payload: { message: 'execute_task: task string is required' } })
      return
    }

    // If an agent is already running, stop it first
    if (this.agent && this.agent.status === 'running') {
      this.agent.stop()
      await new Promise<void>((res) => setTimeout(res, 200))
    }

    // Build a fresh agent for this task
    await this._destroyAgent()
    const agentConfig = await this._loadConfig()
    const agent = new MultiPageAgent(agentConfig)
    this.agent = agent

    // Wire event listeners
    agent.addEventListener('statuschange', () => {
      this._send({ type: 'status', payload: { status: agent.status as AgentStatus } })
    })

    agent.addEventListener('historychange', () => {
      this._send({
        type: 'history',
        payload: { events: agent.history as unknown as Record<string, unknown>[] },
      })
    })

    agent.addEventListener('activity', (e: Event) => {
      const activity = (e as CustomEvent).detail as AgentActivity
      this._send({ type: 'activity', payload: activity as unknown as Record<string, unknown> })
    })

    // Execute and stream final result
    try {
      const result = await agent.execute(task)
      this._send({
        type: 'done',
        payload: { success: result.success, data: String(result.data ?? '') },
      })
    } catch (err) {
      this._send({ type: 'error', payload: { message: String(err) } })
    }
  }

  private async _destroyAgent(): Promise<void> {
    if (!this.agent) return
    const agent = this.agent
    this.agent = null
    try {
      agent.dispose()
    } catch {
      // ignore
    }
  }

  /** Read LLM config from chrome.storage.local, same as useAgent hook. */
  private async _loadConfig(): Promise<{
    apiKey: string
    baseURL: string
    model: string
    language?: 'en-US' | 'zh-CN'
    maxSteps?: number
    experimentalLlmsTxt?: boolean
    instructions?: { system?: string }
  }> {
    const result = await chrome.storage.local.get(['llmConfig', 'language', 'advancedConfig'])

    let llmConfig: LLMConfig = (result.llmConfig as LLMConfig) ?? DEMO_CONFIG
    llmConfig = migrateLegacyEndpoint(llmConfig)

    const language = (result.language as 'en-US' | 'zh-CN') || undefined
    const advancedConfig = (
      result.advancedConfig as {
        maxSteps?: number
        systemInstruction?: string
        experimentalLlmsTxt?: boolean
      }
    ) ?? {}

    return {
      ...llmConfig,
      language,
      maxSteps: advancedConfig.maxSteps,
      experimentalLlmsTxt: advancedConfig.experimentalLlmsTxt,
      instructions: advancedConfig.systemInstruction
        ? { system: advancedConfig.systemInstruction }
        : undefined,
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const remoteTaskHandler = new RemoteTaskHandler()
