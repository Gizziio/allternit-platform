import React from 'react';
import { GlassSurface } from '../../design/GlassSurface';

export function BrowserPane({ url, title }: { url?: string; title?: string }) {
  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 16px', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.6 }}>{url || 'about:blank'}</div>
      </div>
      <div style={{ flex: 1, position: 'relative', background: 'white' }}>
        <div style={{ 
          position: 'absolute', 
          inset: 0, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#333'
        }}>
          {title} Content Area
        </div>
      </div>
    </div>
  );
}
