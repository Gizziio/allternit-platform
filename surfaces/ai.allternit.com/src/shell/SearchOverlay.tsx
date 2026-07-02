'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  MagnifyingGlass,
  X,
  ChatTeardropText,
  UsersThree,
  TerminalWindow,
  Globe,
  Palette,
  ArrowBendDownLeft,
} from '@phosphor-icons/react';
import { useChatSessionStore } from '../views/chat/ChatSessionStore';
import { useCodeSessionStore } from '../views/code/CodeSessionStore';
import { cn } from '@/lib/utils';

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  onOpenSession?: (id: string, surface: string) => void;
}

function relativeLabel(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const days = ms / 86400000;
  if (days < 1) return 'Today';
  if (days < 7) return 'Previous 7 days';
  if (days < 30) return 'Past month';
  if (days < 365) return 'Past year';
  return 'Older';
}

const SURFACE_META: Record<string, { icon: React.ElementType; color: string }> = {
  chat:    { icon: ChatTeardropText, color: '#D97757' },
  cowork:  { icon: UsersThree,      color: '#A78BFA' },
  code:    { icon: TerminalWindow,  color: '#79C47C' },
  browser: { icon: Globe,           color: '#69A8C8' },
  design:  { icon: Palette,         color: 'var(--accent-primary)' },
};

export function SearchOverlay({ open, onClose, onOpenSession }: SearchOverlayProps): React.ReactNode | null {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const chatSessions = useChatSessionStore((s) => s.sessions);
  const codeSessions = useCodeSessionStore((s) => s.sessions);

  // Inline state adjustment for query and open changes
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveIndex(0);
  }

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }

  const allSessions = useMemo(() => {
    const combined = [
      ...chatSessions.map((s) => ({ ...s, surface: s.metadata?.originSurface ?? 'chat' })),
      ...codeSessions.map((s) => ({ ...s, surface: s.metadata?.originSurface ?? 'code' })),
    ];
    combined.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return combined;
  }, [chatSessions, codeSessions]);

  const results = useMemo(() => {
    if (!query.trim()) return allSessions.slice(0, 20);
    const q = query.toLowerCase();
    return allSessions.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 20);
  }, [allSessions, query]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | undefined;
    if (open) {
      timeoutId = setTimeout(() => inputRef.current?.focus(), 40);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && results[activeIndex]) {
        const s = results[activeIndex];
        onOpenSession?.(s.id, s.surface);
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, results, activeIndex, onOpenSession]);

  // Scroll active row into view
  useEffect(() => {
    const row = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    row?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        role="button" tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
        className="fixed inset-0 z-[499] bg-black/25"
      />

      {/* Panel */}
      <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[500] w-full max-w-[660px] mx-3 rounded-xl bg-[var(--shell-menu-bg,#1a1a1a)] border border-solid border-[var(--shell-menu-border,rgba(255,255,255,0.1))] shadow-[0_24px_60px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[calc(100vh-80px)]">
        {/* Search input */}
        <div className="flex items-center gap-2.5 p-[12px_16px] border-b border-solid border-[var(--shell-menu-border,rgba(255,255,255,0.08))] shrink-0">
          <label htmlFor="global-search-input">
            <MagnifyingGlass size={16} weight="bold" className="text-[var(--text-tertiary)] shrink-0" />
          </label>
          <input 
            id="global-search-input"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats and projects"
            aria-label="Search chats and projects"
            className="flex-1 bg-transparent border-none outline-none text-[14px] font-normal text-[var(--text-primary)] font-inherit"
          />
          <button type="button"
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer text-[var(--text-tertiary)] flex p-1 rounded transition-colors hover:bg-white/5"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto"
        >
          {results.length === 0 && (
            <div className="p-[24px_16px] text-center text-[var(--text-tertiary)] text-[13px]">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {results.map((session, i) => {
            const meta = SURFACE_META[session.surface] ?? SURFACE_META.chat;
            const Icon = meta.icon;
            const isActive = i === activeIndex;
            return (
              <button type="button"
                key={session.id}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => { onOpenSession?.(session.id, session.surface); onClose(); }}
                className={cn(
                  "w-full flex items-center gap-3 p-[9px_16px] border-none cursor-pointer text-left text-[var(--text-primary)] transition-colors duration-75",
                  isActive ? "bg-[var(--shell-item-hover,rgba(255,255,255,0.06))]" : "bg-transparent"
                )}
              >
                <Icon
                  size={16}
                  weight="duotone"
                  className="shrink-0"
                  style={{ color: meta.color }}
                />
                <span className="flex-1 text-[14px] font-normal overflow-hidden text-ellipsis whitespace-nowrap">
                  {session.name || 'Untitled'}
                </span>
                <span className={cn("text-[12px] text-[var(--text-tertiary)] shrink-0", isActive ? "mr-2" : "mr-0")}>
                  {relativeLabel(session.updatedAt)}
                </span>
                {isActive && (
                  <ArrowBendDownLeft size={14} className="text-[var(--text-tertiary)] shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
