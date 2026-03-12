/**
 * Visual Verification Panel
 * 
 * ShellUI component for displaying visual evidence and verification results.
 * Shows screenshots, coverage maps, console output, and confidence scores.
 */

import React, { useState, useEffect } from 'react';
import type { EvidenceFile } from '@/runtime/verification';

interface VisualVerificationPanelProps {
  wihId: string;
  evidence?: EvidenceFile;
  loading?: boolean;
  onRefresh?: () => void;
  onBypass?: (reason: string) => void;
}

export const VisualVerificationPanel: React.FC<VisualVerificationPanelProps> = ({
  wihId,
  evidence,
  loading = false,
  onRefresh,
  onBypass,
}) => {
  const [selectedArtifact, setSelectedArtifact] = useState<number>(0);
  const [bypassReason, setBypassReason] = useState('');
  const [showBypassDialog, setShowBypassDialog] = useState(false);

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        <p>Capturing visual evidence for {wihId}...</p>
      </div>
    );
  }

  if (!evidence) {
    return (
      <div style={styles.empty}>
        <p>No visual evidence available</p>
        {onRefresh && <button onClick={onRefresh}>Capture Evidence</button>}
      </div>
    );
  }

  const passed = evidence.success && evidence.overall_confidence >= 0.7;
  const confidencePercent = Math.round(evidence.overall_confidence * 100);

  return (
    <div style={{ ...styles.panel, ...(passed ? styles.passed : styles.failed) }}>
      {/* Header */}
      <div style={styles.header}>
        <h3>Visual Verification</h3>
        <div style={{ ...styles.badge, ...(passed ? styles.badgePass : styles.badgeFail) }}>
          {passed ? '✓ PASSED' : '✗ FAILED'}
        </div>
      </div>

      {/* Confidence Score */}
      <div style={styles.confidenceSection}>
        <div style={styles.confidenceBar}>
          <div 
            style={{
              ...styles.confidenceFill,
              width: `${confidencePercent}%`,
              backgroundColor: confidencePercent >= 70 ? '#4caf50' : 
                              confidencePercent >= 50 ? '#ff9800' : '#f44336'
            }}
          />
        </div>
        <div style={styles.confidenceLabel}>
          Confidence: {confidencePercent}% (threshold: 70%)
        </div>
      </div>

      {/* Artifact Tabs */}
      <div style={styles.tabs}>
        {evidence.artifacts.map((artifact, index) => (
          <button
            key={index}
            style={{ ...styles.tab, ...(selectedArtifact === index ? styles.tabActive : {}) }}
            onClick={() => setSelectedArtifact(index)}
          >
            {getArtifactIcon(artifact.type)} {artifact.type}{' '}
            <span style={styles.tabConfidence}>{Math.round(artifact.confidence * 100)}%</span>
          </button>
        ))}
      </div>

      {/* Artifact Viewer */}
      <div style={styles.viewer}>
        {renderArtifact(evidence.artifacts[selectedArtifact])}
      </div>

      {/* Errors */}
      {evidence.errors.length > 0 && (
        <div style={styles.errors}>
          <h4>Errors</h4>
          <ul>
            {evidence.errors.map((error, i) => (
              <li key={i} style={styles.errorItem}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div style={styles.actions}>
        {onRefresh && <button onClick={onRefresh}>↻ Refresh</button>}
        {!passed && onBypass && (
          <button onClick={() => setShowBypassDialog(true)} style={styles.bypassBtn}>
            ⚠ Bypass
          </button>
        )}
      </div>

      {/* Bypass Dialog */}
      {showBypassDialog && (
        <div style={styles.dialog}>
          <h4>Bypass Visual Verification</h4>
          <textarea
            style={styles.textarea}
            placeholder="Enter reason for bypass..."
            value={bypassReason}
            onChange={(e) => setBypassReason(e.target.value)}
          />
          <div style={styles.dialogActions}>
            <button onClick={() => setShowBypassDialog(false)}>Cancel</button>
            <button 
              onClick={() => { onBypass?.(bypassReason); setShowBypassDialog(false); }}
              disabled={!bypassReason.trim()}
            >
              Confirm Bypass
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Styles
const styles: Record<string, React.CSSProperties> = {
  panel: {
    border: '1px solid #ccc',
    borderRadius: 8,
    padding: 16,
    background: '#f5f5f5',
    fontFamily: 'system-ui, sans-serif',
  },
  passed: { borderLeft: '4px solid #4caf50' },
  failed: { borderLeft: '4px solid #f44336' },
  loading: { textAlign: 'center', padding: 40 },
  spinner: {
    width: 40,
    height: 40,
    border: '4px solid #ccc',
    borderTop: '4px solid #333',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  empty: { textAlign: 'center', padding: 40 },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  badge: {
    padding: '4px 12px',
    borderRadius: 4,
    fontWeight: 'bold',
    fontSize: 12,
  },
  badgePass: { background: '#4caf50', color: 'white' },
  badgeFail: { background: '#f44336', color: 'white' },
  confidenceSection: { marginBottom: 16 },
  confidenceBar: {
    height: 8,
    background: '#ddd',
    borderRadius: 4,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  confidenceLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#666',
  },
  tabs: {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
    overflowX: 'auto',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: 4,
    background: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  tabActive: {
    background: '#333',
    borderColor: '#333',
    color: 'white',
  },
  tabConfidence: {
    fontSize: 10,
    opacity: 0.7,
  },
  viewer: {
    minHeight: 300,
    border: '1px solid #ccc',
    borderRadius: 4,
    padding: 16,
    background: '#fff',
    marginBottom: 16,
  },
  errors: { marginBottom: 16 },
  errorItem: {
    color: '#f44336',
    fontSize: 12,
  },
  actions: {
    display: 'flex',
    gap: 8,
  },
  bypassBtn: {
    background: '#ff9800',
    color: 'white',
  },
  dialog: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: '#fff',
    border: '1px solid #ccc',
    borderRadius: 8,
    padding: 24,
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    zIndex: 1000,
  },
  textarea: {
    width: '100%',
    minHeight: 100,
    margin: '16px 0',
    padding: 8,
  },
  dialogActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
};

// Helper functions
function getArtifactIcon(type: string): string {
  const icons: Record<string, string> = {
    'ui-state': '🖼️',
    'coverage-map': '📊',
    'console-output': '📋',
    'visual-diff': '👁️',
    'error-state': '⚠️',
  };
  return icons[type] || '📄';
}

function renderArtifact(artifact: any) {
  return (
    <pre style={{ fontSize: 12, overflow: 'auto' }}>
      {JSON.stringify(artifact, null, 2)}
    </pre>
  );
}
