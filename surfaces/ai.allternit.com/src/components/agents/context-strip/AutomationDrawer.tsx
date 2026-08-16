import React, { useState, useEffect } from "react";
import {
  ClockCounterClockwise,
  Calendar,
  Wrench,
  X,
  Play,
  Pause,
  Plus,
  ArrowCounterClockwise,
  Pencil,
  Trash,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/lib/hooks/use-is-client";
import {
  listScheduledJobs,
  createScheduledJob,
  updateScheduledJob,
  deleteScheduledJob,
  runScheduledJobNow,
  pauseScheduledJob,
  resumeScheduledJob,
  describeCronExpression,
  calculateNextRun,
  getExecutionHistory,
  clearExecutionHistory,
  useJobRunner,
  type CronJobConfig,
  type JobExecution,
} from "@/lib/agents";
import { CronJobWizard } from "../CronJobWizard";
import { ConfirmModal } from "@/components/ConfirmModal";
import type { SurfacePalette, DisplayJob } from "./context-strip.types";
import { MetaCard } from "./MetaCard";

interface AutomationDrawerProps {
  automationEnabled: boolean;
  palette: SurfacePalette;
}

export function AutomationDrawer({ automationEnabled, palette }: AutomationDrawerProps) {
  const [activeTab, setActiveTab] = useState<"scheduled" | "history" | "config">("scheduled");
  const [jobs, setJobs] = useState<DisplayJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [editingJob, setEditingJob] = useState<DisplayJob | null>(null);
  const [confirmDeleteJobId, setConfirmDeleteJobId] = useState<string | null>(null);

  const loadJobs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const jobConfigs = await listScheduledJobs();
      const displayJobs: DisplayJob[] = jobConfigs.map((job) => ({
        id: job.id || "",
        name: job.name,
        schedule: job.schedule,
        status: job.enabled ? "active" : "paused",
        description: job.description,
        lastRun: job.lastRunAt ? new Date(job.lastRunAt) : undefined,
        nextRun: job.nextRunAt ? new Date(job.nextRunAt) : (calculateNextRun(job.schedule) ?? undefined),
        runCount: job.runCount || 0,
        lastError: job.lastError,
      }));
      setJobs(displayJobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "scheduled") {
      loadJobs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "scheduled") return;
    const interval = setInterval(loadJobs, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const handleCreateJob = async (config: CronJobConfig) => {
    try {
      await createScheduledJob(config);
      setShowCreateWizard(false);
      loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
    }
  };

  const handleUpdateJob = async (jobId: string, updates: Partial<CronJobConfig>) => {
    try {
      await updateScheduledJob(jobId, updates);
      loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update job");
    }
  };

  const handleDeleteJob = (jobId: string) => {
    setConfirmDeleteJobId(jobId);
  };

  const commitDeleteJob = async (jobId: string) => {
    setConfirmDeleteJobId(null);
    try {
      await deleteScheduledJob(jobId);
      loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete job");
    }
  };

  const handleRunNow = async (jobId: string) => {
    try {
      await runScheduledJobNow(jobId);
      setTimeout(loadJobs, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run job");
    }
  };

  const handleToggleJob = async (job: DisplayJob) => {
    if (job.status === "active") {
      await pauseScheduledJob(job.id);
    } else {
      await resumeScheduledJob(job.id);
    }
    loadJobs();
  };

  return (
    <div className="flex flex-col gap-3">
      {(showCreateWizard || editingJob) && (
        <div role="button" tabIndex={0}
          className="fixed inset-0 bg-[var(--shell-overlay-backdrop)] flex items-center justify-center z-[100] p-5"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateWizard(false);
              setEditingJob(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowCreateWizard(false);
              setEditingJob(null);
            }
          }}
        >
          <div className="max-h-[90vh] overflow-auto">
            <CronJobWizard
              initialConfig={editingJob ? {
                name: editingJob.name,
                schedule: editingJob.schedule,
                description: editingJob.description || "",
                prompt: "",
                taskType: "custom-task",
                parameters: {},
                enabled: editingJob.status === "active",
                maxRetries: 3,
                timeout: 30,
                notifyOnSuccess: false,
                notifyOnFailure: true,
              } : undefined}
              onClose={() => {
                setShowCreateWizard(false);
                setEditingJob(null);
              }}
              onSubmit={editingJob 
                ? (config: CronJobConfig) => handleUpdateJob(editingJob.id, config)
                : handleCreateJob
              }
              onComplete={() => {
                setShowCreateWizard(false);
                setEditingJob(null);
                loadJobs();
              }}
              onCancel={() => {
                setShowCreateWizard(false);
                setEditingJob(null);
              }}
            />
          </div>
        </div>
      )}

      <div
        className="flex items-center gap-2 p-[10px_12px] rounded-[10px] bg-[var(--bg-card)] border border-solid border-[var(--palette-border)]"
        style={{ '--palette-border': palette.border } as React.CSSProperties}
      >
        <ClockCounterClockwise
          size={14}
          weight="bold"
          style={{ color: palette.accent }}
        />
        <div className="flex-1">
          <div className="text-[12px] font-semibold text-[var(--text-primary)]">
            Runtime-Managed Session
          </div>
          <div className="text-[12px] text-[var(--text-secondary)]">
            {automationEnabled
              ? `Automation hooks are active | ${jobs.length} job${jobs.length !== 1 ? "s" : ""}`
              : "Enable automation to schedule jobs"}
          </div>
        </div>
        <div
          className={cn(
            "px-2 py-1 rounded-full text-[12px] font-bold",
            automationEnabled ? "bg-[#79C47C]/20 text-[#79C47C]" : "bg-[var(--ui-border-muted)] text-[var(--text-secondary)]"
          )}
        >
          {automationEnabled ? "Enabled" : "Disabled"}
        </div>
      </div>

      <div 
        className="flex gap-2 border-b border-solid border-[var(--palette-border)] pb-2"
        style={{ '--palette-border': palette.border } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={() => setActiveTab("scheduled")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-none text-[12px] font-bold cursor-pointer transition-all",
            activeTab === "scheduled" ? "bg-[var(--palette-soft)] text-[var(--palette-accent)]" : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          )}
          style={activeTab === "scheduled" ? {
            '--palette-soft': palette.soft,
            '--palette-accent': palette.accent,
          } as React.CSSProperties : {}}
        >
          <Calendar size={12} weight="bold" />
          Scheduled ({jobs.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-none text-[12px] font-bold cursor-pointer transition-all",
            activeTab === "history" ? "bg-[var(--palette-soft)] text-[var(--palette-accent)]" : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          )}
          style={activeTab === "history" ? {
            '--palette-soft': palette.soft,
            '--palette-accent': palette.accent,
          } as React.CSSProperties : {}}
        >
          <ClockCounterClockwise size={12} weight="bold" />
          History
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("config")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-none text-[12px] font-bold cursor-pointer transition-all",
            activeTab === "config" ? "bg-[var(--palette-soft)] text-[var(--palette-accent)]" : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          )}
          style={activeTab === "config" ? {
            '--palette-soft': palette.soft,
            '--palette-accent': palette.accent,
          } as React.CSSProperties : {}}
        >
          <Wrench size={12} weight="bold" />
          Config
        </button>
      </div>

      {error && (
        <div className="p-[10px_12px] rounded-lg bg-[var(--status-error-bg)] border border-solid border-red-500/30 flex items-center gap-2">
          <X size={14} className="text-red-500" />
          <span className="text-[12px] text-red-300 flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="p-1 px-1.5 rounded bg-transparent border-none text-red-300 text-[12px] cursor-pointer hover:bg-black/10 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {activeTab === "scheduled" && (
        <ScheduledJobsView
          jobs={jobs}
          isLoading={isLoading}
          palette={palette}
          automationEnabled={automationEnabled}
          onCreate={() => setShowCreateWizard(true)}
          onEdit={setEditingJob}
          onDelete={handleDeleteJob}
          onRunNow={handleRunNow}
          onToggle={handleToggleJob}
          onRefresh={loadJobs}
        />
      )}

      {activeTab === "history" && <JobHistoryView palette={palette} />}

      {activeTab === "config" && <AutomationConfigView palette={palette} />}

      <ConfirmModal
        isOpen={confirmDeleteJobId !== null}
        title="Delete Scheduled Job"
        message="Are you sure you want to delete this scheduled job?"
        confirmLabel="Delete"
        destructive
        onConfirm={() => confirmDeleteJobId && commitDeleteJob(confirmDeleteJobId)}
        onCancel={() => setConfirmDeleteJobId(null)}
      />
    </div>
  );
}

function ScheduledJobsView({
  jobs,
  isLoading,
  palette,
  automationEnabled,
  onCreate,
  onEdit,
  onDelete,
  onRunNow,
  onToggle,
  onRefresh,
}: any) {
  if (isLoading) {
    return (
      <div className="p-5 text-center text-[var(--text-secondary)]">
        <div className="text-[13px]">Loading scheduled jobs...</div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div
        className="p-5 rounded-xl bg-[var(--bg-card)] border border-solid border-[var(--palette-border)] text-center"
        style={{ '--palette-border': palette.border } as React.CSSProperties}
      >
        <Calendar size={24} className="mx-auto mb-2" style={{ color: palette.accent }} />
        <div className="text-[12px] text-[var(--text-secondary)] mb-2">
          No scheduled jobs configured
        </div>
        <button
          type="button"
          onClick={onCreate}
          disabled={!automationEnabled}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-solid text-[12px] font-bold transition-all",
            automationEnabled ? "bg-[var(--palette-soft)] border-[var(--palette-border)] text-[var(--palette-accent)] cursor-pointer" : "bg-[var(--surface-hover)] border-[var(--palette-border)] text-[#666] cursor-not-allowed"
          )}
          style={automationEnabled ? {
            '--palette-soft': palette.soft,
            '--palette-border': palette.border,
            '--palette-accent': palette.accent,
          } as React.CSSProperties : { '--palette-border': palette.border } as React.CSSProperties}
        >
          <Plus size={12} weight="bold" />
          Create Job
        </button>
        {!automationEnabled && (
          <div className="text-[12px] text-[var(--text-tertiary)] mt-2">
            Enable automation to create scheduled jobs
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-[var(--text-secondary)]">
          {jobs.filter((j: any) => j.status === "active").length} active
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-1 px-2 py-1 rounded-md border border-solid border-[var(--palette-border)] bg-transparent text-[var(--text-secondary)] text-[12px] cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
            style={{ '--palette-border': palette.border } as React.CSSProperties}
          >
            <ArrowCounterClockwise size={12} />
            Refresh
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={!automationEnabled}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-md border border-solid text-[12px] font-semibold transition-all",
              automationEnabled ? "bg-[var(--palette-soft)] border-[var(--palette-border)] text-[var(--palette-accent)] cursor-pointer hover:opacity-90" : "bg-[var(--surface-hover)] border-[var(--palette-border)] text-[#666] cursor-not-allowed"
            )}
            style={automationEnabled ? {
              '--palette-soft': palette.soft,
              '--palette-border': palette.border,
              '--palette-accent': palette.accent,
            } as React.CSSProperties : { '--palette-border': palette.border } as React.CSSProperties}
          >
            <Plus size={12} weight="bold" />
            New Job
          </button>
        </div>
      </div>

      {jobs.map((job: any) => (
        <JobCard
          key={job.id}
          job={job}
          palette={palette}
          automationEnabled={automationEnabled}
          onEdit={() => onEdit(job)}
          onDelete={() => onDelete(job.id)}
          onRunNow={() => onRunNow(job.id)}
          onToggle={() => onToggle(job)}
        />
      ))}
    </div>
  );
}

function JobCard({ job, palette, automationEnabled, onEdit, onDelete, onRunNow, onToggle }: any) {
  const isClient = useIsClient();
  const statusColors: any = {
    active: "#79C47C",
    paused: "#fbbf24",
    failed: "#ef4444",
  };

  const scheduleDescription = describeCronExpression(job.schedule);

  return (
    <div
      className="rounded-xl border border-solid border-[var(--palette-border)] bg-[var(--bg-card)] overflow-hidden"
      style={{ '--palette-border': palette.border } as React.CSSProperties}
    >
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar size={14} className="shrink-0" style={{ color: palette.accent }} />
            <span 
              className="text-[12px] font-semibold text-[var(--text-primary)] overflow-hidden text-ellipsis whitespace-nowrap"
              title={job.name}
            >
              {job.name}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onToggle}
              disabled={!automationEnabled}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-bold border-none transition-colors",
                automationEnabled ? "cursor-pointer" : "cursor-not-allowed"
              )}
              style={{
                background: `${statusColors[job.status]}20`,
                color: statusColors[job.status],
              }}
              title={automationEnabled ? "Click to toggle" : "Automation disabled"}
            >
              {job.status === "active" && <Play size={10} weight="fill" />}
              {job.status === "paused" && <Pause size={10} weight="fill" />}
              {job.status}
            </button>
          </div>
        </div>

        <div
          className="flex items-center gap-2 p-[6px_8px] bg-[var(--surface-hover)] rounded-md text-[12px] mb-2"
        >
          <span className="font-mono text-[var(--palette-accent)]"
            style={{ '--palette-accent': palette.accent } as React.CSSProperties}
          >{job.schedule}</span>
          <span className="text-[#666]">•</span>
          <span className="text-[var(--text-secondary)]">{scheduleDescription}</span>
        </div>

        <div className="flex flex-wrap gap-3 text-[12px] text-[var(--text-secondary)]">
          {job.runCount > 0 && (
            <span title="Total runs">{job.runCount} run{job.runCount !== 1 ? "s" : ""}</span>
          )}
          {job.lastRun && (
            <span title={`Last run: ${job.lastRun.toLocaleString()}`}>
              Last: {formatRelativeTime(job.lastRun, isClient)}
            </span>
          )}
          {job.nextRun && job.status === "active" && (
            <span className="text-[var(--palette-accent)]"
              style={{ '--palette-accent': palette.accent } as React.CSSProperties}
              title={`Next run: ${job.nextRun.toLocaleString()}`}
            >
              Next: {formatRelativeTime(job.nextRun, isClient)}
            </span>
          )}
          {job.lastError && (
            <span className="text-red-500" title={job.lastError}>
              Last failed
            </span>
          )}
        </div>

        {job.description && (
          <div className="mt-2 text-[12px] text-[var(--text-tertiary)] leading-relaxed">
            {job.description}
          </div>
        )}

        <div className="flex gap-1.5 mt-2.5">
          <ActionButton
            icon={<Play size={12} weight="bold" />}
            label="Run Now"
            onClick={onRunNow}
            disabled={!automationEnabled}
            palette={palette}
          />
          <ActionButton
            icon={<Pencil size={12} weight="bold" />}
            label="Edit"
            onClick={onEdit}
            disabled={!automationEnabled}
            palette={palette}
          />
          <ActionButton
            icon={<Trash size={12} weight="bold" />}
            label="Delete"
            onClick={onDelete}
            palette={palette}
            danger
          />
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  palette,
  danger,
}: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1 px-2.5 py-1 rounded-md border border-solid text-[12px] font-medium transition-all",
        disabled ? "bg-transparent border-[var(--palette-border)] text-[#666] cursor-not-allowed opacity-60" :
        danger ? "bg-[var(--status-error-bg)] border-red-500/30 text-red-500 cursor-pointer hover:opacity-90" :
        "bg-transparent border-[var(--palette-border)] text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--surface-hover)]"
      )}
      style={{ '--palette-border': palette.border } as React.CSSProperties}
    >
      {icon}
      {label}
    </button>
  );
}

function formatRelativeTime(date: Date, isClient: boolean): string {
  if (!isClient) return "…";
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (Math.abs(diffMins) < 60) {
    return diffMins > 0 ? `in ${diffMins}m` : `${Math.abs(diffMins)}m ago`;
  }
  if (Math.abs(diffHours) < 24) {
    return diffHours > 0 ? `in ${diffHours}h` : `${Math.abs(diffHours)}h ago`;
  }
  return diffDays > 0 ? `in ${diffDays}d` : `${Math.abs(diffDays)}d ago`;
}

function JobHistoryView({ palette }: { palette: SurfacePalette }) {
  const [history, setHistory] = useState<JobExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      setIsLoading(true);
      try {
        const executions = getExecutionHistory();
        setHistory(executions);
      } finally {
        setIsLoading(false);
      }
    };
    loadHistory();
  }, []);

  if (isLoading) {
    return (
      <div className="p-5 text-center text-[var(--text-secondary)]">
        <div className="text-[13px]">Loading execution history...</div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div
        className="p-5 rounded-xl bg-[var(--bg-card)] border border-solid border-[var(--palette-border)] text-center"
        style={{ '--palette-border': palette.border, '--palette-accent': palette.accent } as React.CSSProperties}
      >
        <ClockCounterClockwise size={24} className="mx-auto mb-2 text-[var(--palette-accent)]" />
        <div className="text-[12px] text-[var(--text-secondary)]">
          No execution history yet
        </div>
        <div className="text-[12px] text-[var(--text-tertiary)] mt-1">
          Job runs will be recorded here
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    completed: "#79C47C",
    failed: "#ef4444",
    running: "#3b82f6",
    cancelled: "#888",
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center px-1">
        <span className="text-[12px] text-[var(--text-secondary)]">
          Last {history.length} execution{history.length !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={() => {
            clearExecutionHistory();
            setHistory([]);
          }}
          className="text-[12px] text-[var(--text-tertiary)] bg-transparent border-none cursor-pointer hover:text-[var(--text-primary)] transition-colors"
        >
          Clear History
        </button>
      </div>
      {history.slice(0, 10).map((execution) => (
        <div
          key={execution.executionId}
          className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-solid border-[var(--palette-border)] flex items-center gap-2.5"
          style={{ '--palette-border': palette.border } as React.CSSProperties}
        >
          <div
            className="size-2 rounded-full shrink-0"
            style={{
              background: statusColors[execution.status] || "#888",
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-[var(--text-primary)] font-medium truncate">
              {execution.jobId}
            </div>
            <div className="text-[12px] text-[var(--text-tertiary)]">
              {new Date(execution.startedAt).toLocaleString()}
            </div>
          </div>
          <div
            className="px-2 py-0.5 rounded-full text-[12px] font-semibold uppercase shrink-0"
            style={{
              background: `${statusColors[execution.status] || "#888"}20`,
              color: statusColors[execution.status] || "#888",
            }}
          >
            {execution.status}
          </div>
        </div>
      ))}
    </div>
  );
}

function AutomationConfigView({ palette }: { palette: SurfacePalette }) {
  const { isRunning, start, stop } = useJobRunner();

  return (
    <div className="flex flex-col gap-2.5">
      <MetaCard
        accent={palette.accent}
        label="Execution Mode"
        value="Native agent session with durable state"
      />
      <MetaCard
        accent={palette.accent}
        label="Persistence"
        value="Session state is saved automatically"
      />
      <MetaCard
        accent={palette.accent}
        label="Scheduling Backend"
        value="Runtime-managed (when enabled)"
      />
      <MetaCard
        accent={palette.accent}
        label="Job Runner"
        value={isRunning ? "Running (polling every 60s)" : "Stopped"}
      />

      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={() => start()}
          disabled={isRunning}
          className={cn(
            "flex-1 py-2 px-3 rounded-lg border border-solid text-[12px] font-semibold transition-all",
            isRunning ? "bg-[var(--surface-hover)] border-[var(--ui-border-default)] text-[#666] cursor-not-allowed" : "bg-[#79C47C]/15 border-[#79C47C]/30 text-[#79C47C] cursor-pointer hover:bg-[#79C47C]/25"
          )}
        >
          {isRunning ? "Runner Active" : "Start Runner"}
        </button>
        <button
          type="button"
          onClick={() => stop()}
          disabled={!isRunning}
          className={cn(
            "flex-1 py-2 px-3 rounded-lg border border-solid text-[12px] font-semibold transition-all",
            !isRunning ? "bg-[var(--surface-hover)] border-[var(--ui-border-default)] text-[#666] cursor-not-allowed" : "bg-[var(--status-error-bg)] border-red-500/30 text-red-500 cursor-pointer hover:opacity-90"
          )}
        >
          Stop Runner
        </button>
      </div>

      <div
        className="mt-2 p-2.5 rounded-[10px] bg-[var(--surface-hover)] border border-solid border-[var(--palette-border)] text-[12px] text-[var(--text-secondary)] leading-relaxed"
        style={{ '--palette-border': palette.border } as React.CSSProperties}
      >
        The job runner polls for due jobs every minute and executes them via native agent sessions. 
        Enable automation to allow scheduled jobs and background tasks.
      </div>
    </div>
  );
}
