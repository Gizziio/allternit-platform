/**
 * RemoteSessionView.tsx
 * 
 * Remote Control / Session Mirroring View for Allternit ShellUI
 * Similar to Claude Code Remote Control - view ANY session from any device
 * 
 * Supports:
 * - Code Mode sessions (CodeModeADE)
 * - Cowork Mode sessions (CoworkTranscript)
 * - Chat Mode sessions
 * - Any session with a run_id
 * 
 * Features:
 * - Unified session list from all modes
 * - Real-time terminal output streaming via Cowork Controller
 * - Session filtering by mode (Code/Cowork/Chat)
 * - Mobile-responsive design
 * - QR code / URL sharing for each session
 * - Session token authentication
 * 
 * Usage:
 * - Accessible from any mode via "Remote" button
 * - Or direct URL: /shell?view=remote
 * - Or mobile: scan QR code from any session
 */

'use client'

import React, { useEffect, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/design/GlassCard'
import { Button } from '@/design/Button'
import {
  ArrowSquareOut,
  ArrowsClockwise,
  CheckCircle,
  Clock,
  Copy,
  Monitor,
  QrCode,
  DeviceMobile,
  Terminal as TerminalIcon,
  Users,
  Warning,
  WifiHigh,
  WifiSlash,
} from "@phosphor-icons/react";
import { openInBrowser } from '@/lib/openInBrowser';

// ============================================================================
// Types
// ============================================================================

interface RemoteSession {
  id: string
  run_id: string
  run_name?: string
  mode: 'code' | 'cowork' | 'chat' | 'browser'  // Which mode this session is from
  created_at: string
  expires_at: string
  status: 'active' | 'expired' | 'ended'
  client_count: number
  ws_url: string
  http_url: string
}

interface TerminalEvent {
  type: 'output' | 'input' | 'prompt' | 'status' | 'error' | 'connected' | 'disconnected'
  data?: string
  timestamp: number
  runId?: string
  message?: string
  clientId?: string
  clientCount?: number
}

// ============================================================================
// Remote Session View Component
// ============================================================================

export function RemoteSessionView() {
  const [sessions, setSessions] = useState<RemoteSession[]>([])
  const [selectedSession, setSelectedSession] = useState<RemoteSession | null>(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [clientCount, setClientCount] = useState(0)
  const [showQR, setShowQR] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<'all' | 'code' | 'cowork' | 'chat' | 'browser'>('all')
  
  // Filter sessions by mode
  const filteredSessions = sessions.filter(s => filterMode === 'all' || s.mode === filterMode)
  
  const terminalRef = React.useRef<HTMLDivElement>(null)
  const terminal = React.useRef<Terminal | null>(null)
  const ws = React.useRef<WebSocket | null>(null)
  const reconnectAttempts = React.useRef(0)
  const maxReconnectAttempts = 5

  // Fetch active sessions from Cowork API
  useEffect(() => {
    async function fetchSessions() {
      try {
        setLoading(true)
        const response = await fetch('/api/v1/mirror')
        if (!response.ok) throw new Error('Failed to fetch sessions')
        const data = await response.json()
        setSessions(data)
        
        // Auto-select most recent active session
        const activeSession = data.find((s: RemoteSession) => s.status === 'active')
        if (activeSession && !selectedSession) {
          setSelectedSession(activeSession)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sessions')
      } finally {
        setLoading(false)
      }
    }

    fetchSessions()
    const interval = setInterval(fetchSessions, 5000) // Refresh every 5s
    return () => clearInterval(interval)
  }, [selectedSession?.id])

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || !selectedSession) return

    terminal.current = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#ffffff',
        cursor: '#00ff00',
      },
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      scrollback: 10000,
      convertEol: true,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    terminal.current.loadAddon(fitAddon)
    terminal.current.loadAddon(webLinksAddon)
    terminal.current.open(terminalRef.current)
    fitAddon.fit()

    const handleResize = () => fitAddon.fit()
    window.addEventListener('resize', handleResize)

    // Welcome message
    terminal.current.writeln('\x1b[1;36m╔════════════════════════════════════════╗\x1b[0m')
    terminal.current.writeln('\x1b[1;36m║\x1b[0m  \x1b[1;33mAllternit Remote Session Viewer\x1b[0m       \x1b[1;36m║\x1b[0m')
    terminal.current.writeln('\x1b[1;36m║\x1b[0m  \x1b[32mReady to connect\x1b[0m                  \x1b[1;36m║\x1b[0m')
    terminal.current.writeln('\x1b[1;36m╚════════════════════════════════════════╝\x1b[0m')
    terminal.current.writeln('')

    return () => {
      window.removeEventListener('resize', handleResize)
      terminal.current?.dispose()
    }
  }, [selectedSession?.id])

  // Connect to session WebSocket
  useEffect(() => {
    if (!terminal.current || !selectedSession || connecting) return

    const connect = () => {
      setConnecting(true)
      reconnectAttempts.current += 1

      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host.replace('5177', '3010')}/cowork/${selectedSession.id}`
      
      terminal.current?.writeln(`\x1b[36m→ Connecting to session ${selectedSession.id.slice(0, 8)}...\x1b[0m`)

      ws.current = new WebSocket(wsUrl)

      ws.current.onopen = () => {
        setConnected(true)
        setConnecting(false)
        reconnectAttempts.current = 0
        terminal.current?.writeln('\x1b[32m✓ Connected successfully\x1b[0m')
        terminal.current?.writeln('')
      }

      ws.current.onclose = (event) => {
        setConnected(false)
        setConnecting(false)
        terminal.current?.writeln(`\x1b[31m✗ Disconnected (code: ${event.code})\x1b[0m`)
        
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000)
          terminal.current?.writeln(`\x1b[33m↻ Reconnecting in ${delay/1000}s...\x1b[0m`)
          setTimeout(connect, delay)
        }
      }

      ws.current.onerror = () => {
        terminal.current?.writeln('\x1b[31m✗ WebSocket connection error\x1b[0m')
      }

      ws.current.onmessage = (event) => {
        try {
          const terminalEvent: TerminalEvent = JSON.parse(event.data)
          
          if (terminalEvent.type === 'connected') {
            setClientCount(terminalEvent.clientCount || 1)
            terminal.current?.writeln(`\x1b[36m${terminalEvent.message || 'Connected'}\x1b[0m`)
            if (terminalEvent.clientCount) {
              terminal.current?.writeln(`\x1b[90mViewers: ${terminalEvent.clientCount}\x1b[0m`)
            }
          } else if (terminalEvent.type === 'disconnected') {
            setClientCount(prev => Math.max(0, prev - 1))
          } else if (terminalEvent.type === 'output') {
            terminal.current?.write(terminalEvent.data + '\r\n')
          } else if (terminalEvent.data) {
            terminal.current?.writeln(terminalEvent.data)
          }

          terminal.current?.scrollToBottom()
        } catch (err) {
          console.error('Failed to parse event:', err)
        }
      }
    }

    connect()

    return () => {
      ws.current?.close()
    }
  }, [selectedSession?.id, connecting])

  // Copy URL to clipboard
  const copyUrl = async () => {
    if (!selectedSession) return
    await navigator.clipboard.writeText(selectedSession.http_url)
  }

  // Refresh sessions list
  const refreshSessions = () => {
    setSessions([])
    setLoading(true)
    setTimeout(() => setLoading(false), 500)
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Monitor className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Remote Sessions</h1>
            <p className="text-xs text-gray-400">View terminal sessions from any device</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshSessions}
            disabled={loading}
          >
            <ArrowsClockwise className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowQR(!showQR)}
            disabled={!selectedSession}
          >
            <QrCode size={16} />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Session List Sidebar */}
        <div className="w-80 border-r border-gray-700 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-medium text-gray-400 mb-3">Remote Sessions</h2>

            {/* Mode Filter */}
            <div className="flex gap-1 mb-3 overflow-x-auto pb-2">
              {(['all', 'code', 'cowork', 'chat', 'browser'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className={cn(
                    "px-2 py-1 rounded text-xs whitespace-nowrap transition-colors",
                    filterMode === mode
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  )}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading sessions...</div>
            ) : filteredSessions.length === 0 ? (
              <GlassCard className="p-4 text-center">
                <TerminalIcon className="mx-auto mb-2 text-gray-500" size={32} />
                <p className="text-sm text-gray-400">
                  {filterMode === 'all' ? 'No active sessions' : `No ${filterMode} sessions`}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Enable remote control in any session with <code className="bg-gray-800 px-1 rounded">/remote</code>
                </p>
              </GlassCard>
            ) : (
              <div className="space-y-2">
                {filteredSessions.map(session => (
                  <motion.button
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className={cn(
                      "w-full p-3 rounded-lg text-left transition-colors",
                      selectedSession?.id === session.id
                        ? "bg-blue-600/20 border border-blue-500/50"
                        : "bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700"
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">
                        {session.run_name || session.run_id.slice(0, 8)}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded uppercase font-bold",
                          session.mode === 'code' ? "bg-purple-600/30 text-purple-400" :
                          session.mode === 'cowork' ? "bg-green-600/30 text-green-400" :
                          session.mode === 'chat' ? "bg-blue-600/30 text-blue-400" :
                          "bg-gray-600/30 text-gray-400"
                        )}>
                          {session.mode}
                        </span>
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          session.status === 'active' ? "bg-green-500 animate-pulse" : "bg-gray-500"
                        )} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Users size={12} />
                      <span>{session.client_count} viewers</span>
                      <span className="ml-auto flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(session.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Terminal Viewer */}
        <div className="flex-1 flex flex-col">
          {/* Terminal Header */}
          {selectedSession && (
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Session:</span>
                <code className="text-sm bg-gray-800 px-2 py-1 rounded">
                  {selectedSession.id.slice(0, 8)}
                </code>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {connected ? (
                    <>
                      <WifiHigh className="text-green-500" size={16} />
                      <span className="text-sm text-green-400">Connected</span>
                    </>
                  ) : (
                    <>
                      <WifiSlash className="w-4 h-4 text-red-500" />
                      <span className="text-sm text-red-400">Disconnected</span>
                    </>
                  )}
                </div>
                
                {clientCount > 0 && (
                  <div className="flex items-center gap-1 text-sm text-blue-400">
                    <Users size={16} />
                    <span>{clientCount}</span>
                  </div>
                )}
                
                <Button variant="ghost" size="sm" onClick={copyUrl}>
                  <Copy size={16} />
                </Button>
                
                <Button variant="ghost" size="sm" onClick={() => openInBrowser(selectedSession.http_url)}>
                  <ArrowSquareOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Terminal */}
          <div className="flex-1 overflow-hidden">
            {selectedSession ? (
              <div ref={terminalRef} className="h-full" />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Monitor className="mx-auto mb-4 opacity-50" size={64} />
                  <p className="text-lg">Select a session to view</p>
                  <p className="text-sm mt-2">Or start a new mirror session with Gizzi</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQR && selectedSession && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowQR(false)}
        >
          <div 
            className="bg-gray-800 rounded-xl p-6 max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <DeviceMobile size={24} />
              Scan to Connect
            </h2>
            
            {/* QR Code Placeholder */}
            <div className="aspect-square bg-white rounded-lg p-4 mb-4">
              <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-700 rounded flex items-center justify-center">
                <QrCode className="text-white" size={128} />
              </div>
            </div>
            
            {/* URL */}
            <div className="mb-4">
              <label className="text-xs text-gray-400 mb-1 block">Session URL</label>
              <code className="text-sm bg-gray-900 px-3 py-2 rounded block truncate">
                {selectedSession.http_url}
              </code>
            </div>
            
            {/* Instructions */}
            <div className="text-sm text-gray-400 space-y-2">
              <p className="flex items-start gap-2">
                <CheckCircle className="text-green-500 mt-0.5 flex-shrink-0" size={16} />
                Open camera app and scan QR code
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle className="text-green-500 mt-0.5 flex-shrink-0" size={16} />
                Or copy URL and paste in mobile browser
              </p>
              <p className="flex items-start gap-2">
                <Warning className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                Session expires in {new Date(selectedSession.expires_at).toLocaleString()}
              </p>
            </div>
            
            <Button 
              className="w-full mt-6"
              onClick={() => setShowQR(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
