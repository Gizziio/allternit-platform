/**
 * OpenClaw Control UI Host
 * 
 * Embeds OpenClaw's native Control UI in an iframe.
 * This is the QUARANTINE phase - we're hosting OpenClaw as-is
 * before gradually replacing components with native A2R implementations.
 * 
 * Architecture: OpenClaw runs separately on port 18789, we iframe it.
 */

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

const OPENCLAW_URL = 'http://localhost:18789';
const HEALTH_CHECK_INTERVAL = 5000;

export function OpenClawControlUI() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string | null>(null);

  // Health check
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${OPENCLAW_URL}/health`, {
          method: 'GET',
          // Allow cross-origin for localhost development
          mode: 'cors',
        });
        
        if (response.ok) {
          setIsHealthy(true);
          const data = await response.json().catch(() => ({}));
          setVersion(data.version || 'unknown');
          setError(null);
        } else {
          setIsHealthy(false);
          setError(`OpenClaw health check failed: ${response.status}`);
        }
      } catch (err) {
        setIsHealthy(false);
        setError('OpenClaw is not running on localhost:18789');
      }
    };

    // Check immediately
    checkHealth();
    
    // Then check periodically
    const interval = setInterval(checkHealth, HEALTH_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Handle iframe load
  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  // Handle iframe error
  const handleIframeError = () => {
    setIsLoading(false);
    setError('Failed to load OpenClaw Control UI');
  };

  // Refresh iframe
  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  // Open in new tab
  const handleOpenExternal = () => {
    window.open(OPENCLAW_URL, '_blank');
  };

  if (error && !isHealthy) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              OpenClaw Not Available
            </CardTitle>
            <CardDescription>
              OpenClaw Control UI is not currently running
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            
            <div className="bg-muted p-4 rounded-md">
              <h4 className="font-semibold mb-2">To start OpenClaw:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Open a terminal</li>
                <li>Run: <code className="bg-background px-1 rounded">openclaw gateway --port 18789</code></li>
                <li>Or run: <code className="bg-background px-1 rounded">./scripts/start-openclaw.sh</code></li>
                <li>Refresh this page</li>
              </ol>
            </div>
            
            <Button onClick={() => window.location.reload()} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between bg-background">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">OpenClaw Control UI</h2>
          <Badge variant={isHealthy ? "default" : "secondary"}>
            {isHealthy ? "Connected" : "Connecting..."}
          </Badge>
          {version && (
            <Badge variant="outline">v{version}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleOpenExternal}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open in New Tab
          </Button>
        </div>
      </div>

      {/* Iframe Container */}
      <div className="flex-1 relative bg-muted">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading OpenClaw Control UI...</p>
            </div>
          </div>
        )}
        
        <iframe
          ref={iframeRef}
          src={OPENCLAW_URL}
          className="w-full h-full border-0"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="OpenClaw Control UI"
        />
      </div>

      {/* Footer Notice */}
      <div className="border-t px-4 py-2 bg-muted text-xs text-muted-foreground flex items-center justify-between">
        <span>
          Running in QUARANTINE mode - This is OpenClaw's native UI hosted via iframe.
          Gradual migration to native A2R components in progress.
        </span>
        <a 
          href="/.migration/openclaw-absorption/INDEX.md" 
          target="_blank"
          className="hover:underline"
        >
          Migration Status →
        </a>
      </div>
    </div>
  );
}
