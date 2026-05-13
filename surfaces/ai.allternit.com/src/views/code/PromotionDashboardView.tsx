import React, { useState, useEffect } from 'react';
import { GlassCard } from '../../design/glass/GlassCard';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  Warning,
  CaretDown,
  CaretUp,
  FolderOpen,
  GearSix,
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
        className="text-[20px] font-extrabold tabular-nums"
        style={{ color }}
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

  useEffect(() => {
    fetch('/api/v1/promotion/proposals')
      .then(r => r.json())
      .then((data: Proposal[]) => {
        setProposals(data);
        setProposalStates(data.reduce((acc, p) => ({ ...acc, [p.id]: p.status }), {}));
      })
      .catch(() => {});
  }, []);

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

  const handleApply = (id: string) => {
    setProposalStates(prev => ({ ...prev, [id]: 'approved' }));
  };

  const handleReject = (id: string) => {
    setProposalStates(prev => ({ ...prev, [id]: 'rejected' }));
  };

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
          <StatCard label="Pending" value={stats.pending} color="#ffa500" />
          <StatCard label="Approved" value={stats.approved} color="#34c759" />
          <StatCard label="Rejected" value={stats.rejected} color="#ff3b30" />
        </div>
      </div>

      {/* Filter Tabs and Sort */}
      <div className="flex justify-between items-center gap-3">
        <div className="flex gap-2">
          {(['All', 'pending', 'approved', 'rejected'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status === 'All' ? 'All' : status)}
              className={`px-3.5 py-1.5 rounded-md border-none text-[12px] font-semibold cursor-pointer transition-all duration-200 capitalize ${
                filterStatus === status 
                  ? 'bg-[var(--accent-chat)] text-white' 
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <select
          value={sortBy}
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
        <div className="grid gap-3">
          {sortedProposals.map(proposal => {
            const currentStatus = proposalStates[proposal.id];
            const isExpanded = expandedId === proposal.id;
            const CheckIconComponent = getCheckIcon(proposal.ciChecks);

            return (
              <GlassCard
                key={proposal.id}
                className="p-4 transition-all duration-200 border border-solid border-transparent"
                style={{
                   borderColor: isExpanded ? 'var(--border-subtle)' : undefined
                }}
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
                    {CheckIconComponent && <CheckIconComponent size={14} style={{ color: getCheckColor(proposal.ciChecks) }} />}
                    <span className="text-[12px] text-[var(--text-secondary)] font-semibold uppercase">
                      CI: {proposal.ciChecks}
                    </span>
                  </div>

                  {/* Risk Level */}
                  <div className="flex items-center gap-1.5">
                    <Warning size={14} style={{ color: getRiskColor(proposal.riskLevel) }} />
                    <span
                      className="text-[12px] font-semibold uppercase"
                      style={{ color: getRiskColor(proposal.riskLevel) }}
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
                  <button
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
                        <div key={idx} className="p-2 bg-white/5 rounded text-[12px] flex justify-between items-center">
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

                {/* Action Buttons */}
                {currentStatus === 'pending' && (
                  <div className="flex gap-2 pt-3 border-t border-solid border-[var(--border-subtle)]">
                    <button
                      onClick={() => handleApply(proposal.id)}
                      className="flex-1 py-2 px-3 rounded-md border-none bg-[var(--status-success)] text-white text-[12px] font-bold cursor-pointer transition-all duration-200 hover:brightness-110 active:scale-95"
                    >
                      Apply Proposal
                    </button>
                    <button
                      onClick={() => handleReject(proposal.id)}
                      className="flex-1 py-2 px-3 rounded-md border border-solid border-[var(--border-subtle)] bg-transparent text-[var(--status-error)] text-[12px] font-bold cursor-pointer transition-all duration-200 hover:bg-[var(--status-error-bg)]"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
