import React, { useState, useEffect } from 'react';
import { GlassCard } from '../../design/GlassCard';
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

type ProposalStatus = 'pending' | 'approved' | 'rejected';
type SortBy = 'date' | 'risk' | 'author';

interface ProposalFile {
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
  ciChecks: 'passed' | 'failed' | 'running';
  riskLevel: 'Low' | 'Medium' | 'High';
  affectedFiles: ProposalFile[];
  reviewers?: string[];
}

const getRiskColor = (risk: string): string => {
  switch (risk) {
    case 'Low': return '#34c759';
    case 'Medium': return '#ffa500';
    case 'High': return '#ff3b30';
    default: return '#8e8e93';
  }
};

const getCheckIcon = (status: string): React.ComponentType | null => {
  switch (status) {
    case 'passed': return CheckCircle;
    case 'failed': return XCircle;
    case 'running': return GearSix;
    default: return null;
  }
};

const getCheckColor = (status: string): string => {
  switch (status) {
    case 'passed': return '#34c759';
    case 'failed': return '#ff3b30';
    case 'running': return '#ffa500';
    default: return '#888';
  }
};

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
    pending: proposalStates ? Object.values(proposalStates).filter(s => s === 'pending').length : 0,
    approved: proposalStates ? Object.values(proposalStates).filter(s => s === 'approved').length : 0,
    rejected: proposalStates ? Object.values(proposalStates).filter(s => s === 'rejected').length : 0
  };

  const handleApply = (id: string) => {
    setProposalStates(prev => ({ ...prev, [id]: 'approved' }));
  };

  const handleReject = (id: string) => {
    setProposalStates(prev => ({ ...prev, [id]: 'rejected' }));
  };

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', gap: 20, overflow: 'hidden' }}>
      {/* Header with Summary Stats */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <ShieldCheck size={28} color="var(--accent-primary)" />
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Promotion Dashboard</h1>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '4px 0 0 0' }}>
              Review and manage code promotion proposals
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
          <StatCard label="Pending" value={stats.pending} color="#ffa500" />
          <StatCard label="Approved" value={stats.approved} color="#34c759" />
          <StatCard label="Rejected" value={stats.rejected} color="#ff3b30" />
        </div>
      </div>

      {/* Filter Tabs and Sort */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['All', 'pending', 'approved', 'rejected'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status === 'All' ? 'All' : status)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: filterStatus === status ? 'var(--accent-chat)' : 'var(--bg-secondary)',
                color: filterStatus === status ? 'white' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textTransform: 'capitalize'
              }}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <option value="date">Sort by: Date</option>
          <option value="risk">Sort by: Risk</option>
          <option value="author">Sort by: Author</option>
        </select>
      </div>

      {/* Proposals List */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'grid', gap: 12 }}>
          {sortedProposals.map(proposal => {
            const currentStatus = proposalStates[proposal.id];
            const isExpanded = expandedId === proposal.id;
            const CheckIconComponent = getCheckIcon(proposal.ciChecks);

            return (
              <GlassCard
                key={proposal.id}
                style={{
                  padding: 16,
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)' }}>
                        {proposal.id}
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>•</span>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                        {proposal.author}
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>•</span>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {proposal.timestamp}
                      </div>
                    </div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {proposal.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {proposal.description}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <div>
                      {currentStatus === 'approved' && (
                        <div style={{
                          padding: '4px 10px',
                          borderRadius: 4,
                          background: '#34c75920',
                          color: '#34c759',
                          fontSize: 10,
                          fontWeight: 700
                        }}>
                          DEPLOYED
                        </div>
                      )}
                      {currentStatus === 'rejected' && (
                        <div style={{
                          padding: '4px 10px',
                          borderRadius: 4,
                          background: '#ff3b3020',
                          color: '#ff3b30',
                          fontSize: 10,
                          fontWeight: 700
                        }}>
                          REJECTED
                        </div>
                      )}
                      {currentStatus === 'pending' && (
                        <div style={{
                          padding: '4px 10px',
                          borderRadius: 4,
                          background: '#ffa50020',
                          color: '#ffa500',
                          fontSize: 10,
                          fontWeight: 700
                        }}>
                          PENDING
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Metadata Row */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                  {/* CI Checks */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {CheckIconComponent && <CheckIconComponent size={14} color={getCheckColor(proposal.ciChecks)} />}
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                      CI: {proposal.ciChecks}
                    </span>
                  </div>

                  {/* Risk Level */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Warning size={14} color={getRiskColor(proposal.riskLevel)} />
                    <span
                      style={{
                        fontSize: 11,
                        color: getRiskColor(proposal.riskLevel),
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}
                    >
                      Risk: {proposal.riskLevel}
                    </span>
                  </div>

                  {/* Affected Files Count */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FolderOpen size={14} color="var(--text-tertiary)" />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {proposal.affectedFiles.length} files
                    </span>
                  </div>

                  {/* Expand Button */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : proposal.id)}
                    style={{
                      marginLeft: 'auto',
                      padding: 4,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer'
                    }}
                  >
                    {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
                  </button>
                </div>

                {/* Expanded Content - Affected Files */}
                {isExpanded && (
                  <div style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                    <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8, margin: 0 }}>
                      Affected Files
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                      {proposal.affectedFiles.map((file, idx) => (
                        <div key={idx} style={{
                          padding: 8,
                          background: 'rgba(255, 255, 255, 0.02)',
                          borderRadius: 4,
                          fontSize: 11,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span style={{ color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                            {file.path}
                          </span>
                          <span style={{ color: 'var(--text-tertiary)', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
                            <span style={{ color: '#34c759' }}>+{file.additions}</span> <span style={{ color: '#ff3b30' }}>-{file.deletions}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {currentStatus === 'pending' && (
                  <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                    <button
                      onClick={() => handleApply(proposal.id)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: 'none',
                        background: '#34c759',
                        color: 'white',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Apply Proposal
                    </button>
                    <button
                      onClick={() => handleReject(proposal.id)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--border-subtle)',
                        background: 'transparent',
                        color: '#ff3b30',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
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

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <GlassCard style={{ padding: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </GlassCard>
  );
}
