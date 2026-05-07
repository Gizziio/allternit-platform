import React from 'react';
import { X } from '@phosphor-icons/react';
import { THEME } from '../constants';

export function ConnectorConnectModal({
  connectorName,
  accountLabel,
  onAccountLabelChange,
  onClose,
  onConnect,
  isConnecting,
}: {
  connectorName: string;
  accountLabel: string;
  onAccountLabelChange: (value: string) => void;
  onClose: () => void;
  onConnect: () => void;
  isConnecting: boolean;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 230,
        backgroundColor: 'var(--shell-overlay-backdrop)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      role="dialog"
      aria-label={`Connect ${connectorName}`}
    >
      <div
        style={{
          width: 'min(520px, 100%)',
          borderRadius: 12,
          border: `1px solid ${THEME.borderStrong}`,
          backgroundColor: THEME.bgElevated,
          padding: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 20, color: THEME.textPrimary }}>Connect {connectorName}</h3>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', color: THEME.textTertiary, cursor: 'pointer' }}
            aria-label="Close connect dialog"
            disabled={isConnecting}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ margin: 0, marginBottom: 12, fontSize: 13, color: THEME.textSecondary, lineHeight: 1.55 }}>
          Add an optional account label so this connector can be identified in connected workspace context.
        </p>

        <label style={{ display: 'block', fontSize: 12, color: THEME.textTertiary, marginBottom: 6 }}>
          Account label (optional)
        </label>
        <input
          value={accountLabel}
          onChange={(event) => onAccountLabelChange(event.target.value)}
          placeholder="team@company.com"
          style={{
            width: '100%',
            borderRadius: 8,
            border: `1px solid ${THEME.border}`,
            backgroundColor: 'var(--surface-hover)',
            color: THEME.textPrimary,
            fontSize: 13,
            padding: '9px 11px',
            outline: 'none',
          }}
          disabled={isConnecting}
        />

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            disabled={isConnecting}
            style={{
              padding: '8px 12px',
              borderRadius: 7,
              border: `1px solid ${THEME.borderStrong}`,
              backgroundColor: 'transparent',
              color: THEME.textSecondary,
              fontSize: 12,
              cursor: isConnecting ? 'default' : 'pointer',
              opacity: isConnecting ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConnect}
            disabled={isConnecting}
            style={{
              padding: '8px 14px',
              borderRadius: 7,
              border: 'none',
              backgroundColor: THEME.textPrimary,
              color: THEME.bg,
              fontSize: 12,
              fontWeight: 600,
              cursor: isConnecting ? 'default' : 'pointer',
              opacity: isConnecting ? 0.7 : 1,
            }}
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
