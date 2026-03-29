/**
 * RemoteSessionQRModal.tsx
 * 
 * Modal for displaying remote session QR code and URL
 * Used by Code Mode, Cowork Mode, and other modes
 */

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  QrCode,
  DeviceMobile,
  Copy,
  Check,
  ArrowSquareOut,
  Clock,
  Warning,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Button } from '@/design/Button'
import { GlassCard } from '@/design/GlassCard'

export interface RemoteSessionQRModalProps {
  open: boolean
  onClose: () => void
  sessionUrl: string
  sessionName?: string
  expiresAt?: string
}

export function RemoteSessionQRModal({
  open,
  onClose,
  sessionUrl,
  sessionName,
  expiresAt,
}: RemoteSessionQRModalProps) {
  const [copied, setCopied] = React.useState(false)

  const copyUrl = async () => {
    await navigator.clipboard.writeText(sessionUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            onClick={onClose}
          >
            <GlassCard
              className="max-w-md w-full p-0 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <DeviceMobile className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Remote Session
                    </h2>
                    {sessionName && (
                      <p className="text-xs text-gray-400 truncate max-w-[200px]">
                        {sessionName}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* QR Code */}
                <div className="aspect-square bg-white rounded-xl p-4 mb-4">
                  <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-700 rounded-lg flex items-center justify-center">
                    <QrCode className="w-32 h-32 text-white" />
                  </div>
                </div>

                {/* Session URL */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">
                    Session URL
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-black/30 px-3 py-2 rounded-lg block truncate text-gray-300">
                      {sessionUrl}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyUrl}
                      className={cn(
                        copied && "text-green-400"
                      )}
                    >
                      {copied ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(sessionUrl, '_blank')}
                    >
                      <ArrowSquareOut className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Instructions */}
                <div className="text-sm text-gray-400 space-y-2 pt-2">
                  <p className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Open camera app and scan QR code
                  </p>
                  <p className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Or copy URL and paste in mobile browser
                  </p>
                  {expiresAt && (
                    <p className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      Session expires {new Date(expiresAt).toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Warning */}
                <GlassCard className="p-3 bg-yellow-500/10 border-yellow-500/20">
                  <p className="text-xs text-yellow-400 flex items-start gap-2">
                    <Warning className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    Anyone with this URL can view the session. Share carefully.
                  </p>
                </GlassCard>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/10">
                <Button onClick={onClose} className="w-full">
                  Close
                </Button>
              </div>
            </GlassCard>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default RemoteSessionQRModal
