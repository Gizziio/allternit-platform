// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react'
import { Box, Text } from '../../ink.js'
import { useKeybinding } from '../../keybindings/useKeybinding.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { ALLTERNIT_GATEWAY_BASE } from '@/shared/constants/allternitGateway'

interface MultimodalMonitorProps {
  onDone: LocalJSXCommandOnDone
}

type SyncStatus = 'disconnected' | 'connecting' | 'synced' | 'drifting'

const API_BASE = process.env.Allternit_API_URL || ALLTERNIT_GATEWAY_BASE
const WS_BASE = API_BASE.replace(/^http/, 'ws')

export function MultimodalMonitor({ onDone }: MultimodalMonitorProps): React.ReactNode {
  const [status, setStatus] = useState<SyncStatus>('connecting')
  const [messages, setMessages] = useState(0)
  const [lastSize, setLastSize] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const wsUrl = `${WS_BASE}/api/v1/multimodal/ws/multimodal`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('synced')
      setError(null)
    }

    ws.onclose = () => {
      setStatus('disconnected')
    }

    ws.onerror = (err) => {
      setStatus('drifting')
      setError('WebSocket error — the multimodal endpoint may be unavailable.')
    }

    ws.onmessage = (event) => {
      setMessages((m) => m + 1)
      const size = typeof event.data === 'string' ? event.data.length : (event.data as Blob).size ?? 0
      setLastSize(size)
    }

    return () => {
      ws.close()
    }
  }, [])

  useKeybinding(
    'confirm:no',
    () => {
      wsRef.current?.close()
      onDone()
    },
    { context: 'Confirmation' },
  )

  const statusColor =
    status === 'synced' ? 'green' : status === 'drifting' ? 'yellow' : status === 'connecting' ? 'blue' : 'red'

  return (
    <Box flexDirection="column" padding={1} borderStyle="single" borderColor="cyan">
      <Text color="cyan" bold>— Multimodal Input Monitor —</Text>
      <Box flexDirection="column" marginY={1}>
        <Box gap={1}>
          <Text color="gray">Status:</Text>
          <Text color={statusColor}>{status}</Text>
        </Box>
        <Box gap={1}>
          <Text color="gray">Messages received:</Text>
          <Text color="white">{messages}</Text>
        </Box>
        {lastSize !== null && (
          <Box gap={1}>
            <Text color="gray">Last message size:</Text>
            <Text color="white">{lastSize} bytes</Text>
          </Box>
        )}
        {error && (
          <Box gap={1}>
            <Text color="red">Error: {error}</Text>
          </Box>
        )}
      </Box>
      <Text color="gray">Press Esc or q to disconnect and close.</Text>
    </Box>
  )
}

export async function call(
  onDone: LocalJSXCommandOnDone,
): Promise<React.ReactNode> {
  return <MultimodalMonitor onDone={onDone} />
}
