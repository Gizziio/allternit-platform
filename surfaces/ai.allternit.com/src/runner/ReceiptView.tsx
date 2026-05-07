/**
 * Receipt View Component
 * 
 * Displays the audit receipt for a completed operator task.
 * Shows:
 * - Task summary and status
 * - Actions taken
 * - Objects created/modified
 * - Verification results
 * - Privacy routing info
 */

"use client";

import React, { useState } from "react";
import {
  CheckCircle,
  Warning,
  XCircle,
  Clock,
  FileText,
  DownloadSimple,
  CaretRight,
  CaretDown,
  Shield,
  Target,
  Stack,
  Pulse as Activity,
} from '@phosphor-icons/react';

const THEME = {
  bg: '#2B2520',
  cardBg: '#3A332B',
  textPrimary: '#ECECEC',
  textSecondary: 'var(--ui-text-secondary)',
  textMuted: 'var(--ui-text-muted)',
  accent: 'var(--accent-primary)',
  success: 'var(--status-success)',
  warning: 'var(--status-warning)',
  error: 'var(--status-error)',
  border: 'var(--ui-border-muted)',
};

export interface Receipt {
  id: string;
  requestId: string;
  userId: string;
  userRole: string;
  userIntent: string;
  targetSystem: string;
  targetContext: Record<string, unknown>;
  executionMode: string;
  backend: string;
  routingReason: string;
  planSummary: {
    goal: string;
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
  };
  actions: Array<{
    stepNumber: number;
    action: string;
    target: string;
    status: string;
    backend: string;
    durationMs: number;
    error?: string;
    verification?: {
      method: string;
      passed: boolean;
      details?: string;
    };
  }>;
  status: 'success' | 'partial_success' | 'failed' | 'cancelled' | 'blocked';
  createdObjects: Array<{
    type: string;
    name: string;
    id?: string;
    url?: string;
  }>;
  modifiedObjects: Array<{
    type: string;
    name: string;
    id: string;
    changes: string[];
  }>;
  errors: string[];
  warnings: string[];
  verification: {
    overallPassed: boolean;
    checks: Array<{
      name: string;
      passed: boolean;
      message?: string;
    }>;
  };
  privacy: {
    modelRouting: string;
    modelId?: string;
    dataClassification: string;
    piiDetected: boolean;
    studentDataFlagged: boolean;
    policyVersion: string;
  };
  startedAt: number;
  completedAt: number;
  durationMs: number;
  hash: string;
  createdAt: string;
}

interface ReceiptViewProps {
  receipt: Receipt;
  onClose?: () => void;
}

export function ReceiptView({ receipt, onClose }: ReceiptViewProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    summary: true,
    actions: true,
    createdObjects: true,
    verification: true,
    privacy: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={20} style={{ color: THEME.success }} />;
      case 'partial_success':
        return <Warning size={20} style={{ color: THEME.warning }} />;
      case 'failed':
      case 'blocked':
        return <XCircle size={20} style={{ color: THEME.error }} />;
      case 'cancelled':
        return <XCircle size={20} style={{ color: THEME.textMuted }} />;
      default:
        return <Clock size={20} style={{ color: THEME.textMuted }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return THEME.success;
      case 'partial_success':
        return THEME.warning;
      case 'failed':
      case 'blocked':
        return THEME.error;
      default:
        return THEME.textMuted;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(receipt, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${receipt.requestId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        background: THEME.bg,
        borderRadius: '12px',
        border: `1px solid ${THEME.border}`,
        padding: '16px',
        fontFamily: 'var(--font-sans)',
        color: THEME.textPrimary,
        maxHeight: '70vh',
        overflow: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: `1px solid ${THEME.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {getStatusIcon(receipt.status)}
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>
              Task Receipt
            </div>
            <div style={{ fontSize: '12px', color: THEME.textSecondary }}>
              {receipt.requestId}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleExport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              background: THEME.cardBg,
              border: `1px solid ${THEME.border}`,
              borderRadius: '6px',
              color: THEME.textPrimary,
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            <DownloadSimple size={14} />
            Export
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                border: `1px solid ${THEME.border}`,
                borderRadius: '6px',
                color: THEME.textSecondary,
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Summary Section */}
      <Section
        title="Summary"
        icon={<FileText size={16} />}
        expanded={expandedSections.summary}
        onToggle={() => toggleSection('summary')}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <InfoRow label="Status" value={receipt.status.replace('_', ' ')} color={getStatusColor(receipt.status)} />
          <InfoRow label="Duration" value={formatDuration(receipt.durationMs)} />
          <InfoRow label="Target" value={receipt.targetSystem} />
          <InfoRow label="Backend" value={receipt.backend} />
          <InfoRow 
            label="Steps" 
            value={`${receipt.planSummary.completedSteps}/${receipt.planSummary.totalSteps} completed`} 
          />
          <InfoRow 
            label="Started" 
            value={formatDate(receipt.startedAt)} 
          />
        </div>
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            background: THEME.cardBg,
            borderRadius: '8px',
            fontSize: '13px',
            lineHeight: '1.5',
          }}
        >
          <div style={{ color: THEME.textSecondary, fontSize: '11px', marginBottom: '4px' }}>Intent</div>
          {receipt.userIntent}
        </div>
      </Section>

      {/* Actions Section */}
      <Section
        title="Actions Taken"
        icon={<Activity size={16} />}
        expanded={expandedSections.actions}
        onToggle={() => toggleSection('actions')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {receipt.actions.map((action, idx) => (
            <div
              key={idx}
              style={{
                padding: '10px',
                background: THEME.cardBg,
                borderRadius: '8px',
                border: `1px solid ${action.status === 'failed' ? 'rgba(239,68,68,0.2)' : THEME.border}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: action.status === 'success' 
                        ? 'rgba(34,197,94,0.2)' 
                        : action.status === 'failed'
                        ? 'rgba(239,68,68,0.2)'
                        : 'rgba(107,107,107,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 600,
                      color: action.status === 'success'
                        ? THEME.success
                        : action.status === 'failed'
                        ? THEME.error
                        : THEME.textMuted,
                    }}
                  >
                    {action.stepNumber}
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 500 }}>{action.action}</span>
                </div>
                <div style={{ fontSize: '11px', color: THEME.textSecondary }}>
                  {formatDuration(action.durationMs)}
                </div>
              </div>
              {action.target && (
                <div style={{ fontSize: '12px', color: THEME.textSecondary, marginLeft: '26px' }}>
                  Target: {action.target}
                </div>
              )}
              {action.error && (
                <div
                  style={{
                    fontSize: '12px',
                    color: THEME.error,
                    marginLeft: '26px',
                    marginTop: '4px',
                  }}
                >
                  {action.error}
                </div>
              )}
              {action.verification && (
                <div
                  style={{
                    fontSize: '11px',
                    color: action.verification.passed ? THEME.success : THEME.warning,
                    marginLeft: '26px',
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {action.verification.passed ? <CheckCircle size={10} /> : <Warning size={10} />}
                  Verified: {action.verification.method}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Created Objects Section */}
      {receipt.createdObjects.length > 0 && (
        <Section
          title="Created Objects"
          icon={<Stack size={16} />}
          expanded={expandedSections.createdObjects}
          onToggle={() => toggleSection('createdObjects')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {receipt.createdObjects.map((obj, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px',
                  background: THEME.cardBg,
                  borderRadius: '6px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle size={14} style={{ color: THEME.success }} />
                <span style={{ fontWeight: 500 }}>{obj.type}:</span>
                <span>{obj.name}</span>
                {obj.url && (
                  <a
                    href={obj.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: THEME.accent,
                      textDecoration: 'none',
                      fontSize: '11px',
                    }}
                  >
                    Open →
                  </a>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Verification Section */}
      <Section
        title="Verification"
        icon={<Shield size={16} />}
        expanded={expandedSections.verification}
        onToggle={() => toggleSection('verification')}
      >
        <div
          style={{
            padding: '10px',
            background: receipt.verification.overallPassed 
              ? 'var(--status-success-bg)' 
              : 'var(--status-warning-bg)',
            borderRadius: '8px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {receipt.verification.overallPassed 
            ? <CheckCircle size={16} style={{ color: THEME.success }} />
            : <Warning size={16} style={{ color: THEME.warning }} />
          }
          <span style={{ fontSize: '13px', fontWeight: 500 }}>
            {receipt.verification.overallPassed 
              ? 'All verification checks passed' 
              : 'Some verification checks failed'}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {receipt.verification.checks.map((check, idx) => (
            <div
              key={idx}
              style={{
                padding: '8px',
                background: THEME.cardBg,
                borderRadius: '6px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {check.passed 
                ? <CheckCircle size={14} style={{ color: THEME.success }} />
                : <XCircle size={14} style={{ color: THEME.error }} />
              }
              <span>{check.name}</span>
              {check.message && (
                <span style={{ color: THEME.textSecondary, fontSize: '11px' }}>
                  — {check.message}
                </span>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Privacy Section */}
      <Section
        title="Privacy & Compliance"
        icon={<Target size={16} />}
        expanded={expandedSections.privacy}
        onToggle={() => toggleSection('privacy')}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <InfoRow label="Model Routing" value={receipt.privacy.modelRouting} />
          <InfoRow label="Data Classification" value={receipt.privacy.dataClassification} />
          <InfoRow 
            label="PII Detected" 
            value={receipt.privacy.piiDetected ? 'Yes' : 'No'}
            color={receipt.privacy.piiDetected ? THEME.warning : undefined}
          />
          <InfoRow 
            label="Student Data" 
            value={receipt.privacy.studentDataFlagged ? 'Flagged' : 'Not detected'}
            color={receipt.privacy.studentDataFlagged ? THEME.warning : undefined}
          />
        </div>
        {receipt.privacy.modelId && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: THEME.textSecondary }}>
            Model: {receipt.privacy.modelId}
          </div>
        )}
      </Section>

      {/* Integrity Hash */}
      <div
        style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: `1px solid ${THEME.border}`,
          fontSize: '10px',
          color: THEME.textMuted,
          fontFamily: 'var(--font-mono)',
        }}
      >
        Receipt Hash: {receipt.hash}
      </div>
    </div>
  );
}

// Section component for collapsible content
interface SectionProps {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ title, icon, expanded, onToggle, children }: SectionProps) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '8px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: THEME.textPrimary,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {icon}
          <span style={{ fontSize: '13px', fontWeight: 600 }}>{title}</span>
        </div>
        {expanded ? <CaretDown size={16} /> : <CaretRight size={16} />}
      </button>
      {expanded && (
        <div style={{ marginTop: '8px', paddingLeft: '8px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// Info row component
interface InfoRowProps {
  label: string;
  value: string;
  color?: string;
}

function InfoRow({ label, value, color }: InfoRowProps) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: THEME.textSecondary, marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: 500, color: color || THEME.textPrimary }}>{value}</div>
    </div>
  );
}
