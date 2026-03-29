/**
 * ContextView - Shows current WIH/DAG context with FUNCTIONAL actions
 * 
 * All buttons actually do things - no placeholders
 */

import React, { useEffect } from "react";
import {
  GitBranch,
  ClipboardText,
  User,
  Clock,
  CaretRight,
  Play,
  CheckCircle,
  XCircle,
  ArrowsClockwise,
  Plus,
  EnvelopeSimple,
  Pulse as Activity,
  GearSix,
  ClockCounterClockwise,
} from '@phosphor-icons/react';
import { useUnifiedStore } from "@/lib/agents/unified.store";

export function ContextView() {
  const {
    contextMode,
    currentDag,
    currentWih,
    currentExecution,
    health,
    myWihs,
    wihs,
    executions,
    logs,
    activeMainTab,
    setActiveMainTab,
    activeDrawerTab,
    setActiveDrawerTab,
    selectDag,
    selectWih,
    executeDag,
    closeWih,
    fetchWihs,
    fetchDags,

    fetchAgents,
    checkHealth,
  } = useUnifiedStore();

  // Auto-refresh data when context view is active
  useEffect(() => {
    const interval = setInterval(() => {
      fetchWihs();
      fetchDags();
      checkHealth();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchWihs, fetchDags, checkHealth]);

  const modeConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    idle: { label: "Idle", color: "#6b7280", icon: Clock },
    planning: { label: "Planning", color: "#6366f1", icon: GitBranch },
    executing: { label: "Executing", color: "#f59e0b", icon: Play },
    working: { label: "Working", color: "#10b981", icon: ClipboardText },
    reviewing: { label: "Reviewing", color: "#ec4899", icon: User },
    monitoring: { label: "Monitoring", color: "#06b6d4", icon: Activity },
  };

  const config = modeConfig[contextMode] || modeConfig.idle;
  const ModeIcon = config.icon;

  // ACTUAL action handlers
  const handleGoToPlan = () => {
    setActiveMainTab("plan");
    if (currentDag) {
      selectDag(currentDag.dagId);
    }
  };

  const handleGoToWork = () => {
    setActiveMainTab("work");
    if (currentWih) {
      selectWih(currentWih.wih_id);
    }
  };

  const handleGoToStatus = () => {
    setActiveMainTab("status");
  };

  const handleGoToMail = () => {
    setActiveMainTab("mail");
  };

  const handleExecuteDag = async () => {
    if (currentDag) {
      try {
        await executeDag(currentDag.dagId);
        setActiveMainTab("status"); // Auto-switch to status to see execution
      } catch (err) {
        console.error("Failed to execute DAG:", err);
      }
    }
  };

  const handleCompleteWih = async () => {
    if (currentWih) {
      try {
        await closeWih(currentWih.wih_id, "completed");
        await fetchWihs(); // Refresh list
      } catch (err) {
        console.error("Failed to complete WIH:", err);
      }
    }
  };

  const handleFailWih = async () => {
    if (currentWih) {
      try {
        await closeWih(currentWih.wih_id, "failed");
        await fetchWihs(); // Refresh list
      } catch (err) {
        console.error("Failed to fail WIH:", err);
      }
    }
  };

  const handleRefresh = () => {
    fetchWihs();
    fetchDags();
    checkHealth();
  };

  const handleNewPlan = () => {
    setActiveMainTab("plan");
  };

  const handleViewLogs = () => {
    setActiveDrawerTab("logs");
  };

  const handleViewExecutions = () => {
    setActiveDrawerTab("executions");
  };

  return (
    <div
      style={{
        height: "100%",
        overflow: "auto",
        padding: 20,
        background: "var(--bg-primary, #0a0a0a)",
      }}
    >
      {/* Header with refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Current Context</h2>
        <button
          onClick={handleRefresh}
          style={{
            padding: 8,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <ArrowsClockwise size={14} />
          <span style={{ fontSize: 12 }}>Refresh</span>
        </button>
      </div>

      {/* Context Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: 20,
          background: "var(--bg-secondary, #141414)",
          border: "1px solid var(--border-subtle, #333)",
          borderRadius: 12,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: `${config.color}20`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ModeIcon size={28} color={config.color} />
        </div>
        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontSize: 20,
              fontWeight: 700,
              margin: "0 0 4px 0",
              color: config.color,
            }}
          >
            {config.label}
          </h3>
          <p
            style={{
              fontSize: 13,
              color: "#888",
              margin: 0,
            }}
          >
            {contextMode === "idle" 
              ? "No active work context - create a plan or pickup work" 
              : `Currently ${config.label.toLowerCase()}`}
          </p>
        </div>
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: health.rails ? "#10b981" : "#ff3b30",
            boxShadow: `0 0 10px ${health.rails ? "#10b981" : "#ff3b30"}`,
          }}
        />
      </div>

      {/* Active DAG */}
      {currentDag && (
        <Section title="Active Plan">
          <div
            style={{
              padding: 16,
              background: "var(--bg-secondary, #141414)",
              border: "1px solid var(--border-subtle, #333)",
              borderRadius: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div>
                <h4
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    margin: "0 0 4px 0",
                  }}
                >
                  {currentDag.metadata?.title || currentDag.dagId}
                </h4>
                <span
                  style={{
                    fontSize: 12,
                    color: "#888",
                  }}
                >
                  {currentDag.nodes?.length || 0} nodes • v{currentDag.version}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleExecuteDag}
                  style={{
                    padding: "8px 16px",
                    background: "#10b981",
                    border: "none",
                    borderRadius: 6,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Play size={14} />
                  Run
                </button>
                <button
                  onClick={handleGoToPlan}
                  style={{
                    padding: "8px 16px",
                    background: "#0a84ff",
                    border: "none",
                    borderRadius: 6,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  Open
                  <CaretRight size={14} />
                </button>
              </div>
            </div>

            {currentExecution && (
              <div
                style={{
                  padding: 12,
                  background: "var(--bg-primary, #0a0a0a)",
                  borderRadius: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "#888",
                    }}
                  >
                    Current Execution
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: currentExecution.status === "running" ? "#f59e0b" : "#10b981",
                    }}
                  >
                    {currentExecution.status}
                  </span>
                </div>
                <div
                  style={{
                    height: 4,
                    background: "var(--border-subtle, #333)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${currentExecution.progress}%`,
                      background: "#0a84ff",
                      borderRadius: 2,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleViewExecutions}
                    style={{
                      fontSize: 11,
                      color: '#0a84ff',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    View in Executions tab
                  </button>
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Active WIH */}
      {currentWih && (
        <Section title="Active Work Item">
          <div
            style={{
              padding: 16,
              background: "var(--bg-secondary, #141414)",
              border: "1px solid var(--border-subtle, #333)",
              borderRadius: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div>
                <h4
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    margin: "0 0 4px 0",
                  }}
                >
                  {currentWih.title || currentWih.wih_id}
                </h4>
                <span
                  style={{
                    fontSize: 12,
                    color: "#888",
                  }}
                >
                  {currentWih.wih_id}
                </span>
              </div>
              <StatusBadge status={currentWih.status} />
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <button
                onClick={handleGoToWork}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#0a84ff",
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Open in Work Tab
              </button>
            </div>

            {(currentWih.status === "signed" || currentWih.status === "in_progress") && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                }}
              >
                <button
                  onClick={handleCompleteWih}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#10b981",
                    border: "none",
                    borderRadius: 6,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <CheckCircle size={14} />
                  Complete
                </button>
                <button
                  onClick={handleFailWih}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#ff3b30",
                    border: "none",
                    borderRadius: 6,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <XCircle size={14} />
                  Fail
                </button>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Quick Stats */}
      <Section title="Quick Stats">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <StatBox 
            label="My WIHs" 
            value={myWihs.length} 
            onClick={handleGoToWork}
          />
          <StatBox 
            label="Active Execs" 
            value={executions.filter(e => e.status === 'running').length}
            onClick={handleViewExecutions}
          />
          <StatBox 
            label="Total WIHs" 
            value={wihs.length}
            onClick={() => setActiveMainTab('work')}
          />
          <StatBox 
            label="Recent Logs" 
            value={logs.length}
            onClick={handleViewLogs}
          />
        </div>
      </Section>

      {/* Functional Quick Actions */}
      <Section title="Quick Actions">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ActionButton
            icon={Plus}
            label="Create New Plan"
            color="#6366f1"
            onClick={handleNewPlan}
          />
          <ActionButton
            icon={GitBranch}
            label="View All Plans"
            color="#0a84ff"
            onClick={() => setActiveMainTab('plan')}
          />
          <ActionButton
            icon={ClipboardText}
            label="View Work Queue"
            color="#10b981"
            onClick={() => setActiveMainTab('work')}
          />
          <ActionButton
            icon={Activity}
            label="Check System Status"
            color="#06b6d4"
            onClick={() => setActiveMainTab('status')}
          />
          <ActionButton
            icon={EnvelopeSimple}
            label="Check Mail"
            color="#f59e0b"
            onClick={() => setActiveMainTab('mail')}
          />
          <ActionButton
            icon={ClockCounterClockwise}
            label="View Audit Log"
            color="#8b5cf6"
            onClick={() => setActiveMainTab('audit')}
          />
        </div>
      </Section>

      {/* Navigation to Drawer Tabs */}
      <Section title="Drawer Views">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <DrawerTabButton
            label="Queue"
            isActive={activeDrawerTab === 'queue'}
            onClick={() => setActiveDrawerTab('queue')}
          />
          <DrawerTabButton
            label="Context"
            isActive={activeDrawerTab === 'context'}
            onClick={() => setActiveDrawerTab('context')}
          />
          <DrawerTabButton
            label="Logs"
            isActive={activeDrawerTab === 'logs'}
            onClick={() => setActiveDrawerTab('logs')}
          />
          <DrawerTabButton
            label="Executions"
            isActive={activeDrawerTab === 'executions'}
            onClick={() => setActiveDrawerTab('executions')}
          />
          <DrawerTabButton
            label="Agents"
            isActive={activeDrawerTab === 'agents'}
            onClick={() => setActiveDrawerTab('agents')}
          />
          <DrawerTabButton
            label="Scheduler"
            isActive={activeDrawerTab === 'scheduler'}
            onClick={() => setActiveDrawerTab('scheduler')}
          />
        </div>
      </Section>
    </div>
  );
}

// Section Component
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h4
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#888",
          margin: "0 0 12px 0",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {title}
      </h4>
      {children}
    </div>
  );
}

// Status Badge
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    open: { label: "Open", color: "#888" },
    ready: { label: "Ready", color: "#0a84ff" },
    signed: { label: "Signed", color: "#f59e0b" },
    in_progress: { label: "In Progress", color: "#10b981" },
    blocked: { label: "Blocked", color: "#ff3b30" },
    closed: { label: "Closed", color: "#666" },
  };

  const { label, color } = config[status] || config.open;

  return (
    <span
      style={{
        padding: "4px 10px",
        background: `${color}20`,
        color: color,
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

// Stat Box
function StatBox({ 
  label, 
  value, 
  onClick 
}: { 
  label: string; 
  value: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: 12,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'center'
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, color: '#0a84ff' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{label}</div>
    </button>
  );
}

// Action Button
function ActionButton({
  icon: Icon,
  label,
  color,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: `${color}10`,
        border: `1px solid ${color}30`,
        borderRadius: 8,
        color: color,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${color}20`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `${color}10`;
      }}
    >
      <Icon size={18} />
      {label}
    </button>
  );
}

// Drawer Tab Button
function DrawerTabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px',
        background: isActive ? '#0a84ff' : 'var(--bg-secondary)',
        border: `1px solid ${isActive ? '#0a84ff' : 'var(--border-subtle)'}`,
        borderRadius: 6,
        color: isActive ? '#fff' : '#888',
        fontSize: 12,
        fontWeight: isActive ? 600 : 500,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

export default ContextView;
