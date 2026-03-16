/**
 * Security Dashboard - Full Implementation
 * 
 * Features:
 * - Security monitoring overview
 * - Recent security events
 * - Compliance status
 * - Alerts and notifications
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Lock,
  Unlock,
  FileWarning,
  User,
  Bot,
  Globe,
  Server,
  RefreshCw,
  Bell,
  Filter,
  ChevronRight,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  X,
  Eye,
  EyeOff,
  Settings,
  XCircle,
} from 'lucide-react';
import {
  getSecurityOverview,
  listSecurityEvents,
  acknowledgeSecurityEvent,
  resolveSecurityEvent,
  getComplianceStatus,
  runComplianceAssessment,
} from '@/lib/governance/policy.service';
import type {
  SecurityOverview,
  SecurityEvent,
  ComplianceStatus,
  SecurityEventType,
  SecurityEventSeverity,
} from '@/lib/governance/policy.types';

// Event type configurations
const EVENT_TYPES: { value: SecurityEventType; label: string; color: string; icon: React.ReactNode }[] = [
  { value: 'authentication', label: 'Auth', color: '#3b82f6', icon: <Lock size={14} /> },
  { value: 'authorization', label: 'Access', color: '#8b5cf6', icon: <Unlock size={14} /> },
  { value: 'policy_violation', label: 'Policy', color: '#ef4444', icon: <AlertTriangle size={14} /> },
  { value: 'anomaly', label: 'Anomaly', color: '#f59e0b', icon: <Activity size={14} /> },
  { value: 'threat', label: 'Threat', color: '#dc2626', icon: <AlertCircle size={14} /> },
  { value: 'compliance', label: 'Compliance', color: '#10b981', icon: <CheckCircle size={14} /> },
  { value: 'system', label: 'System', color: '#6b7280', icon: <Server size={14} /> },
];

const SEVERITY_CONFIG: Record<SecurityEventSeverity, { color: string; bgColor: string; label: string }> = {
  info: { color: '#6b7280', bgColor: '#37415120', label: 'Info' },
  low: { color: '#3b82f6', bgColor: '#3b82f620', label: 'Low' },
  medium: { color: '#f59e0b', bgColor: '#f59e0b20', label: 'Medium' },
  high: { color: '#f97316', bgColor: '#f9731620', label: 'High' },
  critical: { color: '#ef4444', bgColor: '#ef444420', label: 'Critical' },
};

// ============================================================================
// Main Component
// ============================================================================

export function SecurityDashboard() {
  // State
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [compliance, setCompliance] = useState<ComplianceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'compliance'>('overview');
  const [filterType, setFilterType] = useState<SecurityEventType | 'all'>('all');
  const [filterSeverity, setFilterSeverity] = useState<SecurityEventSeverity | 'all'>('all');
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [overviewRes, eventsRes, complianceRes] = await Promise.all([
        getSecurityOverview(),
        listSecurityEvents({ 
          type: filterType === 'all' ? undefined : filterType,
          severity: filterSeverity === 'all' ? undefined : filterSeverity,
          acknowledged: showAcknowledged ? undefined : false,
          pageSize: 100,
        }),
        getComplianceStatus(),
      ]);

      setOverview(overviewRes);
      setEvents(eventsRes.events);
      setCompliance(complianceRes);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load security data');
      // Use mock data for development
      setOverview(getMockOverview());
      setEvents(getMockEvents());
      setCompliance(getMockCompliance());
    } finally {
      setLoading(false);
    }
  }, [filterType, filterSeverity, showAcknowledged]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Handlers
  const handleAcknowledge = async (eventId: string) => {
    try {
      await acknowledgeSecurityEvent(eventId);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to acknowledge event');
    }
  };

  const handleResolve = async (eventId: string) => {
    try {
      await resolveSecurityEvent(eventId, 'Resolved by user');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve event');
    }
  };

  const handleRunAssessment = async () => {
    try {
      setLoading(true);
      await runComplianceAssessment();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run assessment');
    }
  };

  // Get threat level color
  const getThreatColor = (level: string) => {
    switch (level) {
      case 'low': return '#22c55e';
      case 'medium': return '#f59e0b';
      case 'high': return '#f97316';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1a1a1a' }}>
      {/* Header */}
      <div style={{ 
        padding: '20px 24px', 
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#1a1a1a',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#fff' }}>
            Security Dashboard
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#888' }}>
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={fetchData}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #444',
              background: 'transparent',
              color: '#aaa',
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ 
        padding: '0 24px', 
        borderBottom: '1px solid #333',
        display: 'flex',
        gap: 0,
        background: '#1a1a1a',
      }}>
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'events', label: 'Security Events', count: overview?.activeAlerts },
          { id: 'compliance', label: 'Compliance' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            style={{
              padding: '14px 20px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #d4b08c' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab.id ? '#d4b08c' : '#888',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span style={{
                padding: '2px 8px',
                background: activeTab === tab.id ? '#d4b08c20' : '#ef4444',
                borderRadius: 10,
                fontSize: 11,
                color: activeTab === tab.id ? '#d4b08c' : '#fff',
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && !overview ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchData} />
        ) : activeTab === 'overview' ? (
          <OverviewTab 
            overview={overview!} 
            events={events.slice(0, 10)}
            onEventClick={setSelectedEvent}
          />
        ) : activeTab === 'events' ? (
          <EventsTab
            events={events}
            filterType={filterType}
            filterSeverity={filterSeverity}
            showAcknowledged={showAcknowledged}
            onFilterTypeChange={setFilterType}
            onFilterSeverityChange={setFilterSeverity}
            onToggleAcknowledged={() => setShowAcknowledged(!showAcknowledged)}
            onEventClick={setSelectedEvent}
          />
        ) : (
          <ComplianceTab
            compliance={compliance!}
            onRunAssessment={handleRunAssessment}
          />
        )}
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onAcknowledge={() => handleAcknowledge(selectedEvent.id)}
          onResolve={() => handleResolve(selectedEvent.id)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Overview Tab
// ============================================================================

function OverviewTab({ 
  overview, 
  events,
  onEventClick,
}: { 
  overview: SecurityOverview; 
  events: SecurityEvent[];
  onEventClick: (event: SecurityEvent) => void;
}) {
  const getThreatColor = (level: string) => {
    switch (level) {
      case 'low': return '#22c55e';
      case 'medium': return '#f59e0b';
      case 'high': return '#f97316';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Threat Level Banner */}
      <div style={{
        padding: 20,
        background: `${getThreatColor(overview.threatLevel)}10`,
        borderRadius: 12,
        border: `1px solid ${getThreatColor(overview.threatLevel)}30`,
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          background: `${getThreatColor(overview.threatLevel)}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: getThreatColor(overview.threatLevel),
        }}>
          <Shield size={28} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
            Current Threat Level
          </div>
          <div style={{ 
            fontSize: 28, 
            fontWeight: 700, 
            color: getThreatColor(overview.threatLevel),
            textTransform: 'capitalize',
          }}>
            {overview.threatLevel}
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: 16,
        marginBottom: 24,
      }}>
        <MetricCard
          label="Active Alerts"
          value={overview.activeAlerts}
          icon={<Bell size={20} />}
          color="#ef4444"
          trend={overview.metrics.totalViolations24h > 5 ? 'up' : 'down'}
        />
        <MetricCard
          label="Unresolved Violations"
          value={overview.unresolvedViolations}
          icon={<AlertTriangle size={20} />}
          color="#f59e0b"
        />
        <MetricCard
          label="Pending Approvals"
          value={overview.pendingApprovals}
          icon={<Clock size={20} />}
          color="#3b82f6"
        />
        <MetricCard
          label="Compliance Score"
          value={`${overview.complianceStatus.score}%`}
          icon={<CheckCircle size={20} />}
          color="#22c55e"
          trend={overview.complianceStatus.score > 80 ? 'up' : 'down'}
        />
      </div>

      {/* Recent Events */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fff' }}>
            Recent Security Events
          </h3>
          <button style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: '#d4b08c',
            fontSize: 13,
            cursor: 'pointer',
          }}>
            View All →
          </button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
              <CheckCircle size={32} />
              <p>No recent security events</p>
            </div>
          ) : (
            events.slice(0, 5).map(event => (
              <EventCard 
                key={event.id} 
                event={event} 
                onClick={() => onEventClick(event)}
              />
            ))
          )}
        </div>
      </div>

      {/* 24h Metrics */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#fff' }}>
          Last 24 Hours
        </h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(5, 1fr)', 
          gap: 12,
        }}>
          <StatBox label="Violations" value={overview.metrics.totalViolations24h} color="#ef4444" />
          <StatBox label="Blocked" value={overview.metrics.blockedActions24h} color="#f97316" />
          <StatBox label="Approved" value={overview.metrics.approvedRequests24h} color="#22c55e" />
          <StatBox label="Rejected" value={overview.metrics.rejectedRequests24h} color="#888" />
          <StatBox label="Enforcement" value={`${Math.round(overview.metrics.policyEnforcementRate * 100)}%`} color="#3b82f6" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Events Tab
// ============================================================================

function EventsTab({
  events,
  filterType,
  filterSeverity,
  showAcknowledged,
  onFilterTypeChange,
  onFilterSeverityChange,
  onToggleAcknowledged,
  onEventClick,
}: {
  events: SecurityEvent[];
  filterType: SecurityEventType | 'all';
  filterSeverity: SecurityEventSeverity | 'all';
  showAcknowledged: boolean;
  onFilterTypeChange: (type: SecurityEventType | 'all') => void;
  onFilterSeverityChange: (severity: SecurityEventSeverity | 'all') => void;
  onToggleAcknowledged: () => void;
  onEventClick: (event: SecurityEvent) => void;
}) {
  return (
    <div style={{ padding: 24 }}>
      {/* Filters */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12,
        marginBottom: 20,
        padding: 16,
        background: '#252525',
        borderRadius: 8,
      }}>
        <select
          value={filterType}
          onChange={(e) => onFilterTypeChange(e.target.value as SecurityEventType | 'all')}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #444',
            background: '#1a1a1a',
            color: '#e5e5e5',
            fontSize: 13,
          }}
        >
          <option value="all">All Types</option>
          {EVENT_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => onFilterSeverityChange(e.target.value as SecurityEventSeverity | 'all')}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #444',
            background: '#1a1a1a',
            color: '#e5e5e5',
            fontSize: 13,
          }}
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="info">Info</option>
        </select>
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          color: '#aaa', 
          fontSize: 13,
          cursor: 'pointer',
        }}>
          <input 
            type="checkbox" 
            checked={showAcknowledged}
            onChange={onToggleAcknowledged}
          />
          Show acknowledged
        </label>
      </div>

      {/* Events List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#666' }}>
            <CheckCircle size={48} style={{ marginBottom: 16 }} />
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#aaa' }}>No events found</h3>
            <p>No security events match your current filters.</p>
          </div>
        ) : (
          events.map(event => (
            <EventCard 
              key={event.id} 
              event={event} 
              onClick={() => onEventClick(event)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Compliance Tab
// ============================================================================

function ComplianceTab({
  compliance,
  onRunAssessment,
}: {
  compliance: ComplianceStatus;
  onRunAssessment: () => void;
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return '#22c55e';
      case 'at_risk': return '#f59e0b';
      case 'non_compliant': return '#ef4444';
      default: return '#888';
    }
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Overall Score */}
      <div style={{
        padding: 32,
        background: '#252525',
        borderRadius: 12,
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 32,
      }}>
        <div style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: `conic-gradient(${getStatusColor(compliance.overall)} ${compliance.score * 3.6}deg, #333 0deg)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}>
          <div style={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: '#252525',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}>
            <span style={{ fontSize: 32, fontWeight: 700, color: getStatusColor(compliance.overall) }}>
              {compliance.score}%
            </span>
            <span style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>
              {compliance.overall}
            </span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 600, color: '#fff' }}>
            Compliance Status
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: 14, color: '#888' }}>
            Last assessment: {new Date(compliance.lastAssessmentAt).toLocaleString()}
          </p>
          <button
            onClick={onRunAssessment}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: '#d4b08c',
              color: '#1a1a1a',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Run Assessment
          </button>
        </div>
      </div>

      {/* Frameworks */}
      <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#fff' }}>
        Compliance Frameworks
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
        {compliance.frameworks.map(framework => (
          <div key={framework.id} style={{
            padding: 20,
            background: '#252525',
            borderRadius: 8,
            border: `1px solid ${getStatusColor(framework.status)}30`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>
                {framework.name}
              </span>
              <span style={{
                padding: '4px 10px',
                background: `${getStatusColor(framework.status)}20`,
                color: getStatusColor(framework.status),
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
              }}>
                {framework.status}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, height: 6, background: '#333', borderRadius: 3 }}>
                <div style={{
                  width: `${framework.score}%`,
                  height: '100%',
                  background: getStatusColor(framework.status),
                  borderRadius: 3,
                }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: getStatusColor(framework.status) }}>
                {framework.score}%
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {framework.passedControls} of {framework.totalControls} controls passed
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#fff' }}>
        Control Status
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {compliance.controls.slice(0, 20).map(control => (
          <div key={control.id} style={{
            padding: '12px 16px',
            background: '#252525',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            {control.status === 'passed' ? (
              <CheckCircle size={18} color="#22c55e" />
            ) : control.status === 'failed' ? (
              <XCircle size={18} color="#ef4444" />
            ) : (
              <AlertCircle size={18} color="#888" />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: '#fff' }}>{control.name}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{control.framework}</div>
            </div>
            <span style={{
              padding: '2px 8px',
              background: control.status === 'passed' ? '#22c55e20' : control.status === 'failed' ? '#ef444420' : '#66666620',
              color: control.status === 'passed' ? '#22c55e' : control.status === 'failed' ? '#ef4444' : '#888',
              borderRadius: 4,
              fontSize: 11,
            }}>
              {control.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Event Card Component
// ============================================================================

function EventCard({ event, onClick }: { event: SecurityEvent; onClick: () => void }) {
  const typeConfig = EVENT_TYPES.find(t => t.value === event.type) || EVENT_TYPES[6];
  const severityConfig = SEVERITY_CONFIG[event.severity];

  return (
    <div 
      onClick={onClick}
      style={{
        padding: '14px 18px',
        background: event.acknowledgedAt ? '#1f1f1f' : '#252525',
        borderRadius: 8,
        border: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        cursor: 'pointer',
        opacity: event.acknowledgedAt ? 0.7 : 1,
      }}
    >
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        background: `${typeConfig.color}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: typeConfig.color,
      }}>
        {typeConfig.icon}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>
            {event.title}
          </span>
          <span style={{
            padding: '2px 8px',
            background: severityConfig.bgColor,
            color: severityConfig.color,
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 600,
          }}>
            {severityConfig.label}
          </span>
          {event.acknowledgedAt && (
            <span style={{
              padding: '2px 8px',
              background: '#66666620',
              color: '#888',
              borderRadius: 4,
              fontSize: 10,
            }}>
              Acknowledged
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
          {event.description}
        </p>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 12, color: '#666' }}>
          {new Date(event.createdAt).toLocaleTimeString()}
        </div>
        <div style={{ fontSize: 11, color: '#555' }}>
          {event.source.agentName || event.source.userId || 'System'}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Event Detail Modal
// ============================================================================

function EventDetailModal({
  event,
  onClose,
  onAcknowledge,
  onResolve,
}: {
  event: SecurityEvent;
  onClose: () => void;
  onAcknowledge: () => void;
  onResolve: () => void;
}) {
  const typeConfig = EVENT_TYPES.find(t => t.value === event.type) || EVENT_TYPES[6];
  const severityConfig = SEVERITY_CONFIG[event.severity];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        width: 550,
        maxHeight: '90vh',
        background: '#1a1a1a',
        borderRadius: 12,
        border: '1px solid #333',
        overflow: 'auto',
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: `${typeConfig.color}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: typeConfig.color,
            }}>
              {typeConfig.icon}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fff' }}>
                {event.title}
              </h2>
              <span style={{
                padding: '2px 8px',
                background: severityConfig.bgColor,
                color: severityConfig.color,
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
              }}>
                {severityConfig.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Description
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: '#aaa', lineHeight: 1.6 }}>
              {event.description}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Source
              </h3>
              <div style={{ padding: 12, background: '#252525', borderRadius: 6 }}>
                {event.source.agentName && (
                  <div style={{ fontSize: 13, color: '#fff', marginBottom: 4 }}>
                    Agent: {event.source.agentName}
                  </div>
                )}
                {event.source.userId && (
                  <div style={{ fontSize: 13, color: '#fff', marginBottom: 4 }}>
                    User: {event.source.userId}
                  </div>
                )}
                {event.source.ip && (
                  <div style={{ fontSize: 13, color: '#888' }}>
                    IP: {event.source.ip}
                  </div>
                )}
              </div>
            </div>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Target
              </h3>
              <div style={{ padding: 12, background: '#252525', borderRadius: 6 }}>
                <div style={{ fontSize: 13, color: '#fff', marginBottom: 4 }}>
                  Type: {event.target?.type || 'N/A'}
                </div>
                <div style={{ fontSize: 13, color: '#888' }}>
                  ID: {event.target?.identifier || 'N/A'}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Metadata
            </h3>
            <div style={{ padding: 12, background: '#252525', borderRadius: 6 }}>
              <code style={{ fontSize: 12, color: '#d4b08c' }}>
                {JSON.stringify(event.metadata, null, 2)}
              </code>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            {!event.acknowledgedAt && (
              <button
                onClick={onAcknowledge}
                style={{
                  padding: '10px 20px',
                  borderRadius: 6,
                  border: '1px solid #444',
                  background: 'transparent',
                  color: '#aaa',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Acknowledge
              </button>
            )}
            {!event.resolvedAt && (
              <button
                onClick={onResolve}
                style={{
                  padding: '10px 20px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#22c55e',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Resolve
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Utility Components
// ============================================================================

function MetricCard({ 
  label, 
  value, 
  icon, 
  color,
  trend,
}: { 
  label: string; 
  value: number | string; 
  icon: React.ReactNode; 
  color: string;
  trend?: 'up' | 'down';
}) {
  return (
    <div style={{
      padding: 20,
      background: '#252525',
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 10,
        background: `${color}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
        <div style={{ fontSize: 13, color: '#888' }}>{label}</div>
      </div>
      {trend && (
        <div style={{ color: trend === 'up' ? '#22c55e' : '#ef4444' }}>
          {trend === 'up' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      padding: 16,
      background: '#252525',
      borderRadius: 8,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 24, fontWeight: 700, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#888' }}>{label}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: '#666' }}>
      <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite' }} />
      <p>Loading security data...</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <AlertCircle size={32} color="#ef4444" />
      <p style={{ color: '#ef4444', marginBottom: 16 }}>{message}</p>
      <button
        onClick={onRetry}
        style={{
          padding: '8px 16px',
          borderRadius: 6,
          border: '1px solid #444',
          background: 'transparent',
          color: '#aaa',
          cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  );
}

// ============================================================================
// Mock Data
// ============================================================================

function getMockOverview(): SecurityOverview {
  return {
    threatLevel: 'medium',
    activeAlerts: 3,
    unresolvedViolations: 5,
    pendingApprovals: 2,
    recentEvents: getMockEvents().slice(0, 5),
    complianceStatus: {
      overall: 'at_risk',
      score: 82,
      lastAssessmentAt: '2026-03-06T10:00:00Z',
      frameworks: [
        { id: 'soc2', name: 'SOC 2', version: '2017', status: 'compliant', score: 95, totalControls: 64, passedControls: 61, failedControls: 3 },
        { id: 'gdpr', name: 'GDPR', version: '2018', status: 'at_risk', score: 78, totalControls: 48, passedControls: 37, failedControls: 11 },
      ],
      controls: [],
    },
    metrics: {
      totalViolations24h: 12,
      blockedActions24h: 8,
      approvedRequests24h: 24,
      rejectedRequests24h: 3,
      avgResponseTimeMs: 150,
      policyEnforcementRate: 0.94,
    },
  };
}

function getMockEvents(): SecurityEvent[] {
  return [
    {
      id: 'evt-001',
      type: 'policy_violation',
      subtype: 'data_access',
      severity: 'high',
      title: 'Unauthorized data access attempt',
      description: 'Agent attempted to access sensitive customer data without proper authorization',
      source: { agentId: 'agent-001', agentName: 'Data Analyzer' },
      target: { type: 'database', identifier: 'customers' },
      context: { environment: 'production', timestamp: '2026-03-06T18:30:00Z', correlationId: 'corr-001' },
      metadata: { table: 'customers', columns: ['email', 'phone'] },
      createdAt: '2026-03-06T18:30:00Z',
    },
    {
      id: 'evt-002',
      type: 'anomaly',
      subtype: 'rate_limit',
      severity: 'medium',
      title: 'Unusual API usage pattern detected',
      description: 'Agent exceeded normal API call rate by 300%',
      source: { agentId: 'agent-002', agentName: 'Web Scraper' },
      target: { type: 'api', identifier: 'search-api' },
      context: { environment: 'production', timestamp: '2026-03-06T17:15:00Z', correlationId: 'corr-002' },
      metadata: { calls_per_minute: 150, threshold: 50 },
      createdAt: '2026-03-06T17:15:00Z',
    },
    {
      id: 'evt-003',
      type: 'authentication',
      subtype: 'token_refresh',
      severity: 'info',
      title: 'API token refreshed',
      description: 'Agent API token was automatically refreshed',
      source: { agentId: 'agent-003', agentName: 'System Agent' },
      context: { environment: 'production', timestamp: '2026-03-06T16:00:00Z', correlationId: 'corr-003' },
      metadata: {},
      createdAt: '2026-03-06T16:00:00Z',
    },
    {
      id: 'evt-004',
      type: 'threat',
      subtype: 'injection_attempt',
      severity: 'critical',
      title: 'Potential injection attack detected',
      description: 'Suspicious input patterns detected in agent command',
      source: { agentId: 'agent-004', agentName: 'Untrusted Agent' },
      target: { type: 'system', identifier: 'shell' },
      context: { environment: 'production', timestamp: '2026-03-06T15:30:00Z', correlationId: 'corr-004' },
      metadata: { pattern: '$(...)', command: 'eval' },
      createdAt: '2026-03-06T15:30:00Z',
      acknowledgedAt: '2026-03-06T15:35:00Z',
      acknowledgedBy: 'admin',
    },
    {
      id: 'evt-005',
      type: 'compliance',
      subtype: 'audit_complete',
      severity: 'low',
      title: 'Weekly compliance audit completed',
      description: 'Automated compliance audit completed with no issues',
      source: { userId: 'system' },
      context: { environment: 'all', timestamp: '2026-03-06T14:00:00Z', correlationId: 'corr-005' },
      metadata: { frameworks_checked: ['SOC2', 'GDPR'] },
      createdAt: '2026-03-06T14:00:00Z',
    },
  ];
}

function getMockCompliance(): ComplianceStatus {
  return {
    overall: 'at_risk',
    score: 82,
    lastAssessmentAt: '2026-03-06T10:00:00Z',
    frameworks: [
      { id: 'soc2', name: 'SOC 2', version: '2017', status: 'compliant', score: 95, totalControls: 64, passedControls: 61, failedControls: 3 },
      { id: 'gdpr', name: 'GDPR', version: '2018', status: 'at_risk', score: 78, totalControls: 48, passedControls: 37, failedControls: 11 },
      { id: 'hipaa', name: 'HIPAA', version: '2013', status: 'compliant', score: 92, totalControls: 54, passedControls: 50, failedControls: 4 },
      { id: 'iso27001', name: 'ISO 27001', version: '2022', status: 'compliant', score: 88, totalControls: 114, passedControls: 100, failedControls: 14 },
    ],
    controls: [
      { id: 'ctrl-001', name: 'Data encryption at rest', framework: 'SOC 2', status: 'passed', lastCheckedAt: '2026-03-06T10:00:00Z', policyIds: ['pol-001'] },
      { id: 'ctrl-002', name: 'Access control review', framework: 'SOC 2', status: 'passed', lastCheckedAt: '2026-03-06T10:00:00Z', policyIds: ['pol-002'] },
      { id: 'ctrl-003', name: 'Data retention policy', framework: 'GDPR', status: 'failed', lastCheckedAt: '2026-03-06T10:00:00Z', policyIds: ['pol-003'] },
      { id: 'ctrl-004', name: 'Right to erasure', framework: 'GDPR', status: 'passed', lastCheckedAt: '2026-03-06T10:00:00Z', policyIds: ['pol-004'] },
      { id: 'ctrl-005', name: 'Audit logging', framework: 'SOC 2', status: 'passed', lastCheckedAt: '2026-03-06T10:00:00Z', policyIds: ['pol-005'] },
    ],
  };
}

export default SecurityDashboard;
