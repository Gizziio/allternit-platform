import React, { useState, useEffect, useCallback } from 'react';
import { GlassCard } from '../../design/glass/GlassCard';
import { EmptyState } from '@/components/settings/EmptyState';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  Warning,
  CaretDown,
  CaretUp,
  FolderOpen,
  GearSix,
  ArrowsClockwise,
} from '@phosphor-icons/react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProposalStatus = 'pending' | 'approved' | 'rejected';
type RiskLevel = 'Low' | 'Medium' | 'High';
type SortBy = 'date' | 'risk' | 'author';

interface AffectedFile {
  path: string;
  additions: number;
  deletions: number;
}

interface Proposal {
  id: string;
  title: string;
  description: string;
  author: string;
  timestamp: string;
  status: ProposalStatus;
  riskLevel: RiskLevel;
  affectedFiles: AffectedFile[];
  ciChecks: 'passing' | 'failing' | 'running';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'High': return 'var(--status-error)';
    case 'Medium': return 'var(--status-warning)';
    case 'Low': return 'var(--status-success)';
    default: return 'var(--text-tertiary)';
  }
}

function getCheckColor(status: Proposal['ciChecks']): string {
  switch (status) {
    case 'passing': return 'var(--status-success)';
    case 'failing': return 'var(--status-error)';
    case 'running': return 'var(--accent-primary)';
    default: return 'var(--text-tertiary)';
  }
}

function getCheckIcon(status: Proposal['ciChecks']) {
  switch (status) {
    case 'passing': return CheckCircle;
    case 'failing': return XCircle;
    case 'running': return GearSix;
    default: return null;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <GlassCard className="p-3 text-center">
      <div className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
        {label}
      </div>
      <div 
        className="text-[20px] font-extrabold tabular-nums text-[var(--stat-color)]"
        style={{ '--stat-color': color } as React.CSSProperties}
      >
        {value}
      </div>
    </GlassCard>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PromotionDashboardView() {
  const [filterStatus, setFilterStatus] = useState<'All' | ProposalStatus>('All');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [proposalStates, setProposalStates] = useState<Record<string, ProposalStatus>>({});
  const [fetchState, setFetchState] = useState<'loading' | 'error' | 'success'>('loading');
  const [decisionLoading, setDecisionLoading] = useState<Record<string, boolean>>({});
  const [decisionError, setDecisionError] = useState<Record<string, string | null>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  const loadProposals = useCallback(() => {
    setFetchState('loading');
    setGlobalError(null);
    fetch('/api/v1/promotion/proposals')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Proposal[]) => {
        setProposals(data);
        setProposalStates(data.reduce((acc, p) => ({ ...acc, [p.id]: p.status }), {}));
        setFetchState('success');
      })
      .catch((err: Error) => {
        setFetchState('error');
        setGlobalError(err.message);
      });
  }, []);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  const filteredProposals = proposals.filter(p => 
    filterStatus === 'All' ? true : proposalStates[p.id] === filterStatus
  );

  const sortedProposals = [...filteredProposals].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return proposals.findIndex(p => p.id === b.id) - proposals.findIndex(p => p.id === a.id);
      case 'risk': {
        const riskOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
        return riskOrder[b.riskLevel as keyof typeof riskOrder] - riskOrder[a.riskLevel as keyof typeof riskOrder];
      }
      case 'author':
        return a.author.localeCompare(b.author);
      default:
        return 0;
    }
  });

  const stats = {
    pending: Object.values(proposalStates).filter(s => s === 'pending').length,
    approved: Object.values(proposalStates).filter(s => s === 'approved').length,
    rejected: Object.values(proposalStates).filter(s => s === 'rejected').length
  };

  const submitDecision = useCallback(async (id: string, decision: 'approved' | 'rejected') => {
    const previousStatus = proposalStates[id];
    setDecisionLoading(prev => ({ ...prev, [id]: true }));
    setDecisionError(prev => ({ ...prev, [id]: null }));
    setProposalStates(prev => ({ ...prev, [id]: decision }));

    try {
      const res = await fetch(`/api/v1/promotion/proposals/${id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
    } catch (err: any) {
      setProposalStates(prev => ({ ...prev, [id]: previousStatus }));
      setDecisionError(prev => ({ ...prev, [id]: err.message || 'Decision failed' }));
    } finally {
      setDecisionLoading(prev => ({ ...prev, [id]: false }));
    }
  }, [proposalStates]);

  const handleApply = (id: string) => submitDecision(id, 'approved');
  const handleReject = (id: string) => submitDecision(id, 'rejected');

  return (
    <div className="p-6 h-full flex flex-col gap-5 overflow-hidden">
      {/* Header with Summary Stats */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <ShieldCheck size={28} className="text-[var(--accent-primary)]" />
          <div>
            <h1 className="text-xl font-extrabold m-0">Promotion Dashboard</h1>
            <p className="text-[13px] text-[var(--text-tertiary)] mt-1 mb-0">
              Review and manage code promotion proposals
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <StatCard label="Pending" value={stats.pending} color="var(--status-warning)" />
          <StatCard label="Approved" value={stats.approved} color="var(--status-success)" />
          <StatCard label="Rejected" value={stats.rejected} color="var(--status-error)" />
        </div>
      </div>

      {/* Global Error Banner */}
      {globalError && fetchState === 'success' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--status-error-bg)] text-[var(--status-error)] text-[12px] font-semibold">
          <Warning size={14} />
          {globalError}
          <button type="button" onClick={() => setGlobalError(null)} className="ml-auto text-[11px] underline cursor-pointer bg-transparent border-none">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Tabs and Sort */}
      <div className="flex justify-between items-center gap-3">
        <div className="flex gap-2">
          {(['All', 'pending', 'approved', 'rejected'] as const).map(status => (
            <button type="button"
              key={status}
              onClick={() => setFilterStatus(status === 'All' ? 'All' : status)}
              className={`px-3.5 py-1.5 rounded-md border-none text-[12px] font-semibold cursor-pointer transition-all duration-200 capitalize ${
                filterStatus === status
                  ? 'bg-[var(--accent-chat)] text-[var(--ui-text-inverse)]'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <select aria-label="Selection" value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="p-1.5 px-2.5 rounded-md border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-[12px] font-semibold cursor-pointer outline-none"
        >
          <option value="date">Sort by: Date</option>
          <option value="risk">Sort by: Risk</option>
          <option value="author">Sort by: Author</option>
        </select>
      </div>

      {/* Proposals List */}
      <div className="flex-1 overflow-auto">
        {fetchState === 'loading' && (
          <div className="flex flex-col items-center justify-center p-12 gap-3 text-[var(--text-tertiary)]">
            <ArrowsClockwise size={24} className="animate-spin" />
            <span className="text-[13px] font-medium">Loading proposals…</span>
          </div>
        )}

        {fetchState === 'error' && (
          <EmptyState
            icon={<XCircle size={48} weight="thin" className="text-[var(--status-error)]" />}
            title="Could not load proposals"
            caption="The promotion service is unavailable. Check your connection and try again."
            ctaLabel="Retry"
            onCtaClick={loadProposals}
          />
        )}

        {fetchState === 'success' && sortedProposals.length === 0 && (
          <EmptyState
            icon={<FolderOpen size={48} weight="thin" />}
            title="No proposals found"
            caption={filterStatus === 'All'
              ? 'There are no promotion proposals to review right now.'
              : `No ${filterStatus} proposals match the current filter.`}
            ctaLabel={filterStatus === 'All' ? undefined : 'Clear filter'}
            onCtaClick={filterStatus === 'All' ? undefined : () => setFilterStatus('All')}
          />
        )}

        {fetchState !== 'error' && (
          <div className="grid gap-3">
            {sortedProposals.map(proposal => {
            const currentStatus = proposalStates[proposal.id];
            const isExpanded = expandedId === proposal.id;
            const CheckIconComponent = getCheckIcon(proposal.ciChecks);

            return (
              <GlassCard
                key={proposal.id}
                className={`p-4 transition-all duration-200 border border-solid ${
                  isExpanded ? 'border-[var(--border-subtle)]' : 'border-transparent'
                }`}
              >
                {/* Header */}
                <div className="flex justify-between items-start gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="text-[12px] font-extrabold text-[var(--text-tertiary)]">
                        {proposal.id}
                      </div>
                      <span className="text-[12px] text-[var(--text-tertiary)]">•</span>
                      <div className="text-[12px] font-semibold text-[var(--text-tertiary)]">
                        {proposal.author}
                      </div>
                      <span className="text-[12px] text-[var(--text-tertiary)]">•</span>
                      <div className="text-[12px] text-[var(--text-tertiary)]">
                        {proposal.timestamp}
                      </div>
                    </div>
                    <h3 className="m-0 text-[15px] font-bold text-[var(--text-primary)] mb-1">
                      {proposal.title}
                    </h3>
                    <p className="m-0 text-[12px] text-[var(--text-secondary)] leading-relaxed">
                      {proposal.description}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className="flex flex-col items-end gap-2">
                    <div>
                      {currentStatus === 'approved' && (
                        <div className="px-2.5 py-1 rounded bg-[var(--status-success-bg)] text-[var(--status-success)] text-[10px] font-bold">
                          DEPLOYED
                        </div>
                      )}
                      {currentStatus === 'rejected' && (
                        <div className="px-2.5 py-1 rounded bg-[var(--status-error-bg)] text-[var(--status-error)] text-[10px] font-bold">
                          REJECTED
                        </div>
                      )}
                      {currentStatus === 'pending' && (
                        <div className="px-2.5 py-1 rounded bg-[var(--status-warning-bg)] text-[var(--status-warning)] text-[10px] font-bold">
                          PENDING
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Metadata Row */}
                <div className="flex gap-3 items-center mb-3 pt-3 border-t border-solid border-[var(--border-subtle)]">
                  {/* CI Checks */}
                  <div className="flex items-center gap-1.5">
                    {CheckIconComponent && (
                      <CheckIconComponent 
                        size={14} 
                        className="text-[var(--check-color)]" 
                        style={{ '--check-color': getCheckColor(proposal.ciChecks) } as React.CSSProperties} 
                      />
                    )}
                    <span className="text-[12px] text-[var(--text-secondary)] font-semibold uppercase">
                      CI: {proposal.ciChecks}
                    </span>
                  </div>

                  {/* Risk Level */}
                  <div className="flex items-center gap-1.5">
                    <Warning 
                      size={14} 
                      className="text-[var(--risk-color)]" 
                      style={{ '--risk-color': getRiskColor(proposal.riskLevel) } as React.CSSProperties} 
                    />
                    <span
                      className="text-[12px] font-semibold uppercase text-[var(--risk-color)]"
                      style={{ '--risk-color': getRiskColor(proposal.riskLevel) } as React.CSSProperties}
                    >
                      Risk: {proposal.riskLevel}
                    </span>
                  </div>

                  {/* Affected Files Count */}
                  <div className="flex items-center gap-1.5">
                    <FolderOpen size={14} className="text-[var(--text-tertiary)]" />
                    <span className="text-[12px] text-[var(--text-secondary)] font-semibold">
                      {proposal.affectedFiles.length} files
                    </span>
                  </div>

                  {/* Expand Button */}
                  <button type="button"
                    onClick={() => setExpandedId(isExpanded ? null : proposal.id)}
                    className="ml-auto p-1 border-none bg-transparent text-[var(--text-tertiary)] cursor-pointer"
                  >
                    {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
                  </button>
                </div>

                {/* Expanded Content - Affected Files */}
                {isExpanded && (
                  <div className="pt-3 border-t border-solid border-[var(--border-subtle)]">
                    <h4 className="text-[12px] font-bold text-[var(--text-tertiary)] uppercase mb-2 m-0">
                      Affected Files
                    </h4>
                    <div className="flex flex-col gap-1.5 mb-3">
                      {proposal.affectedFiles.map((file, idx) => (
                        <div key={`promotiondashboardview-${idx}`} className="p-2 bg-[var(--surface-hover)] rounded text-[12px] flex justify-between items-center">
                          <span className="text-[var(--text-secondary)] font-mono">
                            {file.path}
                          </span>
                          <span className="text-[var(--text-tertiary)] text-[11px] tabular-nums">
                            <span className="text-[var(--status-success)]">+{file.additions}</span> <span className="text-[var(--status-error)]">-{file.deletions}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Decision Error */}
                {decisionError[proposal.id] && (
                  <div className="flex items-center gap-2 pt-3 text-[11px] font-semibold text-[var(--status-error)]">
                    <XCircle size={13} />
                    {decisionError[proposal.id]}
                  </div>
                )}

                {/* Action Buttons */}
                {currentStatus === 'pending' && (
                  <div className="flex gap-2 pt-3 border-t border-solid border-[var(--border-subtle)]">
                    <button type="button"
                      onClick={() => handleApply(proposal.id)}
                      disabled={decisionLoading[proposal.id]}
                      className="flex-1 py-2 px-3 rounded-md border-none bg-[var(--status-success)] text-[var(--ui-text-inverse)] text-[12px] font-bold cursor-pointer transition-all duration-200 hover:brightness-110 active:scale-95 disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-1.5"
                    >
                      {decisionLoading[proposal.id] ? <ArrowsClockwise size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                      Apply Proposal
                    </button>
                    <button type="button"
                      onClick={() => handleReject(proposal.id)}
                      disabled={decisionLoading[proposal.id]}
                      className="flex-1 py-2 px-3 rounded-md border border-solid border-[var(--border-subtle)] bg-transparent text-[var(--status-error)] text-[12px] font-bold cursor-pointer transition-all duration-200 hover:bg-[var(--status-error-bg)] disabled:opacity-60 disabled:cursor-wait"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </GlassCard>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
}
