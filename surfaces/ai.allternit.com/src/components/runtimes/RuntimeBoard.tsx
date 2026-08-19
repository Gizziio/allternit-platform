'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Cpu,
  Circle,
  WifiHigh,
  WifiSlash,
  ClockCounterClockwise,
  Play,
  Square,
  Terminal,
  Paperclip,
  X,
} from '@phosphor-icons/react';
import { GlassSurface } from '@/design/GlassSurface';
import { useToast } from '@/hooks/use-toast';
import { AgentCliBadge } from './AgentCliBadge';
import {
  RuntimeClient,
  type RegisteredRuntime,
  type ExecutionLog,
  type AgentEvent,
  type RuntimeClientOptions,
  type AgentTask,
} from '@allternit/sdk/runtime';

export interface RuntimeBoardProps {
  /** Base URL of the runtime API. Defaults to the platform API at /api/v1/runtime. */
  baseUrl?: string;
  /** When true, baseUrl points at a gizzi-code runtime directly (uses /v1/runtime). */
  direct?: boolean;
  /** Optional token provider for authenticated requests. */
  getToken?: () => Promise<string | null | undefined>;
}

const STATUS_COLORS: Record<string, string> = {
  online: 'var(--status-success)',
  busy: 'var(--status-warning)',
  offline: 'var(--ui-text-muted)',
};

export function RuntimeBoard({ baseUrl, direct, getToken }: RuntimeBoardProps) {
  const { addToast } = useToast();
  const client = useMemo(() => {
    const opts: RuntimeClientOptions = {
      baseUrl: baseUrl ?? '',
      direct: direct ?? false,
      getToken,
    };
    return new RuntimeClient(opts);
  }, [baseUrl, direct, getToken]);

  const [runtimes, setRuntimes] = useState<RegisteredRuntime[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRuntimeId, setSelectedRuntimeId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [streamEvents, setStreamEvents] = useState<AgentEvent[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchRuntimes = useCallback(async () => {
    try {
      const { runtimes: data } = await client.listRuntimes();
      setRuntimes(data);
      if (selectedRuntimeId && !data.find((r) => r.id === selectedRuntimeId)) {
        setSelectedRuntimeId(null);
      }
    } catch {
      addToast({ title: 'Error', description: 'Failed to load runtimes', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [client, addToast, selectedRuntimeId]);

  useEffect(() => {
    void fetchRuntimes();
    const interval = setInterval(fetchRuntimes, 10000);
    return () => clearInterval(interval);
  }, [fetchRuntimes]);

  const selectedRuntime = useMemo(
    () => runtimes.find((r) => r.id === selectedRuntimeId),
    [runtimes, selectedRuntimeId]
  );

  const fetchLogs = useCallback(async () => {
    if (!selectedRuntimeId) return;
    setLogsLoading(true);
    try {
      const { logs: data } = await client.listLogs(selectedRuntimeId, 20);
      setLogs(data);
    } catch {
      addToast({ title: 'Error', description: 'Failed to load execution logs', type: 'error' });
    } finally {
      setLogsLoading(false);
    }
  }, [client, selectedRuntimeId, addToast]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  async function fileToAttachment(file: File): Promise<{ filename: string; mimeType: string; content: string | Uint8Array }> {
    const isText = file.type.startsWith('text/') || file.name.endsWith('.txt');
    if (isText) {
      const text = await file.text();
      return { filename: file.name, mimeType: file.type || 'text/plain', content: text };
    }
    const buffer = await file.arrayBuffer();
    return {
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      content: new Uint8Array(buffer),
    };
  }

  async function runTask(cliName: string) {
    if (!selectedRuntimeId || !prompt.trim()) return;
    setRunning(true);
    setStreamEvents([]);
    try {
      const taskAttachments = attachments.length > 0 ? await Promise.all(attachments.map(fileToAttachment)) : undefined;
      const { handle } = await client.assignTask(selectedRuntimeId, cliName, {
        prompt: prompt.trim(),
        attachments: taskAttachments,
      });
      setAttachments([]);
      addToast({ title: 'Running', description: `Task ${handle.taskId.slice(0, 8)} started`, type: 'info' });
      for await (const event of client.streamTask(handle.runtimeId, handle.taskId)) {
        setStreamEvents((prev) => [...prev, event]);
      }
      addToast({ title: 'Done', description: 'Task finished', type: 'success' });
    } catch (err) {
      addToast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Task failed',
        type: 'error',
      });
    } finally {
      setRunning(false);
      void fetchLogs();
    }
  }

  function renderEvent(event: AgentEvent): string {
    switch (event.type) {
      case 'text_delta':
        return event.delta;
      case 'tool_call':
        return `\n[tool_call ${event.name}]\n`;
      case 'tool_result':
        return `\n[tool_result ${event.isError ? 'error' : 'ok'}]\n`;
      case 'status':
        return `\n[status: ${event.status}]\n`;
      case 'finish':
        return `\n[finish: ${event.finishReason}]\n`;
      case 'error':
        return `\n[error: ${String(event.error)}]\n`;
      default:
        return '';
    }
  }

  return (
    <div style={{ padding: 'var(--spacing-lg)', height: '100%', overflow: 'auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacing-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <Cpu size={24} color="#3b82f6" />
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600 }}>
            Agent Runtimes
          </h2>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          Loading runtimes…
        </div>
      ) : runtimes.length === 0 ? (
        <div style={{ color: 'var(--text-tertiary)', fontSize: '14px', textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          <Cpu size={48} style={{ opacity: 0.3, marginBottom: 'var(--spacing-md)' }} />
          <p>No agent runtimes registered yet.</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 'var(--spacing-lg)',
          }}
        >
          {runtimes.map((rt) => (
            <GlassSurface
              key={rt.id}
              onClick={() => setSelectedRuntimeId(rt.id)}
              style={{
                padding: 'var(--spacing-md)',
                cursor: 'pointer',
                border:
                  selectedRuntimeId === rt.id
                    ? '1px solid var(--accent-primary)'
                    : '1px solid transparent',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 'var(--spacing-md)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  <Circle size={12} weight="fill" color={STATUS_COLORS[rt.status] ?? STATUS_COLORS.offline} />
                  <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>
                    {rt.name}
                  </h3>
                </div>
                {rt.status === 'online' ? (
                  <WifiHigh size={16} color="#22c55e" />
                ) : (
                  <WifiSlash size={16} color="#6b7280" />
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{rt.host}</div>
                {rt.lastHeartbeatAt && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    <ClockCounterClockwise size={11} />
                    Last heartbeat: {new Date(rt.lastHeartbeatAt).toLocaleString()}
                  </div>
                )}
                {rt.agentClis.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {rt.agentClis.map((cli) => (
                      <AgentCliBadge key={cli.name} name={cli.name} icon={cli.icon} size={18} />
                    ))}
                  </div>
                )}
              </div>
            </GlassSurface>
          ))}
        </div>
      )}

      {selectedRuntime && (
        <GlassSurface style={{ marginTop: 'var(--spacing-lg)', padding: 'var(--spacing-md)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--spacing-md)',
            }}
          >
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>
              {selectedRuntime.name}
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              {selectedRuntime.status}
            </span>
          </div>

          {selectedRuntime.status !== 'offline' && selectedRuntime.agentClis.length > 0 && (
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Quick task
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                <input
                  aria-label="Prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={`Ask ${selectedRuntime.agentClis[0]?.name}…`}
                  disabled={running}
                  style={{
                    flex: 1,
                    minWidth: 240,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                />
                <input
                  ref={fileInputRef}
                  aria-label="Attach files"
                  type="file"
                  multiple
                  accept="text/*,image/*,.txt,.md,.json,.yaml,.yml"
                  onChange={(e) => {
                    if (e.currentTarget.files) {
                      setAttachments((prev) => [...prev, ...Array.from(e.currentTarget.files!)]);
                    }
                    e.currentTarget.value = '';
                  }}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  disabled={running}
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach files"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: running ? 'not-allowed' : 'pointer',
                    opacity: running ? 0.5 : 1,
                  }}
                >
                  <Paperclip size={16} />
                  {attachments.length > 0 && (
                    <span style={{ fontSize: '11px', marginLeft: '2px' }}>{attachments.length}</span>
                  )}
                </button>
                {selectedRuntime.agentClis.map((cli) => (
                  <button
                    key={cli.name}
                    type="button"
                    disabled={running || !prompt.trim()}
                    onClick={() => void runTask(cli.name)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: 'var(--status-info)',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: running ? 'not-allowed' : 'pointer',
                      opacity: running || !prompt.trim() ? 0.5 : 1,
                    }}
                  >
                    {running ? <Square size={14} weight="fill" /> : <Play size={14} weight="fill" />}
                    {cli.name}
                  </button>
                ))}
              </div>
              {attachments.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                  {attachments.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <Paperclip size={12} />
                      <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                        title="Remove attachment"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '2px',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-tertiary)',
                          cursor: 'pointer',
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {streamEvents.length > 0 && (
            <div
              style={{
                marginBottom: 'var(--spacing-md)',
                padding: 'var(--spacing-sm)',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-secondary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                maxHeight: 240,
                overflow: 'auto',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: 'var(--text-tertiary)' }}>
                <Terminal size={14} />
                Live output
              </div>
              {streamEvents.map((event, index) => (
                <span key={index}>{renderEvent(event)}</span>
              ))}
            </div>
          )}

          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Recent execution logs
            </div>
            {logsLoading ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Loading logs…</div>
            ) : logs.length === 0 ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>No recent tasks.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {logs.map((log) => (
                  <div
                    key={log.taskId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-secondary)',
                      fontSize: '13px',
                    }}
                  >
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {log.taskId.slice(0, 8)}
                    </span>
                    <AgentCliBadge name={log.cliName} icon={log.cliName} size={16} />
                    <span
                      style={{
                        color: STATUS_COLORS[log.status] ?? STATUS_COLORS.offline,
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      {log.status}
                    </span>
                    {log.finishedAt && (
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
                        {new Date(log.finishedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassSurface>
      )}
    </div>
  );
}
