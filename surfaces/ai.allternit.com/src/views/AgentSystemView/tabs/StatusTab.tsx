/**
 * StatusTab - System Health and Active Executions
 * 
 * Features:
 * - System health metrics
 * - Active executions with progress
 * - Lease status overview
 * - Recent events feed
 * - Agent activity
 */

import React, { useEffect } from "react";
import {
  Pulse as Activity,
  CheckCircle,
  XCircle,
  Clock,
  Cpu,
  WifiHigh,
  Users,
  Pause,
  Play,
} from '@phosphor-icons/react';
import { useUnifiedStore } from "@/lib/agents/unified.store";

export function StatusTab() {
  const {
    health,
    executions,
    leases,
    agents,
    logs,
    checkHealth,
    fetchLeases,
    fetchAgents,
    fetchLedgerEvents,
    cancelExecution,
  } = useUnifiedStore();

  // Fetch data on mount
  useEffect(() => {
    checkHealth();
    fetchLeases();
    fetchAgents();
    fetchLedgerEvents(50);
  }, [checkHealth, fetchLeases, fetchAgents, fetchLedgerEvents]);

  const activeExecutions = executions.filter((e) => e.status === "running");
  const completedExecutions = executions.filter((e) => e.status === "completed");
  const failedExecutions = executions.filter((e) => e.status === "failed");
  const activeLeases = leases.filter((l) => l.status === "active");
  const expiringLeases = leases.filter((l) => l.status === "expiring");

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        overflow: "hidden",
        padding: 16,
        gap: 16,
      }}
    >
      {/* Left Column: Health & Stats */}
      <div
        style={{
          width: 300,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Health Card */}
        <Card title="System Health">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <HealthItem
              icon={WifiHigh}
              label="Rails Service"
              status={health.rails}
            />
            <HealthItem
              icon={Cpu}
              label="Gateway"
              status={health.gateway}
            />
            <div
              style={{
                paddingTop: 12,
                borderTop: "1px solid var(--border-subtle, #333)",
                fontSize: 12,
                color: "#888",
              }}
            >
              Last updated: {new Date(health.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </Card>

        {/* Quick Stats */}
        <Card title="Overview">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <StatBox
              icon={Play}
              label="Active"
              value={activeExecutions.length}
              color="#0a84ff"
            />
            <StatBox
              icon={CheckCircle}
              label="Completed"
              value={completedExecutions.length}
              color="#10b981"
            />
            <StatBox
              icon={XCircle}
              label="Failed"
              value={failedExecutions.length}
              color="#ff3b30"
            />
            <StatBox
              icon={Users}
              label="Agents"
              value={agents.length}
              color="#f59e0b"
            />
          </div>
        </Card>

        {/* Lease Status */}
        <Card title="Leases">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <LeaseStat label="Active" count={activeLeases.length} color="#10b981" />
            <LeaseStat label="Expiring" count={expiringLeases.length} color="#f59e0b" />
            <LeaseStat label="Expired" count={leases.filter((l) => l.status === "expired").length} color="#ff3b30" />
          </div>
        </Card>
      </div>

      {/* Middle Column: Executions */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minWidth: 0,
        }}
      >
        <Card title="Active Executions" fullHeight>
          {activeExecutions.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#666",
                padding: 40,
              }}
            >
              <Activity size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p>No active executions</p>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                overflow: "auto",
              }}
            >
              {activeExecutions.map((execution) => (
                <ExecutionCard
                  key={execution.runId}
                  execution={execution}
                  onCancel={() => cancelExecution(execution.runId)}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Right Column: Events & Logs */}
      <div
        style={{
          width: 350,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <Card title="Recent Events" fullHeight>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              overflow: "auto",
            }}
          >
            {logs.slice(0, 20).map((log) => (
              <LogItem key={log.id} log={log} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// Card Component
interface CardProps {
  title: string;
  children: React.ReactNode;
  fullHeight?: boolean;
}

function Card({ title, children, fullHeight }: CardProps) {
  return (
    <div
      style={{
        background: "var(--bg-secondary, #141414)",
        border: "1px solid var(--border-subtle, #333)",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        flex: fullHeight ? 1 : undefined,
        minHeight: 0,
      }}
    >
      <h3
        style={{
          fontSize: 13,
          fontWeight: 600,
          margin: "0 0 16px 0",
          color: "var(--text-primary, #f0f0f0)",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {title}
      </h3>
      <div style={{ flex: fullHeight ? 1 : undefined, minHeight: 0, overflow: fullHeight ? "auto" : undefined }}>
        {children}
      </div>
    </div>
  );
}

// Health Item Component
interface HealthItemProps {
  icon: React.ElementType;
  label: string;
  status: boolean;
}

function HealthItem({ icon: Icon, label, status }: HealthItemProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: status ? "#10b98120" : "#ff3b3020",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={16} color={status ? "#10b981" : "#ff3b30"} />
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-primary, #f0f0f0)",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 11,
            color: status ? "#10b981" : "#ff3b30",
          }}
        >
          {status ? "Healthy" : "Unhealthy"}
        </div>
      </div>
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: status ? "#10b981" : "#ff3b30",
        }}
      />
    </div>
  );
}

// Stat Box Component
interface StatBoxProps {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}

function StatBox({ icon: Icon, label, value, color }: StatBoxProps) {
  return (
    <div
      style={{
        padding: 12,
        background: "var(--bg-primary, #0a0a0a)",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Icon size={20} color={color} />
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: color,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#888",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}

// Lease Stat Component
function LeaseStat({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        background: "var(--bg-primary, #0a0a0a)",
        borderRadius: 6,
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: "#888",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: color,
        }}
      >
        {count}
      </span>
    </div>
  );
}

// Execution Card Component
interface ExecutionCardProps {
  execution: {
    runId: string;
    dagId: string;
    status: string;
    progress: number;
    startedAt: number;
    completedNodes: string[];
    failedNodes: string[];
  };
  onCancel: () => void;
}

function ExecutionCard({ execution, onCancel }: ExecutionCardProps) {
  const duration = Date.now() - execution.startedAt;
  const durationStr = formatDuration(duration);

  return (
    <div
      style={{
        padding: 16,
        background: "var(--bg-primary, #0a0a0a)",
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
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-primary, #f0f0f0)",
              marginBottom: 4,
            }}
          >
            {execution.dagId}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#888",
            }}
          >
            {execution.runId}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: "#888",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Clock size={12} />
            {durationStr}
          </span>
          <button
            onClick={onCancel}
            style={{
              padding: "6px 12px",
              background: "#ff3b30",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Pause size={12} />
            Cancel
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          height: 4,
          background: "var(--border-subtle, #333)",
          borderRadius: 2,
          overflow: "hidden",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${execution.progress}%`,
            background: "#0a84ff",
            borderRadius: 2,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Stats */}
      <div
        style={{
          display: "flex",
          gap: 16,
          fontSize: 11,
          color: "#888",
        }}
      >
        <span style={{ color: "#10b981" }}>
          {execution.completedNodes.length} completed
        </span>
        {execution.failedNodes.length > 0 && (
          <span style={{ color: "#ff3b30" }}>
            {execution.failedNodes.length} failed
          </span>
        )}
      </div>
    </div>
  );
}

// Log Item Component
function LogItem({ log }: { log: { id: string; timestamp: number; level: string; message: string; source: string } }) {
  const levelColors: Record<string, string> = {
    debug: "#888",
    info: "#0a84ff",
    warn: "#f59e0b",
    error: "#ff3b30",
  };

  return (
    <div
      style={{
        padding: "8px 12px",
        background: "var(--bg-primary, #0a0a0a)",
        borderRadius: 6,
        fontSize: 11,
        fontFamily: "var(--font-mono)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <span style={{ color: "#666" }}>
          {new Date(log.timestamp).toLocaleTimeString()}
        </span>
        <span
          style={{
            color: levelColors[log.level] || "#888",
            fontWeight: 600,
            textTransform: "uppercase",
          }}
        >
          {log.level}
        </span>
        <span
          style={{
            color: "#666",
            fontSize: 10,
          }}
        >
          [{log.source}]
        </span>
      </div>
      <div
        style={{
          color: "var(--text-secondary, #ccc)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {log.message}
      </div>
    </div>
  );
}

// Helper Functions
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export default StatusTab;
