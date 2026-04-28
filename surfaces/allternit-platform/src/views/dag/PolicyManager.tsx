/**
 * Policy Manager - Full Implementation
 * 
 * Features:
 * - List all governance policies
 * - Create new policy
 * - Edit existing policies
 * - Enable/disable policies
 * - View policy violation history
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Plus,
  MagnifyingGlass,
  PencilSimple,
  Trash,
  Copy,
  Power,
  Warning,
  CheckCircle,
  CaretDown,
  CaretRight,
  Clock,
  FileText,
  Lock,
  X,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import {
  listPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  enablePolicy,
  disablePolicy,
  clonePolicy,
  listViolations,
} from '@/lib/governance/policy.service';
import type {
  Policy,
  PolicyViolation,
  PolicyType,
  PolicySeverity,
  EnforcementMode,
  CreatePolicyInput,
} from '@/lib/governance/policy.types';

// Policy type configurations
const POLICY_TYPES: { value: PolicyType; label: string; color: string; icon: React.ReactNode }[] = [
  { value: 'security', label: 'Security', color: 'var(--status-error)', icon: <Shield size={14} /> },
  { value: 'compliance', label: 'Compliance', color: '#8b5cf6', icon: <CheckCircle size={14} /> },
  { value: 'operational', label: 'Operational', color: 'var(--status-info)', icon: <Clock size={14} /> },
  { value: 'data', label: 'Data', color: 'var(--status-success)', icon: <FileText size={14} /> },
  { value: 'access', label: 'Access', color: 'var(--status-warning)', icon: <Lock size={14} /> },
];

const SEVERITY_LEVELS: { value: PolicySeverity; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical', color: 'var(--status-error)' },
  { value: 'high', label: 'High', color: 'var(--status-warning)' },
  { value: 'medium', label: 'Medium', color: 'var(--status-warning)' },
  { value: 'low', label: 'Low', color: 'var(--status-info)' },
];

const ENFORCEMENT_MODES: { value: EnforcementMode; label: string; description: string }[] = [
  { value: 'block', label: 'Block', description: 'Prevent action and alert' },
  { value: 'warn', label: 'Warn', description: 'Allow with warning' },
  { value: 'audit', label: 'Audit', description: 'Log only' },
  { value: 'allow', label: 'Allow', description: 'No enforcement' },
];

// ============================================================================
// Main Component
// ============================================================================

export function PolicyManager() {
  // State
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<PolicyType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'disabled'>('all');
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViolationsPanel, setShowViolationsPanel] = useState(false);
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);

  // Fetch policies
  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listPolicies({
        type: filterType === 'all' ? undefined : filterType,
        status: filterStatus === 'all' ? undefined : filterStatus,
        search: searchQuery || undefined,
      });
      setPolicies(response.policies);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load policies');
      // Use mock data for development
      setPolicies(getMockPolicies());
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, searchQuery]);

  // Fetch violations
  const fetchViolations = useCallback(async () => {
    try {
      const response = await listViolations({ status: 'open', pageSize: 50 });
      setViolations(response.violations);
    } catch {
      setViolations(getMockViolations());
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
    fetchViolations();
  }, [fetchPolicies, fetchViolations]);

  // Handlers
  const handleCreatePolicy = async (input: CreatePolicyInput) => {
    try {
      await createPolicy(input);
      setShowCreateModal(false);
      fetchPolicies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create policy');
    }
  };

  const handleUpdatePolicy = async (policyId: string, updates: Partial<Policy>) => {
    try {
      await updatePolicy(policyId, updates);
      setShowEditModal(false);
      setSelectedPolicy(null);
      fetchPolicies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update policy');
    }
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!confirm('Are you sure you want to delete this policy?')) return;
    try {
      await deletePolicy(policyId);
      fetchPolicies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete policy');
    }
  };

  const handleTogglePolicy = async (policy: Policy) => {
    try {
      if (policy.status === 'active') {
        await disablePolicy(policy.id);
      } else {
        await enablePolicy(policy.id);
      }
      fetchPolicies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle policy');
    }
  };

  const handleClonePolicy = async (policyId: string) => {
    try {
      await clonePolicy(policyId);
      fetchPolicies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone policy');
    }
  };

  // Filter policies
  const filteredPolicies = policies.filter(policy => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        policy.name.toLowerCase().includes(query) ||
        policy.description.toLowerCase().includes(query) ||
        policy.tags.some(tag => tag.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }
    return true;
  });

  // Get violations for a policy
  const getPolicyViolations = (policyId: string) => {
    return violations.filter(v => v.policyId === policyId);
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
            Policy Manager
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--ui-text-secondary)' }}>
            {policies.length} policies • {violations.filter(v => v.status === 'open').length} open violations
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setShowViolationsPanel(!showViolationsPanel)}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid var(--ui-border-default)',
              background: showViolationsPanel ? 'var(--accent-primary)' : 'transparent',
              color: showViolationsPanel ? 'var(--ui-text-inverse)' : 'var(--ui-text-primary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Warning size={16} />
            Violations
            {violations.filter(v => v.status === 'open').length > 0 && (
              <span style={{
                padding: '2px 8px',
                background: 'var(--status-error)',
                color: 'var(--ui-text-primary)',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 600,
              }}>
                {violations.filter(v => v.status === 'open').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
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
            <Plus size={16} />
            New Policy
          </button>
        </div>
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
            placeholder="Search policies..."
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
          onChange={(e) => setFilterType(e.target.value as PolicyType | 'all')}
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
          {POLICY_TYPES.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'disabled')}
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
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
        <button
          onClick={fetchPolicies}
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

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Policy List */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto', 
          padding: 16,
        }}>
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={fetchPolicies} />
          ) : filteredPolicies.length === 0 ? (
            <EmptyState onCreate={() => setShowCreateModal(true)} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredPolicies.map(policy => (
                <PolicyCard
                  key={policy.id}
                  policy={policy}
                  violations={getPolicyViolations(policy.id)}
                  isExpanded={expandedPolicy === policy.id}
                  onToggleExpand={() => setExpandedPolicy(
                    expandedPolicy === policy.id ? null : policy.id
                  )}
                  onEdit={() => {
                    setSelectedPolicy(policy);
                    setShowEditModal(true);
                  }}
                  onDelete={() => handleDeletePolicy(policy.id)}
                  onToggle={() => handleTogglePolicy(policy)}
                  onClone={() => handleClonePolicy(policy.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Violations Panel */}
        {showViolationsPanel && (
          <div style={{ 
            width: 380, 
            borderLeft: '1px solid #333',
            background: 'var(--surface-hover)',
            overflow: 'auto',
          }}>
            <div style={{ 
              padding: '16px 20px', 
              borderBottom: '1px solid var(--ui-border-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ui-text-primary)' }}>
                Recent Violations
              </h3>
              <button 
                onClick={() => setShowViolationsPanel(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--ui-text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 12 }}>
              {violations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--ui-text-muted)' }}>
                  <CheckCircle size={32} style={{ marginBottom: 12 }} />
                  <p>No violations found</p>
                </div>
              ) : (
                violations.slice(0, 20).map(violation => (
                  <ViolationCard key={violation.id} violation={violation} />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <PolicyModal
          title="Create Policy"
          onClose={() => setShowCreateModal(false)}
          onSubmit={(input) => handleCreatePolicy(input as any)}
        />
      )}
      {showEditModal && selectedPolicy && (
        <PolicyModal
          title="Edit Policy"
          policy={selectedPolicy}
          onClose={() => {
            setShowEditModal(false);
            setSelectedPolicy(null);
          }}
          onSubmit={(updates) => handleUpdatePolicy(selectedPolicy.id, updates as any)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Policy Card Component
// ============================================================================

function PolicyCard({
  policy,
  violations,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onToggle,
  onClone,
}: {
  policy: Policy;
  violations: PolicyViolation[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onClone: () => void;
}) {
  const policyType = POLICY_TYPES.find(t => t.value === policy.type) || POLICY_TYPES[0];
  const severity = SEVERITY_LEVELS.find(s => s.value === policy.severity) || SEVERITY_LEVELS[2];

  return (
    <div style={{
      background: 'var(--surface-panel)',
      borderRadius: 8,
      border: '1px solid var(--ui-border-muted)',
      overflow: 'hidden',
    }}>
      <div 
        onClick={onToggleExpand}
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          cursor: 'pointer',
        }}
      >
        <button style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--ui-text-secondary)',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
        }}>
          {isExpanded ? <CaretDown size={18} /> : <CaretRight size={18} />}
        </button>

        <div style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: `${policyType.color}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: policyType.color,
        }}>
          {policyType.icon}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ui-text-primary)' }}>
              {policy.name}
            </span>
            {policy.status === 'active' ? (
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
                Disabled
              </span>
            )}
            {violations.length > 0 && (
              <span style={{
                padding: '2px 8px',
                background: 'var(--status-error-bg)',
                color: 'var(--status-error)',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
              }}>
                {violations.length} violations
              </span>
            )}
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--ui-text-secondary)' }}>
            {policy.description}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '4px 10px',
            background: `${severity.color}20`,
            color: severity.color,
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 500,
          }}>
            {severity.label}
          </span>
          <span style={{
            padding: '4px 10px',
            background: 'var(--surface-hover)',
            color: 'var(--ui-text-muted)',
            borderRadius: 4,
            fontSize: 12,
          }}>
            {policy.enforcementMode}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: 'none',
              background: policy.status === 'active' ? 'var(--status-success-bg)' : 'var(--surface-active)',
              color: policy.status === 'active' ? 'var(--status-success)' : 'var(--ui-text-muted)',
              cursor: 'pointer',
            }}
            title={policy.status === 'active' ? 'Disable' : 'Enable'}
          >
            <Power size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--ui-text-secondary)',
              cursor: 'pointer',
            }}
            title="Edit"
          >
            <PencilSimple size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClone(); }}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--ui-text-secondary)',
              cursor: 'pointer',
            }}
            title="Clone"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--status-error)',
              cursor: 'pointer',
            }}
            title="Delete"
          >
            <Trash size={16} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div style={{ 
          padding: '16px 20px', 
          borderTop: '1px solid var(--ui-border-muted)',
          background: 'var(--surface-hover)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--ui-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Rules ({policy.rules.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {policy.rules.map(rule => (
                  <div key={rule.id} style={{ 
                    padding: '8px 12px', 
                    background: 'var(--surface-panel)',
                    borderRadius: 6,
                    fontSize: 13,
                    color: 'var(--ui-text-muted)',
                  }}>
                    {rule.name}
                    {!rule.enabled && <span style={{ marginLeft: 8, color: 'var(--ui-text-muted)' }}>(disabled)</span>}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--ui-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Scope
              </h4>
              <div style={{ fontSize: 13, color: 'var(--ui-text-muted)' }}>
                {policy.appliesTo.agents?.length ? (
                  <p>{policy.appliesTo.agents.length} agents</p>
                ) : (
                  <p>All agents</p>
                )}
                {policy.appliesTo.tools?.length ? (
                  <p>{policy.appliesTo.tools.length} tools</p>
                ) : null}
              </div>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--ui-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Metadata
              </h4>
              <div style={{ fontSize: 13, color: 'var(--ui-text-muted)' }}>
                <p>Version: {policy.version}</p>
                <p>Created: {new Date(policy.createdAt).toLocaleDateString()}</p>
                <p>Updated: {new Date(policy.updatedAt).toLocaleDateString()}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {policy.tags.map(tag => (
                    <span key={tag} style={{
                      padding: '2px 8px',
                      background: 'var(--surface-hover)',
                      borderRadius: 4,
                      fontSize: 11,
                      color: 'var(--ui-text-secondary)',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Violation Card Component
// ============================================================================

function ViolationCard({ violation }: { violation: PolicyViolation }) {
  const severity = SEVERITY_LEVELS.find(s => s.value === violation.severity) || SEVERITY_LEVELS[2];

  return (
    <div style={{
      padding: 12,
      background: 'var(--surface-panel)',
      borderRadius: 6,
      marginBottom: 8,
      borderLeft: `3px solid ${severity.color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ui-text-primary)' }}>
          {violation.policyName}
        </span>
        <span style={{
          padding: '1px 6px',
          background: `${severity.color}20`,
          color: severity.color,
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 600,
        }}>
          {severity.label}
        </span>
      </div>
      <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--ui-text-secondary)' }}>
        {violation.agentName} • {new Date(violation.createdAt).toLocaleString()}
      </p>
      <div style={{ display: 'flex', gap: 4 }}>
        {violation.status === 'open' && (
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
    </div>
  );
}

// ============================================================================
// Policy Modal Component
// ============================================================================

function PolicyModal({
  title,
  policy,
  onClose,
  onSubmit,
}: {
  title: string;
  policy?: Policy;
  onClose: () => void;
  onSubmit: (input: Partial<CreatePolicyInput> | CreatePolicyInput) => void;
}) {
  const [formData, setFormData] = useState<Partial<CreatePolicyInput>>({
    name: policy?.name || '',
    description: policy?.description || '',
    type: policy?.type || 'security',
    severity: policy?.severity || 'medium',
    enforcementMode: policy?.enforcementMode || 'audit',
    rules: policy?.rules || [{ 
      id: 'temp-1', 
      name: 'Default Rule', 
      condition: { type: 'threshold' }, 
      action: { type: 'log' }, 
      priority: 1, 
      enabled: true 
    }],
    tags: policy?.tags || [],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

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
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--ui-text-primary)' }}>
            {title}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--ui-text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ui-text-muted)', marginBottom: 6 }}>
              Policy Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ui-text-muted)', marginBottom: 6 }}>
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as PolicyType })}
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
                {POLICY_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ui-text-muted)', marginBottom: 6 }}>
                Severity
              </label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value as PolicySeverity })}
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
                {SEVERITY_LEVELS.map(level => (
                  <option key={level.value} value={level.value}>{level.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ui-text-muted)', marginBottom: 6 }}>
                Enforcement
              </label>
              <select
                value={formData.enforcementMode}
                onChange={(e) => setFormData({ ...formData, enforcementMode: e.target.value as EnforcementMode })}
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
                {ENFORCEMENT_MODES.map(mode => (
                  <option key={mode.value} value={mode.value}>{mode.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{
            padding: 12,
            background: 'var(--surface-panel)',
            borderRadius: 6,
            marginBottom: 16,
          }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ui-text-secondary)' }}>
              {ENFORCEMENT_MODES.find(m => m.value === formData.enforcementMode)?.description}
            </p>
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
              {policy ? 'Save Changes' : 'Create Policy'}
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

function LoadingState() {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--ui-text-muted)' }}>
      <ArrowsClockwise size={32} style={{ animation: 'spin 1s linear infinite' }} />
      <p>Loading policies...</p>
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

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--ui-text-muted)' }}>
      <Shield size={48} style={{ marginBottom: 16 }} />
      <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: 'var(--ui-text-muted)' }}>No policies yet</h3>
      <p style={{ margin: '0 0 16px 0', fontSize: 14 }}>Create your first policy to start enforcing governance rules.</p>
      <button
        onClick={onCreate}
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
        Create Policy
      </button>
    </div>
  );
}

// ============================================================================
// Mock Data
// ============================================================================

function getMockPolicies(): Policy[] {
  return [
    {
      id: 'pol-001',
      name: 'Sensitive Data Access Control',
      description: 'Prevents agents from accessing sensitive data without proper authorization',
      type: 'security',
      severity: 'critical',
      status: 'active',
      enforcementMode: 'block' as any,
      rules: [
        { id: 'rule-001', name: 'Block PII Access', condition: { type: 'list' }, action: { type: 'block' }, priority: 1, enabled: true },
        { id: 'rule-002', name: 'Log Access Attempts', condition: { type: 'threshold' }, action: { type: 'log' }, priority: 2, enabled: true },
      ],
      createdAt: '2026-01-15T10:00:00Z',
      updatedAt: '2026-02-28T14:30:00Z',
      createdBy: 'admin',
      version: 2,
      tags: ['security', 'pii', 'data-protection'],
      appliesTo: { agents: [], tools: ['file_read', 'database_query'] },
      violationCount: 3,
      lastViolationAt: '2026-03-05T08:15:00Z',
    },
    {
      id: 'pol-002',
      name: 'External API Rate Limiting',
      description: 'Limits the rate at which agents can call external APIs',
      type: 'operational',
      severity: 'medium',
      status: 'active',
      enforcementMode: 'block',
      rules: [
        { id: 'rule-003', name: 'Rate Limit Check', condition: { type: 'threshold' }, action: { type: 'alert' as any }, priority: 1, enabled: true },
      ],
      createdAt: '2026-02-01T09:00:00Z',
      updatedAt: '2026-02-01T09:00:00Z',
      createdBy: 'admin',
      version: 1,
      tags: ['operational', 'rate-limiting'],
      appliesTo: { agents: [], tools: ['web_search', 'api_call'] },
      violationCount: 12,
      lastViolationAt: '2026-03-06T16:45:00Z',
    },
    {
      id: 'pol-003',
      name: 'Code Execution Sandbox',
      description: 'Requires sandbox environment for code execution',
      type: 'security',
      severity: 'high',
      status: 'active',
      enforcementMode: 'block',
      rules: [
        { id: 'rule-004', name: 'Sandbox Check', condition: { type: 'composite' }, action: { type: 'block' }, priority: 1, enabled: true },
      ],
      createdAt: '2026-01-20T11:00:00Z',
      updatedAt: '2026-02-15T13:20:00Z',
      createdBy: 'admin',
      version: 3,
      tags: ['security', 'code-execution', 'sandbox'],
      appliesTo: { agents: [], tools: ['execute_code', 'run_script'] },
      violationCount: 0,
    },
    {
      id: 'pol-004',
      name: 'GDPR Compliance Check',
      description: 'Ensures compliance with GDPR regulations for EU data',
      type: 'compliance',
      severity: 'critical',
      status: 'disabled',
      enforcementMode: 'audit',
      rules: [
        { id: 'rule-005', name: 'Data Residency', condition: { type: 'list' }, action: { type: 'log' }, priority: 1, enabled: false },
      ],
      createdAt: '2026-02-10T14:00:00Z',
      updatedAt: '2026-02-10T14:00:00Z',
      createdBy: 'admin',
      version: 1,
      tags: ['compliance', 'gdpr', 'data-residency'],
      appliesTo: { agents: [], resources: ['eu-data'] },
      violationCount: 0,
    },
  ];
}

function getMockViolations(): PolicyViolation[] {
  return [
    {
      id: 'viol-001',
      policyId: 'pol-001',
      policyName: 'Sensitive Data Access Control',
      policyType: 'security',
      severity: 'critical',
      status: 'open',
      agentId: 'agent-001',
      agentName: 'Data Analyzer',
      toolCall: { tool: 'file_read', arguments: { path: '/data/customers.csv' } },
      context: { timestamp: '2026-03-05T08:15:00Z' },
      evidence: [{ type: 'log', content: 'Attempted to read PII data', timestamp: '2026-03-05T08:15:00Z' }],
      createdAt: '2026-03-05T08:15:00Z',
    },
    {
      id: 'viol-002',
      policyId: 'pol-002',
      policyName: 'External API Rate Limiting',
      policyType: 'operational',
      severity: 'medium',
      status: 'open',
      agentId: 'agent-002',
      agentName: 'Web Scraper',
      toolCall: { tool: 'web_search', arguments: { query: 'test' } },
      context: { timestamp: '2026-03-06T16:45:00Z' },
      evidence: [{ type: 'log', content: 'Rate limit exceeded: 150 requests/min', timestamp: '2026-03-06T16:45:00Z' }],
      createdAt: '2026-03-06T16:45:00Z',
    },
  ];
}

export default PolicyManager;
