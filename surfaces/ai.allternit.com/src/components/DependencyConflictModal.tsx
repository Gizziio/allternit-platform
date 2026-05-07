/**
 * DependencyConflictModal Component
 * 
 * Modal shown when there's a version conflict between plugins.
 * Displays conflict details and provides resolution options.
 */

import React, { useState, useCallback } from 'react';
import {
  X,
  Warning,
  CheckCircle,
  ArrowRight,
  Package,
  Info,
  ShieldWarning,
} from '@phosphor-icons/react';
import type { DependencyConflict } from '../plugins/dependencies';

// ============================================================================
// Theme
// ============================================================================

const THEME = {
  bg: 'var(--surface-canvas)',
  bgElevated: 'var(--surface-panel)',
  bgGlass: 'rgba(28, 25, 23, 0.95)',
  accent: 'var(--accent-primary)',
  accentMuted: 'rgba(212, 176, 140, 0.15)',
  textPrimary: 'var(--ui-text-primary)',
  textSecondary: 'var(--ui-text-secondary)',
  textTertiary: 'var(--ui-text-muted)',
  border: 'rgba(212, 176, 140, 0.1)',
  borderStrong: 'rgba(212, 176, 140, 0.2)',
  success: 'var(--status-success)',
  danger: 'var(--status-error)',
  warning: 'var(--status-warning)',
  info: 'var(--status-info)',
};

// ============================================================================
// Types
// ============================================================================

export interface DependencyConflictModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** The conflict to resolve */
  conflict: DependencyConflict | null;
  /** Plugin that's being installed */
  installingPlugin: {
    id: string;
    name: string;
    version: string;
  };
  /** Called when user selects a resolution */
  onResolve: (resolution: 'keep' | 'upgrade' | 'force' | 'cancel', options?: { 
    upgradeAll?: boolean;
    forceVersion?: string;
  }) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Available versions for the conflicting dependency */
  availableVersions?: string[];
}

type ResolutionOption = 'keep' | 'upgrade' | 'force';

interface ResolutionCardProps {
  option: ResolutionOption;
  isSelected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  icon: React.ReactNode;
  risk: 'low' | 'medium' | 'high';
  details?: React.ReactNode;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatVersionRange(range: string): string {
  if (range === '*') return 'any version';
  return range;
}

function getRiskColor(risk: 'low' | 'medium' | 'high'): string {
  switch (risk) {
    case 'low':
      return THEME.success;
    case 'medium':
      return THEME.warning;
    case 'high':
      return THEME.danger;
    default:
      return THEME.textTertiary;
  }
}

function getRiskLabel(risk: 'low' | 'medium' | 'high'): string {
  switch (risk) {
    case 'low':
      return 'Low Risk';
    case 'medium':
      return 'Medium Risk';
    case 'high':
      return 'High Risk';
    default:
      return 'Unknown';
  }
}

// ============================================================================
// Resolution Card Component
// ============================================================================

function ResolutionCard({
  option,
  isSelected,
  onSelect,
  title,
  description,
  icon,
  risk,
  details,
}: ResolutionCardProps) {
  const riskColor = getRiskColor(risk);
  
  return (
    <button
      onClick={onSelect}
      style={{
        width: '100%',
        padding: 16,
        borderRadius: 8,
        border: `2px solid ${isSelected ? THEME.accent : THEME.border}`,
        backgroundColor: isSelected ? 'rgba(212, 176, 140, 0.08)' : THEME.bgElevated,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            backgroundColor: isSelected ? THEME.accentMuted : 'var(--surface-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: isSelected ? THEME.accent : THEME.textPrimary,
              }}
            >
              {title}
            </span>
            <span
              style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 4,
                backgroundColor: `${riskColor}20`,
                color: riskColor,
                fontWeight: 500,
              }}
            >
              {getRiskLabel(risk)}
            </span>
          </div>
          
          <p
            style={{
              fontSize: 12,
              color: THEME.textSecondary,
              margin: '0 0 8px',
              lineHeight: 1.5,
            }}
          >
            {description}
          </p>
          
          {details && (
            <div
              style={{
                padding: 10,
                backgroundColor: 'var(--surface-hover)',
                borderRadius: 6,
                marginTop: 8,
              }}
            >
              {details}
            </div>
          )}
        </div>
        
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: `2px solid ${isSelected ? THEME.accent : THEME.borderStrong}`,
            backgroundColor: isSelected ? THEME.accent : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isSelected && <CheckCircle size={12} color="#0c0a09" />}
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DependencyConflictModal({
  isOpen,
  conflict,
  installingPlugin,
  onResolve,
  onCancel,
  availableVersions,
}: DependencyConflictModalProps) {
  const [selectedOption, setSelectedOption] = useState<ResolutionOption>('keep');
  const [upgradeAll, setUpgradeAll] = useState(false);
  const [forceVersion, setForceVersion] = useState<string>('');
  
  const handleResolve = useCallback(() => {
    onResolve(selectedOption, {
      upgradeAll,
      forceVersion: forceVersion || undefined,
    });
  }, [selectedOption, upgradeAll, forceVersion, onResolve]);
  
  if (!isOpen || !conflict) return null;
  
  const { pluginId, installedVersion, conflictingRequirements } = conflict;
  
  // Get unique requirements
  const uniqueReqs = conflictingRequirements.filter(
    (req, index, self) => 
      index === self.findIndex(r => r.requiredBy === req.requiredBy)
  );
  
  // Find the requirement from the installing plugin
  const installingReq = uniqueReqs.find(r => r.requiredBy === installingPlugin.id);
  const otherReqs = uniqueReqs.filter(r => r.requiredBy !== installingPlugin.id);
  
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-modal-title"
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          backgroundColor: THEME.bgGlass,
          border: `1px solid ${THEME.borderStrong}`,
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${THEME.border}`,
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Warning size={20} color={THEME.warning} />
            </div>
            <div>
              <h2
                id="conflict-modal-title"
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: THEME.textPrimary,
                  margin: 0,
                }}
              >
                Version Conflict Detected
              </h2>
              <p style={{ fontSize: 12, color: THEME.textSecondary, margin: '4px 0 0' }}>
                {pluginId} has incompatible version requirements
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: 'none',
              backgroundColor: 'transparent',
              color: THEME.textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        
        {/* Conflict Details */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${THEME.border}`,
            backgroundColor: THEME.bgElevated,
          }}
        >
          <div
            style={{
              padding: 12,
              backgroundColor: 'var(--surface-hover)',
              borderRadius: 8,
              border: `1px solid ${THEME.border}`,
            }}
          >
            {/* Installed Version */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
                paddingBottom: 12,
                borderBottom: `1px solid ${THEME.border}`,
              }}
            >
              <Package size={16} color={THEME.textSecondary} />
              <span style={{ fontSize: 13, color: THEME.textSecondary }}>
                Currently installed:
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: THEME.textPrimary,
                  padding: '2px 8px',
                  backgroundColor: 'var(--surface-hover)',
                  borderRadius: 4,
                }}
              >
                {pluginId} v{installedVersion || 'unknown'}
              </span>
            </div>
            
            {/* Requirements */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {uniqueReqs.map((req) => (
                <div
                  key={req.requiredBy}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <ArrowRight size={14} color={THEME.accent} />
                  <span style={{ fontSize: 12, color: THEME.textSecondary }}>
                    <strong style={{ color: THEME.textPrimary }}>
                      {req.requiredBy === installingPlugin.id ? installingPlugin.name : req.requiredBy}
                    </strong>
                    {' '}requires{' '}
                    <span
                      style={{
                        color: installedVersion && !req.versionRange.includes(installedVersion)
                          ? THEME.warning
                          : THEME.accent,
                        fontWeight: 500,
                      }}
                    >
                      {formatVersionRange(req.versionRange)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Resolution Options */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px 20px',
          }}
        >
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: THEME.textSecondary,
              margin: '0 0 12px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Choose Resolution
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Keep Current */}
            <ResolutionCard
              option="keep"
              isSelected={selectedOption === 'keep'}
              onSelect={() => setSelectedOption('keep')}
              title="Keep Current Version"
              description={`Continue with ${pluginId} v${installedVersion}. This may cause compatibility issues with ${installingPlugin.name}.`}
              icon={<CheckCircle size={20} color={THEME.success} />}
              risk="medium"
              details={
                <div style={{ fontSize: 11, color: THEME.warning }}>
                  <ShieldWarning size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  {installingPlugin.name} may not work correctly
                </div>
              }
            />
            
            {/* Upgrade All */}
            <ResolutionCard
              option="upgrade"
              isSelected={selectedOption === 'upgrade'}
              onSelect={() => setSelectedOption('upgrade')}
              title="Upgrade All"
              description={`Update ${pluginId} to a version that satisfies all requirements. This is the recommended option.`}
              icon={<ArrowRight size={20} color={THEME.info} />}
              risk="low"
              details={
                <div>
                  <div style={{ fontSize: 11, color: THEME.textSecondary, marginBottom: 8 }}>
                    Will upgrade to a version compatible with:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {uniqueReqs.map(req => (
                      <span
                        key={req.requiredBy}
                        style={{
                          fontSize: 10,
                          padding: '2px 8px',
                          backgroundColor: 'rgba(59, 130, 246, 0.15)',
                          color: THEME.info,
                          borderRadius: 4,
                        }}
                      >
                        {req.requiredBy === installingPlugin.id ? installingPlugin.name : req.requiredBy}
                      </span>
                    ))}
                  </div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 10,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={upgradeAll}
                      onChange={(e) => setUpgradeAll(e.target.checked)}
                      style={{ accentColor: THEME.accent }}
                    />
                    <span style={{ fontSize: 11, color: THEME.textSecondary }}>
                      Also upgrade other dependencies if needed
                    </span>
                  </label>
                </div>
              }
            />
            
            {/* Force Install */}
            <ResolutionCard
              option="force"
              isSelected={selectedOption === 'force'}
              onSelect={() => setSelectedOption('force')}
              title="Force Install"
              description={`Install the version required by ${installingPlugin.name}, potentially breaking other plugins.`}
              icon={<Warning size={20} color={THEME.danger} />}
              risk="high"
              details={
                <div>
                  <div style={{ fontSize: 11, color: THEME.danger, marginBottom: 8 }}>
                    <ShieldWarning size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    This may break: {otherReqs.map(r => r.requiredBy).join(', ')}
                  </div>
                  {availableVersions && availableVersions.length > 0 && (
                    <select
                      value={forceVersion}
                      onChange={(e) => setForceVersion(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        backgroundColor: THEME.bg,
                        border: `1px solid ${THEME.border}`,
                        borderRadius: 4,
                        color: THEME.textPrimary,
                        fontSize: 12,
                      }}
                    >
                      <option value="">Select version to force...</option>
                      {availableVersions.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  )}
                </div>
              }
            />
          </div>
        </div>
        
        {/* Warning Banner */}
        {selectedOption === 'force' && (
          <div
            style={{
              padding: '12px 20px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderTop: `1px solid rgba(239, 68, 68, 0.2)`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <Warning size={16} color={THEME.danger} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: THEME.danger, marginBottom: 2 }}>
                Warning: Potential Breakage
              </div>
              <div style={{ fontSize: 11, color: THEME.textSecondary, lineHeight: 1.5 }}>
                Forcing a version change may cause other plugins to malfunction. 
                Only use this option if you understand the risks and have backups.
              </div>
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderTop: `1px solid ${THEME.border}`,
            backgroundColor: THEME.bgElevated,
            gap: 12,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '10px 18px',
              borderRadius: 6,
              border: `1px solid ${THEME.border}`,
              backgroundColor: 'transparent',
              color: THEME.textSecondary,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel Installation
          </button>
          
          <button
            onClick={handleResolve}
            style={{
              padding: '10px 18px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: selectedOption === 'force' ? THEME.danger : selectedOption === 'upgrade' ? THEME.success : THEME.accent,
              color: selectedOption === 'force' || selectedOption === 'upgrade' ? '#fff' : 'var(--surface-canvas)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {selectedOption === 'keep' && 'Continue Anyway'}
            {selectedOption === 'upgrade' && 'Upgrade & Continue'}
            {selectedOption === 'force' && 'Force Install'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DependencyConflictModal;
