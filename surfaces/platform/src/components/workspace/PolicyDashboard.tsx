/**
 * Policy Dashboard Component
 * 
 * Visualizes policy rules with toggles and configuration.
 * Shows safety rules, tool permissions, and file access controls.
 */

import { useState, useEffect } from 'react';
import { WorkspaceAPI } from '../../agent-workspace';
import { PolicyRule } from './types';

interface PolicyDashboardProps {
  api: WorkspaceAPI;
}

export function PolicyDashboard({ api }: PolicyDashboardProps) {
  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [selectedRule, setSelectedRule] = useState<PolicyRule | null>(null);
  const [filter, setFilter] = useState<'all' | 'allow' | 'deny' | 'require_approval'>('all');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    // Load policy rules
    const loadRules = async () => {
      // Mock data - replace with actual API call
      const mockRules: PolicyRule[] = [
        {
          id: 'policy-1',
          name: 'File System Write',
          description: 'Allow writing files within workspace',
          toolId: 'filesystem.write',
          action: 'allow',
          enabled: true,
          priority: 100,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'policy-2',
          name: 'File System Delete',
          description: 'Require approval for file deletion',
          toolId: 'filesystem.delete',
          action: 'require_approval',
          enabled: true,
          priority: 90,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'policy-3',
          name: 'External Network Access',
          description: 'Deny external network access by default',
          toolId: 'network.http',
          action: 'deny',
          enabled: true,
          priority: 1000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'policy-4',
          name: 'System Command Execution',
          description: 'System commands require explicit approval',
          toolId: 'system.exec',
          action: 'require_approval',
          enabled: true,
          priority: 500,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'policy-5',
          name: 'Sensitive File Access',
          description: 'Block access to sensitive files',
          filePattern: '*.key,*.pem,.env',
          operation: 'read',
          action: 'deny',
          enabled: true,
          priority: 200,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      setRules(mockRules);
    };

    loadRules();
  }, [api]);

  const toggleRule = (ruleId: string) => {
    setRules(prev => prev.map(rule => 
      rule.id === ruleId 
        ? { ...rule, enabled: !rule.enabled, updatedAt: new Date().toISOString() }
        : rule
    ));
  };

  const filteredRules = rules.filter(rule => 
    filter === 'all' || rule.action === filter
  );

  const stats = {
    total: rules.length,
    enabled: rules.filter(r => r.enabled).length,
    allow: rules.filter(r => r.action === 'allow').length,
    deny: rules.filter(r => r.action === 'deny').length,
    requireApproval: rules.filter(r => r.action === 'require_approval').length,
  };

  const getActionColor = (action: PolicyRule['action']) => {
    const colors = {
      allow: '#10b981',
      deny: '#ef4444',
      require_approval: '#f59e0b',
    };
    return colors[action];
  };

  const getActionLabel = (action: PolicyRule['action']) => {
    const labels = {
      allow: 'Allow',
      deny: 'Deny',
      require_approval: 'Require Approval',
    };
    return labels[action];
  };

  return (
    <div className="policy-dashboard">
      {/* Stats Overview */}
      <div className="policy-dashboard__stats">
        <StatCard 
          label="Total Rules" 
          value={stats.total} 
          icon="📋" 
          color="#3b82f6"
        />
        <StatCard 
          label="Active" 
          value={stats.enabled} 
          icon="✓" 
          color="#10b981"
        />
        <StatCard 
          label="Allowed" 
          value={stats.allow} 
          icon="✓" 
          color="#10b981"
        />
        <StatCard 
          label="Denied" 
          value={stats.deny} 
          icon="✕" 
          color="#ef4444"
        />
        <StatCard 
          label="Approval Required" 
          value={stats.requireApproval} 
          icon="⏸" 
          color="#f59e0b"
        />
      </div>

      <div className="policy-dashboard__content">
        {/* Rules List */}
        <aside className="policy-dashboard__sidebar">
          <div className="policy-dashboard__filters">
            <h3>Filter by Action</h3>
            {(['all', 'allow', 'deny', 'require_approval'] as const).map(action => (
              <button
                key={action}
                className={`policy-filter ${filter === action ? 'policy-filter--active' : ''}`}
                onClick={() => setFilter(action)}
              >
                <span 
                  className="policy-filter__indicator"
                  style={{ backgroundColor: action === 'all' ? '#666' : getActionColor(action) }}
                />
                {action === 'all' ? 'All Rules' : getActionLabel(action)}
                <span className="policy-filter__count">
                  {action === 'all' ? rules.length : rules.filter(r => r.action === action).length}
                </span>
              </button>
            ))}
          </div>

          <div className="policy-dashboard__rules-list">
            {filteredRules.map(rule => (
              <div
                key={rule.id}
                className={`policy-rule-item ${selectedRule?.id === rule.id ? 'policy-rule-item--active' : ''}`}
                onClick={() => {
                  setSelectedRule(rule);
                  setIsEditing(false);
                }}
              >
                <div className="policy-rule-item__header">
                  <span 
                    className="policy-rule-item__action"
                    style={{ backgroundColor: getActionColor(rule.action) }}
                  >
                    {rule.action === 'allow' ? '✓' : rule.action === 'deny' ? '✕' : '⏸'}
                  </span>
                  <span className="policy-rule-item__name">{rule.name}</span>
                </div>
                <div className="policy-rule-item__meta">
                  <span className={`policy-rule-item__status ${rule.enabled ? 'enabled' : 'disabled'}`}>
                    {rule.enabled ? 'Active' : 'Disabled'}
                  </span>
                  {rule.toolId && <span className="policy-rule-item__tool">{rule.toolId}</span>}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Rule Detail / Editor */}
        <main className="policy-dashboard__detail">
          {selectedRule ? (
            <>
              <header className="policy-detail__header">
                <div className="policy-detail__title">
                  <h2>{selectedRule.name}</h2>
                  <span 
                    className="policy-detail__badge"
                    style={{ backgroundColor: getActionColor(selectedRule.action) }}
                  >
                    {getActionLabel(selectedRule.action)}
                  </span>
                </div>
                <div className="policy-detail__actions">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={selectedRule.enabled}
                      onChange={() => toggleRule(selectedRule.id)}
                    />
                    <span className="toggle-switch__slider" />
                    <span className="toggle-switch__label">
                      {selectedRule.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>
              </header>

              <div className="policy-detail__content">
                <section className="policy-detail__section">
                  <h3>Description</h3>
                  <p>{selectedRule.description}</p>
                </section>

                {selectedRule.toolId && (
                  <section className="policy-detail__section">
                    <h3>Tool</h3>
                    <code className="policy-detail__code">{selectedRule.toolId}</code>
                  </section>
                )}

                {selectedRule.filePattern && (
                  <section className="policy-detail__section">
                    <h3>File Pattern</h3>
                    <code className="policy-detail__code">{selectedRule.filePattern}</code>
                    {selectedRule.operation && (
                      <p>Operation: <strong>{selectedRule.operation}</strong></p>
                    )}
                  </section>
                )}

                <section className="policy-detail__section">
                  <h3>Priority</h3>
                  <div className="policy-detail__priority">
                    <div 
                      className="priority-bar"
                      style={{ width: `${Math.min(selectedRule.priority / 10, 100)}%` }}
                    />
                    <span>{selectedRule.priority}</span>
                  </div>
                </section>

                <section className="policy-detail__section">
                  <h3>History</h3>
                  <div className="policy-detail__meta">
                    <p>Created: {new Date(selectedRule.createdAt).toLocaleString()}</p>
                    <p>Updated: {new Date(selectedRule.updatedAt).toLocaleString()}</p>
                  </div>
                </section>
              </div>
            </>
          ) : (
            <div className="policy-dashboard__empty">
              <p>Select a policy rule to view details</p>
            </div>
          )}
        </main>
      </div>

      {/* Quick Actions */}
      <div className="policy-dashboard__quick-actions">
        <h3>Quick Actions</h3>
        <div className="quick-actions__grid">
          <QuickActionCard
            icon="🛡️"
            title="Safety Check"
            description="Run a safety audit on all policy rules"
            onClick={() => console.log('Running safety check...')}
          />
          <QuickActionCard
            icon="📊"
            title="Policy Report"
            description="Generate a detailed policy report"
            onClick={() => console.log('Generating report...')}
          />
          <QuickActionCard
            icon="🔄"
            title="Sync with Kernel"
            description="Push policy changes to kernel"
            onClick={() => console.log('Syncing with kernel...')}
          />
          <QuickActionCard
            icon="💾"
            title="Export Rules"
            description="Export policy rules to POLICY.md"
            onClick={() => console.log('Exporting...')}
          />
        </div>
      </div>
    </div>
  );
}

// Sub-components

function StatCard({ label, value, icon, color }: { 
  label: string; 
  value: number; 
  icon: string;
  color: string;
}) {
  return (
    <div className="policy-stat-card" style={{ borderColor: color }}>
      <span className="policy-stat-card__icon" style={{ color }}>{icon}</span>
      <div className="policy-stat-card__content">
        <span className="policy-stat-card__value" style={{ color }}>{value}</span>
        <span className="policy-stat-card__label">{label}</span>
      </div>
    </div>
  );
}

function QuickActionCard({ icon, title, description, onClick }: {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button className="quick-action-card" onClick={onClick}>
      <span className="quick-action-card__icon">{icon}</span>
      <span className="quick-action-card__title">{title}</span>
      <span className="quick-action-card__description">{description}</span>
    </button>
  );
}

// CSS Styles
export const policyDashboardStyles = `
.policy-dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.policy-dashboard__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
}

.policy-stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-left-width: 4px;
  border-radius: 8px;
}

.policy-stat-card__icon {
  font-size: 1.5rem;
}

.policy-stat-card__content {
  display: flex;
  flex-direction: column;
}

.policy-stat-card__value {
  font-size: 1.5rem;
  font-weight: 700;
}

.policy-stat-card__label {
  font-size: 0.75rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.policy-dashboard__content {
  display: flex;
  gap: 1.5rem;
  flex: 1;
  min-height: 400px;
}

.policy-dashboard__sidebar {
  width: 300px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.policy-dashboard__filters {
  padding: 1rem;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
}

.policy-dashboard__filters h3 {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.policy-filter {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.625rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #888;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.policy-filter:hover {
  background: #2a2a2a;
  color: #e0e0e0;
}

.policy-filter--active {
  background: #2a2a2a;
  color: #e0e0e0;
}

.policy-filter__indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.policy-filter__count {
  margin-left: auto;
  font-size: 0.75rem;
  color: #666;
}

.policy-dashboard__rules-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.policy-rule-item {
  padding: 0.875rem;
  background: #1a1a1a;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.policy-rule-item:hover {
  border-color: #3b82f6;
}

.policy-rule-item--active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.policy-rule-item__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.policy-rule-item__action {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: white;
}

.policy-rule-item__name {
  font-weight: 500;
  font-size: 0.875rem;
}

.policy-rule-item__meta {
  display: flex;
  gap: 0.75rem;
  font-size: 0.75rem;
}

.policy-rule-item__status {
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
}

.policy-rule-item__status.enabled {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.policy-rule-item__status.disabled {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.policy-rule-item__tool {
  color: #666;
  font-family: monospace;
}

.policy-dashboard__detail {
  flex: 1;
  padding: 1.5rem;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  overflow-y: auto;
}

.policy-detail__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #2a2a2a;
}

.policy-detail__title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.policy-detail__title h2 {
  margin: 0;
  font-size: 1.25rem;
}

.policy-detail__badge {
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  color: white;
}

.toggle-switch {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.toggle-switch input {
  display: none;
}

.toggle-switch__slider {
  position: relative;
  width: 44px;
  height: 24px;
  background: #2a2a2a;
  border-radius: 12px;
  transition: background 0.3s;
}

.toggle-switch__slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: transform 0.3s;
}

.toggle-switch input:checked + .toggle-switch__slider {
  background: #10b981;
}

.toggle-switch input:checked + .toggle-switch__slider::after {
  transform: translateX(20px);
}

.toggle-switch__label {
  font-size: 0.875rem;
  color: #888;
}

.policy-detail__content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.policy-detail__section h3 {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.policy-detail__section p {
  margin: 0;
  line-height: 1.6;
}

.policy-detail__code {
  display: inline-block;
  background: #0f0f0f;
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.875rem;
  color: #3b82f6;
}

.policy-detail__priority {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.priority-bar {
  height: 8px;
  background: #3b82f6;
  border-radius: 4px;
  max-width: 200px;
}

.policy-detail__meta {
  font-size: 0.875rem;
  color: #666;
}

.policy-detail__meta p {
  margin: 0.375rem 0;
}

.policy-dashboard__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
}

.policy-dashboard__quick-actions {
  margin-top: 1rem;
}

.policy-dashboard__quick-actions h3 {
  margin: 0 0 1rem;
  font-size: 1rem;
}

.quick-actions__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.quick-action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.25rem;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-action-card:hover {
  border-color: #3b82f6;
  transform: translateY(-2px);
}

.quick-action-card__icon {
  font-size: 1.5rem;
}

.quick-action-card__title {
  font-weight: 500;
  font-size: 0.875rem;
}

.quick-action-card__description {
  font-size: 0.75rem;
  color: #666;
  text-align: center;
}
`;
