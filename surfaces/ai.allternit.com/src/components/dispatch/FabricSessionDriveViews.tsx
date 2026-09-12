'use client';

import React, { Suspense } from 'react';
import { Browser, Code, Monitor, Robot, TerminalWindow } from '@phosphor-icons/react';
import type { FabricDriveKind } from '@/lib/fabric-session-kind';
import type {
  FabricBot,
  FabricBrain,
  FabricSessionDetail,
  FabricSessionEvent,
  FabricSessionWithStatus,
} from '@/lib/dispatch/fabric-session-client';
import { cn } from '@/lib/utils';

const UnifiedTerminal = React.lazy(() => import('@/components/workspace/UnifiedTerminal'));

export function FabricKindIcon({ kind, size = 14 }: { kind: FabricDriveKind; size?: number }) {
  if (kind === 'code') return <Code size={size} weight="bold" />;
  if (kind === 'aci') return <Browser size={size} weight="bold" />;
  if (kind === 'bot') return <Robot size={size} weight="bold" />;
  if (kind === 'desktop') return <Monitor size={size} weight="bold" />;
  return <TerminalWindow size={size} weight="bold" />;
}

export function isFabricKeepalive(type?: string): boolean {
  return type === 'remote.heartbeat' || type === 'session-worker.heartbeat' || type === 'session-worker.connected';
}

export function FabricCodeDrive({
  session,
  terminalSessionId,
  terminalWorkingDir,
}: {
  /**
   * Optional when `terminalSessionId` is set — the Termius-style terminal
   * binds to a runtime-scoped id, so the code home screen can open a
   * terminal before any fabric session exists.
   */
  session?: FabricSessionWithStatus;
  detail: FabricSessionDetail | null;
  events: FabricSessionEvent[];
  /**
   * Override the terminal binding — e.g. the code-mode Terminal view
   * passes a runtime-scoped id so UnifiedTerminal manages its own
   * multi-session tabs instead of the fabric session's single terminal.
   */
  terminalSessionId?: string;
  terminalWorkingDir?: string;
}) {
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="min-h-0 flex-1 overflow-hidden bg-[var(--view-code-bg)]">
        <Suspense fallback={<div className="p-4 text-[12px] text-[var(--text-tertiary)]">Loading terminal…</div>}>
          <UnifiedTerminal
            sessionId={terminalSessionId ?? session?.session.id ?? 'fabric-terminal'}
            workingDir={terminalSessionId ? terminalWorkingDir : session?.session.directory}
          />
        </Suspense>
      </div>
    </div>
  );
}

function pickScreenshotString(record: Record<string, unknown> | null | undefined): string | null {
  if (!record) return null;
  const raw = record.screenshot ?? record.screenshot_b64;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function asImageSrc(raw: string): string {
  if (raw.startsWith('data:') || raw.startsWith('http') || raw.startsWith('blob:')) return raw;
  return `data:image/png;base64,${raw}`;
}

/** Live computer frame from an `/api/aci/stream` envelope, including nested ACU traces. */
export function extractAciScreenshot(frame: { type?: string; data?: Record<string, unknown> | null }): string | null {
  const data = (frame.data ?? {}) as Record<string, unknown>;
  const nested = data.data && typeof data.data === 'object' && !Array.isArray(data.data)
    ? (data.data as Record<string, unknown>)
    : null;
  const raw = pickScreenshotString(data) || pickScreenshotString(nested);
  return raw ? asImageSrc(raw) : null;
}

export function partImageSrc(part: Record<string, unknown>): string | null {
  const type = String(part.type || '');
  const mime = String(part.mime || part.mediaType || '');
  const url = typeof part.url === 'string' ? part.url
    : typeof part.src === 'string' ? part.src
    : typeof part.data === 'string' ? part.data
    : '';
  const looksImage = type === 'image' || type === 'file' || mime.startsWith('image/') || url.startsWith('data:image');
  if (!looksImage || !url) return null;
  if (url.startsWith('data:') || url.startsWith('http') || url.startsWith('blob:')) return url;
  if (mime.startsWith('image/') || type === 'image') return `data:${mime || 'image/png'};base64,${url}`;
  return null;
}

export function latestComputerFrame(
  detail: FabricSessionDetail | null,
  events: FabricSessionEvent[],
): string | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const props = events[i]?.properties as Record<string, unknown> | undefined;
    if (!props) continue;
    if (typeof props.screenshot === 'string' && props.screenshot) {
      return props.screenshot.startsWith('data:') ? props.screenshot : `data:image/png;base64,${props.screenshot}`;
    }
    const part = (props.part || props) as Record<string, unknown>;
    const src = partImageSrc(part);
    if (src) return src;
  }
  const messages = detail?.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    for (const part of messages[i].parts ?? []) {
      const src = partImageSrc(part as Record<string, unknown>);
      if (src) return src;
    }
  }
  return null;
}

export function mergeNodeBots(agents: FabricBot[], brains: FabricBrain[]): FabricBot[] {
  const fromBrains: FabricBot[] = brains
    .filter((brain) => brain.connected && brain.models.length > 0)
    .map((brain) => ({
      id: `brain:${brain.id}`,
      name: brain.name,
      description: `${brain.models.length} model${brain.models.length === 1 ? '' : 's'} on this node`,
      status: 'ready',
      provider: brain.id,
      model: brain.models[0]?.id,
    }));
  const seen = new Set(fromBrains.map((bot) => bot.name.toLowerCase()));
  const fromAgents = agents.filter((bot) => !seen.has(bot.name.toLowerCase()));
  return [...fromBrains, ...fromAgents];
}

export function FabricBotDrive({
  bots,
  sessions,
  selectedSessionId,
  selectedBotId,
  onSelectBot,
  onSelectSession,
  onOpenBot,
}: {
  bots: FabricBot[];
  sessions: FabricSessionWithStatus[];
  selectedSessionId: string | null;
  selectedBotId: string | null;
  onSelectBot: (id: string) => void;
  onSelectSession: (id: string) => void;
  onOpenBot: (bot: FabricBot) => void;
}) {
  if (bots.length === 0 && sessions.length === 0) {
    return (
      <div className="px-2 py-6 text-center">
        <Robot size={28} className="mx-auto mb-2 opacity-40" />
        <p className="text-[12px] font-medium text-[var(--shell-item-fg)] m-0 mb-1">No bots on this node</p>
        <p className="text-[11px] text-[var(--shell-item-muted)] m-0">
          Connected brains (Grok, Claude, Kimi, …) and Desktop bots show up here. Open one to run a session on this machine.
        </p>
      </div>
    );
  }

  const derived: FabricBot[] = bots.length > 0
    ? bots
    : Array.from(new Set(sessions.map((entry) => entry.session.agentID).filter(Boolean) as string[])).map(
        (id): FabricBot => ({
          id,
          name: id,
        })
      );

  return (
    <div className="flex flex-col gap-1">
      {derived.map((bot) => {
        const botSessions = sessions.filter((entry) => {
          if (entry.session.agentID === bot.id || entry.session.agentID === bot.provider) return true;
          const title = String(entry.session.title || '').toLowerCase();
          return Boolean(bot.name) && title.includes(bot.name.toLowerCase());
        });
        const selected = selectedBotId === bot.id;
        return (
          <div key={bot.id} className="rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => {
                onSelectBot(bot.id);
                if (botSessions[0]) onSelectSession(botSessions[0].session.id);
                else onOpenBot(bot);
              }}
              className={cn(
                'w-full text-left rounded-xl border-none px-3 py-2.5 cursor-pointer',
                selected
                  ? 'bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)]'
                  : 'bg-transparent text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]'
              )}
            >
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-[var(--surface-hover)] flex items-center justify-center shrink-0">
                  <Robot size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold truncate">{bot.name}</div>
                  <div className={cn('text-[10px] truncate', selected ? 'text-[var(--shell-item-active-fg)]' : 'text-[var(--shell-item-muted)]')}>
                    {bot.status || 'ready'}
                    {bot.provider ? ` · ${bot.provider}` : ''}
                    {bot.model ? ` · ${bot.model}` : ''}
                    {` · ${botSessions.length} session${botSessions.length === 1 ? '' : 's'}`}
                  </div>
                </div>
              </div>
            </button>
            {selected && botSessions.map(({ session, status }) => (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelectSession(session.id)}
                className={cn(
                  'w-full text-left border-none pl-12 pr-3 py-1.5 cursor-pointer text-[11px] truncate',
                  selectedSessionId === session.id
                    ? 'text-[var(--accent-primary)] font-semibold'
                    : 'text-[var(--shell-item-muted)]'
                )}
              >
                {session.title} · {status.type}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
