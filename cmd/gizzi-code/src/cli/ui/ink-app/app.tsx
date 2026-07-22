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

export async function tui(options?: any): Promise<void> {
  const currentCwd = process.cwd()
  setOriginalCwd(currentCwd)
  setCwdState(currentCwd)
  setSessionTrustAccepted(true)

  enableConfigs()
  enableSharedConfigs()

  if (options?.fetch) {
    globalThis.fetch = options.fetch
  }

  Log.Default.info("tui: getting tools and commands")
  const initialTools = getAllBaseTools().filter((t: any) => t.isEnabled ? t.isEnabled() : true)
  const initialCommands = await getCommands()

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
        <REPL
          commands={initialCommands}
          debug={false}
          initialTools={initialTools}
          initialMessages={initialMessages}
          thinkingConfig={{ enabled: false, budgetTokens: 0 }}
        />
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
