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

export function SearchOverlay({ open, onClose, onOpenSession }: SearchOverlayProps): JSX.Element | null {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const chatSessions = useChatSessionStore((s) => s.sessions);
  const codeSessions = useCodeSessionStore((s) => s.sessions);

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
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  useEffect(() => { setActiveIndex(0); }, [query]);

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
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 499,
          background: 'rgba(0,0,0,0.25)',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 56,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 500,
          width: '100%',
          maxWidth: 660,
          margin: '0 12px',
          borderRadius: 12,
          background: 'var(--shell-menu-bg, #1a1a1a)',
          border: '1px solid var(--shell-menu-border, rgba(255,255,255,0.1))',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 80px)',
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderBottom: '1px solid var(--shell-menu-border, rgba(255,255,255,0.08))',
            flexShrink: 0,
          }}
        >
          <MagnifyingGlass size={16} weight="bold" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats and projects"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 14,
              fontWeight: 400,
              color: 'var(--text-primary)',
            }}
          />
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              display: 'flex',
              padding: 4,
              borderRadius: 4,
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          style={{ overflowY: 'auto', flex: 1 }}
        >
          {results.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {results.map((session, i) => {
            const meta = SURFACE_META[session.surface] ?? SURFACE_META.chat;
            const Icon = meta.icon;
            const isActive = i === activeIndex;
            return (
              <button
                key={session.id}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => { onOpenSession?.(session.id, session.surface); onClose(); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '9px 16px',
                  background: isActive ? 'var(--shell-item-hover, rgba(255,255,255,0.06))' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'var(--text-primary)',
                }}
              >
                <Icon
                  size={16}
                  weight="duotone"
                  style={{ color: meta.color, flexShrink: 0 }}
                />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session.name || 'Untitled'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0, marginRight: isActive ? 8 : 0 }}>
                  {relativeLabel(session.updatedAt)}
                </span>
                {isActive && (
                  <ArrowBendDownLeft size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
