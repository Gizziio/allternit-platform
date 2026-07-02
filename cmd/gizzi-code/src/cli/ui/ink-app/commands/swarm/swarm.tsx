// @ts-nocheck
import React, { useState, useEffect } from 'react'
import { Box, Text } from '../../ink.js'
import { useKeybinding } from '../../keybindings/useKeybinding.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'

interface SwarmVisualizerProps {
  onDone: LocalJSXCommandOnDone
}

const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

function getProgressBar(pct: number) {
  const totalBars = 8
  const filledBars = Math.min(totalBars, Math.floor((pct / 100) * totalBars))
  const emptyBars = totalBars - filledBars
  const barStr = `${'█'.repeat(filledBars)}${'░'.repeat(emptyBars)}`
  return `[${barStr}]`
}

function getPulsingLine(step: number) {
  const length = 40
  let pos = step % (length * 2)
  if (pos > length) pos = length * 2 - pos
  const left = '━'.repeat(pos)
  const right = '━'.repeat(length - pos)
  return { left, right }
}

export function SwarmVisualizer({ onDone }: SwarmVisualizerProps) {
  const [step, setStep] = useState(0)
  const [realTasks, setRealTasks] = useState<any[]>([])

  // Fetch real tasks from cowork database/API to display live progress
  useEffect(() => {
    const API_BASE = process.env.Allternit_API_URL || "http://127.0.0.1:8013"
    fetch(`${API_BASE}/api/v1/tasks?limit=5`)
      .then(res => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(data => {
        const list = (Array.isArray(data) ? data : data?.tasks) || []
        if (list.length > 0) {
          setRealTasks(list)
        }
      })
      .catch(() => {
        // Ignore error, fallback to simulated task list
      })
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(prev => {
        if (prev >= 50) {
          clearInterval(interval)
          return prev
        }
        return prev + 1
      })
    }, 200)

    return () => clearInterval(interval)
  }, [])

  // Handle escape/quit to exit the visualizer
  useKeybinding(
    'confirm:no',
    () => {
      onDone()
    },
    { context: 'Confirmation' },
  )

  const spinner = spinnerFrames[step % spinnerFrames.length]
  const pulsing = getPulsingLine(step)

  // Teammate 001
  const pct1 = Math.min(100, Math.floor((step / 10) * 100))
  const isDone1 = pct1 >= 100
  const msg1 = isDone1 ? 'Scope: src/cli/commands/* checked' : 'Scanning files under src/cli/commands...'

  // Teammate 002
  const pct2 = Math.min(100, Math.floor((step / 35) * 100))
  const isDone2 = pct2 >= 100
  const msg2 = isDone2
    ? 'Workspace dry-run successful'
    : pct2 >= 50 ? "Let's script and dry-run first o..." : 'Scanning package files...'

  // Teammate 003
  const pct3 = Math.min(100, Math.floor((step / 40) * 100))
  const isDone3 = pct3 >= 100
  const msg3 = isDone3
    ? 'Error count logged'
    : pct3 >= 30 ? 'Let me see how many errors the s...' : 'Checking dependencies...'

  // Teammate 004
  const pct4 = Math.min(100, Math.floor((step / 45) * 100))
  const isDone4 = pct4 >= 100
  const msg4 = isDone4
    ? 'Fixes verified'
    : pct4 >= 60 ? 'verify.ts: fix content->body.' : 'Setting up subagent...'

  return (
    <Box flexDirection="column" padding={1} borderStyle="single" borderColor="cyan">
      <Text color="cyan" bold>— Agent Swarm — Parallel TS error reduction</Text>
      <Box flexDirection="column" marginY={1}>
        {/* Teammate 001 */}
        <Box gap={1}>
          <Text color="gray">001</Text>
          <Text color={isDone1 ? 'green' : 'yellow'}>{getProgressBar(pct1)}</Text>
          <Text color={isDone1 ? 'green' : 'yellow'}>{isDone1 ? '✔' : spinner}</Text>
          <Text bold={isDone1} color={isDone1 ? 'white' : 'gray'}>{msg1}</Text>
        </Box>

        {/* Teammate 002 */}
        <Box gap={1}>
          <Text color="gray">002</Text>
          <Text color={isDone2 ? 'green' : 'yellow'}>{getProgressBar(pct2)}</Text>
          <Text color={isDone2 ? 'green' : 'yellow'}>{isDone2 ? '✔' : spinner}</Text>
          <Text bold={isDone2} color={isDone2 ? 'white' : 'gray'}>{msg2}</Text>
        </Box>

        {/* Teammate 003 */}
        <Box gap={1}>
          <Text color="gray">003</Text>
          <Text color={isDone3 ? 'green' : 'yellow'}>{getProgressBar(pct3)}</Text>
          <Text color={isDone3 ? 'green' : 'yellow'}>{isDone3 ? '✔' : spinner}</Text>
          <Text bold={isDone3} color={isDone3 ? 'white' : 'gray'}>{msg3}</Text>
        </Box>

        {/* Teammate 004 */}
        <Box gap={1}>
          <Text color="gray">004</Text>
          <Text color={isDone4 ? 'green' : 'yellow'}>{getProgressBar(pct4)}</Text>
          <Text color={isDone4 ? 'green' : 'yellow'}>{isDone4 ? '✔' : spinner}</Text>
          <Text bold={isDone4} color={isDone4 ? 'white' : 'gray'}>{msg4}</Text>
        </Box>
      </Box>

      <Text bold>Working...</Text>
      <Box>
        <Text color="gray">{pulsing.left}</Text>
        <Text color="cyan">●</Text>
        <Text color="gray">{pulsing.right}</Text>
      </Box>

      {/* Todo and Task List */}
      <Box flexDirection="column" marginTop={1}>
        <Text bold>Todo / Task Progress</Text>
        {realTasks.length > 0 ? (
          realTasks.map((t, idx) => {
            let statusIcon = '○'
            let statusColor = 'gray'
            if (t.status === 'completed' || t.status === 'done') {
              statusIcon = '✔'
              statusColor = 'green'
            } else if (t.status === 'in_progress' || t.status === 'doing') {
              statusIcon = '●'
              statusColor = 'blue'
            }
            return (
              <Box key={t.id || idx} gap={1}>
                <Text color={statusColor}>{statusIcon}</Text>
                <Text color={statusColor === 'green' ? 'gray' : 'white'}>{t.title}</Text>
              </Box>
            )
          })
        ) : (
          <>
            <Text color="green">✔ Clean up malformed extensionless auto-shim files and resume safe shimming</Text>
            
            <Box gap={1}>
              <Text color={step >= 15 ? 'green' : 'blue'}>{step >= 15 ? '✔' : '●'}</Text>
              <Text color={step >= 15 ? 'gray' : 'white'}>Fix React/ambient module stubs (react.d.ts, missing-modules.d.ts)</Text>
            </Box>

            <Box gap={1}>
              <Text color={step >= 40 ? 'green' : step >= 15 ? 'blue' : 'gray'}>
                {step >= 40 ? '✔' : step >= 15 ? '●' : '○'}
              </Text>
              <Text color={step >= 40 ? 'gray' : 'white'}>Fix remaining top TS error categories in parallel with subagents</Text>
            </Box>

            <Box gap={1}>
              <Text color={step >= 48 ? 'green' : step >= 40 ? 'blue' : 'gray'}>
                {step >= 48 ? '✔' : step >= 40 ? '●' : '○'}
              </Text>
              <Text color={step >= 48 ? 'gray' : 'white'}>Re-run full typecheck and measure drop</Text>
            </Box>

            <Box gap={1}>
              <Text color={step >= 50 ? 'green' : step >= 48 ? 'blue' : 'gray'}>
                {step >= 50 ? '✔' : step >= 48 ? '●' : '○'}
              </Text>
              <Text color={step >= 50 ? 'gray' : 'white'}>Run bun test to verify no regressions</Text>
            </Box>
          </>
        )}
      </Box>

      <Box marginTop={1} justifyContent="space-between">
        <Box>
          <Text backgroundColor="gray" color="black"> auto swarm </Text>
          <Text backgroundColor="cyan" color="black"> goal ● active </Text>
          <Text> · 16h28m · 1 turn · K2.7 Code thinking ~</Text>
        </Box>
        <Text color="gray">press esc to close</Text>
      </Box>
    </Box>
  )
}

export async function call(onDone: LocalJSXCommandOnDone) {
  return <SwarmVisualizer onDone={onDone} />
}
