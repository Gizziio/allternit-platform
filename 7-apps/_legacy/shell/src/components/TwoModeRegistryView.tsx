import * as React from 'react';
import { useState } from 'react';
import { RegistryView } from './RegistryView';
import { MarketplaceView } from './MarketplaceView';

type Mode = 'registry' | 'marketplace';

export const TwoModeRegistryView: React.FC = () => {
  const [mode, setMode] = useState<Mode>('registry');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '12px',
        backgroundColor: 'white',
        borderBottom: '1px solid #e2e8f0'
      }}>
        <div style={{
          display: 'inline-flex',
          backgroundColor: '#f1f5f9',
          borderRadius: '6px',
          padding: '4px'
        }}>
          <button
            onClick={() => setMode('registry')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: mode === 'registry' ? '#eff6ff' : 'transparent',
              color: mode === 'registry' ? '#3b82f6' : '#64748b',
              fontWeight: mode === 'registry' ? '600' : 'normal',
              cursor: 'pointer',
              fontSize: '14px',
              borderBottom: mode === 'registry' ? '3px solid #3b82f6' : '3px solid transparent',
              transition: 'all 0.2s ease'
            }}
          >
            Registered
          </button>
          <button
            onClick={() => setMode('marketplace')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: mode === 'marketplace' ? '#eff6ff' : 'transparent',
              color: mode === 'marketplace' ? '#3b82f6' : '#64748b',
              fontWeight: mode === 'marketplace' ? '600' : 'normal',
              cursor: 'pointer',
              fontSize: '14px',
              borderBottom: mode === 'marketplace' ? '3px solid #3b82f6' : '3px solid transparent',
              transition: 'all 0.2s ease'
            }}
          >
            Marketplace
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {mode === 'registry' ? <RegistryView /> : <MarketplaceView />}
      </div>
    </div>
  );
};
