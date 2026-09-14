/**
 * CoworkTranscript - Interleaves chat messages with inline work blocks
 * Renders the unified stream: message → work block → message → work block
 */

import React, { memo, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { StreamingChatComposer } from '@/components/chat/StreamingChatComposer';
import { CoworkWorkBlock } from './CoworkWorkBlock';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { coworkTransitionController } from '@/lib/agents/session-transition-controller';
import type { ChatMessage } from '@/lib/ai/rust-stream-adapter';
import type { AnyCoworkEvent } from './cowork.types';
import { useCoworkRuns } from '@/lib/cowork/useCoworkRuns';
import { useCoworkRunEvents, type CoworkRunEvent } from '@/lib/cowork/useCoworkRunEvents';
import { ChatThreadInlineGate } from '@/views/chat/components/ChatThreadInlineGate';
import type { AgentModeSurface } from '@/stores/agent-surface-mode.store';

interface CoworkTranscriptProps {
  /** Legacy: explicit messages array (CoworkRoot) */
  messages?: ChatMessage[];
  isLoading?: boolean;
  onRegenerate: () => void;
  /** When provided, limits parts lookup to this gizzi-code session */
  sessionId?: string;
  /** New: pull messages from the chat session store by ID */
  conversationId?: string;
  /** Phase 2: agent sub-session IDs to merge into this transcript */
  linkedSessionIds?: string[];
  onSelectArtifact?: (artifact: any) => void;
  selectedArtifactTitle?: string;
  /** In floating HUD mode the transcript area should stay empty instead of showing a landing placeholder. */
  hideEmptyState?: boolean;
  /** Compact HUD layout: minimal spacing and no empty-state padding. */
  hudMode?: boolean;
  /** Surface context for inline approval/question gate polling. */
  surface?: AgentModeSurface;
}

// Derive the currently-running tool from messages so we can show it inline
function getCurrentRunningTool(messages: ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant' || !Array.isArray(m.content)) continue;
    const parts = m.content as any[];
    const running = [...parts].reverse().find(
      (p: any) =>
        p.type === 'dynamic-tool' &&
        // Live native parts stream as 'input-streaming' and settle into
        // 'output-available'/'output-error' (mode-session-store); the legacy
        // rust-stream-adapter marks tool input 'input-available'.
        (p.state === 'input-available' ||
          p.state === 'input-streaming' ||
          p.state === 'running')
    );
    if (running) return running.toolName as string;
  }
  return null;
}

const TOOL_VERB: Record<string, string> = {
  Bash: 'Running shell command',
  BashTool: 'Running shell command',
  Read: 'Reading file',
  Write: 'Writing file',
  Edit: 'Editing file',
  MultiEdit: 'Editing files',
  NotebookEdit: 'Editing notebook',
  TodoWrite: 'Updating task list',
  TaskCreate: 'Creating task',
  TaskUpdate: 'Updating task',
  TaskGet: 'Checking tasks',
  TaskList: 'Listing tasks',
  ExitPlanMode: 'Approving plan',
  AskUserQuestion: 'Asking a question',
};

function LiveToolBadge({ toolName }: { toolName: string }) {
  const label = TOOL_VERB[toolName] ?? `Using ${toolName}`;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 12px', borderRadius: 8,
      background: 'rgba(210,185,148,0.05)',
      border: '1px solid rgba(210,185,148,0.10)',
      maxWidth: 320,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(210,185,148,0.7)',
        boxShadow: '0 0 6px rgba(210,185,148,0.5)',
        animation: 'liveToolPulse 1.4s ease-in-out infinite',
      }} />
      <style>{`@keyframes liveToolPulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      <span style={{ fontSize: 12, color: 'rgba(210,185,148,0.75)', fontStyle: 'italic' }}>
        {label}…
      </span>
    </div>
  );
}

// Work event types that should render as inline blocks
const INLINE_WORK_TYPES = [
  'cowork.action',
  'cowork.command',
  'cowork.file',
  'cowork.observation',
  'cowork.checkpoint',
  'cowork.tool_call',
  'cowork.tool_result',
];

// Slow cadence for refreshing the run list while a cowork transcript is
// mounted — the events themselves poll every 4s via useCoworkRunEvents once a
// run is bound.
const RUNS_REFRESH_MS = 15_000;

/**
 * Map cloud run events ({ event_type, payload }) onto the AnyCoworkEvent
 * shapes CoworkWorkBlock renders. Payloads from the runs API vary, so every
 * field the blocks dereference gets a default instead of crashing on a
 * missing key.
 */
const RUN_EVENT_DEFAULTS: Record<
  string,
  (payload: Record<string, unknown>) => Record<string, unknown>
> = {
  'cowork.action': (p) => ({
    actionId: String(p.actionId ?? ''),
    actionType: p.actionType ?? 'click',
    target: p.target,
    args: p.args,
    humanReadable: String(p.humanReadable ?? ''),
    frameId: String(p.frameId ?? ''),
  }),
  'cowork.command': (p) => ({
    commandId: String(p.commandId ?? ''),
    commands: Array.isArray(p.commands)
      ? (p.commands as string[])
      : typeof p.command === 'string'
        ? [p.command]
        : [],
    cwd: p.cwd,
    env: p.env,
    result: p.result,
  }),
  'cowork.file': (p) => ({
    operation: (p.operation as 'read' | 'edit' | 'create' | 'delete') ?? 'read',
    files: Array.isArray(p.files) ? p.files : [],
  }),
  'cowork.observation': (p) => ({
    frameId: String(p.frameId ?? ''),
    imageRef: String(p.imageRef ?? ''),
    metadata: (p.metadata as Record<string, unknown>) ?? {},
    ocr: p.ocr,
    labels: p.labels,
  }),
  'cowork.checkpoint': (p) => ({
    checkpointId: String(p.checkpointId ?? ''),
    label: String(p.label ?? ''),
    state: (p.state as Record<string, unknown>) ?? {},
  }),
  'cowork.tool_call': (p) => ({
    toolCallId: String(p.toolCallId ?? ''),
    toolName: String(p.toolName ?? 'tool'),
    args: (p.args as Record<string, unknown>) ?? {},
  }),
  'cowork.tool_result': (p) => ({
    toolCallId: String(p.toolCallId ?? ''),
    result: p.result ?? null,
    error: p.error as string | undefined,
  }),
};

function mapRunEventsToCoworkEvents(
  runEvents: CoworkRunEvent[],
  runId: string,
  sessionId: string | undefined,
): AnyCoworkEvent[] {
  return runEvents
    .filter((ev) => INLINE_WORK_TYPES.includes(ev.event_type))
    .map((ev, index) => {
      const payload = ev.payload ?? {};
      const timestamp =
        typeof payload.timestamp === 'number'
          ? payload.timestamp
          : typeof payload.time === 'number'
            ? payload.time
            : Date.now();
      const base = {
        id: typeof payload.id === 'string' ? payload.id : `${runId}:${index}`,
        type: ev.event_type,
        timestamp,
        sessionId:
          typeof payload.sessionId === 'string' ? payload.sessionId : (sessionId ?? runId),
      };
      const defaults = RUN_EVENT_DEFAULTS[ev.event_type];
      return {
        ...base,
        ...(defaults ? defaults(payload) : {}),
      } as unknown as AnyCoworkEvent;
    });
}

/**
 * Merge messages and work events into a unified timeline
 * sorted by timestamp
 */
function mergeTimeline(
  messages: ChatMessage[],
  events: AnyCoworkEvent[]
): Array<{ type: 'message' | 'work'; data: any; id: string }> {
  const workEvents = (events || []).filter(e => INLINE_WORK_TYPES.includes(e.type));
  
  const items: Array<{ type: 'message' | 'work'; data: any; id: string; timestamp: number }> = [
    ...(messages || []).map(m => ({
      type: 'message' as const,
      data: m,
      id: m.id,
      timestamp: m.createdAt?.getTime() || Date.now(),
    })),
    ...workEvents.map(e => ({
      type: 'work' as const,
      data: e,
      id: e.id,
      timestamp: e.timestamp,
    })),
  ];
  
  // Sort by timestamp
  return items.sort((a, b) => a.timestamp - b.timestamp);
}

export const CoworkTranscript = memo(function CoworkTranscript({
  messages: messagesProp,
  isLoading: isLoadingProp,
  onRegenerate,
  sessionId,
  conversationId,
  linkedSessionIds,
  onSelectArtifact,
  selectedArtifactTitle,
  hideEmptyState,
  hudMode = false,
  surface = 'chat',
}: CoworkTranscriptProps) {
  // When conversationId is provided, pull messages from the chat session store
  const storeSession = useChatSessionStore((state) =>
    conversationId ? state.sessions.find((s) => s.id === conversationId) ?? null : null
  );
  const storeStreaming = useChatSessionStore((state) =>
    conversationId ? state.streamingBySession[conversationId] : null
  );

  // Phase 2: Pull messages from linked agent sub-sessions
  const linkedSessions = useChatSessionStore((state) =>
    (linkedSessionIds || [])
      .map((id) => state.sessions.find((s) => s.id === id))
      .filter(Boolean)
  );
  const linkedStreaming = useChatSessionStore((state) => {
    if (!linkedSessionIds || linkedSessionIds.length === 0) return null;
    for (const id of linkedSessionIds) {
      const s = state.streamingBySession[id];
      if (s?.isStreaming) return s;
    }
    return null;
  });

  // Convert store messages to ChatMessage shape
  const storeDerivedMessages: ChatMessage[] = (storeSession?.messages ?? []).map((m) => {
    if (m.role === 'assistant') {
      const rawToolParts = (m.metadata?.agentElementsParts as Array<Record<string, unknown>> | undefined) ?? [];
      const hasThinking = Boolean(m.thinking);
      const hasTools = rawToolParts.length > 0;

      if (hasThinking || hasTools) {
        const parts: Array<Record<string, unknown>> = [];
        if (hasThinking) {
          parts.push({ type: 'reasoning', text: m.thinking, reasoningId: `${m.id}-thinking` });
        }
        for (const tp of rawToolParts) {
          const rawType = String(tp.type ?? '');
          const toolName = rawType.startsWith('tool-') ? rawType.slice(5) : rawType;
          parts.push({ type: 'dynamic-tool', toolName, toolCallId: tp.toolCallId, input: tp.input, state: tp.state ?? 'output-available', result: tp.result ?? tp.output, error: tp.error });
        }
        if (m.content) parts.push({ type: 'text', text: typeof m.content === 'string' ? m.content : '' });
        return {
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: parts as any,
          createdAt: m.timestamp ? new Date(m.timestamp) : new Date(),
          metadata: m.metadata as ChatMessage['metadata'],
        };
      }
    }
    const pluginMention = m.metadata?.pluginMention as
      | { kind: 'plugin' | 'connector'; id: string; name: string }
      | undefined;
    let metadata: ChatMessage['metadata'] = m.metadata
      ? { ...(m.metadata as Record<string, unknown>) }
      : undefined;
    if (pluginMention) {
      metadata = { ...metadata, pluginMention };
    }
    return {
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: typeof m.content === 'string' ? m.content : '',
      createdAt: m.timestamp ? new Date(m.timestamp) : new Date(),
      metadata,
    };
  });

  // Merge linked session messages
  const linkedMessages: ChatMessage[] = linkedSessions.flatMap((session) =>
    (session?.messages ?? []).map((m) => {
      const agentMeta = session?.metadata?.agentId
        ? { agentId: session.metadata.agentId, agentName: session.metadata.agentName }
        : undefined;
      if (m.role === 'assistant' && m.thinking) {
        const parts: Array<{type: string; text?: string; reasoningId?: string}> = [
          { type: 'reasoning', text: m.thinking, reasoningId: `${m.id}-thinking` },
          { type: 'text', text: typeof m.content === 'string' ? m.content : '' },
        ];
        return {
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: parts as any,
          createdAt: m.timestamp ? new Date(m.timestamp) : new Date(),
          metadata: agentMeta,
        };
      }
      return {
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : '',
        createdAt: m.timestamp ? new Date(m.timestamp) : new Date(),
        metadata: agentMeta,
      };
    })
  );

  const allMessages = [...storeDerivedMessages, ...linkedMessages];
  // Deduplicate by ID (in case main session and linked sessions overlap)
  const dedupedMessages = allMessages.filter((m, idx, arr) =>
    arr.findIndex((other) => other.id === m.id) === idx
  );

  const messages = conversationId ? dedupedMessages : (messagesProp ?? []);
  const isLoading = conversationId
    ? ((storeStreaming?.isStreaming ?? false) || (linkedStreaming?.isStreaming ?? false))
    : (isLoadingProp ?? false);

  const currentRunningTool = useMemo(
    () => (isLoading ? getCurrentRunningTool(messages) : null),
    [messages, isLoading]
  );

  // Run/work events for the inline work blocks. Mode sessions don't carry a
  // cloud run id (see cowork.types.ts / CoworkSessionStore — no runId field
  // exists on either side), so we bind to the most recent cowork-mode
  // pipeline run from the cloud runs API and poll its event stream. The
  // events hook degrades to [] when the runs API is unavailable, so the
  // transcript never breaks on a missing backend.
  const { runs: coworkRuns, refresh: refreshCoworkRuns, unsupported: runsUnsupported } =
    useCoworkRuns(undefined, { enabled: Boolean(sessionId) });
  useEffect(() => {
    if (!sessionId || runsUnsupported) return;
    void refreshCoworkRuns();
    const id = window.setInterval(() => void refreshCoworkRuns(), RUNS_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [sessionId, runsUnsupported, refreshCoworkRuns]);

  const activeRunId = useMemo(() => {
    if (!sessionId) return null;
    const sorted = coworkRuns
      .filter((r) => r.mode === 'cowork')
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    return sorted[0]?.id ?? null;
  }, [coworkRuns, sessionId]);

  const { events: runEvents } = useCoworkRunEvents(activeRunId);

  const events = useMemo(
    () => (activeRunId ? mapRunEventsToCoworkEvents(runEvents, activeRunId, sessionId) : []),
    [runEvents, activeRunId, sessionId],
  );

  // Pagination: large transcripts render only the most recent messages to keep
  // DOM weight and render time bounded. A "load more" button reveals earlier
  // history in chunks.
  const PAGE_SIZE = 100;
  const [renderLimit, setRenderLimit] = useState(PAGE_SIZE);
  const displayedMessages = useMemo(
    () => messages.slice(-renderLimit),
    [messages, renderLimit],
  );
  const timeline = mergeTimeline(displayedMessages, events);

  // Subscribe to transition controller for session-switch loading states
  const [transitionState, setTransitionState] = useState(coworkTransitionController.getState());
  useEffect(() => {
    const unsub = coworkTransitionController.subscribe(setTransitionState);
    return unsub;
  }, []);

  // Reset pagination when the conversation or session changes.
  useEffect(() => {
    setRenderLimit(PAGE_SIZE);
  }, [conversationId, sessionId]);

  // Merge transition loading into isLoading
  const isTransitioning =
    (transitionState.transitionState === 'switching' || transitionState.transitionState === 'loading') &&
    transitionState.intendedSessionId === conversationId;
  const effectiveIsLoading = isLoading || isTransitioning;

  const canLoadMore = messages.length > renderLimit;

  return (
    <div className={cn('relative', hudMode ? 'space-y-2' : 'space-y-4')}>
      {canLoadMore && (
        <div className="flex justify-center py-2">
          <button
            type="button"
            onClick={() => setRenderLimit((limit) => limit + PAGE_SIZE)}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
          >
            Load earlier messages ({messages.length - renderLimit} remaining)
          </button>
        </div>
      )}
      {isTransitioning && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Switching session…
          </div>
        </div>
      )}
      {timeline.map((item, idx) => {
        const isLast = idx === timeline.length - 1;

        if (item.type === 'message') {
          const msg = item.data as ChatMessage;
          const isStreamingThis = effectiveIsLoading && isLast;
          return (
            <StreamingChatComposer
              key={item.id}
              message={msg}
              isLoading={isStreamingThis}
              isLast={isLast}
              onRegenerate={onRegenerate}
              viewMode={isStreamingThis ? 'verbose' : 'normal'}
              onSelectArtifact={onSelectArtifact}
              selectedArtifactTitle={selectedArtifactTitle}
              conversationId={conversationId}
            />
          );
        }

        // Inline work block from the bound cloud run's event stream
        return (
          <div key={item.id} className="max-w-2xl mx-auto">
            <CoworkWorkBlock
              event={item.data}
              isStreaming={effectiveIsLoading && isLast}
            />
          </div>
        );
      })}

      {/* Live tool badge — shows inline below the last message while a tool is running */}
      {currentRunningTool && (
        <div style={{ paddingLeft: 4 }}>
          <LiveToolBadge toolName={currentRunningTool} />
        </div>
      )}

      {/* Inline approval/question cards rendered inside the thread.
          Only mounted for chat-session-backed transcripts (conversationId).
          CoworkRoot already runs its own approval gate poller for cowork sessions. */}
      {!effectiveIsLoading && conversationId && (
        <ChatThreadInlineGate
          sessionId={conversationId}
          surface={surface}
          className={hudMode ? 'px-1' : 'px-2 md:px-5'}
        />
      )}

      {timeline.length === 0 && !effectiveIsLoading && !hideEmptyState && !hudMode && (
        <div className="text-center py-12" style={{ color: 'var(--ui-text-muted)' }}>
          <p>Session started. Send a message to begin.</p>
        </div>
      )}
    </div>
  );
});

export default CoworkTranscript;
