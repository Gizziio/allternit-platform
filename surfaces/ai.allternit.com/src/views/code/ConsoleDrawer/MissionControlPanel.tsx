import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RocketLaunch,
  GitBranch,
  Square,
  Warning,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Cpu,
  FileText,
  Link as LinkIcon,
  Scroll,
  FloppyDisk,
  ArrowRight,
  GitDiff,
  Package,
  Terminal as TerminalIcon,
} from '@phosphor-icons/react';
import { useUnifiedStore } from '@/lib/agents/unified.store';
import { API_BASE_URL } from '@/lib/agents/api-config';
import { execEvents } from '@/integration/execution/exec.events';
import { artifactFromReference, type CodeArtifact } from '../artifacts';
import type { CodeWorkspaceRecord } from '../CodeModeStore';
import type { DrawerTabId } from './DrawerTabs';

interface MissionControlPanelProps {
  sessionId?: string;
  sessionName?: string;
  workspace?: CodeWorkspaceRecord | null;
  onOpenTab?: (tab: DrawerTabId) => void;
}

interface GitStats {
  additions: number;
  deletions: number;
}

interface ProgressItem {
  id: string;
  type: 'execution' | 'log' | 'artifact';
  title: string;
  subtitle?: string;
  timestamp: number;
  status?: 'success' | 'warning' | 'error' | 'info';
  artifacts: number;
  logs: number;
  links: number;
  runId?: string;
}

const MISSION_BG = 'var(--surface-canvas)';
const MISSION_SURFACE = 'var(--surface-panel)';
const AMBER = 'var(--accent-mission, var(--status-warning))';
const CYAN = 'var(--accent-code, var(--status-info))';
const TEXT_PRIMARY = 'var(--text-primary)';
const TEXT_SECONDARY = 'var(--text-secondary)';
const TEXT_TERTIARY = 'var(--text-tertiary)';
const BORDER = 'var(--border-subtle)';

function formatEta(minutes: number): string {
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `~${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'completed':
    case 'closed':
    case 'success':
      return 'var(--status-success)';
    case 'failed':
    case 'error':
    case 'blocked':
      return 'var(--status-error)';
    case 'running':
    case 'in_progress':
    case 'signed':
      return AMBER;
    case 'ready':
      return CYAN;
    default:
      return TEXT_TERTIARY;
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

async function fetchGitStats(workingDir?: string): Promise<GitStats | null> {
  if (!workingDir) return null;
  try {
    const response = await fetch(`${API_BASE_URL}/git/diff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: workingDir, staged: false }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { files?: Array<{ diff: string }> };
    let additions = 0;
    let deletions = 0;
    for (const file of data.files ?? []) {
      for (const line of file.diff.split('\n')) {
        if (line.startsWith('+') && !line.startsWith('+++')) additions += 1;
        if (line.startsWith('-') && !line.startsWith('---')) deletions += 1;
      }
    }
    return { additions, deletions };
  } catch {
    return null;
  }
}

export function MissionControlPanel({
  sessionId,
  sessionName,
  workspace,
  onOpenTab,
}: MissionControlPanelProps): React.ReactNode {
  const wihs = useUnifiedStore((state) => state.wihs);
  const executions = useUnifiedStore((state) => state.executions);
  const logs = useUnifiedStore((state) => state.logs);
  const receipts = useUnifiedStore((state) => state.receipts);
  const health = useUnifiedStore((state) => state.health);
  const fetchWihs = useUnifiedStore((state) => state.fetchWihs);
  const fetchLedgerEvents = useUnifiedStore((state) => state.fetchLedgerEvents);
  const fetchReceipts = useUnifiedStore((state) => state.fetchReceipts);
  const checkHealth = useUnifiedStore((state) => state.checkHealth);
  const closeWih = useUnifiedStore((state) => state.closeWih);

  const [runArtifacts, setRunArtifacts] = useState<CodeArtifact[]>([]);
  const [gitStats, setGitStats] = useState<GitStats | null>(null);
  const [closing, setClosing] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = execEvents.subscribe('onRunComplete', (result) => {
      if (!result.artifacts?.length) return;
      setRunArtifacts((current) => {
        const next = result.artifacts!.map((reference) => artifactFromReference(reference, result.runId));
        return [...current.filter((item) => !next.some((candidate) => candidate.id === item.id)), ...next];
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    void fetchWihs();
    void fetchLedgerEvents(50);
    void fetchReceipts();
    void checkHealth();
    void fetchGitStats(workspace?.root_path).then(setGitStats);

    const timer = window.setInterval(() => {
      void fetchWihs();
      void fetchLedgerEvents(50);
      void fetchReceipts();
      void checkHealth();
      void fetchGitStats(workspace?.root_path).then(setGitStats);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [checkHealth, fetchLedgerEvents, fetchReceipts, fetchWihs, workspace?.root_path]);

  const receiptArtifacts = useMemo<CodeArtifact[]>(() => {
    return receipts.flatMap((receipt) => {
      const payload = receipt.payload;
      if (!payload || typeof payload !== 'object') return [];
      const record = payload as Record<string, unknown>;
      const references = [record.artifact, record.artifact_url, record.path, record.file]
        .filter((value): value is string => typeof value === 'string');
      return references.map((reference) => ({
        ...artifactFromReference(reference, receipt.run_id),
        id: `${receipt.receipt_id}:${reference}`,
        source: 'receipt' as const,
        receiptId: receipt.receipt_id,
        createdAt: new Date(receipt.timestamp).getTime(),
        metadata: { receipt_kind: receipt.kind },
      }));
    });
  }, [receipts]);

  const allArtifacts = useMemo(
    () => [...runArtifacts, ...receiptArtifacts].sort((a, b) => b.createdAt - a.createdAt),
    [receiptArtifacts, runArtifacts]
  );

  const handleCompleteWih = useCallback(
    async (wihId: string) => {
      setClosing((prev) => new Set(prev).add(wihId));
      try {
        await closeWih(wihId, 'completed');
        await fetchWihs();
      } finally {
        setClosing((prev) => {
          const next = new Set(prev);
          next.delete(wihId);
          return next;
        });
      }
    },
    [closeWih, fetchWihs]
  );

  const openWihs = useMemo(
    () => wihs.filter((w) => ['open', 'ready', 'signed', 'in_progress', 'blocked'].includes(w.status)),
    [wihs]
  );
  const completedWihs = useMemo(() => wihs.filter((w) => w.status === 'closed'), [wihs]);

  const estimatedMinutesRemaining = useMemo(() => {
    return openWihs.reduce((sum, w) => {
      const base = w.status === 'open' ? 8 : w.status === 'ready' ? 6 : w.status === 'signed' || w.status === 'in_progress' ? 12 : 4;
      return sum + base;
    }, 0);
  }, [openWihs]);

  const roadmapVisible = openWihs.slice(0, 8);
  const roadmapHidden = Math.max(0, openWihs.length - roadmapVisible.length);

  const progressItems = useMemo<ProgressItem[]>(() => {
    const items: ProgressItem[] = [];
    for (const execution of executions.slice().sort((a, b) => b.startedAt - a.startedAt).slice(0, 6)) {
      const runArtifacts = allArtifacts.filter((a) => a.runId === execution.runId);
      const runLogs = logs.filter((l) => l.runId === execution.runId);
      items.push({
        id: `run:${execution.runId}`,
        type: 'execution',
        title: `Run ${execution.runId.slice(0, 8)}`,
        subtitle: `${execution.status} · ${execution.progress}%`,
        timestamp: execution.startedAt,
        status: execution.status === 'completed' ? 'success' : execution.status === 'failed' ? 'error' : 'warning',
        artifacts: runArtifacts.length,
        logs: runLogs.length,
        links: runArtifacts.filter((a) => a.uri && /^https?:\/\//.test(a.uri)).length,
        runId: execution.runId,
      });
    }
    for (const log of logs.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, 10)) {
      items.push({
        id: `log:${log.id}`,
        type: 'log',
        title: log.message,
        subtitle: `${log.source} · ${log.level}`,
        timestamp: log.timestamp,
        status: log.level === 'error' ? 'error' : log.level === 'warn' ? 'warning' : 'info',
        artifacts: 0,
        logs: 1,
        links: 0,
        runId: log.runId,
      });
    }
    for (const artifact of allArtifacts.slice(0, 8)) {
      items.push({
        id: `artifact:${artifact.id}`,
        type: 'artifact',
        title: artifact.name,
        subtitle: `${artifact.kind} · ${artifact.source}`,
        timestamp: artifact.createdAt,
        status: 'success',
        artifacts: 1,
        logs: 0,
        links: artifact.uri && /^https?:\/\//.test(artifact.uri) ? 1 : 0,
        runId: artifact.runId,
      });
    }
    return items
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 12);
  }, [allArtifacts, executions, logs]);

  const progressHidden = Math.max(0, executions.length + logs.length + allArtifacts.length - progressItems.length);

  const title = sessionName || workspace?.display_name || sessionId || 'Code Session';

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: MISSION_BG,
        color: TEXT_PRIMARY,
        fontSize: 13,
      }}
    >
      <div
        style={{
          minHeight: 58,
          padding: '9px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          borderBottom: `1px solid ${BORDER}`,
          background: MISSION_SURFACE,
          backdropFilter: 'blur(18px) saturate(150%)',
          WebkitBackdropFilter: 'blur(18px) saturate(150%)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 210, flex: '1 1 260px' }}>
          <span
            style={{
              width: 32,
              height: 32,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 8,
              border: '1px solid color-mix(in srgb, var(--accent-mission, var(--status-warning)) 28%, var(--border-subtle))',
              background: 'color-mix(in srgb, var(--accent-mission, var(--status-warning)) 10%, var(--surface-panel))',
              boxShadow: 'var(--shadow-sm)',
              flexShrink: 0,
            }}
          >
            <RocketLaunch size={16} color={AMBER} weight="fill" />
          </span>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, minWidth: 0 }}>
              {workspace?.repo_status?.branch && (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 10,
                    color: TEXT_SECONDARY,
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <GitBranch size={11} />
                  {workspace.repo_status.branch}
                </span>
              )}
              {workspace?.repo_status?.last_commit && (
                <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: 'var(--font-mono)' }}>
                  {workspace.repo_status.last_commit.slice(0, 7)}
                </span>
              )}
              {workspace?.root_path && (
                <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {workspace.root_path.split('/').pop()}
                </span>
              )}
              {!workspace && <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>No workspace selected</span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <TelemetryPill
              icon={<Clock size={11} color={AMBER} />}
              label="ETA"
              value={estimatedMinutesRemaining > 0 ? formatEta(estimatedMinutesRemaining) : '—'}
              valueColor={AMBER}
            />
            <TelemetryPill
              icon={<span style={{ color: 'var(--status-success)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>+</span>}
              label="ADD"
              value={gitStats ? String(gitStats.additions) : '—'}
              valueColor="var(--status-success)"
            />
            <TelemetryPill
              icon={<span style={{ color: 'var(--status-error)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>−</span>}
              label="DEL"
              value={gitStats ? String(gitStats.deletions) : '—'}
              valueColor="var(--status-error)"
            />
            <TelemetryPill
              icon={<Cpu size={11} color={health.rails && health.gateway ? CYAN : 'var(--status-error)'} />}
              label="SYS"
              value={health.rails && health.gateway ? 'READY' : 'CHECK'}
              valueColor={health.rails && health.gateway ? CYAN : 'var(--status-error)'}
            />
          </div>
          <div style={{ width: 1, height: 22, background: BORDER, margin: '0 2px' }} />
          <MissionAction label="Terminal" icon={<TerminalIcon size={12} />} onClick={() => onOpenTab?.('terminal')} />
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))',
          gap: 10,
          padding: 10,
          overflow: 'auto',
        }}
      >
        <div
          style={{
            minHeight: 155,
            display: 'flex',
            flexDirection: 'column',
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            background: MISSION_SURFACE,
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <PanelHeader
            title="Roadmap"
            detail={`${completedWihs.length}/${wihs.length} complete`}
            action={<MissionAction compact label="Changes" icon={<GitDiff size={11} />} onClick={() => onOpenTab?.('changes')} />}
          />
          <div style={{ flex: 1, overflow: 'auto', padding: 6 }}>
            {roadmapVisible.length === 0 ? (
              <EmptyPanel
                icon={<Square size={17} />}
                title="Roadmap is clear"
                description="Active work items will appear here as the session plans and executes."
              />
            ) : (
              roadmapVisible.map((wih) => {
                const isClosing = closing.has(wih.wih_id);
                return (
                  <button
                    type="button"
                    key={wih.wih_id}
                    disabled={isClosing || wih.status === 'blocked'}
                    onClick={() => handleCompleteWih(wih.wih_id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '7px 8px',
                      marginBottom: 3,
                      borderRadius: 7,
                      border: '1px solid transparent',
                      background: 'transparent',
                      color: TEXT_PRIMARY,
                      textAlign: 'left',
                      cursor: wih.status === 'blocked' ? 'not-allowed' : 'pointer',
                      opacity: isClosing ? 0.5 : 1,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (wih.status !== 'blocked') e.currentTarget.style.background = 'var(--surface-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {wih.status === 'blocked' ? (
                      <Warning size={16} color="var(--status-error)" style={{ marginTop: 2, flexShrink: 0 }} />
                    ) : (
                      <span style={{ marginTop: 2, flexShrink: 0, color: statusColor(wih.status) }}>
                        <Square size={16} weight="regular" />
                      </span>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {wih.title || wih.wih_id}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <StatusBadge status={wih.status} />
                        {wih.assignee && (
                          <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>@{wih.assignee}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
            {roadmapHidden > 0 && (
              <div style={{ padding: '6px 10px', fontSize: 11, color: TEXT_TERTIARY }}>
                +{roadmapHidden} more todos
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            minHeight: 155,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            background: MISSION_SURFACE,
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <PanelHeader
            title="Activity"
            detail={`${executions.length} runs · ${logs.length} logs · ${allArtifacts.length} outputs`}
            action={<MissionAction compact label="Artifacts" icon={<Package size={11} />} onClick={() => onOpenTab?.('artifacts')} />}
          />
          <div style={{ flex: 1, overflow: 'auto', padding: 6 }}>
            {progressItems.length === 0 ? (
              <EmptyPanel
                icon={<Scroll size={17} />}
                title="Waiting for activity"
                description="Runs, logs, and generated outputs will stream into this timeline."
              />
            ) : (
              progressItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    if (item.type === 'artifact') onOpenTab?.('artifacts');
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '7px 8px',
                    marginBottom: 3,
                    borderRadius: 7,
                    border: '1px solid transparent',
                    background: 'transparent',
                    color: TEXT_PRIMARY,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <ProgressIcon type={item.type} status={item.status} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>
                      {item.subtitle && (
                        <span style={{ fontSize: 10, color: TEXT_SECONDARY }}>{item.subtitle}</span>
                      )}
                      <EvidenceCounts artifacts={item.artifacts} logs={item.logs} links={item.links} />
                    </div>
                  </div>
                </button>
              ))
            )}
            {progressHidden > 0 && (
              <div style={{ padding: '6px 10px', fontSize: 11, color: TEXT_TERTIARY }}>
                +{progressHidden} more entries
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelHeader({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: 38,
        padding: '0 9px 0 11px',
        borderBottom: `1px solid ${BORDER}`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: TEXT_SECONDARY }}>
        {title}
      </span>
      <span style={{ fontSize: 9, color: TEXT_TERTIARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {detail}
      </span>
      <span style={{ flex: 1 }} />
      {action}
    </div>
  );
}

function EmptyPanel({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        height: '100%',
        minHeight: 105,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 14,
        color: TEXT_TERTIARY,
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          display: 'grid',
          placeItems: 'center',
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          background: 'var(--surface-panel-muted)',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ minWidth: 0, maxWidth: 290 }}>
        <span style={{ display: 'block', fontSize: 11, fontWeight: 650, color: TEXT_SECONDARY }}>{title}</span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 10, lineHeight: 1.45 }}>{description}</span>
      </span>
    </div>
  );
}

function MissionAction({
  label,
  icon,
  onClick,
  compact = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: compact ? 24 : 28,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: compact ? '0 7px' : '0 9px',
        border: `1px solid ${BORDER}`,
        borderRadius: 6,
        background: 'var(--surface-hover)',
        color: TEXT_SECONDARY,
        fontSize: compact ? 9 : 10,
        fontWeight: 650,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
      {!compact && <ArrowRight size={10} />}
    </button>
  );
}

function TelemetryPill({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        height: 28,
        padding: '0 7px',
        borderRadius: 6,
        border: `1px solid ${BORDER}`,
        background: 'var(--surface-panel-muted)',
      }}
    >
      {icon}
      <span style={{ fontSize: 8, fontWeight: 750, letterSpacing: '0.07em', color: TEXT_TERTIARY }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 750, color: valueColor, fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: statusColor(status),
        padding: '2px 5px',
        borderRadius: 4,
        background: `color-mix(in srgb, ${statusColor(status)} 12%, var(--surface-panel))`,
      }}
    >
      {statusLabel(status)}
    </span>
  );
}

function ProgressIcon({ type, status }: { type: ProgressItem['type']; status?: ProgressItem['status'] }) {
  const color = status ? statusColor(status) : TEXT_SECONDARY;
  if (type === 'execution') {
    if (status === 'success') return <CheckCircle size={16} color={color} weight="fill" />;
    if (status === 'error') return <XCircle size={16} color={color} weight="fill" />;
    return <Play size={16} color={color} weight="fill" />;
  }
  if (type === 'log') return <Scroll size={16} color={color} />;
  return <FloppyDisk size={16} color={color} />;
}

function EvidenceCounts({ artifacts, logs, links }: { artifacts: number; logs: number; links: number }) {
  if (artifacts === 0 && logs === 0 && links === 0) return null;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: TEXT_TERTIARY }}>
      {artifacts > 0 && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <FileText size={10} />
          {artifacts}
        </span>
      )}
      {logs > 0 && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Scroll size={10} />
          {logs}
        </span>
      )}
      {links > 0 && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <LinkIcon size={10} />
          {links}
        </span>
      )}
    </span>
  );
}
