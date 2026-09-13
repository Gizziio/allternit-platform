'use client';

import React, { useEffect, useMemo } from 'react';
import { Briefcase, Plus } from '@phosphor-icons/react';
import { ChatViewWrapper } from '@/shell/ChatViewWrapper';
import { CoworkRoot } from '@/views/cowork/CoworkRoot';
import { useCoworkSessionStore } from '@/views/cowork/CoworkSessionStore';
import { ErrorBoundary } from '@/components/error-boundary';
import { cn } from '@/lib/utils';

export type FabricChatView = 'chat' | 'cowork';

/**
 * Fabric Transport chat-mode canvas. The default view is the exact desktop
 * chat surface (ChatViewWrapper — greeting, composer, model picker, thread);
 * selecting a cowork session switches the canvas to the desktop cowork
 * surface (CoworkRoot) and back. `allternit:open-view` events dispatched by
 * desktop views (viewType 'cowork' | 'chat' | 'home') drive the same switch.
 */
export function FabricChatModeCanvas({
  view,
  onView,
}: {
  view: FabricChatView;
  onView: (next: { view: FabricChatView }) => void;
}): React.ReactNode {
  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { viewType?: string }
        | undefined;
      if (!detail?.viewType) return;
      if (detail.viewType === 'cowork') {
        onView({ view: 'cowork' });
        return;
      }
      if (
        detail.viewType === 'chat' ||
        detail.viewType === 'home' ||
        detail.viewType === 'chat-legacy'
      ) {
        onView({ view: 'chat' });
      }
    };
    window.addEventListener('allternit:open-view', onOpen);
    return () => window.removeEventListener('allternit:open-view', onOpen);
  }, [onView]);

  if (view === 'cowork') {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <ErrorBoundary componentName="FabricCowork">
          <CoworkRoot />
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <ErrorBoundary componentName="FabricChat">
        <ChatViewWrapper />
      </ErrorBoundary>
    </div>
  );
}

function railRowClass(active: boolean): string {
  return cn(
    'w-full flex items-center gap-2.5 py-1.5 px-3 max-md:min-h-11 rounded-xl border-none cursor-pointer text-left transition-all duration-200 font-medium',
    active
      ? 'bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-semibold'
      : 'bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]',
  );
}

/**
 * Cowork section of the fabric chat rail: lists the account's cowork
 * sessions (same store the desktop shell rail uses). Selecting one activates
 * it in CoworkSessionStore and flips the chat-mode canvas to the desktop
 * cowork surface via the parent `onOpen`.
 */
export function FabricCoworkRailSection({
  active,
  onOpen,
}: {
  active: boolean;
  onOpen: () => void;
}): React.ReactNode {
  const sessions = useCoworkSessionStore((s) => s.sessions ?? []);
  const activeSessionId = useCoworkSessionStore((s) => s.activeSessionId);
  const setActiveSession = useCoworkSessionStore((s) => s.setActiveSession);

  const sorted = useMemo(
    () =>
      [...sessions].sort((a, b) =>
        String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')),
      ),
    [sessions],
  );

  return (
    <div className="flex flex-col gap-0.5">
      <div className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--shell-item-muted)]">
        Cowork
      </div>
      <button
        type="button"
        className={railRowClass(active && !activeSessionId)}
        onClick={() => {
          setActiveSession(null);
          onOpen();
        }}
      >
        <Plus size={15} weight="bold" className="text-[var(--shell-item-muted)]" />
        <span className="text-[12px]">New cowork session</span>
      </button>
      {sorted.length === 0 ? (
        <div className="px-3 py-2 text-[12px] text-[var(--shell-item-muted)]">
          No cowork sessions yet
        </div>
      ) : (
        sorted.slice(0, 8).map((session) => (
          <button
            key={session.id}
            type="button"
            className={railRowClass(active && activeSessionId === session.id)}
            onClick={() => {
              setActiveSession(session.id);
              onOpen();
            }}
          >
            <Briefcase size={15} weight="bold" />
            <span className="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">
              {session.name || 'Untitled session'}
            </span>
          </button>
        ))
      )}
    </div>
  );
}
