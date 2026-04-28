/**
 * Policy Gating - Full Implementation
 * 
 * Features:
 * - Configure rule enforcement engine
 * - Set up approval workflows
 * - View pending approvals
 * - Approve/reject requests
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Warning,
  User,
  FileText,
  Code,
  Database,
  Globe,
  GearSix,
  ArrowsClockwise,
  MagnifyingGlass,
  Check,
  X,
  Timer,
  Users,
  LockOpen,
} from '@phosphor-icons/react';
import {
  listApprovals,
  getPendingApprovals,
  submitApproval,
  cancelApproval,
  escalateApproval,
} from '@/lib/governance/policy.service';
import type {
  ApprovalRequest,
  ApprovalStatus,
  ApprovalType,
} from '@/lib/governance/policy.types';

// Approval type configurations
const APPROVAL_TYPES: { value: ApprovalType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'tool_execution', label: 'Tool Execution', icon: <Code size={16} />, color: 'var(--status-info)' },
  { value: 'file_access', label: 'File Access', icon: <FileText size={16} />, color: 'var(--status-success)' },
  { value: 'policy_override', label: 'Policy Override', icon: <LockOpen size={16} />, color: 'var(--status-warning)' },
  { value: 'deployment', label: 'Deployment', icon: <Globe size={16} />, color: '#8b5cf6' },
  { value: 'data_export', label: 'Data Export', icon: <Database size={16} />, color: 'var(--status-error)' },
];

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'var(--status-warning)', bgColor: 'var(--status-warning-bg)', icon: <Clock size={14} /> },
  approved: { label: 'Approved', color: 'var(--status-success)', bgColor: 'var(--status-success-bg)', icon: <CheckCircle size={14} /> },
  rejected: { label: 'Rejected', color: 'var(--status-error)', bgColor: 'var(--status-error-bg)', icon: <XCircle size={14} /> },
  expired: { label: 'Expired', color: 'var(--ui-text-secondary)', bgColor: 'var(--surface-active)', icon: <Timer size={14} /> },
  cancelled: { label: 'Cancelled', color: 'var(--ui-text-muted)', bgColor: 'var(--surface-active)', icon: <X size={14} /> },
};

// ============================================================================
// Main Component
// ============================================================================

export function PolicyGating() {
  // State
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [pendingOnly, setPendingOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<ApprovalType | 'all'>('all');
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'requests' | 'workflows'>('requests');

  // Fetch approvals
  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = pendingOnly 
        ? await getPendingApprovals()
        : await listApprovals({ 
            type: filterType === 'all' ? undefined : filterType,
          });
      
      setApprovals(response.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approvals');
      // Use mock data for development
      setApprovals(getMockApprovals());
    } finally {
      setLoading(false);
    }
  }, [pendingOnly, filterType]);

  useEffect(() => {
    fetchApprovals();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchApprovals, 30000);
    return () => clearInterval(interval);
  }, [fetchApprovals]);

  // Handlers
  const handleApprove = async (approvalId: string, note?: string) => {
    try {
      await submitApproval({ requestId: approvalId, approved: true, note });
      fetchApprovals();
      if (selectedApproval?.id === approvalId) {
        setShowDetailModal(false);
        setSelectedApproval(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleReject = async (approvalId: string, note?: string) => {
    try {
      await submitApproval({ requestId: approvalId, approved: false, note });
      fetchApprovals();
      if (selectedApproval?.id === approvalId) {
        setShowDetailModal(false);
        setSelectedApproval(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    }
  };

  const handleEscalate = async (approvalId: string, reason: string) => {
    try {
      await escalateApproval(approvalId, reason);
      fetchApprovals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to escalate');
    }
  };

  const handleCancel = async (approvalId: string) => {
    if (!confirm('Are you sure you want to cancel this request?')) return;
    try {
      await cancelApproval(approvalId);
      fetchApprovals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    }
  };

  // Filter approvals
  const filteredApprovals = approvals.filter(approval => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        approval.title.toLowerCase().includes(query) ||
        approval.description.toLowerCase().includes(query) ||
        approval.requester.agentName.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Stats
  const stats = {
    pending: approvals.filter(a => a.status === 'pending').length,
    approved: approvals.filter(a => a.status === 'approved').length,
    rejected: approvals.filter(a => a.status === 'rejected').length,
    expired: approvals.filter(a => a.status === 'expired').length,
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--surface-panel)' }}>
      {/* Header */}
      <div style={{ 
        padding: '20px 24px', 
        borderBottom: '1px solid var(--ui-border-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--surface-panel)',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'var(--ui-text-primary)' }}>
            Policy Gating
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--ui-text-secondary)' }}>
            Approval workflows and access control
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setActiveTab('requests')}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: activeTab === 'requests' ? 'var(--accent-primary)' : 'var(--surface-hover)',
              color: activeTab === 'requests' ? 'var(--ui-text-inverse)' : 'var(--ui-text-muted)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Requests
          </button>
          <button
            onClick={() => setActiveTab('workflows')}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: activeTab === 'workflows' ? 'var(--accent-primary)' : 'var(--surface-hover)',
              color: activeTab === 'workflows' ? 'var(--ui-text-inverse)' : 'var(--ui-text-muted)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Workflows
          </button>
        </div>
      </div>

      {activeTab === 'requests' ? (
        <>
          {/* Stats */}
          <div style={{ 
            padding: '16px 24px', 
            borderBottom: '1px solid var(--ui-border-muted)',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            background: 'var(--surface-panel)',
          }}>
            <StatCard 
              label="Pending" 
              value={stats.pending} 
              color="var(--status-warning)" 
              icon={<Clock size={20} />}
              active={pendingOnly}
              onClick={() => setPendingOnly(true)}
            />
            <StatCard 
              label="Approved" 
              value={stats.approved} 
              color="var(--status-success)" 
              icon={<CheckCircle size={20} />}
              active={!pendingOnly}
              onClick={() => setPendingOnly(false)}
            />
            <StatCard 
              label="Rejected" 
              value={stats.rejected} 
              color="var(--status-error)" 
              icon={<XCircle size={20} />}
              active={!pendingOnly}
              onClick={() => setPendingOnly(false)}
            />
            <StatCard 
              label="Expired" 
              value={stats.expired} 
              color="var(--ui-text-secondary)" 
              icon={<Timer size={20} />}
              active={!pendingOnly}
              onClick={() => setPendingOnly(false)}
            />
          </div>

          {/* Filters */}
          <div style={{ 
            padding: '12px 24px', 
            borderBottom: '1px solid var(--ui-border-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--surface-panel)',
          }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
              <MagnifyingGlass size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ui-text-muted)' }} />
              <input
                type="text"
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: 6,
                  border: '1px solid var(--ui-border-default)',
                  background: 'var(--surface-panel)',
                  color: 'var(--ui-text-primary)',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as ApprovalType | 'all')}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--ui-border-default)',
                background: 'var(--surface-panel)',
                color: 'var(--ui-text-primary)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <option value="all">All Types</option>
              {APPROVAL_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <button
              onClick={fetchApprovals}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--ui-border-default)',
                background: 'transparent',
                color: 'var(--ui-text-secondary)',
                cursor: 'pointer',
              }}
            >
              <ArrowsClockwise size={16} />
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {loading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState message={error} onRetry={fetchApprovals} />
            ) : filteredApprovals.length === 0 ? (
              <EmptyState pendingOnly={pendingOnly} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredApprovals.map(approval => (
                  <ApprovalCard
                    key={approval.id}
                    approval={approval}
                    onClick={() => {
                      setSelectedApproval(approval);
                      setShowDetailModal(true);
                    }}
                    onApprove={() => handleApprove(approval.id)}
                    onReject={() => handleReject(approval.id)}
                    onEscalate={(reason) => handleEscalate(approval.id, reason)}
                    onCancel={() => handleCancel(approval.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <WorkflowConfiguration />
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedApproval && (
        <ApprovalDetailModal
          approval={selectedApproval}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedApproval(null);
          }}
          onApprove={(note) => handleApprove(selectedApproval.id, note)}
          onReject={(note) => handleReject(selectedApproval.id, note)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Approval Card Component
// ============================================================================

function ApprovalCard({
  approval,
  onClick,
  onApprove,
  onReject,
  onEscalate,
  onCancel,
}: {
  approval: ApprovalRequest;
  onClick: () => void;
  onApprove: () => void;
  onReject: () => void;
  onEscalate: (reason: string) => void;
  onCancel: () => void;
}) {
  const typeConfig = APPROVAL_TYPES.find(t => t.value === approval.type) || APPROVAL_TYPES[0];
  const statusConfig = STATUS_CONFIG[approval.status];
  const isPending = approval.status === 'pending';
  const isExpired = new Date(approval.expiresAt) < new Date();

  return (
    <div 
      onClick={onClick}
      style={{
        background: 'var(--surface-panel)',
        borderRadius: 8,
        border: '1px solid var(--ui-border-muted)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
      }}
    >
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: `${typeConfig.color}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: typeConfig.color,
      }}>
        {typeConfig.icon}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ui-text-primary)' }}>
            {approval.title}
          </span>
          <span style={{
            padding: '3px 10px',
            background: statusConfig.bgColor,
            color: statusConfig.color,
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            {statusConfig.icon}
            {statusConfig.label}
          </span>
          {isExpired && isPending && (
            <span style={{
              padding: '2px 8px',
              background: 'var(--status-error-bg)',
              color: 'var(--status-error)',
              borderRadius: 4,
              fontSize: 11,
            }}>
              Expired
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ui-text-secondary)', lineHeight: 1.4 }}>
          {approval.description}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
            <User size={12} style={{ display: 'inline', marginRight: 4 }} />
            {approval.requester.agentName}
          </span>
          <span style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
            <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
            {new Date(approval.createdAt).toLocaleString()}
          </span>
          {approval.resource.riskLevel && (
            <span style={{
              padding: '1px 8px',
              background: getRiskColor(approval.resource.riskLevel).bg,
              color: getRiskColor(approval.resource.riskLevel).text,
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 500,
            }}>
              {approval.resource.riskLevel} risk
            </span>
          )}
        </div>
      </div>

      {isPending && !isExpired && (
        <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onReject}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #ef4444',
              background: 'transparent',
              color: 'var(--status-error)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <X size={16} />
            Reject
          </button>
          <button
            onClick={onApprove}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--status-success)',
              color: 'var(--ui-text-primary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Check size={16} />
            Approve
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Approval Detail Modal
// ============================================================================

function ApprovalDetailModal({
  approval,
  onClose,
  onApprove,
  onReject,
}: {
  approval: ApprovalRequest;
  onClose: () => void;
  onApprove: (note?: string) => void;
  onReject: (note?: string) => void;
}) {
  const [note, setNote] = useState('');
  const typeConfig = APPROVAL_TYPES.find(t => t.value === approval.type) || APPROVAL_TYPES[0];
  const statusConfig = STATUS_CONFIG[approval.status];
  const isPending = approval.status === 'pending';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--shell-overlay-backdrop)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        width: 600,
        maxHeight: '90vh',
        background: 'var(--surface-panel)',
        borderRadius: 12,
        border: '1px solid var(--ui-border-muted)',
        overflow: 'auto',
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--ui-border-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: `${typeConfig.color}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: typeConfig.color,
            }}>
              {typeConfig.icon}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ui-text-primary)' }}>
                {approval.title}
              </h2>
              <span style={{
                padding: '2px 8px',
                background: statusConfig.bgColor,
                color: statusConfig.color,
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
              }}>
                {statusConfig.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--ui-text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Description */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--ui-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Description
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ui-text-muted)', lineHeight: 1.6 }}>
              {approval.description}
            </p>
          </div>

          {/* Requester Info */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--ui-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Requester
            </h3>
            <div style={{ 
              padding: 12, 
              background: 'var(--surface-panel)', 
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}>
                <User size={18} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ui-text-primary)' }}>
                  {approval.requester.agentName}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
                  Agent ID: {approval.requester.agentId}
                </div>
              </div>
            </div>
          </div>

          {/* Resource Details */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--ui-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Resource
            </h3>
            <div style={{ padding: 12, background: 'var(--surface-panel)', borderRadius: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--ui-text-secondary)' }}>Type:</span>
                <span style={{ fontSize: 13, color: 'var(--ui-text-primary)' }}>{approval.resource.type}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--ui-text-secondary)' }}>Identifier:</span>
                <code style={{ fontSize: 12, color: 'var(--accent-primary)', background: 'var(--surface-panel)', padding: '2px 6px', borderRadius: 4 }}>
                  {approval.resource.identifier}
                </code>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--ui-text-secondary)' }}>Risk Level:</span>
                <span style={{
                  padding: '2px 8px',
                  background: getRiskColor(approval.resource.riskLevel).bg,
                  color: getRiskColor(approval.resource.riskLevel).text,
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                }}>
                  {approval.resource.riskLevel.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Decisions */}
          {approval.decisions.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--ui-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Decisions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {approval.decisions.map((decision, index) => (
                  <div key={index} style={{ 
                    padding: 12, 
                    background: 'var(--surface-panel)', 
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}>
                    {decision.decision === 'approved' ? (
                      <CheckCircle size={18} color="var(--status-success)" />
                    ) : (
                      <XCircle size={18} color="var(--status-error)" />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--ui-text-primary)' }}>
                        {decision.reviewerName || decision.reviewerId}
                      </div>
                      {decision.note && (
                        <div style={{ fontSize: 12, color: 'var(--ui-text-secondary)', marginTop: 2 }}>
                          "{decision.note}"
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--ui-text-muted)' }}>
                      {new Date(decision.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {isPending && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ui-text-muted)', marginBottom: 6 }}>
                  Note (optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note about your decision..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--ui-border-default)',
                    background: 'var(--surface-panel)',
                    color: 'var(--ui-text-primary)',
                    fontSize: 14,
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button
                  onClick={() => onReject(note)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 6,
                    border: '1px solid #ef4444',
                    background: 'transparent',
                    color: 'var(--status-error)',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <X size={18} />
                  Reject
                </button>
                <button
                  onClick={() => onApprove(note)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'var(--status-success)',
                    color: 'var(--ui-text-primary)',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Check size={18} />
                  Approve
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Workflow Configuration
// ============================================================================

function WorkflowConfiguration() {
  const [workflows] = useState([
    { id: 'wf-1', name: 'Critical Tool Execution', type: 'tool_execution', approvers: 2, autoEscalate: true, timeout: 30 },
    { id: 'wf-2', name: 'Sensitive File Access', type: 'file_access', approvers: 1, autoEscalate: true, timeout: 60 },
    { id: 'wf-3', name: 'Production Deployment', type: 'deployment', approvers: 2, autoEscalate: false, timeout: 120 },
    { id: 'wf-4', name: 'Data Export', type: 'data_export', approvers: 2, autoEscalate: true, timeout: 30 },
  ]);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 800 }}>
        <h2 style={{ margin: '0 0 24px 0', fontSize: 16, fontWeight: 600, color: 'var(--ui-text-primary)' }}>
          Approval Workflows
        </h2>
        <p style={{ margin: '0 0 24px 0', fontSize: 14, color: 'var(--ui-text-secondary)' }}>
          Configure approval requirements for different action types. Set the number of required approvers,
          escalation settings, and timeout periods.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {workflows.map(workflow => (
            <div key={workflow.id} style={{
              padding: 20,
              background: 'var(--surface-panel)',
              borderRadius: 8,
              border: '1px solid var(--ui-border-muted)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: 'var(--surface-hover)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-primary)',
                  }}>
                    <GearSix size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ui-text-primary)' }}>
                      {workflow.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
                      Type: {workflow.type}
                    </div>
                  </div>
                </div>
                <button style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--ui-border-default)',
                  background: 'transparent',
                  color: 'var(--ui-text-muted)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}>
                  Edit
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ui-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                    Required Approvals
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--ui-text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={14} />
                    {workflow.approvers}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ui-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                    Auto-escalate
                  </div>
                  <div style={{ fontSize: 14, color: workflow.autoEscalate ? 'var(--status-success)' : 'var(--ui-text-muted)' }}>
                    {workflow.autoEscalate ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ui-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                    Timeout
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--ui-text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Timer size={14} />
                    {workflow.timeout} min
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button style={{
          marginTop: 16,
          width: '100%',
          padding: '12px',
          borderRadius: 6,
          border: '1px dashed #444',
          background: 'transparent',
          color: 'var(--ui-text-secondary)',
          fontSize: 14,
          cursor: 'pointer',
        }}>
          + Create Custom Workflow
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Utility Components
// ============================================================================

function StatCard({ 
  label, 
  value, 
  color, 
  icon,
  active,
  onClick,
}: { 
  label: string; 
  value: number; 
  color: string; 
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: 16,
        background: active ? `${color}15` : 'var(--surface-panel)',
        borderRadius: 8,
        border: `1px solid ${active ? color : 'var(--surface-hover)'}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        background: `${color}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--ui-text-secondary)' }}>{label}</div>
      </div>
    </button>
  );
}

function LoadingState() {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--ui-text-muted)' }}>
      <ArrowsClockwise size={32} style={{ animation: 'spin 1s linear infinite' }} />
      <p>Loading approvals...</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <Warning size={32} color="var(--status-error)" />
      <p style={{ color: 'var(--status-error)', marginBottom: 16 }}>{message}</p>
      <button
        onClick={onRetry}
        style={{
          padding: '8px 16px',
          borderRadius: 6,
          border: '1px solid var(--ui-border-default)',
          background: 'transparent',
          color: 'var(--ui-text-muted)',
          cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  );
}

function EmptyState({ pendingOnly }: { pendingOnly: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--ui-text-muted)' }}>
      <CheckCircle size={48} style={{ marginBottom: 16 }} />
      <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: 'var(--ui-text-muted)' }}>
        {pendingOnly ? 'No pending approvals' : 'No approvals found'}
      </h3>
      <p style={{ margin: 0, fontSize: 14 }}>
        {pendingOnly 
          ? 'All approval requests have been processed.' 
          : 'There are no approval requests matching your filters.'}
      </p>
    </div>
  );
}

function getRiskColor(risk: string): { bg: string; text: string } {
  switch (risk) {
    case 'critical': return { bg: 'var(--status-error-bg)', text: 'var(--status-error)' };
    case 'high': return { bg: 'var(--status-warning-bg)', text: 'var(--status-warning)' };
    case 'medium': return { bg: 'var(--status-warning-bg)', text: 'var(--status-warning)' };
    case 'low': return { bg: 'var(--status-success-bg)', text: 'var(--status-success)' };
    default: return { bg: 'var(--surface-active)', text: 'var(--ui-text-muted)' };
  }
}

// ============================================================================
// Mock Data
// ============================================================================

function getMockApprovals(): ApprovalRequest[] {
  return [
    {
      id: 'apr-001',
      type: 'tool_execution',
      status: 'pending',
      title: 'Execute shell command: docker-compose up',
      description: 'Agent "Deployment Helper" is requesting permission to execute a shell command to start Docker containers.',
      requester: { agentId: 'agent-001', agentName: 'Deployment Helper' },
      resource: { type: 'shell_command', identifier: 'docker-compose up -d', riskLevel: 'high', details: { working_dir: '/app' } },
      reviewers: ['user-001'],
      decisions: [],
      requiredApprovals: 1,
      currentApprovals: 0,
      createdAt: '2026-03-06T18:30:00Z',
      expiresAt: '2026-03-06T19:00:00Z',
      timeout: 30,
      escalationLevel: 0,
    },
    {
      id: 'apr-002',
      type: 'file_access',
      status: 'pending',
      title: 'Access production database credentials',
      description: 'Agent "Data Analyzer" needs to read database credentials from the secrets file.',
      requester: { agentId: 'agent-002', agentName: 'Data Analyzer' },
      resource: { type: 'file', identifier: '/etc/secrets/db-credentials.env', riskLevel: 'critical' },
      reviewers: ['user-001', 'user-002'],
      decisions: [],
      requiredApprovals: 2,
      currentApprovals: 0,
      createdAt: '2026-03-06T17:15:00Z',
      expiresAt: '2026-03-06T17:45:00Z',
      timeout: 30,
      escalationLevel: 0,
    },
    {
      id: 'apr-003',
      type: 'deployment',
      status: 'approved',
      title: 'Deploy to staging environment',
      description: 'Agent "CI/CD Bot" wants to deploy commit abc123 to staging.',
      requester: { agentId: 'agent-003', agentName: 'CI/CD Bot' },
      resource: { type: 'deployment', identifier: 'staging', riskLevel: 'medium', details: { commit: 'abc123' } },
      reviewers: ['user-001'],
      decisions: [{ reviewerId: 'user-001', decision: 'approved', timestamp: '2026-03-06T16:30:00Z', note: 'Looks good' }],
      requiredApprovals: 1,
      currentApprovals: 1,
      createdAt: '2026-03-06T16:20:00Z',
      expiresAt: '2026-03-06T17:20:00Z',
      completedAt: '2026-03-06T16:30:00Z',
      timeout: 60,
      escalationLevel: 0,
    },
    {
      id: 'apr-004',
      type: 'policy_override',
      status: 'rejected',
      title: 'Override rate limiting policy',
      description: 'Agent "Bulk Processor" wants to exceed the API rate limit for a data migration task.',
      requester: { agentId: 'agent-004', agentName: 'Bulk Processor' },
      resource: { type: 'policy', identifier: 'rate-limit-001', riskLevel: 'high' },
      reviewers: ['user-001'],
      decisions: [{ reviewerId: 'user-001', decision: 'rejected', timestamp: '2026-03-06T15:45:00Z', note: 'Too risky, please batch the requests' }],
      requiredApprovals: 1,
      currentApprovals: 0,
      createdAt: '2026-03-06T15:30:00Z',
      expiresAt: '2026-03-06T16:30:00Z',
      completedAt: '2026-03-06T15:45:00Z',
      timeout: 60,
      escalationLevel: 0,
    },
  ];
}

export default PolicyGating;
