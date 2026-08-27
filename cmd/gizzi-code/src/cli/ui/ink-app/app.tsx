#!/usr/bin/env bun
// @ts-nocheck

/**
 * Gizzi TUI Entry Point - Ink-based REPL initialization.
 */
import React from 'react'
import { createRoot } from './ink'
import { App } from './components/App'
import { REPL } from './screens/REPL'
import { enableConfigs } from './utils/config'
import { enableConfigs as enableSharedConfigs } from '../../../shared/utils/config'
import { getDefaultAppState } from './state/AppStateStore'
import { createStatsStore } from './context/stats'
import { getAllBaseTools } from './tools'
import { getCommands } from './commands'
import { createUserMessage } from './utils/messages'
import { setCwdState, setOriginalCwd, setSessionTrustAccepted } from './bootstrap/state'
import { Log } from '../../../shared/util/log'
import { registerRailsPeer } from '../../../runtime/gizzi-core/services/railsPeer.js'
import { RailsInboxBridge } from './components/RailsInboxBridge'
import { getSessionId } from './bootstrap/state.js'

export async function tui(options?: any): Promise<void> {
  const currentCwd = process.cwd()
  setOriginalCwd(currentCwd)
  setCwdState(currentCwd)
  setSessionTrustAccepted(true)

  enableConfigs()
  enableSharedConfigs()

  // Register as a Rails peer so other local agents can discover and message
  // this session. Fire-and-forget: failures are logged but never block TUI.
  // The actual inbox listener is mounted inside the React tree by
  // <RailsInboxBridge /> so it can post messages to the mailbox context.
  registerRailsPeer(getSessionId()).catch((err) => {
    Log.Default.info('tui: rails peer registration failed', {
      error: err?.message || String(err),
    })
  })

  if (options?.fetch) {
    globalThis.fetch = options.fetch
  }

  Log.Default.info("tui: getting tools and commands")
  const initialTools = getAllBaseTools().filter((t: any) => t.isEnabled ? t.isEnabled() : true)
  const initialCommands = await getCommands(currentCwd)

  const initialMessages = options?.args?.prompt
    ? [createUserMessage({ content: options.args.prompt })]
    : []

  Log.Default.info("tui: rendering ink App & REPL via createRoot")
  try {
    const root = await createRoot({ exitOnCtrlC: false })
    root.render(
      <App
        initialState={getDefaultAppState()}
        stats={createStatsStore()}
        getFpsMetrics={() => undefined}
      >
        <>
          <REPL
            commands={initialCommands}
            debug={false}
            initialTools={initialTools}
            initialMessages={initialMessages}
            thinkingConfig={{ enabled: false, budgetTokens: 0 }}
          />
          <RailsInboxBridge />
        </>
      </App>
    )

    Log.Default.info("tui: waiting for exit")
    await root.waitUntilExit()
  } catch (err: any) {
    Log.Default.error("tui render exception", { error: err?.stack || err?.message || String(err) })
    console.error("TUI Render Error:", err)
  } finally {
    if (options?.onExit) {
      await options.onExit()
    }
  }
}

export async function startInkTUI(): Promise<void> {
  await tui()
}

if (import.meta.main) {
  startInkTUI().catch(err => {
    console.error('Failed to start TUI:', err)
    process.exit(1)
  })
}
