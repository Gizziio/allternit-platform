'use client'

import { usePlatformUser } from '@/lib/platform-auth-client'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  QrCode,
  DeviceMobile,
  Check,
  CircleNotch,
  Warning,
} from '@phosphor-icons/react';
import QRCode from 'react-qr-code'

export default function PairPageClient() {
  const { isLoaded, isSignedIn } = usePlatformUser()
  const params = useParams()
  const router = useRouter()
  const code = params.code as string
  
  const [isPairing, setIsPairing] = useState(false)
  const [isPaired, setIsPaired] = useState(false)
  const [error, setError] = useState('')
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [pairingUrl, setPairingUrl] = useState('')

  // Fetch pairing info on mount
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return

    const fetchPairingInfo = async () => {
      try {
        const response = await fetch(`/api/v1/mirror/pair/${code}`)
        if (response.ok) {
          const data = await response.json()
          setSessionInfo(data)
          setPairingUrl(data.pairing_url || window.location.origin)
        } else {
          setError('Invalid or expired pairing code')
        }
      } catch (error) {
        console.error('Failed to fetch pairing info:', error)
        setError('Failed to load pairing information')
      }
    }

    fetchPairingInfo()
  }, [isLoaded, isSignedIn, code])

  const handlePair = async () => {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=/shell/pair/${code}`)
      return
    }

    setIsPairing(true)
    setError('')

    try {
      const response = await fetch('/api/v1/mirror/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairing_code: code }),
      })

      if (response.ok) {
        const data = await response.json()
        setIsPaired(true)
        
        // Redirect to session after 2 seconds
        setTimeout(() => {
          router.push(`/shell/session/${data.session_id}`)
        }, 2000)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to pair device')
      }
    } catch (error) {
      console.error('Pairing failed:', error)
      setError('Network error. Please try again.')
    } finally {
      setIsPairing(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <CircleNotch size={32} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-50 rounded-full mb-4">
            <DeviceMobile size={40} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">
            Pair with Desktop
          </h1>
          <p className="text-gray-600">
            Connect your mobile device to your desktop session
          </p>
        </div>

        {/* Pairing Code Display */}
        {sessionInfo && (
          <div className="bg-gray-50 rounded-2xl p-6 mb-6">
            <div className="text-center mb-4">
              <p className="text-sm text-gray-500 mb-2">Pairing Code</p>
              <p className="text-2xl font-mono font-bold text-gray-900">{code}</p>
            </div>
            
            {/* QR Code */}
            <div className="aspect-square bg-white rounded-xl flex items-center justify-center mb-4 p-4 shadow-sm">
              <QRCode
                value={pairingUrl}
                size={200}
                level="H"
                includeMargin={true}
                className="mx-auto"
              />
            </div>
            
            <p className="text-xs text-gray-400 text-center">
              Scan this code or enter the code on your desktop
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Warning size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success State */}
        {isPaired ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <Check size={48} className="text-green-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-green-800 mb-1">
              Successfully Paired!
            </h3>
            <p className="text-sm text-green-600">
              Redirecting to your session...
            </p>
          </div>
        ) : (
          /* Pair Button */
          <button
            onClick={handlePair}
            disabled={isPairing || !isSignedIn}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-full font-semibold text-lg transition-colors flex items-center justify-center gap-2"
          >
            {isPairing ? (
              <>
                <CircleNotch size={20} className="animate-spin" />
                Pairing...
              </>
            ) : (
              <>
                <Check size={20} />
                {isSignedIn ? 'Pair Devices' : 'Sign In to Pair'}
              </>
            )}
          </button>
        )}

        {/* Help Text */}
        <p className="text-xs text-gray-400 text-center mt-6">
          By pairing, you allow your mobile device to control and monitor your desktop session
        </p>
      </div>
    </div>
  )
}
