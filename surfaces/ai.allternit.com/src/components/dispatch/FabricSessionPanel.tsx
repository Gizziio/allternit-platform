'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner, PaperPlaneRight, Circle, Pause, Check, X, Bell, BellSlash, ChatTeardropText, Plus, TerminalWindow } from '@phosphor-icons/react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { RuntimeViewModel } from '@/components/dispatch/useRuntimes';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  createFabricSessionClient,
  createWebPushClient,
  type FabricBot,
  type FabricBrain,
  type FabricModelRef,
  type FabricSessionWithStatus,
  type FabricSessionDetail,
  type FabricSessionEvent,
  type FabricPermissionRequest,
  type FabricQuestionRequest,
  type PushSubscriptionJSON,
} from '@/lib/dispatch/fabric-session-client';
import { FABRIC_DRIVE_KINDS, fabricKindSurface, fabricSessionKind, type FabricDriveKind } from '@/lib/fabric-session-kind';
import { extractAciScreenshot, FabricAciDrive, FabricBotDrive, FabricCodeDrive, FabricKindIcon, isFabricKeepalive, mergeNodeBots } from '@/components/dispatch/FabricSessionDriveViews';
import { FabricBrainPicker, fabricBrainLabel, loadFabricBrain } from '@/components/dispatch/FabricBrainPicker';

export interface FabricSessionPanelProps {
  runtimeId: string;
  getToken: () => Promise<string | null>;
  baseUrl?: string;
  direct?: boolean;
  runtime?: RuntimeViewModel | null;
  /** Controlled ACI watch flag. Default (uncontrolled) is off. */
  watching?: boolean;
  onToggleWatch?: () => void;
  driveKind?: FabricDriveKind;
  onDriveKindChange?: (kind: FabricDriveKind) => void;
  railCollapsed?: boolean;
  onToggleRail?: () => void;
}

export function FabricSessionPanel({
  runtimeId,
  getToken,
  baseUrl,
  direct,
  runtime,
  watching: watchingProp,
  onToggleWatch,
  driveKind: driveKindProp,
  onDriveKindChange,
  railCollapsed: railCollapsedProp,
  onToggleRail,
}: FabricSessionPanelProps) {
  const { addToast } = useToast();
  const fabricClient = useMemo(
    () => createFabricSessionClient({ runtimeId, getToken, baseUrl, direct }),
    [runtimeId, getToken, baseUrl, direct]
  );
  const pushClient = useMemo(
    () => createWebPushClient({ runtimeId, getToken, baseUrl }),
    [runtimeId, getToken, baseUrl]
  );

  const [sessions, setSessions] = useState<FabricSessionWithStatus[]>([]);
  const [driveKindState, setDriveKindState] = useState<FabricDriveKind>('chat');
  const driveKind = driveKindProp ?? driveKindState;
  const setDriveKind = onDriveKindChange ?? setDriveKindState;
  const [codePane, setCodePane] = useState<'terminal' | 'chat'>('terminal');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [railCollapsedState, setRailCollapsedState] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia('(max-width: 768px)').matches) return true;
    try {
      return window.localStorage.getItem('fabric-session:rail-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const railCollapsed = railCollapsedProp ?? railCollapsedState;
  const toggleRail = onToggleRail ?? (() => {
    setRailCollapsedState((current) => {
      const next = !current;
      if (typeof window !== 'undefined' && !window.matchMedia('(max-width: 768px)').matches) {
        try {
          window.localStorage.setItem('fabric-session:rail-collapsed', String(next));
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  });
  const pickSession = useCallback((id: string | null) => {
    setSelectedSessionId(id);
    if (id && typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
      if (onToggleRail && !railCollapsed) onToggleRail();
      else setRailCollapsedState(true);
    }
  }, [onToggleRail, railCollapsed]);
  const [detail, setDetail] = useState<FabricSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [sending, setSending] = useState(false);
  const [brains, setBrains] = useState<FabricBrain[]>([]);
  const [brainsLoading, setBrainsLoading] = useState(true);
  const [selectedBrain, setSelectedBrain] = useState<FabricModelRef | null>(() => loadFabricBrain(runtimeId));
  const [bots, setBots] = useState<FabricBot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [aciRunId, setAciRunId] = useState<string | null>(null);
  const [aciScreenshot, setAciScreenshot] = useState<string | null>(null);
  const [aciOpening, setAciOpening] = useState(false);
  const [localWatching, setLocalWatching] = useState(false);
  const aciWatching = watchingProp ?? localWatching;
  const toggleAciWatch = onToggleWatch ?? (() => setLocalWatching((v) => !v));
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );
  const [events, setEvents] = useState<FabricSessionEvent[]>([]);
  const [pendingPermissions, setPendingPermissions] = useState<FabricPermissionRequest[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<FabricQuestionRequest[]>([]);
  const [permissionLoading, setPermissionLoading] = useState<Record<string, boolean>>({});
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string[][]>>({});
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const pushSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  const fetchSessions = useCallback(async () => {
    try {
      const data = await fabricClient.listSessions();
      setSessions(Array.isArray(data) ? data : []);
    } catch (error) {
      addToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load sessions',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [fabricClient, addToast]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (!pushSupported) return;
    void navigator.serviceWorker.ready.then((registration) => {
      void registration.pushManager.getSubscription().then((subscription) => {
        setPushEnabled(!!subscription);
      });
    });
  }, [pushSupported]);

  const fetchPendingActions = useCallback(async () => {
    try {
      const [permissions, questions] = await Promise.all([
        fabricClient.listPendingPermissions(),
        fabricClient.listPendingQuestions(),
      ]);
      setPendingPermissions(permissions);
      setPendingQuestions(questions);
    } catch {
      // Silent: pending actions are polled frequently.
    }
  }, [fabricClient]);

  useEffect(() => {
    void fetchPendingActions();
  }, [fetchPendingActions]);

  const fetchDetail = useCallback(async () => {
    if (!selectedSessionId) return;
    setDetailLoading(true);
    try {
      const data = await fabricClient.getSession(selectedSessionId);
      setDetail(data);
    } catch {
      addToast({ title: 'Error', description: 'Failed to load session details', type: 'error' });
    } finally {
      setDetailLoading(false);
    }
  }, [fabricClient, selectedSessionId, addToast]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    setAciScreenshot(null);
    setAciRunId(null);
    setAciOpening(false);
  }, [selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId) return;
    setEvents([]);
    let active = true;

    void (async () => {
      while (active) {
        try {
          const iterator = fabricClient.streamEvents(selectedSessionId);
          for await (const event of iterator) {
            if (!active) break;
            if (isFabricKeepalive(event.type)) continue;
            if (event.type === 'session.updated' || event.type === 'session.status') {
              void fetchSessions();
            }
            setEvents((prev) => [...prev.slice(-80), event]);
            if (event.type === 'permission.asked') {
              const permission = event.properties as FabricPermissionRequest;
              setPendingPermissions((prev) => {
                if (prev.some((p) => p.id === permission.id)) return prev;
                return [...prev, permission];
              });
            }
            if (event.type === 'question.asked') {
              const question = event.properties as FabricQuestionRequest;
              setPendingQuestions((prev) => {
                if (prev.some((q) => q.id === question.id)) return prev;
                return [...prev, question];
              });
            }
          }
        } catch {
          // Relay sockets drop on idle; reconnect quietly.
        }
        if (active) await new Promise((resolve) => window.setTimeout(resolve, 30000));
      }
    })();

    return () => {
      active = false;
    };
  }, [fabricClient, selectedSessionId, addToast, fetchSessions]);

  const openComputer = useCallback(async (goal: string) => {
    setAciOpening(true);
    try {
      const run = await fabricClient.startAci({
        goal,
        model: selectedBrain ? `${selectedBrain.providerID}/${selectedBrain.modelID}` : undefined,
      });
      if (run.sessionId) setAciRunId(run.sessionId);
    } catch (error) {
      addToast({
        title: 'Could not open computer',
        description: error instanceof Error ? error.message : 'ACI run failed',
        type: 'error',
      });
      setAciOpening(false);
    }
  }, [addToast, fabricClient, selectedBrain]);

  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (driveKind !== 'aci' || !aciWatching || !pageVisible) return;
    const runId = aciRunId || selectedSessionId;
    if (!runId) return;
    let active = true;
    void (async () => {
      try {
        for await (const frame of fabricClient.streamAci(runId)) {
          if (!active) break;
          const shot = extractAciScreenshot(frame);
          if (shot) {
            setAciScreenshot(shot);
            setAciOpening(false);
          }
          if (frame.type === 'done') break;
        }
      } catch {
        // Stream ended; keep last frame. Do not reconnect — that would heartbeat ACI.
      }
    })();
    return () => {
      active = false;
    };
  }, [aciRunId, aciWatching, driveKind, fabricClient, pageVisible, selectedSessionId]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.session.id === selectedSessionId),
    [sessions, selectedSessionId]
  );

  const kindSessions = useMemo(
    () => sessions.filter((entry) => fabricSessionKind(entry.session) === driveKind),
    [sessions, driveKind]
  );

  useEffect(() => {
    setDriveKind('chat');
    setSelectedSessionId(null);
  }, [runtimeId]);

  useEffect(() => {
    if (!selectedSessionId) return;
    if (kindSessions.some((entry) => entry.session.id === selectedSessionId)) return;
    setSelectedSessionId(null);
  }, [driveKind, kindSessions, selectedSessionId]);

  useEffect(() => {
    let cancelled = false;
    setBrainsLoading(true);
    void fabricClient
      .listBrains()
      .then((next) => {
        if (cancelled) return;
        setBrains(next);
        setSelectedBrain((current) => {
          if (current) return current;
          const stored = loadFabricBrain(runtimeId);
          if (stored) return stored;
          const first = next.find((brain) => brain.connected !== false && brain.models.length > 0) ?? next.find((brain) => brain.models.length > 0);
          const model = first?.models[0];
          return first && model ? { providerID: first.id, modelID: model.id } : null;
        });
      })
      .catch(() => {
        if (!cancelled) setBrains([]);
      })
      .finally(() => {
        if (!cancelled) setBrainsLoading(false);
      });
    void fabricClient.listBots().then((next) => {
      if (!cancelled) setBots(next);
    }).catch(() => {
      if (!cancelled) setBots([]);
    });
    return () => {
      cancelled = true;
    };
  }, [fabricClient, runtimeId]);

  async function handleStartSession() {
    try {
      const tab = FABRIC_DRIVE_KINDS.find((entry) => entry.id === driveKind);
      const created = await fabricClient.createSession({
        title: tab ? `${tab.label} session` : 'Fabric Session',
        surface: fabricKindSurface(driveKind),
        defaultModel: selectedBrain ?? undefined,
      });
      const sessionId = (created as { id?: string })?.id;
      await fetchSessions();
      if (sessionId) setSelectedSessionId(sessionId);
    } catch (error) {
      addToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start a session',
        type: 'error',
      });
    }
  }

  async function handleSend() {
    if (!selectedSessionId || !composerText.trim()) return;
    setSending(true);
    const text = composerText.trim();
    try {
      if (driveKind === 'aci') {
        await openComputer(text);
      }
      await fabricClient.sendMessage(selectedSessionId, {
        text,
        model: selectedBrain ?? undefined,
      });
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
      await fabricClient.abortSession(selectedSessionId);
    } catch {
      addToast({ title: 'Error', description: 'Failed to abort session', type: 'error' });
    }
  }

  async function handlePermissionReply(requestID: string, reply: 'once' | 'always' | 'reject') {
    setPermissionLoading((prev) => ({ ...prev, [requestID]: true }));
    try {
      await fabricClient.replyPermission(requestID, reply);
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
      await fabricClient.replyQuestion(requestID, answers);
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
      await fabricClient.rejectQuestion(requestID);
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

  async function handlePushToggle() {
    if (!pushSupported) {
      addToast({ title: 'Not supported', description: 'Push notifications are not supported on this browser.', type: 'error' });
      return;
    }
    setPushLoading(true);
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      if (pushEnabled) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await pushClient.unsubscribePush(subscription.endpoint);
          await subscription.unsubscribe();
        }
        setPushEnabled(false);
        addToast({ title: 'Notifications off', description: 'Push notifications disabled for this runtime.', type: 'success' });
      } else {
        const vapidKey = await pushClient.getVapidPublicKey().catch(() => null);
        if (!vapidKey) {
          addToast({ title: 'Not configured', description: 'Push worker is not configured.', type: 'error' });
          return;
        }
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        });
        await pushClient.subscribePush(subscription.toJSON() as PushSubscriptionJSON);
        setPushEnabled(true);
        addToast({ title: 'Notifications on', description: 'You will receive push notifications for this runtime.', type: 'success' });
      }
    } catch (error) {
      addToast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to toggle push notifications', type: 'error' });
    } finally {
      setPushLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--shell-item-muted)] bg-[var(--shell-view-bg)]">
        <Spinner className="animate-spin mr-2" size={20} />
        Loading sessions…
      </div>
    );
  }

  const sessionTabs = FABRIC_DRIVE_KINDS.filter((tab) => tab.id !== 'desktop');

  return (
    <div
      className="relative h-full min-h-0 overflow-hidden flex"
      style={{ background: 'var(--shell-frame-bg)', color: 'var(--shell-item-fg)' }}
    >
      {isMobile && !railCollapsed ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="absolute inset-0 z-30 border-none bg-black/50 cursor-pointer"
          onClick={toggleRail}
        />
      ) : null}
      {!railCollapsed ? (
      <aside
        className={cn(
          'flex w-[268px] min-h-0 flex-col bg-[var(--shell-rail-bg)] border-r border-solid border-[var(--border-subtle)] md:rounded-tr-2xl md:rounded-br-2xl',
          isMobile && 'fixed inset-y-0 left-0 z-40 shadow-[var(--shadow-lg)]',
        )}
      >
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="flex p-0.5 bg-[var(--surface-hover)] rounded-xl gap-0.5 border border-solid border-[var(--border-subtle)]">
            {sessionTabs.map((tab) => {
              const active = driveKind === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  title={tab.hint}
                  onClick={() => setDriveKind(tab.id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border-none text-[11px] font-bold cursor-pointer transition-all duration-200',
                    active
                      ? 'bg-[var(--bg-primary)] text-[var(--accent-primary)] shadow-[var(--shadow-sm)]'
                      : 'bg-transparent text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)]'
                  )}
                >
                  <FabricKindIcon kind={tab.id} size={13} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3 px-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--shell-item-muted)]">
              {driveKind === 'bot' ? 'Bots' : `${sessionTabs.find((tab) => tab.id === driveKind)?.label ?? 'Chat'} sessions`}
            </div>
            <div className="flex items-center gap-0.5">
              {pushSupported && (
                <button
                  type="button"
                  onClick={() => void handlePushToggle()}
                  disabled={pushLoading}
                  title={pushEnabled ? 'Disable push notifications' : 'Enable push notifications'}
                  className="p-1.5 rounded-md border-none bg-transparent text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] cursor-pointer"
                >
                  {pushLoading ? <Spinner className="animate-spin" size={14} /> : pushEnabled ? <Bell size={14} weight="fill" /> : <BellSlash size={14} />}
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleStartSession()}
                title="New session"
                className="p-1.5 rounded-md border-none bg-transparent text-[var(--shell-item-muted)] hover:text-[var(--accent-primary)] cursor-pointer"
              >
                <Plus size={14} weight="bold" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {driveKind === 'bot' ? (
            <FabricBotDrive
              bots={mergeNodeBots(bots, brains)}
              sessions={sessions}
              selectedSessionId={selectedSessionId}
              selectedBotId={selectedBotId}
              onSelectBot={setSelectedBotId}
              onSelectSession={pickSession}
              onOpenBot={(bot) => {
                setSelectedBotId(bot.id);
                void (async () => {
                  try {
                    const brainModel = bot.provider && bot.model
                      ? { providerID: bot.provider, modelID: bot.model }
                      : selectedBrain ?? undefined;
                    const created = await fabricClient.createSession({
                      title: `${bot.name} session`,
                      surface: bot.provider ? 'chat' : 'cowork',
                      agentID: bot.provider ? undefined : bot.id,
                      defaultModel: brainModel,
                    });
                    if (brainModel) setSelectedBrain(brainModel);
                    await fetchSessions();
                    const sessionId = (created as { id?: string })?.id;
                    if (sessionId) pickSession(sessionId);
                  } catch (error) {
                    addToast({
                      title: 'Error',
                      description: error instanceof Error ? error.message : 'Failed to open bot',
                      type: 'error',
                    });
                  }
                })();
              }}
            />
          ) : kindSessions.length === 0 ? (
            <div className="px-2 py-6 text-center">
              <p className="text-[12px] font-medium text-[var(--shell-item-fg)] m-0 mb-1">No {driveKind} sessions</p>
              <p className="text-[11px] text-[var(--shell-item-muted)] m-0 mb-3">
                {FABRIC_DRIVE_KINDS.find((tab) => tab.id === driveKind)?.hint}
              </p>
              <button
                type="button"
                onClick={() => void handleStartSession()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border-none cursor-pointer bg-[var(--bg-primary)] text-[var(--accent-primary)]"
              >
                <Plus size={12} weight="bold" />
                New session
              </button>
            </div>
          ) : kindSessions.map(({ session, status }) => {
            const active = selectedSessionId === session.id;
            const updated = session.time?.updated ? new Date(session.time.updated).toLocaleString() : null;
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => pickSession(session.id)}
                className={cn(
                  'w-full text-left rounded-xl border-none px-3 py-2.5 mb-1 cursor-pointer transition-colors',
                  active
                    ? 'bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)]'
                    : 'bg-transparent text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]'
                )}
              >
                <div className="flex items-center gap-2">
                  <FabricKindIcon kind={fabricSessionKind(session)} size={13} />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{session.title}</span>
                  <StatusDot status={status.type} />
                </div>
                <div className={cn('mt-1 text-[10px] truncate', active ? 'text-[var(--shell-item-active-fg)]' : 'text-[var(--shell-item-muted)]')}>
                  {status.type}
                  {session.agentID ? ` · ${session.agentID}` : ''}
                  {session.directory ? ` · ${session.directory}` : ''}
                </div>
                {updated && (
                  <div className="mt-0.5 text-[10px] text-[var(--shell-item-muted)] truncate">{updated}</div>
                )}
              </button>
            );
          })}
        </div>
        {runtime && (
          <div className="shrink-0 border-t border-solid border-[var(--shell-divider)] px-3 py-3 bg-[var(--shell-rail-bg)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--shell-item-muted)] mb-1.5">Node</div>
            <div className="flex items-center gap-2">
              <StatusDot status={runtime.status} />
              <span className="text-[12px] font-semibold truncate">{runtime.name}</span>
            </div>
            <div className="mt-1 text-[11px] text-[var(--shell-item-muted)] truncate">{runtime.host}</div>
            {runtime.lastHeartbeatAt && (
              <div className="mt-0.5 text-[10px] text-[var(--shell-item-muted)]">
                Heartbeat {new Date(runtime.lastHeartbeatAt).toLocaleString()}
              </div>
            )}
            {runtime.capabilities.length > 0 && (
              <div className="mt-2 hidden md:flex flex-wrap gap-1">
                {runtime.capabilities.slice(0, 6).map((cap) => (
                  <span key={cap} className="text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--surface-hover)] text-[var(--shell-item-muted)]">
                    {cap.replace(/^runtime:/, '')}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>
      ) : null}

      <div className="flex flex-1 min-h-0 min-w-0 flex-col bg-[var(--shell-view-bg)]">
        {!selectedSession ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 text-center">
            <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 max-w-xs">
              <ChatTeardropText size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-[14px] font-medium text-[var(--text-primary)] m-0 mb-1">Select a session</p>
              <p className="text-[12px] text-[var(--text-tertiary)] m-0 mb-4">
                Choose an active session from the list, or start a new one on this desktop.
              </p>
              <button
                type="button"
                onClick={() => void handleStartSession()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--text-primary)] text-[var(--bg-elevated)] border-none cursor-pointer hover:opacity-90 transition-opacity"
              >
                Start a session
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="h-10 px-4 border-b border-solid border-[var(--border-subtle)] flex items-center justify-between gap-4 bg-[var(--shell-view-bg)]">
              <div className="min-w-0">
                <div className="text-[15px] font-medium tracking-tight text-[var(--shell-item-fg)] truncate" style={{ fontFamily: 'var(--font-ui)' }}>
                  {selectedSession.session.title}
                </div>
                <div className="text-[12px] font-semibold text-[var(--shell-item-muted)] truncate">
                  {driveKind}
                  {selectedBrain ? ` · ${fabricBrainLabel(selectedBrain, brains)}` : ''}
                  {selectedSession.session.agentID ? ` · ${selectedSession.session.agentID}` : ''}
                  {selectedSession.session.directory ? ` · ${selectedSession.session.directory}` : ''}
                  {detail ? ` · ${detail.messages.length} messages` : ''}
                  {runtime ? ` · ${runtime.name}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {driveKind === 'code' && (
                  <div className="flex p-0.5 rounded-lg bg-[var(--surface-hover)] border border-solid border-[var(--border-subtle)]">
                    <button
                      type="button"
                      onClick={() => setCodePane('terminal')}
                      className={cn(
                        'px-2.5 py-1.5 text-[12px] font-semibold border-none cursor-pointer rounded-md',
                        codePane === 'terminal' ? 'bg-[var(--bg-primary)] text-[var(--accent-primary)]' : 'bg-transparent text-[var(--shell-item-muted)]'
                      )}
                    >
                      <TerminalWindow size={12} className="inline mr-1" />
                      Terminal
                    </button>
                    <button
                      type="button"
                      onClick={() => setCodePane('chat')}
                      className={cn(
                        'px-2.5 py-1.5 text-[12px] font-semibold border-none cursor-pointer rounded-md',
                        codePane === 'chat' ? 'bg-[var(--bg-primary)] text-[var(--accent-primary)]' : 'bg-transparent text-[var(--shell-item-muted)]'
                      )}
                    >
                      Chat
                    </button>
                  </div>
                )}
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

            <div className={cn('flex-1 min-h-0 p-4 space-y-3', (driveKind === 'code' && codePane === 'terminal') || driveKind === 'aci' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto')}>
              {driveKind === 'code' && codePane === 'terminal' && selectedSession ? (
                <FabricCodeDrive session={selectedSession} detail={detail} events={events} />
              ) : null}
              {driveKind === 'aci' && selectedSession ? (
                <FabricAciDrive
                  session={selectedSession}
                  detail={detail}
                  events={events}
                  hostName={runtime?.name || runtime?.host}
                  screenshot={aciScreenshot}
                  opening={aciOpening}
                  onOpenComputer={() => void openComputer('Open the desktop so I can see the screen.')}
                  watching={aciWatching}
                  onToggleWatch={toggleAciWatch}
                />
              ) : null}
              {driveKind !== 'aci' && !(driveKind === 'code' && codePane === 'terminal') && detailLoading && (
                <div className="flex items-center text-xs text-[var(--text-tertiary)]">
                  <Spinner className="animate-spin mr-2" size={14} />
                  Loading messages…
                </div>
              )}
              {driveKind !== 'aci' && !(driveKind === 'code' && codePane === 'terminal') && detail?.messages.map((msg) => (
                <div
                  key={msg.info.id}
                  className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                    msg.info.role === 'user'
                      ? 'ml-auto rounded-br-md'
                      : 'mr-auto bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-bl-md'
                  )}
                  style={msg.info.role === 'user' ? { background: 'var(--accent-primary)', color: 'var(--bg-primary)' } : undefined}
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
                  {events.filter((e) => !isFabricKeepalive(e.type)).length} events streamed
                </div>
              )}
            </div>

            {!(driveKind === 'code' && codePane === 'terminal') && (
            <div className="p-3 border-t border-solid border-[var(--border-subtle)] bg-[var(--shell-view-bg)]">
              <div className="rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--shell-rail-bg)] px-3 pt-2.5 pb-2">
                <textarea
                  data-remote-composer
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Message this session…"
                  rows={2}
                  className="w-full resize-none border-none bg-transparent px-0.5 py-1 text-[14px] leading-5 text-[var(--shell-item-fg)] placeholder:text-[var(--shell-item-muted)] focus:outline-none"
                />
                <div className="flex items-center justify-between gap-2 mt-1">
                  <FabricBrainPicker
                    runtimeId={runtimeId}
                    brains={brains}
                    loading={brainsLoading}
                    value={selectedBrain}
                    onChange={setSelectedBrain}
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={sending || !composerText.trim()}
                    className="size-8 shrink-0 rounded-full border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-[var(--accent-primary)] text-[var(--bg-primary)] flex items-center justify-center"
                  >
                    {sending ? <Spinner className="animate-spin" size={16} /> : <PaperPlaneRight size={16} weight="fill" />}
                  </button>
                </div>
              </div>
            </div>
            )}
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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData.split('').map((char) => char.charCodeAt(0)));
}

function PendingPermissionCard({
  permission,
  loading,
  onReply,
}: {
  permission: FabricPermissionRequest;
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
  question: FabricQuestionRequest;
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
