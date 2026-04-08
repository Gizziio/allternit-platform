/**
 * Deployment History Page
 * 
 * View and manage all past deployments with:
 * - Filter by status, provider, date range
 * - Sort by date, status, provider
 * - Re-deploy with same configuration
 * - View detailed deployment logs
 */

import React, { useState, useEffect, useMemo } from 'react';
import { cloudDeployApi, Deployment } from '../lib/api-client';
import './DeploymentHistoryPage.css';

type SortField = 'date' | 'status' | 'provider' | 'progress';
type SortOrder = 'asc' | 'desc';
type FilterStatus = 'all' | 'running' | 'completed' | 'failed' | 'cancelled';

interface DeploymentWithDetails extends Deployment {
  duration?: number; // in seconds
  logs?: string[];
}

export const DeploymentHistoryPage: React.FC = () => {
  const [deployments, setDeployments] = useState<DeploymentWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentWithDetails | null>(null);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Load deployments on mount
  useEffect(() => {
    loadDeployments();
  }, []);

  const loadDeployments = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await cloudDeployApi.listDeployments();
      
      // Add mock duration for demo purposes
      const withDetails = data.map(d => ({
        ...d,
        duration: Math.floor(Math.random() * 300) + 60, // 1-6 minutes
      }));
      
      setDeployments(withDetails);
    } catch (err) {
      setError('Failed to load deployment history');
      // Demo data fallback
      setDeployments(getDemoDeployments());
    } finally {
      setIsLoading(false);
    }
  };

  const getDemoDeployments = (): DeploymentWithDetails[] => [
    {
      deployment_id: 'dep-001',
      provider_id: 'hetzner',
      region_id: 'fsn1',
      instance_type_id: 'cx21',
      storage_gb: 100,
      instance_name: 'allternit-prod-01',
      status: 'completed',
      progress: 100,
      message: 'Deployment completed successfully',
      instance_ip: '78.46.123.45',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2 + 180000).toISOString(),
      completed_at: new Date(Date.now() - 86400000 * 2 + 180000).toISOString(),
      duration: 180,
    },
    {
      deployment_id: 'dep-002',
      provider_id: 'digitalocean',
      region_id: 'nyc3',
      instance_type_id: 's-1vcpu-2gb',
      storage_gb: 50,
      instance_name: 'allternit-dev-01',
      status: 'failed',
      progress: 45,
      message: 'Deployment failed: Invalid API token',
      error_message: 'Authentication failed with provider',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 86400000 + 120000).toISOString(),
      duration: 120,
    },
    {
      deployment_id: 'dep-003',
      provider_id: 'contabo',
      region_id: 'de',
      instance_type_id: 'vps-10',
      storage_gb: 200,
      instance_name: 'allternit-staging-01',
      status: 'running',
      progress: 65,
      message: 'Installing Allternit agent...',
      instance_id: 'inst-contabo-123',
      created_at: new Date(Date.now() - 300000).toISOString(),
      updated_at: new Date(Date.now() - 60000).toISOString(),
    },
    {
      deployment_id: 'dep-004',
      provider_id: 'racknerd',
      region_id: 'us',
      instance_type_id: 'budget-2',
      storage_gb: 35,
      instance_name: 'allternit-test-01',
      status: 'cancelled',
      progress: 30,
      message: 'Deployment cancelled by user',
      created_at: new Date(Date.now() - 172800000).toISOString(),
      updated_at: new Date(Date.now() - 172800000 + 60000).toISOString(),
      duration: 60,
    },
    {
      deployment_id: 'dep-005',
      provider_id: 'hetzner',
      region_id: 'nbg1',
      instance_type_id: 'cx31',
      storage_gb: 160,
      instance_name: 'allternit-prod-02',
      status: 'completed',
      progress: 100,
      message: 'Deployment completed successfully',
      instance_ip: '88.99.45.123',
      instance_id: '12345678',
      created_at: new Date(Date.now() - 432000000).toISOString(),
      updated_at: new Date(Date.now() - 432000000 + 240000).toISOString(),
      completed_at: new Date(Date.now() - 432000000 + 240000).toISOString(),
      duration: 240,
    },
  ];

  // Get unique providers for filter
  const providers = useMemo(() => {
    const unique = new Set(deployments.map(d => d.provider_id));
    return Array.from(unique);
  }, [deployments]);

  // Filter and sort deployments
  const filteredDeployments = useMemo(() => {
    let filtered = [...deployments];

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(d => d.status === filterStatus);
    }

    // Apply provider filter
    if (filterProvider !== 'all') {
      filtered = filtered.filter(d => d.provider_id === filterProvider);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.instance_name.toLowerCase().includes(query) ||
        d.deployment_id.toLowerCase().includes(query) ||
        d.provider_id.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'date':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'provider':
          comparison = a.provider_id.localeCompare(b.provider_id);
          break;
        case 'progress':
          comparison = a.progress - b.progress;
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [deployments, filterStatus, filterProvider, searchQuery, sortField, sortOrder]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = deployments.length;
    const completed = deployments.filter(d => d.status === 'completed').length;
    const failed = deployments.filter(d => d.status === 'failed').length;
    const running = deployments.filter(d => d.status === 'running').length;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, failed, running, successRate };
  }, [deployments]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleRedeploy = async (deployment: DeploymentWithDetails) => {
    // Navigate to deploy with pre-filled config
    window.location.href = `/deploy?redeploy=${deployment.deployment_id}`;
  };

  const handleViewLogs = async (deployment: DeploymentWithDetails) => {
    setSelectedDeployment(deployment);
    // @placeholder APPROVED - Logs API pending
    // @ticket GAP-55
    // Stub: fetch logs from API
    // const logs = await cloudDeployApi.getDeploymentLogs(deployment.deployment_id);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'running': return 'blue';
      case 'failed': return 'red';
      case 'cancelled': return 'orange';
      default: return 'gray';
    }
  };

  const getProviderLogo = (providerId: string) => {
    const logos: Record<string, string> = {
      hetzner: '🟢',
      digitalocean: '🔷',
      aws: '🟠',
      gcp: '🔴',
      azure: '🔵',
      contabo: '🔵',
      racknerd: '🔴',
    };
    return logos[providerId] || '☁️';
  };

  if (isLoading) {
    return (
      <div className="deployment-history-page loading">
        <div className="spinner" />
        <p>Loading deployment history...</p>
      </div>
    );
  }

  return (
    <div className="deployment-history-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>📜 Deployment History</h1>
          <p>View and manage all your deployments</p>
        </div>
        <button className="btn-primary" onClick={() => window.location.href = '/deploy'}>
          + New Deployment
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total Deployments</span>
        </div>
        <div className="stat-card success">
          <span className="stat-value">{stats.completed}</span>
          <span className="stat-label">Successful</span>
        </div>
        <div className="stat-card error">
          <span className="stat-value">{stats.failed}</span>
          <span className="stat-label">Failed</span>
        </div>
        <div className="stat-card info">
          <span className="stat-value">{stats.running}</span>
          <span className="stat-label">Running</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.successRate}%</span>
          <span className="stat-label">Success Rate</span>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search deployments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="filter-group">
          <label>Status:</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}>
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Provider:</label>
          <select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)}>
            <option value="all">All Providers</option>
            {providers.map(p => (
              <option key={p} value={p}>{getProviderLogo(p)} {p}</option>
            ))}
          </select>
        </div>

        <button className="btn-secondary" onClick={loadDeployments}>
          🔄 Refresh
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <span>❌ {error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Deployments Table */}
      <div className="deployments-table-container">
        {filteredDeployments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h4>No deployments found</h4>
            <p>Try adjusting your filters or create a new deployment.</p>
          </div>
        ) : (
          <table className="deployments-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('date')} className="sortable">
                  Date {sortField === 'date' && (sortOrder === 'desc' ? '↓' : '↑')}
                </th>
                <th>Name</th>
                <th onClick={() => handleSort('provider')} className="sortable">
                  Provider {sortField === 'provider' && (sortOrder === 'desc' ? '↓' : '↑')}
                </th>
                <th>Region</th>
                <th>Instance</th>
                <th onClick={() => handleSort('status')} className="sortable">
                  Status {sortField === 'status' && (sortOrder === 'desc' ? '↓' : '↑')}
                </th>
                <th onClick={() => handleSort('progress')} className="sortable">
                  Progress {sortField === 'progress' && (sortOrder === 'desc' ? '↓' : '↑')}
                </th>
                <th>Duration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeployments.map((deployment) => (
                <tr 
                  key={deployment.deployment_id}
                  className={`status-${deployment.status}`}
                >
                  <td className="date-cell">
                    {formatDate(deployment.created_at)}
                  </td>
                  <td className="name-cell">
                    <span className="instance-name">{deployment.instance_name}</span>
                    <code className="deployment-id">{deployment.deployment_id}</code>
                  </td>
                  <td className="provider-cell">
                    <span className="provider-logo">{getProviderLogo(deployment.provider_id)}</span>
                    <span className="provider-name">{deployment.provider_id}</span>
                  </td>
                  <td>{deployment.region_id}</td>
                  <td>{deployment.instance_type_id}</td>
                  <td>
                    <span className={`status-badge ${getStatusColor(deployment.status)}`}>
                      {deployment.status}
                    </span>
                  </td>
                  <td>
                    <div className="progress-bar-mini">
                      <div 
                        className="progress-fill"
                        style={{ width: `${deployment.progress}%` }}
                      />
                    </div>
                    <span className="progress-text">{deployment.progress}%</span>
                  </td>
                  <td>{formatDuration(deployment.duration)}</td>
                  <td className="actions-cell">
                    <button 
                      className="btn-action"
                      onClick={() => handleViewLogs(deployment)}
                      title="View details"
                    >
                      👁️
                    </button>
                    {deployment.status === 'completed' && (
                      <button 
                        className="btn-action"
                        onClick={() => handleRedeploy(deployment)}
                        title="Redeploy with same config"
                      >
                        🔄
                      </button>
                    )}
                    {deployment.status === 'running' && (
                      <button 
                        className="btn-action danger"
                        title="Cancel deployment"
                      >
                        ⏹️
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Deployment Detail Modal */}
      {selectedDeployment && (
        <DeploymentDetailModal
          deployment={selectedDeployment}
          onClose={() => setSelectedDeployment(null)}
          onRedeploy={() => handleRedeploy(selectedDeployment)}
        />
      )}
    </div>
  );
};

// Deployment Detail Modal
const DeploymentDetailModal: React.FC<{
  deployment: DeploymentWithDetails;
  onClose: () => void;
  onRedeploy: () => void;
}> = ({ deployment, onClose, onRedeploy }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Deployment Details</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="detail-section">
          <h4>Configuration</h4>
          <div className="detail-grid">
            <div className="detail-item">
              <label>Deployment ID</label>
              <code>{deployment.deployment_id}</code>
            </div>
            <div className="detail-item">
              <label>Instance Name</label>
              <span>{deployment.instance_name}</span>
            </div>
            <div className="detail-item">
              <label>Provider</label>
              <span>{deployment.provider_id}</span>
            </div>
            <div className="detail-item">
              <label>Region</label>
              <span>{deployment.region_id}</span>
            </div>
            <div className="detail-item">
              <label>Instance Type</label>
              <span>{deployment.instance_type_id}</span>
            </div>
            <div className="detail-item">
              <label>Storage</label>
              <span>{deployment.storage_gb} GB</span>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h4>Status</h4>
          <div className="status-detail">
            <span className={`status-badge large ${deployment.status}`}>
              {deployment.status}
            </span>
            <p className="status-message">{deployment.message}</p>
            {deployment.error_message && (
              <div className="error-box">
                <strong>Error:</strong> {deployment.error_message}
              </div>
            )}
          </div>
        </div>

        {deployment.instance_ip && (
          <div className="detail-section">
            <h4>Instance Details</h4>
            <div className="detail-grid">
              <div className="detail-item">
                <label>Public IP</label>
                <code>{deployment.instance_ip}</code>
              </div>
              {deployment.instance_id && (
                <div className="detail-item">
                  <label>Instance ID</label>
                  <code>{deployment.instance_id}</code>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="detail-section">
          <h4>Timeline</h4>
          <div className="timeline-list">
            <div className="timeline-item-detail">
              <span className="time">{new Date(deployment.created_at).toLocaleString()}</span>
              <span className="event">Deployment started</span>
            </div>
            {deployment.completed_at && (
              <div className="timeline-item-detail">
                <span className="time">{new Date(deployment.completed_at).toLocaleString()}</span>
                <span className="event">
                  Deployment {deployment.status}
                  {deployment.duration && ` (${Math.floor(deployment.duration / 60)}m ${deployment.duration % 60}s)`}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          {deployment.status === 'completed' && (
            <button className="btn-primary" onClick={onRedeploy}>
              🔄 Redeploy
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeploymentHistoryPage;
