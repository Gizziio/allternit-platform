/**
 * Backend Status Component
 * 
 * Displays connection status and backend unavailable state
 * Integrates with useConnection hook for real-time status
 */

import React from 'react';
import { Cloud, Monitor, RefreshCw, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useConnection, ConnectionState } from '../hooks/useConnection';

interface BackendStatusProps {
  compact?: boolean;
}

export const BackendStatus: React.FC<BackendStatusProps> = ({ compact = false }) => {
  const {
    status,
    backend,
    error,
    health,
    retryCount,
    isRetrying,
    reconnect,
    switchBackend,
    getStatusMessage,
    getStatusColor,
    isConnected,
    isUnavailable,
    canRetry,
  } = useConnection();

  // Compact view for status bar
  if (compact) {
    return (
      <div className="backend-status-compact">
        <button
          className={`status-button ${status}`}
          onClick={reconnect}
          disabled={isRetrying}
          title={getStatusMessage()}
        >
          {status === 'connected' && <Wifi size={14} />}
          {status === 'connecting' && <RefreshCw size={14} className="animate-spin" />}
          {(status === 'error' || status === 'unavailable') && <WifiOff size={14} />}
          {status === 'disconnected' && <AlertCircle size={14} />}
          
          <span className="status-text" style={{ color: getStatusColor() }}>
            {backend === 'cloud' ? 'Cloud' : 'Local'}
          </span>
          
          {isRetrying && (
            <span className="retry-count">({retryCount + 1})</span>
          )}
        </button>

        <style>{`
          .backend-status-compact {
            display: flex;
            align-items: center;
          }
          
          .status-button {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 6px;
            border: none;
            background: transparent;
            color: var(--color-text-secondary);
            font-size: 11px;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          
          .status-button:hover:not(:disabled) {
            background: var(--color-bg-hover);
          }
          
          .status-button:disabled {
            cursor: not-allowed;
            opacity: 0.7;
          }
          
          .status-button.connected {
            color: var(--color-success);
          }
          
          .status-button.error,
          .status-button.unavailable {
            color: var(--color-error);
          }
          
          .status-button.connecting {
            color: var(--color-warning);
          }
          
          .status-text {
            font-weight: 500;
          }
          
          .retry-count {
            opacity: 0.7;
          }
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          .animate-spin {
            animation: spin 1s linear infinite;
          }
        `}</style>
      </div>
    );
  }

  // Full unavailable state view
  if (isUnavailable) {
    return (
      <div className="backend-unavailable-panel">
        <div className="unavailable-content">
          <div className="unavailable-icon">
            <WifiOff size={32} />
          </div>
          
          <h3 className="unavailable-title">Gizzi Terminal Server Not Running</h3>
          
          <p className="unavailable-description">
            The thin client requires the Gizzi Terminal Server to be running locally.
            Please start the server to continue.
          </p>
          
          <div className="unavailable-actions">
            <button 
              className="action-btn primary"
              onClick={reconnect}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Retrying... ({retryCount + 1}/{5})
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  Retry Connection
                </>
              )}
            </button>
            
            <button 
              className="action-btn secondary"
              onClick={() => switchBackend(backend === 'desktop' ? 'cloud' : 'desktop')}
            >
              {backend === 'desktop' ? (
                <>
                  <Cloud size={16} />
                  Try Cloud Backend
                </>
              ) : (
                <>
                  <Monitor size={16} />
                  Try Local Backend
                </>
              )}
            </button>
          </div>
          
          <div className="setup-instructions">
            <h4>To start the Terminal Server:</h4>
            <code className="command-block">
              ./dev/scripts/start-all.sh
            </code>
            <p className="command-note">
              Runs on http://127.0.0.1:4096
            </p>
          </div>
          
          {error && (
            <div className="error-details">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <style>{`
          .backend-unavailable-panel {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 300px;
            padding: 24px;
          }
          
          .unavailable-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            max-width: 320px;
            gap: 16px;
          }
          
          .unavailable-icon {
            width: 64px;
            height: 64px;
            border-radius: 16px;
            background: rgba(239, 68, 68, 0.1);
            color: var(--color-error);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .unavailable-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--color-text-primary);
            margin: 0;
          }
          
          .unavailable-description {
            font-size: 13px;
            color: var(--color-text-secondary);
            line-height: 1.5;
            margin: 0;
          }
          
          .unavailable-actions {
            display: flex;
            flex-direction: column;
            gap: 8px;
            width: 100%;
          }
          
          .action-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            border: none;
            width: 100%;
          }
          
          .action-btn.primary {
            background: var(--color-accent);
            color: #fff;
          }
          
          .action-btn.primary:hover:not(:disabled) {
            background: var(--color-accent-hover);
          }
          
          .action-btn.secondary {
            background: var(--color-bg-secondary);
            color: var(--color-text-primary);
            border: 1px solid var(--color-border);
          }
          
          .action-btn.secondary:hover {
            background: var(--color-bg-tertiary);
          }
          
          .action-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          
          .setup-instructions {
            margin-top: 8px;
            padding: 16px;
            background: var(--color-bg-secondary);
            border-radius: 8px;
            text-align: left;
            width: 100%;
          }
          
          .setup-instructions h4 {
            font-size: 12px;
            font-weight: 600;
            color: var(--color-text-secondary);
            margin: 0 0 12px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .command-block {
            display: block;
            padding: 10px 12px;
            background: var(--color-bg-primary);
            border-radius: 6px;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 12px;
            color: var(--color-accent);
            margin-bottom: 8px;
            word-break: break-all;
          }
          
          .command-note {
            font-size: 11px;
            color: var(--color-text-tertiary);
            margin: 0;
          }
          
          .error-details {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            background: rgba(239, 68, 68, 0.1);
            border-radius: 6px;
            font-size: 12px;
            color: var(--color-error);
            width: 100%;
          }
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          .animate-spin {
            animation: spin 1s linear infinite;
          }
        `}</style>
      </div>
    );
  }

  // Connected state with health info
  return (
    <div className="backend-connected-panel">
      <div className="connected-header">
        <div className="connected-status">
          <div className="status-dot connected" />
          <span className="status-label">Connected</span>
        </div>
        
        {health?.latency && (
          <span className="latency-badge">
            {health.latency}ms
          </span>
        )}
      </div>
      
      <div className="connection-details">
        <div className="detail-row">
          <span className="detail-label">Backend:</span>
          <span className="detail-value">
            {backend === 'cloud' ? (
              <><Cloud size={12} /> Cloud</>
            ) : (
              <><Monitor size={12} /> Local</>
            )}
          </span>
        </div>
        
        {health?.version && (
          <div className="detail-row">
            <span className="detail-label">Version:</span>
            <span className="detail-value">{health.version}</span>
          </div>
        )}
      </div>

      <style>{`
        .backend-connected-panel {
          padding: 16px;
          background: var(--color-bg-secondary);
          border-radius: 12px;
        }
        
        .connected-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        
        .connected-status {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--color-success);
        }
        
        .status-label {
          font-weight: 500;
          color: var(--color-success);
        }
        
        .latency-badge {
          font-size: 11px;
          padding: 2px 8px;
          background: rgba(34, 197, 94, 0.15);
          color: var(--color-success);
          border-radius: 4px;
        }
        
        .connection-details {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .detail-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
        }
        
        .detail-label {
          color: var(--color-text-secondary);
        }
        
        .detail-value {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--color-text-primary);
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

export default BackendStatus;
