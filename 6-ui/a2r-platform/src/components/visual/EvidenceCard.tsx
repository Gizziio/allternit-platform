/**
 * Evidence Card Component
 * 
 * Displays individual artifact evidence with preview, metadata,
 * and confidence score for a specific artifact type.
 */

import React, { useState } from 'react';

export type ArtifactType = 
  | 'ui_state' 
  | 'coverage_map' 
  | 'console_output' 
  | 'visual_diff' 
  | 'error_state';

export interface EvidenceCardProps {
  type: ArtifactType;
  confidence: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
  previewUrl?: string;
  onClick?: () => void;
  isSelected?: boolean;
  ariaLabel?: string;
}

const typeIcons: Record<ArtifactType, string> = {
  ui_state: '🖼️',
  coverage_map: '📊',
  console_output: '📜',
  visual_diff: '👁️',
  error_state: '⚠️',
};

const typeLabels: Record<ArtifactType, string> = {
  ui_state: 'UI State',
  coverage_map: 'Coverage',
  console_output: 'Console',
  visual_diff: 'Visual Diff',
  error_state: 'Errors',
};

const typeColors: Record<ArtifactType, { bg: string; text: string }> = {
  ui_state: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
  coverage_map: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
  console_output: { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308' },
  visual_diff: { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7' },
  error_state: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
};

export const EvidenceCard: React.FC<EvidenceCardProps> = ({
  type,
  confidence,
  timestamp,
  metadata,
  previewUrl,
  onClick,
  isSelected,
  ariaLabel,
}) => {
  const [imageError, setImageError] = useState(false);
  const typeColor = typeColors[type];
  const confidenceColor = confidence >= 0.7 ? '#22c55e' : confidence >= 0.5 ? '#eab308' : '#ef4444';

  const cardStyle: React.CSSProperties = {
    background: '#1a1a1a',
    border: `1px solid ${isSelected ? '#3b82f6' : confidence >= 0.7 ? 'rgba(34, 197, 94, 0.3)' : confidence >= 0.5 ? 'rgba(234, 179, 8, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
    borderRadius: '12px',
    padding: '16px',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 0.2s ease',
    position: 'relative',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  };

  const typeBadgeStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    background: typeColor.bg,
    color: typeColor.text,
  };

  const confidenceBadgeStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    background: confidence >= 0.7 ? 'rgba(34, 197, 94, 0.15)' : confidence >= 0.5 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
    color: confidenceColor,
  };

  const previewStyle: React.CSSProperties = {
    aspectRatio: '16 / 10',
    background: '#0a0a0a',
    borderRadius: '8px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
  };

  const placeholderStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    color: '#666',
    fontSize: '13px',
  };

  const progressBarStyle: React.CSSProperties = {
    height: '4px',
    background: '#0a0a0a',
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '8px',
  };

  const progressFillStyle: React.CSSProperties = {
    height: '100%',
    width: `${confidence * 100}%`,
    background: confidenceColor,
    transition: 'width 0.3s ease',
  };

  const metadataStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '12px',
  };

  const metadataItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    background: '#0a0a0a',
    borderRadius: '6px',
    fontSize: '11px',
    color: '#888',
  };

  const timestampStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#666',
    marginTop: '8px',
  };

  const formatTimestamp = (ts: string): string => {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div 
      style={cardStyle} 
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel || `${typeLabels[type]} artifact with ${Math.round(confidence * 100)}% confidence`}
      aria-selected={isSelected}
    >
      <div style={headerStyle}>
        <div style={typeBadgeStyle}>
          {typeIcons[type]} {typeLabels[type]}
        </div>
        <div style={confidenceBadgeStyle}>
          {Math.round(confidence * 100)}%
        </div>
      </div>

      <div style={previewStyle}>
        {previewUrl && !imageError ? (
          <img 
            src={previewUrl} 
            alt={`${typeLabels[type]} preview`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImageError(true)}
          />
        ) : (
          <div style={placeholderStyle}>
            <div style={{ 
              width: '48px', 
              height: '48px', 
              borderRadius: '12px', 
              background: '#2a2a2a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              {typeIcons[type]}
            </div>
            {typeLabels[type]}
          </div>
        )}
      </div>

      <div style={progressBarStyle}>
        <div style={progressFillStyle} />
      </div>

      {metadata && Object.keys(metadata).length > 0 && (
        <div style={metadataStyle}>
          {Object.entries(metadata).slice(0, 3).map(([key, value]) => (
            <div key={key} style={metadataItemStyle}>
              <span style={{ fontWeight: 500 }}>{key}:</span>
              <span style={{ color: '#fff' }}>{String(value)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={timestampStyle}>Captured at {formatTimestamp(timestamp)}</div>
    </div>
  );
};

export default EvidenceCard;
