'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner, PaperPlaneRight, Circle, Pause, Check, X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  createRemoteControlClient,
  type RemoteSessionWithStatus,
  type RemoteSessionDetail,
  type RemoteControlEvent,
  type RemotePermissionRequest,
  type RemoteQuestionRequest,
} from '@/lib/dispatch/remote-control';

export interface RemoteSessionPanelProps {
  runtimeId: string;
  getToken: () => Promise<string | null>;
  baseUrl?: string;
  direct?: boolean;
}

export function RemoteSessionPanel({ runtimeId, getToken, baseUrl, direct }: RemoteSessionPanelProps) {
  const { addToast } = useToast();
  const client = useMemo(
    () => createRemoteControlClient({ runtimeId, getToken, baseUrl, direct }),
    [runtimeId, getToken, baseUrl, direct]
  );

  const [sessions, setSessions] = useState<RemoteSessionWithStatus[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RemoteSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [sending, setSending] = useState(false);
  const [events, setEvents] = useState<RemoteControlEvent[]>([]);
  const [pendingPermissions, setPendingPermissions] = useState<RemotePermissionRequest[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<RemoteQuestionRequest[]>([]);
  const [permissionLoading, setPermissionLoading] = useState<Record<string, boolean>>({});
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string[][]>>({});

  const fetchSessions = useCallback(async () => {
    try {
      const data = await client.listSessions();
      setSessions(data);
    } catch {
      addToast({ title: 'Error', description: 'Failed to load remote sessions', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [client, addToast]);

  useEffect(() => {
    void fetchSessions();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const fetchPendingActions = useCallback(async () => {
    try {
      const [permissions, questions] = await Promise.all([
        client.listPendingPermissions(),
        client.listPendingQuestions(),
      ]);
      setPendingPermissions(permissions);
      setPendingQuestions(questions);
    } catch {
      // Silent: pending actions are polled frequently.
    }
  }, [client]);

  useEffect(() => {
    void fetchPendingActions();
    const interval = setInterval(fetchPendingActions, 3000);
    return () => clearInterval(interval);
  }, [fetchPendingActions]);

  const fetchDetail = useCallback(async () => {
    if (!selectedSessionId) return;
    setDetailLoading(true);
    try {
      const data = await client.getSession(selectedSessionId);
      setDetail(data);
    } catch {
      addToast({ title: 'Error', description: 'Failed to load session details', type: 'error' });
    } finally {
      setDetailLoading(false);
    }
  }, [client, selectedSessionId, addToast]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    if (!selectedSessionId) return;
    setEvents([]);
    const iterator = client.streamEvents(selectedSessionId);
    let active = true;

    void (async () => {
      try {
        for await (const event of iterator) {
          if (!active) break;
          setEvents((prev) => [...prev, event]);
          if (event.type === 'permission.asked') {
            setPendingPermissions((prev) => {
              if (prev.some((p) => p.id === event.properties.id)) return prev;
              return [...prev, event.properties];
            });
          }
          if (event.type === 'question.asked') {
            setPendingQuestions((prev) => {
              if (prev.some((q) => q.id === event.properties.id)) return prev;
              return [...prev, event.properties];
            });
          }
        }
      } catch {
        if (active) {
          addToast({ title: 'Error', description: 'Session event stream disconnected', type: 'error' });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [client, selectedSessionId, addToast]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.session.id === selectedSessionId),
    [sessions, selectedSessionId]
  );

  async function handleSend() {
    if (!selectedSessionId || !composerText.trim()) return;
    setSending(true);
    try {
      await client.sendMessage(selectedSessionId, { text: composerText.trim() });
      setComposerText('');
    } catch {
      addToast({ title: 'Error', description: 'Failed to send message', type: 'error' });
    } finally {
      setSending(false);
    }
  }

  async function handleAbort() {
    if (!selectedSessionId) return;
    try {
      await client.abortSession(selectedSessionId);
    } catch {
      addToast({ title: 'Error', description: 'Failed to abort session', type: 'error' });
    }
  }

  async function handlePermissionReply(requestID: string, reply: 'once' | 'always' | 'reject') {
    setPermissionLoading((prev) => ({ ...prev, [requestID]: true }));
    try {
      await client.replyPermission(requestID, reply);
      setPendingPermissions((prev) => prev.filter((p) => p.id !== requestID));
    } catch {
      addToast({ title: 'Error', description: 'Failed to reply to permission', type: 'error' });
    } finally {
      setPermissionLoading((prev) => ({ ...prev, [requestID]: false }));
    }
  }

  async function handleQuestionReply(requestID: string) {
    const answers = questionAnswers[requestID] ?? [];
    try {
      await client.replyQuestion(requestID, answers);
      setPendingQuestions((prev) => prev.filter((q) => q.id !== requestID));
      setQuestionAnswers((prev) => {
        const next = { ...prev };
        delete next[requestID];
        return next;
      });
    } catch {
      addToast({ title: 'Error', description: 'Failed to reply to question', type: 'error' });
    }
  }

  async function handleQuestionReject(requestID: string) {
    try {
      await client.rejectQuestion(requestID);
      setPendingQuestions((prev) => prev.filter((q) => q.id !== requestID));
    } catch {
      addToast({ title: 'Error', description: 'Failed to reject question', type: 'error' });
    }
  }

  const sessionPermissions = useMemo(
    () => pendingPermissions.filter((p) => p.sessionID === selectedSessionId),
    [pendingPermissions, selectedSessionId]
  );
  const sessionQuestions = useMemo(
    () => pendingQuestions.filter((q) => q.sessionID === selectedSessionId),
    [pendingQuestions, selectedSessionId]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-tertiary)]">
        <Spinner className="animate-spin mr-2" size={20} />
        Loading sessions…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[400px] border border-[var(--border-default)] rounded-2xl overflow-hidden bg-[var(--bg-elevated)]">
      {/* Session list */}
      <div className="w-64 border-r border-[var(--border-default)] flex flex-col">
        <div className="px-4 py-3 border-b border-[var(--border-default)] text-sm font-medium text-[var(--text-primary)]">
          Active Sessions
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 && (
            <div className="px-4 py-6 text-sm text-[var(--text-tertiary)]">No active sessions on this runtime.</div>
          )}
          {sessions.map(({ session, status }) => (
            <button
              key={session.id}
              type="button"
              onClick={() => setSelectedSessionId(session.id)}
              className={cn(
                'w-full text-left px-4 py-3 border-b border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors',
                selectedSessionId === session.id && 'bg-[var(--surface-hover)]'
              )}
            >
              <div className="text-sm font-medium text-[var(--text-primary)] truncate">{session.title}</div>
              <div className="flex items-center gap-2 mt-1">
                <StatusDot status={status.type} />
                <span className="text-xs text-[var(--text-tertiary)] capitalize">{status.type}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail / composer */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedSession ? (
          <div className="flex-1 flex items-center justify-center text-sm text-[var(--text-tertiary)]">
            Select a session to remote control it.
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {selectedSession.session.title}
                </div>
                <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  {detail ? `${detail.messages.length} messages` : 'Loading messages…'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedSession.status.type === 'busy' && (
                  <button
                    type="button"
                    onClick={handleAbort}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors"
                  >
                    <Pause size={14} weight="fill" />
                    Abort
                  </button>
                )}
                <StatusDot status={selectedSession.status.type} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {detailLoading && (
                <div className="flex items-center text-xs text-[var(--text-tertiary)]">
                  <Spinner className="animate-spin mr-2" size={14} />
                  Loading messages…
                </div>
              )}
              {detail?.messages.map((msg) => (
                <div
                  key={msg.info.id}
                  className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                    msg.info.role === 'user'
                      ? 'ml-auto bg-blue-500 text-white rounded-br-md'
                      : 'mr-auto bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-bl-md'
                  )}
                >
                  {msg.parts
                    .filter((p) => p.type === 'text')
                    .map((p: any, i: number) => (
                      <div key={i}>{p.text}</div>
                    ))}
                </div>
              ))}

              {sessionPermissions.map((permission) => (
                <PendingPermissionCard
                  key={permission.id}
                  permission={permission}
                  loading={!!permissionLoading[permission.id]}
                  onReply={(reply) => void handlePermissionReply(permission.id, reply)}
                />
              ))}

              {sessionQuestions.map((question) => (
                <PendingQuestionCard
                  key={question.id}
                  question={question}
                  answers={questionAnswers[question.id] ?? question.questions.map(() => [])}
                  onChange={(answers) =>
                    setQuestionAnswers((prev) => ({ ...prev, [question.id]: answers }))
                  }
                  onReply={() => void handleQuestionReply(question.id)}
                  onReject={() => void handleQuestionReject(question.id)}
                />
              ))}

              {events.length > 0 && (
                <div className="text-xs text-[var(--text-tertiary)] pt-2 border-t border-[var(--border-subtle)]">
                  {events.filter((e) => e.type !== 'remote.heartbeat').length} events streamed
                </div>
              )}
            </div>

            <div className="p-3 border-t border-[var(--border-default)]">
              <div className="flex items-end gap-2">
                <textarea
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Send a message to this session…"
                  rows={2}
                  className="flex-1 resize-none rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={sending || !composerText.trim()}
                  className="p-2.5 rounded-xl bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
                >
                  {sending ? <Spinner className="animate-spin" size={18} /> : <PaperPlaneRight size={18} weight="fill" />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  return (
    <Circle
      size={8}
      weight="fill"
      className={cn(
        status === 'busy' && 'text-amber-500',
        status === 'idle' && 'text-emerald-500',
        status !== 'busy' && status !== 'idle' && 'text-[var(--text-tertiary)]'
      )}
    />
  );
}

function PendingPermissionCard({
  permission,
  loading,
  onReply,
}: {
  permission: RemotePermissionRequest;
  loading: boolean;
  onReply: (reply: 'once' | 'always' | 'reject') => void;
}) {
  return (
    <div className="max-w-[90%] mr-auto rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
      <div className="font-medium text-[var(--text-primary)] mb-1">Permission request</div>
      <div className="text-[var(--text-secondary)] mb-2">
        {permission.permission}: {permission.patterns.join(', ')}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => onReply('once')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-medium disabled:opacity-50"
        >
          <Check size={12} weight="bold" />
          Allow once
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => onReply('always')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-primary)] text-xs font-medium border border-[var(--border-default)] disabled:opacity-50"
        >
          Always
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => onReply('reject')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 text-xs font-medium border border-red-500/30 disabled:opacity-50"
        >
          <X size={12} weight="bold" />
          Deny
        </button>
      </div>
    </div>
  );
}

function PendingQuestionCard({
  question,
  answers,
  onChange,
  onReply,
  onReject,
}: {
  question: RemoteQuestionRequest;
  answers: string[][];
  onChange: (answers: string[][]) => void;
  onReply: () => void;
  onReject: () => void;
}) {
  return (
    <div className="max-w-[90%] mr-auto rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm">
      <div className="font-medium text-[var(--text-primary)] mb-2">Question</div>
      <div className="space-y-3">
        {question.questions.map((q, qIdx) => (
          <div key={qIdx}>
            <div className="text-[var(--text-secondary)] mb-1.5">{q.question}</div>
            <div className="space-y-1">
              {q.options.map((option) => {
                const selected = answers[qIdx]?.includes(option.label) ?? false;
                return (
                  <label
                    key={option.label}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
                      selected
                        ? 'bg-blue-500/20 border-blue-500/40'
                        : 'bg-[var(--bg-subtle)] border-[var(--border-default)]'
                    )}
                  >
                    <input
                      type={q.multiple ? 'checkbox' : 'radio'}
                      name={`question-${question.id}-${qIdx}`}
                      checked={selected}
                      onChange={() => {
                        const next = answers.map((a) => [...a]);
                        if (q.multiple) {
                          next[qIdx] = selected
                            ? next[qIdx].filter((l) => l !== option.label)
                            : [...next[qIdx], option.label];
                        } else {
                          next[qIdx] = [option.label];
                        }
                        onChange(next);
                      }}
                      className="shrink-0"
                    />
                    <span className="text-[var(--text-primary)] font-medium">{option.label}</span>
                    <span className="text-[var(--text-tertiary)] text-xs ml-auto">{option.description}</span>
                  </label>
                );
              })}
              {q.custom && (
                <input
                  type="text"
                  placeholder="Custom answer…"
                  value={answers[qIdx]?.[0] ?? ''}
                  onChange={(e) => {
                    const next = answers.map((a) => [...a]);
                    next[qIdx] = [e.target.value];
                    onChange(next);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] text-sm text-[var(--text-primary)]"
                />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          onClick={onReply}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium"
        >
          <Check size={12} weight="bold" />
          Answer
        </button>
        <button
          type="button"
          onClick={onReject}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 text-xs font-medium border border-red-500/30"
        >
          <X size={12} weight="bold" />
          Dismiss
        </button>
      </div>
    </div>
  );
}
