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
import { cn } from '@/lib/utils';
import { ConfirmModal } from '@/components/ConfirmModal';

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
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

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
      setApprovals([]);
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

  const handleCancel = (approvalId: string) => {
    setConfirmDialog({
      message: 'Are you sure you want to cancel this request?',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await cancelApproval(approvalId);
          fetchApprovals();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to cancel');
        }
      },
    });
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
    <div className="h-full flex flex-col bg-[var(--surface-panel)]">
      {/* Header */}
      <div className="p-5 px-6 border-b border-solid border-[var(--ui-border-muted)] flex items-center justify-between bg-[var(--surface-panel)] shrink-0">
        <div>
          <h1 className="m-0 text-[20px] font-semibold text-[var(--ui-text-primary)]">
            Policy Gating
          </h1>
          <p className="m-1 m-0 text-[13px] text-[var(--ui-text-secondary)]">
            Approval workflows and access control
          </p>
        </div>
        <div className="flex gap-3">
          <button type="button"
            onClick={() => setActiveTab('requests')}
            className={cn(
              "px-4 py-2 rounded-md border-none text-[13px] font-medium cursor-pointer transition-colors",
              activeTab === 'requests' ? "bg-[var(--accent-primary)] text-[var(--ui-text-inverse)]" : "bg-[var(--surface-hover)] text-[var(--ui-text-muted)] hover:bg-[var(--surface-active)]"
            )}
          >
            Requests
          </button>
          <button type="button"
            onClick={() => setActiveTab('workflows')}
            className={cn(
              "px-4 py-2 rounded-md border-none text-[13px] font-medium cursor-pointer transition-colors",
              activeTab === 'workflows' ? "bg-[var(--accent-primary)] text-[var(--ui-text-inverse)]" : "bg-[var(--surface-hover)] text-[var(--ui-text-muted)] hover:bg-[var(--surface-active)]"
            )}
          >
            Workflows
          </button>
        </div>
      </div>

      {activeTab === 'requests' ? (
        <>
          {/* Stats */}
          <div className="p-4 px-6 border-b border-solid border-[var(--ui-border-muted)] grid grid-cols-4 gap-4 bg-[var(--surface-panel)] shrink-0">
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
          <div className="p-3 px-6 border-b border-solid border-[var(--ui-border-muted)] flex items-center gap-3 bg-[var(--surface-panel)] shrink-0">
            <div className="relative flex-1 max-w-[300px]">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ui-text-muted)]" />
              <input aria-label="Search requests…" type="text"
                placeholder="Search requests…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-md border border-solid border-[var(--ui-border-default)] bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-[13px] outline-none transition-colors focus:border-[var(--accent-primary)]"
              />
            </div>
            <select aria-label="Selection" value={filterType}
              onChange={(e) => setFilterType(e.target.value as ApprovalType | 'all')}
              className="px-3 py-2 rounded-md border border-solid border-[var(--ui-border-default)] bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-[13px] cursor-pointer outline-none focus:border-[var(--accent-primary)]"
            >
              <option value="all">All Types</option>
              {APPROVAL_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <button type="button"
              onClick={fetchApprovals}
              className="p-2 rounded-md border border-solid border-[var(--ui-border-default)] bg-transparent text-[var(--ui-text-secondary)] cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
            >
              <ArrowsClockwise size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4">
            {loading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState message={error} onRetry={fetchApprovals} />
            ) : filteredApprovals.length === 0 ? (
              <EmptyState pendingOnly={pendingOnly} />
            ) : (
              <div className="flex flex-col gap-2">
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
      <ConfirmModal
        isOpen={confirmDialog !== null}
        title="Cancel Request"
        message={confirmDialog?.message || ''}
        confirmLabel="Cancel Request"
        destructive
        onConfirm={confirmDialog?.onConfirm || (() => {})}
        onCancel={() => setConfirmDialog(null)}
      />
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
    <div role="button" tabIndex={0} 
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className="bg-[var(--surface-panel)] rounded-lg border border-solid border-[var(--ui-border-muted)] p-[16px_20px] flex items-center gap-4 cursor-pointer transition-all hover:bg-[var(--surface-hover)]"
    >
      <div 
        className="w-11 h-11 rounded-[10px] flex items-center justify-center shrink-0"
        style={{ background: `${typeConfig.color}20`, color: typeConfig.color }}
      >
        {typeConfig.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-1 flex-wrap">
          <span className="text-[14px] font-semibold text-[var(--ui-text-primary)] truncate max-w-[200px]">
            {approval.title}
          </span>
          <span className={cn(
            "px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1",
            statusConfig.bgColor,
            statusConfig.color
          )} style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}>
            {statusConfig.icon}
            {statusConfig.label}
          </span>
          {isExpired && isPending && (
            <span className="px-2 py-0.5 rounded bg-[var(--status-error-bg)] text-[var(--status-error)] text-[11px] font-bold uppercase tracking-wider">
              Expired
            </span>
          )}
        </div>
        <p className="m-0 text-[13px] text-[var(--ui-text-secondary)] leading-tight truncate">
          {approval.description}
        </p>
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          <span className="text-[12px] text-[var(--ui-text-muted)] flex items-center gap-1">
            <User size={12} />
            {approval.requester.agentName}
          </span>
          <span className="text-[12px] text-[var(--ui-text-muted)] flex items-center gap-1">
            <Clock size={12} />
            {new Date(approval.createdAt).toLocaleString()}
          </span>
          {approval.resource.riskLevel && (
            <span className={cn(
              "px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider",
              getRiskColor(approval.resource.riskLevel).bg,
              getRiskColor(approval.resource.riskLevel).text
            )} style={{ backgroundColor: getRiskColor(approval.resource.riskLevel).bg, color: getRiskColor(approval.resource.riskLevel).text }}>
              {approval.resource.riskLevel} risk
            </span>
          )}
        </div>
      </div>

      {isPending && !isExpired && (
        <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
          <button type="button"
            onClick={onReject}
            className="px-4 py-2 rounded-md border border-solid border-[#ef4444] bg-transparent text-[var(--status-error)] text-[13px] font-medium cursor-pointer flex items-center gap-1.5 transition-colors hover:bg-[#ef4444]/5"
          >
            <X size={16} />
            Reject
          </button>
          <button type="button"
            onClick={onApprove}
            className="px-4 py-2 rounded-md border-none bg-[var(--status-success)] text-[var(--ui-text-primary)] text-[13px] font-bold cursor-pointer flex items-center gap-1.5 transition-opacity hover:opacity-90"
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
    <div 
      role="button" tabIndex={0}
      className="fixed inset-0 bg-[var(--shell-overlay-backdrop)] backdrop-blur-md flex items-center justify-center z-[1000] p-6"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
    >
      <div 
        role="button" tabIndex={0}
        className="w-full max-w-[600px] max-h-[90vh] bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-muted)] overflow-hidden flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
        <div className="p-[20px_24px] border-b border-solid border-[var(--ui-border-muted)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${typeConfig.color}20`, color: typeConfig.color }}
            >
              {typeConfig.icon}
            </div>
            <div>
              <h2 className="m-0 text-[16px] font-bold text-[var(--ui-text-primary)]">
                {approval.title}
              </h2>
              <span className={cn(
                "px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider inline-block mt-1",
                statusConfig.bgColor,
                statusConfig.color
              )} style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}>
                {statusConfig.label}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="bg-transparent border-none text-[var(--ui-text-secondary)] cursor-pointer p-1 hover:text-[var(--ui-text-primary)] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {/* Description */}
          <div className="mb-6">
            <h3 className="m-[0_0_8px_0] text-[11px] font-bold text-[var(--ui-text-muted)] uppercase tracking-widest">
              Description
            </h3>
            <p className="m-0 text-[14px] text-[var(--ui-text-muted)] leading-relaxed">
              {approval.description}
            </p>
          </div>

          {/* Requester Info */}
          <div className="mb-6">
            <h3 className="m-[0_0_8px_0] text-[11px] font-bold text-[var(--ui-text-muted)] uppercase tracking-widest">
              Requester
            </h3>
            <div className="p-3 bg-black/5 dark:bg-white/5 rounded-lg flex items-center gap-3 border border-solid border-[var(--ui-border-muted)]">
              <div className="w-9 h-9 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center shrink-0 text-[var(--accent-primary)]">
                <User size={18} />
              </div>
              <div>
                <div className="text-[14px] font-bold text-[var(--ui-text-primary)]">
                  {approval.requester.agentName}
                </div>
                <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5">
                  Agent ID: {approval.requester.agentId}
                </div>
              </div>
            </div>
          </div>

          {/* Resource Details */}
          <div className="mb-6">
            <h3 className="m-[0_0_8px_0] text-[11px] font-bold text-[var(--ui-text-muted)] uppercase tracking-widest">
              Resource
            </h3>
            <div className="p-3 bg-black/5 dark:bg-white/5 rounded-lg border border-solid border-[var(--ui-border-muted)] space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[var(--ui-text-secondary)]">Type:</span>
                <span className="text-[13px] font-semibold text-[var(--ui-text-primary)]">{approval.resource.type}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[var(--ui-text-secondary)]">Identifier:</span>
                <code className="text-[12px] text-[var(--accent-primary)] bg-[var(--surface-panel)] px-1.5 py-0.5 rounded border border-solid border-[var(--ui-border-muted)] font-mono">
                  {approval.resource.identifier}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[var(--ui-text-secondary)]">Risk Level:</span>
                <span className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider",
                  getRiskColor(approval.resource.riskLevel).bg,
                  getRiskColor(approval.resource.riskLevel).text
                )} style={{ backgroundColor: getRiskColor(approval.resource.riskLevel).bg, color: getRiskColor(approval.resource.riskLevel).text }}>
                  {approval.resource.riskLevel}
                </span>
              </div>
            </div>
          </div>

          {/* Decisions */}
          {approval.decisions.length > 0 && (
            <div className="mb-6">
              <h3 className="m-[0_0_8px_0] text-[11px] font-bold text-[var(--ui-text-muted)] uppercase tracking-widest">
                Decisions
              </h3>
              <div className="flex flex-col gap-2">
                {approval.decisions.map((decision) => (
                  <div key={`${decision.reviewerId}-${decision.timestamp}`} className="p-3 bg-black/5 dark:bg-white/5 rounded-lg flex items-center gap-3 border border-solid border-[var(--ui-border-muted)]">
                    {decision.decision === 'approved' ? (
                      <CheckCircle size={18} className="text-[var(--status-success)] shrink-0" />
                    ) : (
                      <XCircle size={18} className="text-[var(--status-error)] shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--ui-text-primary)]">
                        {decision.reviewerName || decision.reviewerId}
                      </div>
                      {decision.note && (
                        <div className="text-[12px] text-[var(--ui-text-secondary)] mt-0.5 italic">
                          "{decision.note}"
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-[var(--ui-text-muted)] font-medium shrink-0">
                      {new Date(decision.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {isPending && (
            <div className="space-y-4 pt-2">
              <div>
                <div className="block text-[13px] font-bold text-[var(--ui-text-muted)] mb-2 uppercase tracking-wide">
                  Decision Note (optional)
                </div>
                <textarea aria-label="Text Area" value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a reason for your approval or rejection…"
                  rows={3}
                  className="w-full p-3 rounded-lg border border-solid border-[var(--ui-border-default)] bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-[14px] resize-y outline-none transition-colors focus:border-[var(--accent-primary)] font-inherit"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button type="button"
                  onClick={() => onReject(note)}
                  className="px-5 py-2.5 rounded-lg border border-solid border-[#ef4444] bg-transparent text-[var(--status-error)] text-[14px] font-bold cursor-pointer flex items-center gap-2 transition-colors hover:bg-[#ef4444]/5"
                >
                  <X size={18} />
                  Reject
                </button>
                <button type="button"
                  onClick={() => onApprove(note)}
                  className="px-5 py-2.5 rounded-lg border-none bg-[var(--status-success)] text-[var(--ui-text-primary)] text-[14px] font-bold cursor-pointer flex items-center gap-2 transition-opacity hover:opacity-90"
                >
                  <Check size={18} />
                  Approve
                </button>
              </div>
            </div>
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
  const workflows = [
    { id: 'wf-1', name: 'Critical Tool Execution', type: 'tool_execution', approvers: 2, autoEscalate: true, timeout: 30 },
    { id: 'wf-2', name: 'Sensitive File Access', type: 'file_access', approvers: 1, autoEscalate: true, timeout: 60 },
    { id: 'wf-3', name: 'Production Deployment', type: 'deployment', approvers: 2, autoEscalate: false, timeout: 120 },
    { id: 'wf-4', name: 'Data Export', type: 'data_export', approvers: 2, autoEscalate: true, timeout: 30 },
  ];

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-[800px] mx-auto">
        <h2 className="m-[0_0_24px_0] text-[16px] font-bold text-[var(--ui-text-primary)] uppercase tracking-wide">
          Approval Workflows
        </h2>
        <p className="m-[0_0_24px_0] text-[14px] text-[var(--ui-text-secondary)] leading-relaxed">
          Configure approval requirements for different action types. Set the number of required approvers,
          escalation settings, and timeout periods.
        </p>

        <div className="flex flex-col gap-3">
          {workflows.map(workflow => (
            <div key={workflow.id} className="p-5 bg-[var(--surface-panel)] rounded-xl border border-solid border-[var(--ui-border-muted)] transition-all hover:border-[var(--ui-border-default)]">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--surface-hover)] flex items-center justify-center shrink-0 text-[var(--accent-primary)]">
                    <GearSix size={20} />
                  </div>
                  <div>
                    <div className="text-[14px] font-bold text-[var(--ui-text-primary)]">
                      {workflow.name}
                    </div>
                    <div className="text-[12px] text-[var(--ui-text-muted)] mt-0.5">
                      Type: {workflow.type}
                    </div>
                  </div>
                </div>
                <button type="button" className="px-3.5 py-1.5 rounded-lg border border-solid border-[var(--ui-border-default)] bg-transparent text-[var(--ui-text-muted)] text-[12px] font-bold cursor-pointer hover:bg-[var(--surface-hover)] hover:text-[var(--ui-text-primary)] transition-all">
                  Edit
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-solid border-[var(--ui-border-muted)] pt-4">
                <div>
                  <div className="text-[11px] font-bold text-[var(--ui-text-muted)] uppercase tracking-widest mb-1.5">
                    Required Approvals
                  </div>
                  <div className="text-[14px] font-bold text-[var(--ui-text-primary)] flex items-center gap-1.5">
                    <Users size={14} className="text-[var(--accent-primary)]" />
                    {workflow.approvers}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-[var(--ui-text-muted)] uppercase tracking-widest mb-1.5">
                    Auto-escalate
                  </div>
                  <div className={cn(
                    "text-[14px] font-bold",
                    workflow.autoEscalate ? "text-[var(--status-success)]" : "text-[var(--ui-text-muted)]"
                  )}>
                    {workflow.autoEscalate ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-[var(--ui-text-muted)] uppercase tracking-widest mb-1.5">
                    Timeout
                  </div>
                  <div className="text-[14px] font-bold text-[var(--ui-text-primary)] flex items-center gap-1.5">
                    <Timer size={14} className="text-[var(--accent-primary)]" />
                    {workflow.timeout} min
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button type="button" className="mt-5 w-full py-3.5 rounded-xl border border-dashed border-[var(--ui-border-default)] bg-transparent text-[var(--ui-text-secondary)] text-[14px] font-bold cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 hover:border-[var(--ui-border-muted)] transition-all">
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
    <button type="button"
      onClick={onClick}
      className={cn(
        "p-4 rounded-xl border border-solid flex items-center gap-4 cursor-pointer text-left transition-all",
        active ? "shadow-sm" : "bg-[var(--surface-panel)] border-[var(--surface-hover)] hover:bg-[var(--surface-hover)]"
      )}
      style={active ? { backgroundColor: `${color}15`, borderColor: color } : undefined}
    >
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}20`, color }}
      >
        {icon}
      </div>
      <div>
        <div className="text-[24px] font-extrabold leading-none mb-1" style={{ color }}>{value}</div>
        <div className="text-[12px] font-bold text-[var(--ui-text-secondary)] uppercase tracking-wider">{label}</div>
      </div>
    </button>
  );
}

function LoadingState() {
  return (
    <div className="text-center py-20 text-[var(--ui-text-muted)]">
      <ArrowsClockwise size={32} className="animate-spin mx-auto mb-3" />
      <p className="m-0 font-medium">Loading approvals…</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-20 px-6">
      <Warning size={32} className="text-[var(--status-error)] mx-auto mb-3" />
      <p className="text-[var(--status-error)] font-bold mb-4">{message}</p>
      <button type="button"
        onClick={onRetry}
        className="px-5 py-2 rounded-lg border border-solid border-[var(--ui-border-default)] bg-transparent text-[var(--ui-text-secondary)] text-[13px] font-bold cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

function EmptyState({ pendingOnly }: { pendingOnly: boolean }) {
  return (
    <div className="text-center py-20 px-6 text-[var(--ui-text-muted)]">
      <CheckCircle size={48} className="mx-auto mb-4 opacity-20" />
      <h3 className="m-0 mb-2 text-[16px] font-bold text-[var(--ui-text-muted)]">
        {pendingOnly ? 'No pending approvals' : 'No approvals found'}
      </h3>
      <p className="m-0 text-[14px] font-medium max-w-[300px] mx-auto leading-relaxed">
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

export default PolicyGating;
