/**
 * useRemoteSession Hook
 * 
 * Hook for managing remote control sessions in any mode (Code/Cowork/Chat)
 * 
 * Features:
 * - Create remote session for current run
 * - Show QR code modal
 * - Copy session URL
 * - Track session status
 * 
 * Usage:
 * ```tsx
 * const { createSession, showQR, qrUrl, isRemoteEnabled } = useRemoteSession({
 *   runId: currentRunId,
 *   mode: 'code', // or 'cowork', 'chat', 'browser'
 * })
 * 
 * // In component
 * <Button onClick={createSession}>
 *   <Monitor /> Remote
 * </Button>
 * 
 * {showQR && <QRModal url={qrUrl} />}
 * ```
 */

import { useState, useCallback } from 'react'

export interface UseRemoteSessionOptions {
  runId: string
  mode: 'code' | 'cowork' | 'chat' | 'browser'
  runName?: string
  ttlMinutes?: number
}

export interface RemoteSessionData {
  id: string
  run_id: string
  mode: string
  http_url: string
  ws_url: string
  expires_at: string
  qr_code: string
}

export function useRemoteSession({
  runId,
  mode,
  runName,
  ttlMinutes = 60,
}: UseRemoteSessionOptions) {
  const [isRemoteEnabled, setIsRemoteEnabled] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create remote session
  const createSession = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/v1/mirror', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run_id: runId,
          ttl_minutes: ttlMinutes,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create remote session')
      }

      const data: RemoteSessionData = await response.json()
      
      setSessionId(data.id)
      setQrUrl(data.http_url)
      setIsRemoteEnabled(true)
      setShowQR(true)

      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create session'
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [runId, ttlMinutes])

  // End remote session
  const endSession = useCallback(async () => {
    if (!sessionId) return

    try {
      setLoading(true)
      const response = await fetch(`/api/v1/mirror/${sessionId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setIsRemoteEnabled(false)
        setSessionId(null)
        setShowQR(false)
        setQrUrl('')
      }
    } catch (err) {
      console.error('Failed to end session:', err)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  // Copy session URL to clipboard
  const copyUrl = useCallback(async () => {
    if (!qrUrl) return
    
    try {
      await navigator.clipboard.writeText(qrUrl)
    } catch (err) {
      console.error('Failed to copy URL:', err)
    }
  }, [qrUrl])

  // Toggle QR modal
  const toggleQR = useCallback(() => {
    setShowQR(prev => !prev)
  }, [])

  return {
    // State
    isRemoteEnabled,
    showQR,
    qrUrl,
    sessionId,
    loading,
    error,

    // Actions
    createSession,
    endSession,
    copyUrl,
    toggleQR,
    setShowQR,
  }
}

export default useRemoteSession
