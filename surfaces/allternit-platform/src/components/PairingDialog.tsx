'use client'

import React, { useState, useEffect } from 'react'
import { DeviceMobile, Laptop, Check, X, EnvelopeSimple, Monitor } from '@phosphor-icons/react'
import { usePlatformUser } from '@/lib/platform-auth-client'
import QRCode from 'react-qr-code'

interface PairingDialogProps {
  isOpen: boolean
  onClose: () => void
  sessionId?: string
}

export function PairingDialog({ isOpen, onClose, sessionId }: PairingDialogProps) {
  const { isLoaded } = usePlatformUser()
  const [, setIsPaired] = useState(false)
  const [, setPairingCode] = useState('')
  const [qrValue, setQrValue] = useState('')

  useEffect(() => {
    if (!isOpen || !isLoaded || !sessionId) return

    // Register a real pairing code via the mirror API
    fetch('/api/v1/mirror/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.pairing_code) {
          setPairingCode(data.pairing_code)
          setQrValue(data.pairing_url || `${window.location.origin}/shell/pair/${data.pairing_code}`)
        }
      })
      .catch(() => {
        // Fallback: derive a local code so the QR still renders
        const fallback = sessionId.slice(-6).toUpperCase()
        setPairingCode(fallback)
        setQrValue(`${window.location.origin}/shell/pair/${fallback}`)
      })
  }, [isOpen, isLoaded, sessionId])

  const handlePaired = () => {
    setIsPaired(true)
    setTimeout(() => {
      onClose()
    }, 1000)
  }

  const handleEmailLink = () => {
    // TODO: Implement email link sending
    alert('Desktop app link sent to your email!')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-auto shadow-2xl relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X size={20} className="text-gray-600" />
        </button>

        <div className="grid md:grid-cols-2">
          {/* Left Panel - Mobile Preview */}
          <div className="p-8 bg-gradient-to-br from-gray-50 to-white border-r border-gray-200">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <DeviceMobile size={32} className="text-gray-600" />
              </div>
              <h2 className="text-2xl font-semibold mb-2 text-gray-900">
                Cowork with your thumbs
              </h2>
              <p className="text-gray-600 text-base leading-relaxed">
                Dispatch tasks to Claude and check in from your phone or computer — all in one seamless conversation.
              </p>
            </div>

            {/* Mobile mockup */}
            <div className="relative mx-auto max-w-xs mb-8">
              <div className="bg-white rounded-3xl border-4 border-gray-200 p-4 shadow-lg">
                <div className="bg-gray-50 rounded-xl p-4 mb-3">
                  <p className="text-sm text-gray-700">
                    Hey, glad you're here. Tell me what's on your plate, no ask is too big or small.
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 mb-3">
                  <p className="text-sm text-gray-700">
                    • Find a confirmation in Downloads and check the order status
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 mb-3">
                  <p className="text-sm text-gray-700">
                    • Open a spreadsheet, pull today's numbers from a dashboard
                  </p>
                </div>
                <div className="text-xs text-gray-400 text-center mt-4">
                  You can also control this conversation from your phone.
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <button
                onClick={handleEmailLink}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-full font-medium transition-all text-gray-700"
              >
                <EnvelopeSimple size={20} />
                Email desktop app link
              </button>
              <button
                onClick={handlePaired}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-medium transition-all"
              >
                <Monitor size={20} />
                Pair with your desktop
              </button>
            </div>
          </div>

          {/* Right Panel - QR Code */}
          <div className="p-8 flex flex-col items-center justify-center">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <Laptop size={32} className="text-gray-600" />
              </div>
              <h2 className="text-2xl font-semibold mb-2 text-gray-900">
                Pair with the Claude Mobile app
              </h2>
              <p className="text-gray-600 text-base leading-relaxed max-w-sm">
                Use the mobile app to talk to Claude while it works from your desktop. Scan the code to download it on your phone.
              </p>
            </div>

            {/* QR Code */}
            <div className="bg-white p-4 rounded-2xl shadow-lg mb-6 border border-gray-100">
              {qrValue ? (
                <div className="w-64 h-64 bg-gray-50 rounded-xl flex items-center justify-center p-4">
                  <QRCode
                    value={qrValue}
                    size={220}
                    level="H"
                    className="mx-auto"
                  />
                </div>
              ) : (
                <div className="w-64 h-64 bg-gray-50 rounded-xl flex items-center justify-center">
                  <p className="text-gray-400 text-sm">Generating QR code...</p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="w-full max-w-xs space-y-3 mb-6">
              <button
                onClick={handlePaired}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-medium transition-all"
              >
                <Check size={20} />
                I'm signed in on my phone
              </button>
              <button
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full font-medium transition-all"
              >
                Set up later
              </button>
            </div>

            {/* Security notice */}
            <p className="text-xs text-gray-400 text-center max-w-xs leading-relaxed">
              Claude will access your desktop to complete tasks you send from your phone. This may have security risks. Only pair devices you trust.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PairingDialog
