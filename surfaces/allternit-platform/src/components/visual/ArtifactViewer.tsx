/**
 * Artifact Viewer Component
 * 
 * Modal component for viewing full-size artifacts with detailed
 * metadata and analysis results.
 */

import React, { useEffect, useState } from 'react';
import { ArtifactType } from './EvidenceCard';

interface Artifact {
  id: string;
  type: ArtifactType;
  confidence: number;
  timestamp: string;
  data: {
    imageUrl?: string;
    textContent?: string;
    jsonData?: unknown;
  };
  metadata: Record<string, unknown>;
  analysis?: {
    issues?: string[];
    warnings?: string[];
    recommendations?: string[];
  };
}

export interface ArtifactViewerProps {
  artifact: Artifact | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

const typeLabels: Record<ArtifactType, string> = {
  ui_state: 'UI Screenshot',
  coverage_map: 'Coverage Visualization',
  console_output: 'Console Logs',
  visual_diff: 'Visual Difference',
  error_state: 'Error State',
};

const typeIcons: Record<ArtifactType, string> = {
  ui_state: '🖼️',
  coverage_map: '📊',
  console_output: '📜',
  visual_diff: '👁️',
  error_state: '⚠️',
};

const typeColors: Record<ArtifactType, string> = {
  ui_state: 'rgba(59, 130, 246, 0.15)',
  coverage_map: 'rgba(34, 197, 94, 0.15)',
  console_output: 'rgba(234, 179, 8, 0.15)',
  visual_diff: 'rgba(168, 85, 247, 0.15)',
  error_state: 'rgba(239, 68, 68, 0.15)',
};

export const ArtifactViewer: React.FC<ArtifactViewerProps> = ({
  artifact,
  isOpen,
  onClose,
  onNavigate,
  hasPrev = false,
  hasNext = false,
}) => {
  const [activeTab, setActiveTab] = useState<'content' | 'analysis'>('content');

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!artifact || !isOpen) return null;

  const formatTimestamp = (ts: string): string => {
    const date = new Date(ts);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const confidenceColor = artifact.confidence >= 0.7 ? 'var(--status-success)' : artifact.confidence >= 0.5 ? 'var(--status-warning)' : 'var(--status-error)';

  const hasAnalysis = artifact.analysis && (
    (artifact.analysis.issues?.length || 0) > 0 ||
    (artifact.analysis.warnings?.length || 0) > 0 ||
    (artifact.analysis.recommendations?.length || 0) > 0
  );

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '24px',
  };

  const containerStyle: React.CSSProperties = {
    background: 'var(--surface-panel)',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '1200px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid #333',
  };

  const buttonStyle = (disabled?: boolean): React.CSSProperties => ({
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    border: '1px solid #333',
    background: 'transparent',
    color: 'var(--ui-text-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
  });

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
  };

  const viewerStyle: React.CSSProperties = {
    flex: 1,
    background: 'var(--surface-panel)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    overflow: 'auto',
  };

  const sidebarStyle: React.CSSProperties = {
    width: '320px',
    borderLeft: '1px solid #333',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const sectionStyle: React.CSSProperties = {
    padding: '16px 20px',
    borderBottom: '1px solid #333',
  };

  const renderContent = () => {
    if (artifact.data.imageUrl) {
      return (
        <img 
          src={artifact.data.imageUrl} 
          alt="Artifact" 
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)' }}
        />
      );
    }
    if (artifact.data.textContent) {
      return (
        <pre style={{ 
          background: 'var(--surface-panel)', 
          border: '1px solid #333', 
          borderRadius: '8px', 
          padding: '16px',
          fontFamily: 'monospace',
          fontSize: '13px',
          lineHeight: 1.6,
          color: 'var(--ui-text-primary)',
          maxWidth: '100%',
          maxHeight: '100%',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {artifact.data.textContent}
        </pre>
      );
    }
    if (artifact.data.jsonData) {
      return (
        <pre style={{ 
          background: 'var(--surface-panel)', 
          border: '1px solid #333', 
          borderRadius: '8px', 
          padding: '16px',
          fontFamily: 'monospace',
          fontSize: '12px',
          lineHeight: 1.5,
          color: 'var(--ui-text-primary)',
          maxWidth: '100%',
          maxHeight: '100%',
          overflow: 'auto',
        }}>
          {JSON.stringify(artifact.data.jsonData, null, 2)}
        </pre>
      );
    }
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '40px 20px',
        color: 'var(--ui-text-muted)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>{typeIcons[artifact.type]}</div>
        <div>No preview available for this artifact type</div>
      </div>
    );
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={containerStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '10px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: '20px',
              background: typeColors[artifact.type],
            }}>
              {typeIcons[artifact.type]}
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ui-text-primary)' }}>{typeLabels[artifact.type]}</div>
              <div style={{ fontSize: '12px', color: 'var(--ui-text-muted)', marginTop: '2px' }}>ID: {artifact.id}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onNavigate && (
              <>
                <button style={buttonStyle(!hasPrev)} onClick={() => onNavigate('prev')} disabled={!hasPrev}>←</button>
                <button style={buttonStyle(!hasNext)} onClick={() => onNavigate('next')} disabled={!hasNext}>→</button>
              </>
            )}
            <button style={{...buttonStyle(), fontSize: '20px', color: 'var(--ui-text-muted)'}} onClick={onClose}>×</button>
          </div>
        </div>

        <div style={contentStyle}>
          <div style={viewerStyle}>{renderContent()}</div>

          <div style={sidebarStyle}>
            <div style={sectionStyle}>
              <h4 style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--ui-text-muted)', margin: '0 0 12px 0' }}>
                Confidence Score
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '32px', fontWeight: 700, color: confidenceColor, fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(artifact.confidence * 100)}%
                </div>
                <div style={{ flex: 1, height: '8px', background: 'var(--surface-panel)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${artifact.confidence * 100}%`, background: confidenceColor, borderRadius: '4px', transition: 'width 0.3s ease' }} />
                </div>
              </div>
            </div>

            <div style={sectionStyle}>
              <h4 style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--ui-text-muted)', margin: '0 0 12px 0' }}>
                Metadata
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--ui-text-muted)' }}>Captured</span>
                  <span style={{ fontSize: '13px', color: 'var(--ui-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatTimestamp(artifact.timestamp)}</span>
                </div>
                {Object.entries(artifact.metadata).slice(0, 3).map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--ui-text-muted)' }}>{key}</span>
                    <span style={{ fontSize: '13px', color: 'var(--ui-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {hasAnalysis && (
              <div style={{ ...sectionStyle, flex: 1, overflow: 'auto' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--ui-text-muted)', margin: '0 0 12px 0' }}>
                  Analysis
                </h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {artifact.analysis?.issues?.map((issue, i) => (
                    <li key={`issue-${i}`} style={{ 
                      display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', lineHeight: 1.5,
                      background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-error)', border: '1px solid rgba(239, 68, 68, 0.3)'
                    }}>
                      <span>❌</span> {issue}
                    </li>
                  ))}
                  {artifact.analysis?.warnings?.map((warning, i) => (
                    <li key={`warning-${i}`} style={{ 
                      display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', lineHeight: 1.5,
                      background: 'var(--status-warning-bg)', color: 'var(--status-warning)', border: '1px solid color-mix(in srgb, var(--status-warning) 30%, transparent)'
                    }}>
                      <span>⚠️</span> {warning}
                    </li>
                  ))}
                  {artifact.analysis?.recommendations?.map((rec, i) => (
                    <li key={`rec-${i}`} style={{ 
                      display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', lineHeight: 1.5,
                      background: 'rgba(59, 130, 246, 0.1)', color: 'var(--status-info)', border: '1px solid rgba(59, 130, 246, 0.3)'
                    }}>
                      <span>💡</span> {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArtifactViewer;
