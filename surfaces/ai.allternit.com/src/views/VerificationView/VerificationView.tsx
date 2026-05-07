/**
 * Verification View
 * 
 * Main view for visual verification dashboard.
 * Shows verification status, evidence, and historical trends.
 */

import React, { useState } from 'react';
import {
  VisualVerificationPanel,
} from '@/components/visual';
import { useVisualVerification } from '@/hooks/useVisualVerification';

export interface VerificationViewProps {
  wihId?: string;
  className?: string;
}

export const VerificationView: React.FC<VerificationViewProps> = ({
  wihId: initialWihId,
  className,
}) => {
  const [wihId, setWihId] = useState(initialWihId || '');
  const [inputValue, setInputValue] = useState(initialWihId || '');
  
  const { 
    result, 
    isLoading, 
    isPolling, 
    error, 
    trendData,
    refresh,
    startVerification,
    requestBypass 
  } = useVisualVerification({ 
    wihId: wihId || undefined,
    pollInterval: 3000,
    autoStart: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setWihId(inputValue.trim());
    }
  };

  const handleRefresh = async () => {
    await refresh();
  };

  const handleStart = async () => {
    await startVerification();
  };

  const handleBypass = async (reason: string) => {
    await requestBypass(reason);
  };

  return (
    <div style={{ 
      padding: '24px', 
      maxWidth: '1400px', 
      margin: '0 auto',
      minHeight: '100vh',
      background: 'var(--surface-panel)',
    }} className={className}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ 
          fontSize: '28px', 
          fontWeight: 700, 
          color: 'var(--ui-text-primary)',
          margin: '0 0 8px 0' 
        }}>
          Visual Verification
        </h1>
        <p style={{ 
          fontSize: '14px', 
          color: 'var(--ui-text-muted)', 
          margin: 0 
        }}>
          Verify UI changes before autoland with automated evidence capture
        </p>
      </div>

      {/* WIH Input */}
      <div style={{
        background: 'var(--surface-panel)',
        border: '1px solid var(--ui-border-default)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px',
      }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter WIH ID (e.g., wih_abc123)"
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid var(--ui-border-default)',
              background: 'var(--surface-hover)',
              color: 'var(--ui-text-primary)',
              fontSize: '14px',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--status-info)',
              color: 'var(--ui-text-inverse)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Load
          </button>
          {wihId && (
            <button
              type="button"
              onClick={handleStart}
              disabled={isLoading || isPolling}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                background: isLoading || isPolling ? 'var(--surface-hover)' : 'var(--status-success)',
                color: 'var(--ui-text-inverse)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: isLoading || isPolling ? 'not-allowed' : 'pointer',
              }}
            >
              {isPolling ? 'Running...' : 'Start Verification'}
            </button>
          )}
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '16px 20px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          color: 'var(--status-error)',
          marginBottom: '24px',
        }}>
          <strong>Error:</strong> {error.message}
        </div>
      )}

      {/* Verification Panel */}
      {wihId && (
        <VisualVerificationPanel
          wihId={wihId}
          status={result || undefined}
          trendData={trendData}
          onRefresh={handleRefresh}
          onRequestBypass={() => {
            const reason = prompt('Enter bypass reason:');
            if (reason) handleBypass(reason);
          }}
        />
      )}

      {/* Quick Actions */}
      {!wihId && (
        <div style={{
          background: 'var(--surface-panel)',
          border: '1px solid var(--ui-border-default)',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          color: 'var(--ui-text-muted)',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ui-text-primary)', margin: '0 0 8px 0' }}>
            No WIH Selected
          </h3>
          <p style={{ fontSize: '14px', margin: 0 }}>
            Enter a WIH ID above to view verification status and evidence
          </p>
        </div>
      )}
    </div>
  );
};

export default VerificationView;
