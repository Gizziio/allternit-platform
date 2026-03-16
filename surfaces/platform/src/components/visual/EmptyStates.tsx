/**
 * Empty States Component
 * 
 * Various empty state designs for different verification scenarios.
 */

import React from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

const baseStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '60px 40px',
  textAlign: 'center',
  color: '#888',
};

const iconContainerStyle: React.CSSProperties = {
  width: '80px',
  height: '80px',
  borderRadius: '20px',
  background: '#0a0a0a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '40px',
  marginBottom: '24px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 600,
  color: '#fff',
  margin: '0 0 8px 0',
};

const descriptionStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#888',
  margin: '0 0 24px 0',
  maxWidth: '400px',
};

const buttonStyle: React.CSSProperties = {
  padding: '12px 24px',
  borderRadius: '8px',
  border: 'none',
  background: '#3b82f6',
  color: '#fff',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  marginBottom: '12px',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '12px 24px',
  borderRadius: '8px',
  border: '1px solid #333',
  background: 'transparent',
  color: '#888',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '🔍',
  title,
  description,
  action,
  secondaryAction,
}) => (
  <div style={baseStyle}>
    <div style={iconContainerStyle}>{icon}</div>
    <h3 style={titleStyle}>{title}</h3>
    <p style={descriptionStyle}>{description}</p>
    {action && (
      <button style={buttonStyle} onClick={action.onClick}>
        {action.label}
      </button>
    )}
    {secondaryAction && (
      <button style={secondaryButtonStyle} onClick={secondaryAction.onClick}>
        {secondaryAction.label}
      </button>
    )}
  </div>
);

// Predefined empty states
export const NoWihSelected: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <EmptyState
    icon="🔍"
    title="No WIH Selected"
    description="Enter a Work-in-Handshake ID to view visual verification status and evidence"
    action={{ label: "Enter WIH ID", onClick: onStart }}
  />
);

export const NoEvidenceFound: React.FC<{ wihId: string; onCapture: () => void }> = ({ 
  wihId, 
  onCapture 
}) => (
  <EmptyState
    icon="📭"
    title="No Evidence Found"
    description={`No visual evidence has been captured for ${wihId} yet. Start verification to capture screenshots, coverage data, and console output.`}
    action={{ label: "Start Verification", onClick: onCapture }}
  />
);

export const VerificationFailed: React.FC<{ 
  wihId: string; 
  error: string;
  onRetry: () => void;
  onBypass: () => void;
}> = ({ wihId, error, onRetry, onBypass }) => (
  <div style={{ ...baseStyle, background: 'rgba(239, 68, 68, 0.05)', borderRadius: '12px' }}>
    <div style={{ ...iconContainerStyle, background: 'rgba(239, 68, 68, 0.15)' }}>❌</div>
    <h3 style={{ ...titleStyle, color: '#ef4444' }}>Verification Failed</h3>
    <p style={descriptionStyle}>{error}</p>
    <div style={{ display: 'flex', gap: '12px' }}>
      <button style={buttonStyle} onClick={onRetry}>Retry</button>
      <button style={{ ...secondaryButtonStyle, borderColor: '#ef4444', color: '#ef4444' }} onClick={onBypass}>
        Request Bypass
      </button>
    </div>
  </div>
);

export const VerificationPassed: React.FC<{ 
  wihId: string;
  confidence: number;
  onViewDetails: () => void;
}> = ({ wihId, confidence, onViewDetails }) => (
  <div style={{ ...baseStyle, background: 'rgba(34, 197, 94, 0.05)', borderRadius: '12px' }}>
    <div style={{ ...iconContainerStyle, background: 'rgba(34, 197, 94, 0.15)' }}>✅</div>
    <h3 style={{ ...titleStyle, color: '#22c55e' }}>Verification Passed</h3>
    <p style={descriptionStyle}>
      {wihId} passed visual verification with {Math.round(confidence * 100)}% confidence.
      All required artifacts meet quality thresholds.
    </p>
    <button style={{ ...buttonStyle, background: '#22c55e' }} onClick={onViewDetails}>
      View Details
    </button>
  </div>
);

export const AllArtifactsPassed: React.FC = () => (
  <div style={{ ...baseStyle, padding: '40px 20px' }}>
    <div style={{ ...iconContainerStyle, width: '60px', height: '60px', fontSize: '30px' }}>🎉</div>
    <h3 style={{ ...titleStyle, fontSize: '16px' }}>All Artifacts Passed</h3>
    <p style={{ ...descriptionStyle, fontSize: '13px' }}>
      Great job! All visual verification artifacts meet the required confidence threshold.
    </p>
  </div>
);

export const LoadingState: React.FC<{ message?: string }> = ({ message = "Loading verification data..." }) => (
  <div style={baseStyle}>
    <div style={{ 
      ...iconContainerStyle, 
      animation: 'spin 1s linear infinite',
    }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      ⏳
    </div>
    <h3 style={titleStyle}>Loading...</h3>
    <p style={descriptionStyle}>{message}</p>
  </div>
);

export default EmptyState;
