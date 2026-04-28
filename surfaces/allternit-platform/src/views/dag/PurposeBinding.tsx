/**
 * Purpose Binding - Full Implementation
 * 
 * Features:
 * - Configure purpose alignment controls
 * - Bind agents to specific purposes
 * - View purpose violations
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Target,
  Robot,
  Link,
  LinkBreak,
  Warning,
  XCircle,
  MagnifyingGlass,
  ArrowsClockwise,
  CaretRight,
  GearSix,
  Shield,
  Wrench,
  Database,
  Globe,
  FileCode,
  X,
} from '@phosphor-icons/react';
import {
  listPurposes,
  listAgentPurposeBindings,
  bindAgentToPurpose,
  unbindAgentFromPurpose,
  listPurposeViolations,
} from '@/lib/governance/policy.service';
import type {
  Purpose,
  AgentPurposeBinding,
  PurposeViolation,
} from '@/lib/governance/policy.types';

// Purpose category configurations
const PURPOSE_CATEGORIES = [
  { value: 'data-analysis', label: 'Data Analysis', icon: <Database size={16} />, color: 'var(--status-info)' },
  { value: 'code-generation', label: 'Code Generation', icon: <FileCode size={16} />, color: 'var(--status-success)' },
  { value: 'web-research', label: 'Web Research', icon: <Globe size={16} />, color: '#8b5cf6' },
  { value: 'system-admin', label: 'System Administration', icon: <GearSix size={16} />, color: 'var(--status-warning)' },
  { value: 'security', label: 'Security Operations', icon: <Shield size={16} />, color: 'var(--status-error)' },
];

// ============================================================================
// Main Component
// ============================================================================

export function PurposeBinding() {
  // State
  const [purposes, setPurposes] = useState<Purpose[]>([]);
  const [bindings, setBindings] = useState<AgentPurposeBinding[]>([]);
  const [violations, setViolations] = useState<PurposeViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'purposes' | 'bindings' | 'violations'>('purposes');
  const [, setShowCreateModal] = useState(false);
  const [showBindModal, setShowBindModal] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [purposesRes, bindingsRes, violationsRes] = await Promise.all([
        listPurposes(),
        listAgentPurposeBindings(),
        listPurposeViolations(),
      ]);

      setPurposes(purposesRes.purposes);
      setBindings(bindingsRes.bindings);
      setViolations(violationsRes.violations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      // Use mock data for development
      setPurposes(getMockPurposes());
      setBindings(getMockBindings());
      setViolations(getMockViolations());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handlers
  const handleBindAgent = async (agentId: string, purposeId: string, confidence: number) => {
    try {
      await bindAgentToPurpose({ agentId, purposeId, confidence });
      fetchData();
      setShowBindModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bind agent');
    }
  };

  const handleUnbindAgent = async (agentId: string, purposeId: string) => {
    if (!confirm('Are you sure you want to unbind this agent from the purpose?')) return;
    try {
      await unbindAgentFromPurpose(agentId, purposeId);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unbind agent');
    }
  };

  // Filter purposes
  const filteredPurposes = purposes.filter(purpose => {
    if (selectedCategory !== 'all' && purpose.category !== selectedCategory) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        purpose.name.toLowerCase().includes(query) ||
        purpose.description.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Filter bindings
  const filteredBindings = bindings.filter(binding => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        binding.agentName.toLowerCase().includes(query) ||
        binding.purposeName.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Filter violations
  const filteredViolations = violations.filter(violation => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        violation.agentName.toLowerCase().includes(query) ||
        violation.purposeName.toLowerCase().includes(query) ||
        violation.violation.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Stats
  const stats = {
    totalPurposes: purposes.length,
    activeBindings: bindings.filter(b => b.status === 'active').length,
    totalViolations: violations.length,
    openViolations: violations.filter(v => !v.resolvedAt).length,
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
            Purpose Binding
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--ui-text-secondary)' }}>
            Align agents with authorized purposes and monitor compliance
          </p>
        </div>
        <button
          onClick={() => setShowBindModal(true)}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            background: 'var(--accent-primary)',
            color: 'var(--ui-text-inverse)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Link size={16} />
          Bind Agent
        </button>
      </div>

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
          label="Purposes" 
          value={stats.totalPurposes} 
          color="var(--accent-primary)" 
          icon={<Target size={20} />}
        />
        <StatCard 
          label="Active Bindings" 
          value={stats.activeBindings} 
          color="var(--status-info)" 
          icon={<Link size={20} />}
        />
        <StatCard 
          label="Total Violations" 
          value={stats.totalViolations} 
          color="var(--status-warning)" 
          icon={<Warning size={20} />}
        />
        <StatCard 
          label="Open Violations" 
          value={stats.openViolations} 
          color="var(--status-error)" 
          icon={<XCircle size={20} />}
        />
      </div>

      {/* Tabs */}
      <div style={{ 
        padding: '0 24px', 
        borderBottom: '1px solid var(--ui-border-muted)',
        display: 'flex',
        gap: 0,
        background: 'var(--surface-panel)',
      }}>
        {[
          { id: 'purposes', label: 'Purposes', count: purposes.length },
          { id: 'bindings', label: 'Bindings', count: bindings.length },
          { id: 'violations', label: 'Violations', count: violations.filter(v => !v.resolvedAt).length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            style={{
              padding: '14px 20px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #d4b08c' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--ui-text-muted)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {tab.label}
            <span style={{
              padding: '2px 8px',
              background: activeTab === tab.id ? 'color-mix(in srgb, var(--accent-primary) 12%, transparent)' : 'var(--surface-hover)',
              borderRadius: 10,
              fontSize: 11,
            }}>
              {tab.count}
            </span>
          </button>
        ))}
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
            placeholder={`Search ${activeTab}...`}
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
        {activeTab === 'purposes' && (
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
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
            <option value="all">All Categories</option>
            {PURPOSE_CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        )}
        <button
          onClick={fetchData}
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
          <ErrorState message={error} onRetry={fetchData} />
        ) : activeTab === 'purposes' ? (
          filteredPurposes.length === 0 ? (
            <EmptyState message="No purposes found" />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
              {filteredPurposes.map(purpose => (
                <PurposeCard
                  key={purpose.id}
                  purpose={purpose}
                  bindingCount={bindings.filter(b => b.purposeId === purpose.id && b.status === 'active').length}
                  onClick={() => setSelectedPurpose(purpose)}
                />
              ))}
            </div>
          )
        ) : activeTab === 'bindings' ? (
          filteredBindings.length === 0 ? (
            <EmptyState message="No agent bindings found" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredBindings.map(binding => (
                <BindingCard
                  key={`${binding.agentId}-${binding.purposeId}`}
                  binding={binding}
                  onUnbind={() => handleUnbindAgent(binding.agentId, binding.purposeId)}
                />
              ))}
            </div>
          )
        ) : (
          filteredViolations.length === 0 ? (
            <EmptyState message="No violations found" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredViolations.map(violation => (
                <ViolationCard key={violation.id} violation={violation} />
              ))}
            </div>
          )
        )}
      </div>

      {/* Modals */}
      {showBindModal && (
        <BindAgentModal
          purposes={purposes}
          onClose={() => setShowBindModal(false)}
          onBind={handleBindAgent}
        />
      )}
    </div>
  );
}

// ============================================================================
// Purpose Card Component
// ============================================================================

function PurposeCard({ 
  purpose, 
  bindingCount,
  onClick,
}: { 
  purpose: Purpose; 
  bindingCount: number;
  onClick: () => void;
}) {
  const category = PURPOSE_CATEGORIES.find(c => c.value === purpose.category) || PURPOSE_CATEGORIES[0];

  return (
    <div 
      onClick={onClick}
      style={{
        background: 'var(--surface-panel)',
        borderRadius: 8,
        border: '1px solid var(--ui-border-muted)',
        padding: 20,
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: `${category.color}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: category.color,
        }}>
          {category.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ui-text-primary)' }}>
              {purpose.name}
            </span>
            {purpose.status === 'active' ? (
              <span style={{
                padding: '2px 8px',
                background: 'var(--status-success-bg)',
                color: 'var(--status-success)',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
              }}>
                Active
              </span>
            ) : (
              <span style={{
                padding: '2px 8px',
                background: 'var(--surface-active)',
                color: 'var(--ui-text-secondary)',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
              }}>
                Inactive
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ui-text-secondary)', lineHeight: 1.4 }}>
            {purpose.description}
          </p>
        </div>
      </div>

      <div style={{ 
        padding: '12px 0', 
        borderTop: '1px solid var(--ui-border-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
            <Robot size={12} style={{ display: 'inline', marginRight: 4 }} />
            {bindingCount} bound agents
          </span>
          <span style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
            <Wrench size={12} style={{ display: 'inline', marginRight: 4 }} />
            {purpose.allowedTools.length} tools
          </span>
        </div>
        <CaretRight size={16} color="#666" />
      </div>
    </div>
  );
}

// ============================================================================
// Binding Card Component
// ============================================================================

function BindingCard({ 
  binding, 
  onUnbind,
}: { 
  binding: AgentPurposeBinding; 
  onUnbind: () => void;
}) {
  const getStatusColor = () => {
    switch (binding.status) {
      case 'active': return { bg: 'var(--status-success-bg)', text: 'var(--status-success)' };
      case 'suspended': return { bg: 'var(--status-warning-bg)', text: 'var(--status-warning)' };
      case 'revoked': return { bg: 'var(--status-error-bg)', text: 'var(--status-error)' };
      default: return { bg: 'var(--surface-active)', text: 'var(--ui-text-muted)' };
    }
  };

  const statusColor = getStatusColor();

  return (
    <div style={{
      background: 'var(--surface-panel)',
      borderRadius: 8,
      border: '1px solid var(--ui-border-muted)',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }}>
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: 'var(--surface-hover)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--accent-primary)',
      }}>
        <Robot size={20} />
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ui-text-primary)' }}>
            {binding.agentName}
          </span>
          <span style={{
            padding: '2px 8px',
            background: statusColor.bg,
            color: statusColor.text,
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
          }}>
            {binding.status}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--ui-text-secondary)' }}>
            <Target size={12} style={{ display: 'inline', marginRight: 4 }} />
            {binding.purposeName}
          </span>
          <span style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
            Confidence: {Math.round(binding.confidence * 100)}%
          </span>
          {binding.violations > 0 && (
            <span style={{
              padding: '1px 6px',
              background: 'var(--status-error-bg)',
              color: 'var(--status-error)',
              borderRadius: 4,
              fontSize: 11,
            }}>
              {binding.violations} violations
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
          Bound {new Date(binding.boundAt).toLocaleDateString()}
        </span>
        {binding.status === 'active' && (
          <button
            onClick={onUnbind}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--ui-border-default)',
              background: 'transparent',
              color: 'var(--ui-text-secondary)',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <LinkBreak size={14} />
            Unbind
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Violation Card Component
// ============================================================================

function ViolationCard({ violation }: { violation: PurposeViolation }) {
  const getSeverityColor = () => {
    switch (violation.severity) {
      case 'critical': return 'var(--status-error)';
      case 'high': return 'var(--status-warning)';
      case 'medium': return 'var(--status-warning)';
      case 'low': return 'var(--status-info)';
      default: return 'var(--ui-text-muted)';
    }
  };

  return (
    <div style={{
      background: 'var(--surface-panel)',
      borderRadius: 8,
      border: '1px solid var(--ui-border-muted)',
      borderLeft: `3px solid ${getSeverityColor()}`,
      padding: '16px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: `${getSeverityColor()}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: getSeverityColor(),
        }}>
          <Warning size={18} />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ui-text-primary)' }}>
              {violation.violation}
            </span>
            <span style={{
              padding: '2px 8px',
              background: `${getSeverityColor()}20`,
              color: getSeverityColor(),
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
            }}>
              {violation.severity}
            </span>
            {!violation.resolvedAt && (
              <span style={{
                padding: '2px 8px',
                background: 'var(--status-error-bg)',
                color: 'var(--status-error)',
                borderRadius: 4,
                fontSize: 11,
              }}>
                Open
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--ui-text-secondary)' }}>
              <Robot size={12} style={{ display: 'inline', marginRight: 4 }} />
              {violation.agentName}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ui-text-secondary)' }}>
              <Target size={12} style={{ display: 'inline', marginRight: 4 }} />
              {violation.purposeName}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
              {new Date(violation.createdAt).toLocaleString()}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ui-text-muted)' }}>
            {JSON.stringify(violation.details)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Bind Agent Modal
// ============================================================================

function BindAgentModal({
  purposes,
  onClose,
  onBind,
}: {
  purposes: Purpose[];
  onClose: () => void;
  onBind: (agentId: string, purposeId: string, confidence: number) => void;
}) {
  const [agentId, setAgentId] = useState('');
  const [purposeId, setPurposeId] = useState('');
  const [confidence, setConfidence] = useState(0.8);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onBind(agentId, purposeId, confidence);
  };

  const activePurposes = purposes.filter(p => p.status === 'active');

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
        width: 500,
        background: 'var(--surface-panel)',
        borderRadius: 12,
        border: '1px solid var(--ui-border-muted)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--ui-border-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--ui-text-primary)' }}>
            Bind Agent to Purpose
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--ui-text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ui-text-muted)', marginBottom: 6 }}>
              Agent ID
            </label>
            <input
              type="text"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="Enter agent ID"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid var(--ui-border-default)',
                background: 'var(--surface-panel)',
                color: 'var(--ui-text-primary)',
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ui-text-muted)', marginBottom: 6 }}>
              Purpose
            </label>
            <select
              value={purposeId}
              onChange={(e) => setPurposeId(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid var(--ui-border-default)',
                background: 'var(--surface-panel)',
                color: 'var(--ui-text-primary)',
                fontSize: 14,
              }}
            >
              <option value="">Select a purpose...</option>
              {activePurposes.map(purpose => (
                <option key={purpose.id} value={purpose.id}>
                  {purpose.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ui-text-muted)', marginBottom: 6 }}>
              Confidence Level: {Math.round(confidence * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={confidence}
              onChange={(e) => setConfidence(parseFloat(e.target.value))}
              style={{
                width: '100%',
                height: 6,
                borderRadius: 3,
                background: 'var(--surface-hover)',
                outline: 'none',
                accentColor: 'var(--accent-primary)',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'var(--ui-text-muted)' }}>
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                borderRadius: 6,
                border: '1px solid var(--ui-border-default)',
                background: 'transparent',
                color: 'var(--ui-text-muted)',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '10px 20px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--accent-primary)',
                color: 'var(--ui-text-inverse)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Bind Agent
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Utility Components
// ============================================================================

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div style={{
      padding: 16,
      background: 'var(--surface-panel)',
      borderRadius: 8,
      border: '1px solid var(--ui-border-muted)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
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
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--ui-text-muted)' }}>
      <ArrowsClockwise size={32} style={{ animation: 'spin 1s linear infinite' }} />
      <p>Loading...</p>
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

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--ui-text-muted)' }}>
      <Target size={48} style={{ marginBottom: 16 }} />
      <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: 'var(--ui-text-muted)' }}>{message}</h3>
    </div>
  );
}

// ============================================================================
// Mock Data
// ============================================================================

function getMockPurposes(): Purpose[] {
  return [
    {
      id: 'pur-001',
      name: 'Data Analysis & Reporting',
      description: 'Authorized for data processing, statistical analysis, and report generation',
      category: 'data-analysis',
      allowedTools: ['file_read', 'database_query', 'chart_generate', 'export_csv'],
      allowedResources: ['data/*', 'reports/*'],
      restrictions: [
        { type: 'data', target: 'pii', allowed: false },
        { type: 'tool', target: 'file_write', allowed: true, conditions: { path: 'reports/*' } },
      ],
      createdAt: '2026-01-10T10:00:00Z',
      updatedAt: '2026-02-15T14:30:00Z',
      status: 'active',
      agentBindings: [],
    },
    {
      id: 'pur-002',
      name: 'Code Development',
      description: 'Authorized for software development, code review, and testing',
      category: 'code-generation',
      allowedTools: ['file_read', 'file_write', 'code_execute', 'git_commit', 'test_run'],
      allowedResources: ['src/*', 'tests/*', 'docs/*'],
      restrictions: [
        { type: 'resource', target: 'production', allowed: false },
        { type: 'tool', target: 'deploy', allowed: false },
      ],
      createdAt: '2026-01-15T09:00:00Z',
      updatedAt: '2026-03-01T11:00:00Z',
      status: 'active',
      agentBindings: [],
    },
    {
      id: 'pur-003',
      name: 'Web Research Assistant',
      description: 'Authorized for web browsing, information gathering, and summarization',
      category: 'web-research',
      allowedTools: ['web_search', 'web_browse', 'summarize', 'note_take'],
      allowedResources: ['web/*'],
      restrictions: [
        { type: 'tool', target: 'file_write', allowed: true, conditions: { path: 'notes/*' } },
        { type: 'data', target: 'download', allowed: true, conditions: { max_size: '10MB' } },
      ],
      createdAt: '2026-02-01T08:00:00Z',
      updatedAt: '2026-02-01T08:00:00Z',
      status: 'active',
      agentBindings: [],
    },
    {
      id: 'pur-004',
      name: 'System Administration',
      description: 'Authorized for infrastructure management and deployment',
      category: 'system-admin',
      allowedTools: ['ssh', 'docker', 'kubernetes', 'deploy', 'monitor'],
      allowedResources: ['infrastructure/*', 'deployments/*'],
      restrictions: [
        { type: 'resource', target: 'production', allowed: true, conditions: { approval_required: true } },
      ],
      createdAt: '2026-01-20T10:00:00Z',
      updatedAt: '2026-02-28T16:00:00Z',
      status: 'active',
      agentBindings: [],
    },
  ];
}

function getMockBindings(): AgentPurposeBinding[] {
  return [
    {
      agentId: 'agent-001',
      agentName: 'Data Analyzer',
      purposeId: 'pur-001',
      purposeName: 'Data Analysis & Reporting',
      confidence: 0.95,
      boundAt: '2026-02-01T10:00:00Z',
      boundBy: 'admin',
      status: 'active',
      violations: 0,
      lastActivityAt: '2026-03-06T14:30:00Z',
    },
    {
      agentId: 'agent-002',
      agentName: 'Code Assistant',
      purposeId: 'pur-002',
      purposeName: 'Code Development',
      confidence: 0.88,
      boundAt: '2026-02-10T09:00:00Z',
      boundBy: 'admin',
      status: 'active',
      violations: 2,
      lastActivityAt: '2026-03-06T16:00:00Z',
    },
    {
      agentId: 'agent-003',
      agentName: 'Research Bot',
      purposeId: 'pur-003',
      purposeName: 'Web Research Assistant',
      confidence: 0.92,
      boundAt: '2026-02-15T11:00:00Z',
      boundBy: 'admin',
      status: 'active',
      violations: 0,
      lastActivityAt: '2026-03-05T10:00:00Z',
    },
    {
      agentId: 'agent-004',
      agentName: 'DevOps Helper',
      purposeId: 'pur-004',
      purposeName: 'System Administration',
      confidence: 0.75,
      boundAt: '2026-02-20T14:00:00Z',
      boundBy: 'admin',
      status: 'suspended',
      violations: 5,
      lastActivityAt: '2026-03-01T09:00:00Z',
    },
  ];
}

function getMockViolations(): PurposeViolation[] {
  return [
    {
      id: 'viol-001',
      purposeId: 'pur-002',
      purposeName: 'Code Development',
      agentId: 'agent-002',
      agentName: 'Code Assistant',
      violation: 'Attempted to access production database',
      details: { resource: 'prod-db-001', action: 'query' },
      severity: 'high',
      createdAt: '2026-03-05T15:30:00Z',
    },
    {
      id: 'viol-002',
      purposeId: 'pur-002',
      purposeName: 'Code Development',
      agentId: 'agent-002',
      agentName: 'Code Assistant',
      violation: 'Attempted deployment without approval',
      details: { environment: 'staging', action: 'deploy' },
      severity: 'medium',
      createdAt: '2026-03-04T10:00:00Z',
    },
    {
      id: 'viol-003',
      purposeId: 'pur-004',
      purposeName: 'System Administration',
      agentId: 'agent-004',
      agentName: 'DevOps Helper',
      violation: 'Accessed unauthorized infrastructure',
      details: { resource: 'prod-k8s', namespace: 'critical' },
      severity: 'critical',
      createdAt: '2026-03-01T08:00:00Z',
      resolvedAt: '2026-03-01T10:00:00Z',
    },
  ];
}

export default PurposeBinding;
