/**
 * HTML to Figma Panel
 * Sidepanel integration for A2R Extension
 */

import { useState } from 'react'
import { Camera, Copy, Download, ExternalLink, FileJson, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { CaptureButton } from './CaptureButton'

interface CaptureHistory {
  id: string
  url: string
  timestamp: number
  type: 'quick' | 'deep'
  layerCount: number
}

export function HTMLToFigmaPanel() {
  const [history, setHistory] = useState<CaptureHistory[]>([])
  const [lastCapture, setLastCapture] = useState<any>(null)

  const handleCapture = (result: any) => {
    setLastCapture(result)
    
    // Add to history
    const newEntry: CaptureHistory = {
      id: crypto.randomUUID(),
      url: result.url,
      timestamp: Date.now(),
      type: result.options?.agents?.structure ? 'deep' : 'quick',
      layerCount: countLayers(result.layers)
    }
    
    setHistory(prev => [newEntry, ...prev].slice(0, 10)) // Keep last 10
  }

  const countLayers = (layer: any): number => {
    if (!layer) return 0
    let count = 1
    if (layer.children) {
      count += layer.children.reduce((sum: number, child: any) => 
        sum + countLayers(child), 0)
    }
    return count
  }

  const copyToClipboard = async () => {
    if (!lastCapture?.layers) {
      toast.error('No capture to copy')
      return
    }
    
    await navigator.clipboard.writeText(
      JSON.stringify(lastCapture.layers, null, 2)
    )
    toast.success('Copied to clipboard!')
  }

  const openFigma = () => {
    chrome.tabs.create({ url: 'https://figma.com' })
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-purple-500" />
        <h2 className="text-lg font-semibold">HTML to Figma</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Capture any website as editable Figma layers
      </p>

      <Separator />

      {/* Capture Buttons */}
      <div className="flex gap-2">
        <CaptureButton variant="quick" onCapture={handleCapture} />
        <CaptureButton variant="deep" onCapture={handleCapture} />
      </div>

      {/* Last Capture */}
      {lastCapture && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">Last Capture</h3>
            <span className="text-xs text-muted-foreground">
              {new Date(lastCapture.timestamp).toLocaleTimeString()}
            </span>
          </div>
          
          <div className="text-xs text-muted-foreground truncate">
            {lastCapture.url}
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-2"
              onClick={copyToClipboard}
            >
              <Copy className="h-3 w-3" />
              Copy JSON
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-2"
              onClick={openFigma}
            >
              <ExternalLink className="h-3 w-3" />
              Open Figma
            </Button>
          </div>
        </Card>
      )}

      {/* Instructions */}
      <Card className="p-4 bg-muted/50">
        <h4 className="font-medium text-sm mb-2">How to use:</h4>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Navigate to any webpage</li>
          <li>Click Quick or Deep Capture</li>
          <li>Copy the JSON output</li>
          <li>In Figma: Plugins → JSON to Figma</li>
        </ol>
      </Card>

      {/* History */}
      {history.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="font-medium text-sm mb-2">Recent Captures</h3>
            <div className="space-y-2">
              {history.map((item) => (
                <div 
                  key={item.id}
                  className="flex items-center justify-between text-xs p-2 rounded bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <Camera className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate max-w-[150px]">
                      {new URL(item.url).hostname}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    {item.layerCount} layers
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
