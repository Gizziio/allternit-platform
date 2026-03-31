/**
 * HTML to Figma Capture Button Component
 * For A2R Extension Sidepanel
 */

import { useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface CaptureButtonProps {
  variant?: 'quick' | 'deep'
  onCapture?: (result: any) => void
}

export function CaptureButton({ variant = 'quick', onCapture }: CaptureButtonProps) {
  const [isCapturing, setIsCapturing] = useState(false)

  const handleCapture = async () => {
    setIsCapturing(true)
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'HTML_TO_FIGMA_CAPTURE',
        payload: {
          options: {
            fullPage: variant === 'deep',
            agents: {
              structure: variant === 'deep',
              style: variant === 'deep',
              layout: variant === 'deep'
            }
          }
        }
      })

      if (response.success) {
        // Copy to clipboard
        await navigator.clipboard.writeText(
          JSON.stringify(response.layers, null, 2)
        )
        
        onCapture?.(response)
      } else {
        console.error(`Capture failed: ${response.error}`)
      }
    } catch (error) {
      console.error('[HTML→Figma] Capture error:', error)
    } finally {
      setIsCapturing(false)
    }
  }

  return (
    <Button
      variant={variant === 'deep' ? 'default' : 'outline'}
      size="sm"
      onClick={handleCapture}
      disabled={isCapturing}
      className="gap-2"
      title={variant === 'quick' 
        ? 'Fast capture - paste directly into Figma' 
        : 'Full capture with AI cleanup agents'}
    >
      {isCapturing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Camera className="h-4 w-4" />
      )}
      {variant === 'quick' ? 'Quick Capture' : 'Deep Capture'}
    </Button>
  )
}
