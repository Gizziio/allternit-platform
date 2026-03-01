/**
 * Dashboard Page
 * 
 * System health at a glance.
 * Answers: Where is my agent running? Is it healthy? What is it costing me?
 * 
 * Layout:
 * - Top row: Status cards (instances, swarms, CPU/mem, cost, provider distro)
 * - Middle: Instance health table
 * - Bottom: Event feed
 */

import React from 'react';

export const DashboardPage: React.FC = () => {
  return (
    <div className="dashboard-page">
      {/* Top Row: Status Cards */}
      <div className="status-cards-row">
        <StatusCard
          title="Active Instances"
          value="12"
          change="+2 this week"
          status="healthy"
        />
        <StatusCard
          title="Active Swarms"
          value="3"
          change="Stable"
          status="healthy"
        />
        <StatusCard
          title="CPU / Memory Avg"
          value="34% / 2.1GB"
          change="Within limits"
          status="healthy"
        />
        <StatusCard
          title="Monthly Est. Cost"
          value="$186.40"
          change="+$12 from last month"
          status="warning"
        />
        <StatusCard
          title="Provider Distribution"
          value="5 providers"
          change="Hetzner (5), DO (4), AWS (3)"
          status="neutral"
        />
      </div>

      {/* Middle: Instance Health Table */}
      <div className="instance-health-section">
        <h2 className="section-title">Instance Health</h2>
        <InstanceHealthTable />
      </div>

      {/* Bottom: Event Feed */}
      <div className="event-feed-section">
        <h2 className="section-title">Event Feed</h2>
        <EventFeed />
      </div>
    </div>
  );
};

// Status Card Component
const StatusCard: React.FC<{
  title: string;
  value: string;
  change: string;
  status: 'healthy' | 'warning' | 'error' | 'neutral';
}> = ({ title, value, change, status }) => {
  return (
    <div className={`status-card status-${status}`}>
      <div className="status-card-header">
        <span className="status-title">{title}</span>
        <span className={`status-indicator ${status}`} />
      </div>
      <div className="status-value">{value}</div>
      <div className="status-change">{change}</div>
    </div>
  );
};

// Instance Health Table
const InstanceHealthTable: React.FC = () => {
  const instances = [
    { name: 'a2r-worker-1', provider: 'Hetzner', region: 'fsn1', status: 'running', uptime: '14d 3h', costHr: 0.0067 },
    { name: 'a2r-worker-2', provider: 'DigitalOcean', region: 'nyc3', status: 'running', uptime: '7d 12h', costHr: 0.018 },
    { name: 'a2r-worker-3', provider: 'AWS', region: 'us-east-1', status: 'warning', uptime: '2d 1h', costHr: 0.0416 },
    { name: 'a2r-swarm-master', provider: 'Hetzner', region: 'nbg1', status: 'running', uptime: '30d 5h', costHr: 0.0134 },
  ];

  return (
    <table className="instance-health-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Provider</th>
          <th>Region</th>
          <th>Status</th>
          <th>Uptime</th>
          <th>Cost/hr</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {instances.map((instance) => (
          <tr key={instance.name} className={`instance-row status-${instance.status}`}>
            <td className="instance-name">{instance.name}</td>
            <td>{instance.provider}</td>
            <td>{instance.region}</td>
            <td>
              <span className={`status-badge ${instance.status}`}>
                {instance.status === 'running' && '●'}
                {instance.status === 'warning' && '⚠'}
                {instance.status === 'error' && '✗'}
                {instance.status}
              </span>
            </td>
            <td className="mono">{instance.uptime}</td>
            <td className="mono">${instance.costHr.toFixed(4)}</td>
            <td className="actions">
              <button className="btn-action">Open</button>
              <button className="btn-action">Logs</button>
              <button className="btn-action btn-danger">Restart</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// Event Feed
const EventFeed: React.FC = () => {
  const events = [
    { type: 'deploy', time: '2m ago', message: 'Deployed a2r-worker-4 to Hetzner fsn1', status: 'success' },
    { type: 'scale', time: '15m ago', message: 'Swarm scaled from 3 to 5 workers', status: 'info' },
    { type: 'error', time: '1h ago', message: 'a2r-worker-3 health check failed', status: 'error' },
    { type: 'cost', time: '3h ago', message: 'Monthly cost estimate updated: $186.40', status: 'info' },
    { type: 'deploy', time: '1d ago', message: 'Deployed a2r-swarm-master to Hetzner nbg1', status: 'success' },
  ];

  return (
    <div className="event-feed">
      {events.map((event, i) => (
        <div key={i} className={`event-item event-${event.type}`}>
          <span className="event-time mono">{event.time}</span>
          <span className={`event-status ${event.status}`}>
            {event.status === 'success' && '✓'}
            {event.status === 'error' && '✗'}
            {event.status === 'info' && '○'}
          </span>
          <span className="event-message">{event.message}</span>
        </div>
      ))}
    </div>
  );
};

export default DashboardPage;
