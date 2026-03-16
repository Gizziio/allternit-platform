/**
 * Instances Page
 * 
 * Core control surface for instance management.
 * This is where you OPERATE infrastructure, not just deploy.
 * 
 * Answers:
 * - Where is my agent running?
 * - Is it healthy?
 * - What is it costing me?
 */

import React, { useState } from 'react';

interface Instance {
  id: string;
  name: string;
  provider: string;
  region: string;
  status: 'running' | 'stopped' | 'error' | 'provisioning';
  uptime: string;
  cpu: number;
  ram: number;
  agents: number;
  costHr: number;
  lastSeen: string;
}

export const InstancesPage: React.FC = () => {
  const [instances] = useState<Instance[]>([
    // Demo data - in production, fetch from backend
    {
      id: 'inst-1',
      name: 'a2r-worker-1',
      provider: 'Hetzner',
      region: 'fsn1',
      status: 'running',
      uptime: '14d 3h',
      cpu: 34,
      ram: 2.1,
      agents: 12,
      costHr: 0.0067,
      lastSeen: '1m ago',
    },
    {
      id: 'inst-2',
      name: 'a2r-worker-2',
      provider: 'DigitalOcean',
      region: 'nyc3',
      status: 'running',
      uptime: '7d 12h',
      cpu: 52,
      ram: 3.8,
      agents: 8,
      costHr: 0.018,
      lastSeen: '2m ago',
    },
    {
      id: 'inst-3',
      name: 'a2r-worker-3',
      provider: 'AWS',
      region: 'us-east-1',
      status: 'error',
      uptime: '2d 1h',
      cpu: 89,
      ram: 7.2,
      agents: 3,
      costHr: 0.0416,
      lastSeen: '5m ago',
    },
  ]);

  const totalCostHr = instances.reduce((sum, i) => sum + i.costHr, 0);
  const totalAgents = instances.reduce((sum, i) => sum + i.agents, 0);
  const healthyCount = instances.filter(i => i.status === 'running').length;

  return (
    <div className="instances-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Instances</h1>
          <p className="page-description">
            Manage your deployed A2R instances across all providers.
          </p>
        </div>
        <button className="btn-primary">+ New Instance</button>
      </div>

      {/* Summary Cards */}
      <div className="instances-summary">
        <SummaryCard
          label="Total Instances"
          value={instances.length.toString()}
          sub={`${healthyCount} healthy`}
        />
        <SummaryCard
          label="Active Agents"
          value={totalAgents.toString()}
          sub="Across all instances"
        />
        <SummaryCard
          label="Total Cost/hr"
          value={`$${totalCostHr.toFixed(4)}`}
          sub={`~$${(totalCostHr * 24 * 30).toFixed(2)}/mo`}
        />
        <SummaryCard
          label="Last Activity"
          value="2m ago"
          sub="All instances synced"
        />
      </div>

      {/* Instances Table */}
      <div className="instances-table-container">
        <table className="instances-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Provider</th>
              <th>Region</th>
              <th>Status</th>
              <th>CPU</th>
              <th>RAM</th>
              <th>Agents</th>
              <th>Cost/hr</th>
              <th>Last Seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {instances.map((instance) => (
              <tr key={instance.id} className={`instance-row status-${instance.status}`}>
                <td className="instance-name">
                  <span className="mono">{instance.name}</span>
                </td>
                <td>{instance.provider}</td>
                <td>{instance.region}</td>
                <td>
                  <StatusBadge status={instance.status} />
                </td>
                <td>
                  <MetricBar value={instance.cpu} unit="%" warning={80} />
                </td>
                <td>
                  <MetricBar value={instance.ram} unit="GB" warning={7} />
                </td>
                <td>{instance.agents}</td>
                <td className="mono">${instance.costHr.toFixed(4)}</td>
                <td>{instance.lastSeen}</td>
                <td className="actions">
                  <button className="btn-action" title="View Details">
                    Open
                  </button>
                  <button className="btn-action" title="View Logs">
                    Logs
                  </button>
                  <button 
                    className="btn-action btn-danger" 
                    title="Restart Instance"
                    disabled={instance.status !== 'running'}
                  >
                    Restart
                  </button>
                  <button 
                    className="btn-action btn-danger" 
                    title="Destroy Instance"
                  >
                    Destroy
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Control Plane Notice */}
      <div className="control-plane-notice">
        <p>
          <strong>Note:</strong> This is the Console control plane. 
          Instances shown here are managed through the A2R deployment system.
          For manual BYOC instances, connect your provider credentials in 
          the Deploy flow.
        </p>
      </div>
    </div>
  );
};

// Summary Card Component
const SummaryCard: React.FC<{
  label: string;
  value: string;
  sub: string;
}> = ({ label, value, sub }) => (
  <div className="summary-card">
    <div className="summary-label">{label}</div>
    <div className="summary-value mono">{value}</div>
    <div className="summary-sub">{sub}</div>
  </div>
);

// Status Badge Component
const StatusBadge: React.FC<{ status: Instance['status'] }> = ({ status }) => {
  const config = {
    running: { icon: '●', class: 'status-running', label: 'Running' },
    stopped: { icon: '○', class: 'status-stopped', label: 'Stopped' },
    error: { icon: '✗', class: 'status-error', label: 'Error' },
    provisioning: { icon: '⟳', class: 'status-provisioning', label: 'Provisioning' },
  };

  const c = config[status];

  return (
    <span className={`status-badge ${c.class}`}>
      {c.icon} {c.label}
    </span>
  );
};

// Metric Bar Component (shows value with warning threshold)
const MetricBar: React.FC<{
  value: number;
  unit: string;
  warning: number;
}> = ({ value, unit, warning }) => {
  const isWarning = value >= warning;
  
  return (
    <span className={`metric-value ${isWarning ? 'warning' : ''}`}>
      {value}{unit}
    </span>
  );
};

export default InstancesPage;
