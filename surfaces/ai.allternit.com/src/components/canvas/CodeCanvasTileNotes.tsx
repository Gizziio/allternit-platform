"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { NotePencil, UsersThree } from '@phosphor-icons/react';
import { filesApi } from '@/lib/agents/files-api';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('CodeCanvasTileNotes');

interface CodeCanvasTileNotesProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  /** Bind this tile to the workspace shared-context file (agent context bus). */
  shared?: boolean;
  workspacePath?: string;
}

const SHARED_FILE_RELATIVE = '.allternit/shared-context.md';

function seedSharedContext(workspacePath: string): string {
  const name = workspacePath.split('/').filter(Boolean).pop() ?? 'workspace';
  return `# Shared Context — ${name}

Shared scratchpad for every agent and terminal in this workspace.
Humans edit it from the canvas Notes tile; agents read and append from disk.

## How agents use this file
- Read freely for context other agents left behind.
- Append progress notes under "## Agent log" as:
  ### <agent-slug> <ISO-8601 timestamp>
  <one or two lines: what changed, what is next, where artifacts live>
- Append only. Do not rewrite other agents' entries.

## Agent log

`;
}

type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export function CodeCanvasTileNotes({
  initialContent = '',
  onChange,
  shared = false,
  workspacePath,
}: CodeCanvasTileNotesProps) {
  const sharedActive = shared && Boolean(workspacePath);
  const filePath = workspacePath ? `${workspacePath}/${SHARED_FILE_RELATIVE}` : null;
  const [content, setContent] = useState(initialContent);
  const [status, setStatus] = useState<SaveStatus>(sharedActive ? 'loading' : 'idle');
  const contentRef = useRef(content);
  contentRef.current = content;
  const lastSavedRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  // Load (and seed) the shared file on mount.
  useEffect(() => {
    if (!sharedActive || !filePath || !workspacePath) return;
    let cancelled = false;

    const load = async () => {
      setStatus('loading');
      try {
        if (!(await filesApi.fileExists(filePath))) {
          await filesApi.writeFile({ path: filePath, content: seedSharedContext(workspacePath) });
        }
        const remote = await filesApi.readFile({ path: filePath });
        if (cancelled) return;
        lastSavedRef.current = remote.content;
        dirtyRef.current = false;
        setContent(remote.content);
        setStatus('saved');
      } catch (error) {
        if (cancelled) return;
        logger.warn({ error }, 'Failed to load shared context');
        setStatus('error');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [sharedActive, filePath, workspacePath]);

  // Poll for external edits (agents appending from disk).
  useEffect(() => {
    if (!sharedActive || !filePath) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const remote = await filesApi.readFile({ path: filePath });
        if (cancelled) return;
        if (remote.content === lastSavedRef.current) return;
        if (dirtyRef.current) return; // do not clobber an in-progress edit
        lastSavedRef.current = remote.content;
        setContent(remote.content);
      } catch {
        // Transient read failure; the next poll retries.
      }
    };

    const interval = window.setInterval(() => {
      void poll();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [sharedActive, filePath]);

  const persist = useCallback(
    async (next: string) => {
      if (!filePath) return;
      setStatus('saving');
      try {
        await filesApi.writeFile({ path: filePath, content: next });
        lastSavedRef.current = next;
        dirtyRef.current = false;
        setStatus('saved');
      } catch (error) {
        logger.warn({ error }, 'Failed to save shared context');
        setStatus('error');
      }
    },
    [filePath],
  );

  const persistRef = useRef(persist);
  persistRef.current = persist;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      setContent(next);
      if (!sharedActive) {
        onChange?.(next);
        return;
      }
      dirtyRef.current = true;
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        void persistRef.current(contentRef.current);
      }, 800);
    },
    [onChange, sharedActive],
  );

  // Flush a pending save on unmount.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        if (dirtyRef.current) void persistRef.current(contentRef.current);
      }
    };
  }, []);

  const headerLabel = shared ? 'Shared context' : 'Notes';
  const statusLabel =
    status === 'loading'
      ? 'loading…'
      : status === 'saving'
        ? 'saving…'
        : status === 'saved'
          ? 'synced'
          : status === 'error'
            ? 'sync error'
            : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderBottom: '1px solid var(--ui-border-muted)',
          background: 'var(--surface-hover)',
          flexShrink: 0,
        }}
      >
        {shared ? (
          <UsersThree size={12} color="var(--text-tertiary)" />
        ) : (
          <NotePencil size={12} color="var(--text-tertiary)" />
        )}
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{headerLabel}</span>
        {statusLabel && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: status === 'error' ? 'var(--status-error)' : 'var(--text-muted)',
            }}
          >
            {statusLabel}
          </span>
        )}
      </div>
      {shared && !workspacePath ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            color: 'var(--text-muted)',
            fontSize: 12,
            textAlign: 'center',
          }}
        >
          Shared notes need a workspace with a root path.
        </div>
      ) : (
        <textarea
          className="focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
          aria-label={shared ? 'Shared agent context' : 'Type notes here…'}
          value={content}
          onChange={handleChange}
          placeholder={shared ? 'Loading shared context…' : 'Type notes here…'}
          spellCheck={false}
          style={{
            flex: 1,
            minHeight: 0,
            padding: 12,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 13,
            lineHeight: 1.6,
            resize: 'none',
            fontFamily: shared ? 'var(--font-mono)' : 'inherit',
          }}
        />
      )}
    </div>
  );
}
