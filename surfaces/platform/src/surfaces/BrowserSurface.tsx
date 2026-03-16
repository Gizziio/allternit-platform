import React, { useEffect, useState } from 'react';
import { execEvents } from '../integration/execution/exec.events';
import { GlassCard } from '../design/GlassCard';
import { Globe } from '@phosphor-icons/react';

export function BrowserSurface() {
  const [url, setUrl] = useState<string>('about:blank');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const unsub = execEvents.on('onToolCall', (call) => {
      // Map runtime browser tools to surface
      if (call.toolName === 'browse' || call.toolName === 'fetch_url') {
        setIsVisible(true);
        if (call.args.url) {
          setUrl(call.args.url);
        }
      }
    });
    return unsub;
  }, []);

  if (!isVisible) return null;

  return (
    <div style={{ 
      position: 'absolute', top: 60, right: 20, width: 400, height: 600, 
      zIndex: 800, display: 'flex', flexDirection: 'column' 
    }}>
      <GlassCard style={{ height: '100%', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ 
          padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', 
          display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.1)' 
        }}>
          <Globe size={16} />
          <div style={{ flex: 1, fontSize: 12, opacity: 0.7, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {url}
          </div>
          <button onClick={() => setIsVisible(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ flex: 1, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <iframe src={url} style={{ width: '100%', height: '100%', border: 'none' }} title="Browser" />
        </div>
      </GlassCard>
    </div>
  );
}
