/**
 * Visual Verification Panel
 * 
 * Main dashboard component for visual verification showing:
 * - Overall confidence score
 * - Evidence artifacts grid
 * - Historical trends
 * - Real-time status updates
 */

import React, { useState, useCallback } from 'react';
import { ConfidenceMeter } from './ConfidenceMeter';
import { EvidenceCard, ArtifactType } from './EvidenceCard';
import { ArtifactViewer } from './ArtifactViewer';
import { TrendChart } from './TrendChart';

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

export interface VerificationStatus {
  wihId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  overallConfidence: number;
  threshold: number;
  artifacts: Artifact[];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

interface TrendDataPoint {
  timestamp: string;
  confidence: number;
  wihId?: string;
}

export interface VisualVerificationPanelProps {
  wihId?: string;
  status?: VerificationStatus;
  trendData?: TrendDataPoint[];
  onRefresh?: () => void;
  onRequestBypass?: () => void;
  className?: string;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  completed: { bg: 'rgba(34, 197, 94, 0.15)', text: 'var(--status-success)' },
  running: { bg: 'rgba(59, 130, 246, 0.15)', text: 'var(--status-info)' },
  failed: { bg: 'rgba(239, 68, 68, 0.15)', text: 'var(--status-error)' },
  pending: { bg: 'rgba(107, 114, 128, 0.15)', text: 'var(--ui-text-muted)' },
};

export const VisualVerificationPanel: React.FC<VisualVerificationPanelProps> = ({
  wihId,
  status,
  trendData = [],
  onRefresh,
  onRequestBypass,
  className,
}) => {
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [artifactFilter, setArtifactFilter] = useState<ArtifactType | 'all'>('all');

  const filteredArtifacts = status?.artifacts.filter(
    a => artifactFilter === 'all' || a.type === artifactFilter
  ) || [];

  const passedCount = status?.artifacts.filter(a => a.confidence >= (status?.threshold || 0.7)).length || 0;
  const totalCount = status?.artifacts.length || 0;

  const handleArtifactNavigate = useCallback((direction: 'prev' | 'next') => {
    if (!selectedArtifact || !status) return;
    
    const currentIndex = filteredArtifacts.findIndex(a => a.id === selectedArtifact.id);
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex >= 0 && newIndex < filteredArtifacts.length) {
      setSelectedArtifact(filteredArtifacts[newIndex]);
    }
  }, [selectedArtifact, filteredArtifacts, status]);

  const currentArtifactIndex = selectedArtifact 
    ? filteredArtifacts.findIndex(a => a.id === selectedArtifact.id)
    : -1;

  if (!status) {
    return (
      <div style={{ 
        background: 'var(--surface-panel)', 
        border: '1px solid #333', 
        borderRadius: '16px', 
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }} className={className}>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '60px 20px',
          color: 'var(--ui-text-muted)',
          textAlign: 'center',
          gap: '16px',
        }}>
          <div style={{ 
            width: '80px', 
            height: '80px', 
            borderRadius: '20px', 
            background: 'var(--surface-panel)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '40px',
          }}>🔍</div>
          <div>No verification data available</div>
          <div style={{ fontSize: '13px' }}>Run visual verification to see results here</div>
        </div>
      </div>
    );
  }

  const statusColor = statusColors[status.status] || statusColors.pending;

  return (
    <div 
      style={{ 
        background: 'var(--surface-panel)', 
        border: '1px solid #333', 
        borderRadius: '16px', 
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }} 
      className={className}
      role="region"
      aria-label={`Visual verification panel for ${wihId || status?.wihId || 'unknown WIH'}`}
    >
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '20px 24px',
        borderBottom: '1px solid #333',
        background: 'var(--surface-panel)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            borderRadius: '12px', 
            background: 'rgba(59, 130, 246, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
          }}>🔍</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ui-text-primary)', margin: 0 }}>Visual Verification</h3>
            <span style={{ fontSize: '13px', color: 'var(--ui-text-muted)', fontFamily: 'monospace' }}>{wihId || status.wihId}</span>
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            padding: '6px 14px', 
            borderRadius: '20px', 
            fontSize: '12px', 
            fontWeight: 600, 
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            background: statusColor.bg,
            color: statusColor.text,
          }}>
            <div style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              background: 'currentColor',
              animation: status.status === 'running' ? 'pulse 1.5s ease-in-out infinite' : 'none',
            }} />
            {status.status}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {status.status === 'running' && (
            <>
              <span style={{ fontSize: '13px', color: 'var(--ui-text-muted)' }}>Analyzing...</span>
              <div style={{ width: '100px', height: '4px', background: 'var(--surface-hover)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: '60%', height: '100%', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', transition: 'width 0.3s ease' }} />
              </div>
            </>
          )}
          {onRefresh && (
            <button 
              onClick={onRefresh} 
              title="Refresh"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                border: '1px solid #333',
                background: 'transparent',
                color: 'var(--ui-text-primary)',
              }}
            >🔄</button>
          )}
          {status.status === 'failed' && onRequestBypass && (
            <button 
              onClick={onRequestBypass}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                border: '1px solid #ef4444',
                background: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--status-error)',
              }}
            >Request Bypass</button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px' }}>
        {status.error && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            padding: '16px 20px', 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.3)', 
            borderRadius: '12px', 
            color: 'var(--status-error)', 
            fontSize: '14px',
          }}>
            <span>⚠️</span>
            {status.error}
          </div>
        )}

        {/* Top Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '24px', alignItems: 'start' }}>
          {/* Confidence Section */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '16px', 
            padding: '24px', 
            background: 'var(--surface-panel)', 
            borderRadius: '12px',
            minWidth: '200px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ui-text-primary)' }}>Overall Confidence</div>
            <ConfidenceMeter
              confidence={status.overallConfidence}
              threshold={status.threshold}
              size="large"
              animated={status.status === 'completed'}
            />
          </div>

          {/* Summary Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div style={{ 
                background: 'var(--surface-panel)', 
                border: '1px solid #333', 
                borderRadius: '12px', 
                padding: '16px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '8px',
              }}>
                <span style={{ fontSize: '12px', color: 'var(--ui-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Artifacts</span>
                <span style={{ 
                  fontSize: '24px', 
                  fontWeight: 700, 
                  color: passedCount === totalCount ? 'var(--status-success)' : passedCount > totalCount / 2 ? 'var(--status-warning)' : 'var(--status-error)',
                  fontVariantNumeric: 'tabular-nums',
                }}>{passedCount}/{totalCount}</span>
              </div>
              <div style={{ 
                background: 'var(--surface-panel)', 
                border: '1px solid #333', 
                borderRadius: '12px', 
                padding: '16px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '8px',
              }}>
                <span style={{ fontSize: '12px', color: 'var(--ui-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Threshold</span>
                <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ui-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(status.threshold * 100)}%</span>
              </div>
              <div style={{ 
                background: 'var(--surface-panel)', 
                border: '1px solid #333', 
                borderRadius: '12px', 
                padding: '16px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '8px',
              }}>
                <span style={{ fontSize: '12px', color: 'var(--ui-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Duration</span>
                <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ui-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {status.completedAt 
                    ? `${Math.round((new Date(status.completedAt).getTime() - new Date(status.startedAt).getTime()) / 1000)}s`
                    : '--'}
                </span>
              </div>
            </div>

            {trendData.length > 0 && (
              <TrendChart
                data={trendData}
                threshold={status.threshold}
                height={150}
                showPoints={false}
              />
            )}
          </div>
        </div>

        {/* Evidence Grid */}
        {filteredArtifacts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ 
                fontSize: '14px', 
                fontWeight: 600, 
                color: 'var(--ui-text-primary)', 
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                Evidence Artifacts
                <span style={{ fontSize: '12px', color: 'var(--ui-text-muted)', fontWeight: 'normal', textTransform: 'none' }}>({filteredArtifacts.length} items)</span>
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setArtifactFilter('all')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: `1px solid ${artifactFilter === 'all' ? 'var(--status-info)' : 'var(--surface-hover)'}`,
                    background: artifactFilter === 'all' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    color: artifactFilter === 'all' ? 'var(--status-info)' : 'var(--ui-text-muted)',
                  }}
                >All</button>
                {(['ui_state', 'coverage_map', 'console_output', 'visual_diff', 'error_state'] as ArtifactType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => setArtifactFilter(type)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      border: `1px solid ${artifactFilter === type ? 'var(--status-info)' : 'var(--surface-hover)'}`,
                      background: artifactFilter === type ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                      color: artifactFilter === type ? 'var(--status-info)' : 'var(--ui-text-muted)',
                    }}
                  >
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {filteredArtifacts.map(artifact => (
                <EvidenceCard
                  key={artifact.id}
                  type={artifact.type}
                  confidence={artifact.confidence}
                  timestamp={artifact.timestamp}
                  metadata={artifact.metadata}
                  previewUrl={artifact.data.imageUrl}
                  onClick={() => setSelectedArtifact(artifact)}
                  isSelected={selectedArtifact?.id === artifact.id}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <ArtifactViewer
        artifact={selectedArtifact}
        isOpen={!!selectedArtifact}
        onClose={() => setSelectedArtifact(null)}
        onNavigate={handleArtifactNavigate}
        hasPrev={currentArtifactIndex > 0}
        hasNext={currentArtifactIndex < filteredArtifacts.length - 1}
      />
    </div>
  );
};

export default VisualVerificationPanel;
