"use client";

/**
 * Canvas tile mirroring an orchestrator executor session (managed or
 * discovered ao-* tmux session). Polls status + transcript tail, and exposes
 * the orchestrator controls: steer (send), watch (completion report), review
 * accept/reject, kill / dismiss.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  PaperPlaneRight,
  Eye,
  Check,
  X as XIcon,
  Skull,
  Trash,
} from '@phosphor-icons/react';
import { useCodeModeStore, CANVAS_TILE_DEFAULT_SIZE, type CodeCanvasTile } from '@/views/code/CodeModeStore';
import {
  getExecutorStatus,
  tailExecutor,
  sendExecutorMessage,
  watchExecutor,
  reviewExecutor,
  killExecutor,
  type ExecutorSession,
  type ExecutorState,
  type ReviewResult,
} from '@/views/code/orchestrator.service';
import { railsApi } from '@/lib/agents/rails.service';
import { isRailsApiEnabled } from '@/lib/env';
import { artifactFromReference, type CodeArtifact } from '@/views/code/artifacts';

const STATE_COLOR: Record<ExecutorState, string> = {
  spawning: 'var(--status-warning)',
  running: 'var(--status-info)',
  done: 'var(--status-success)',
  dead: 'var(--status-error)',
  killed: 'var(--text-muted)',
};

const TERMINAL_STATES: ExecutorState[] = ['done', 'dead', 'killed'];

export function ExecutorStateBadge({
  state,
  external,
}: {
  state?: ExecutorState;
  external?: boolean;
}) {
  const resolved = state ?? 'spawning';
  const color = STATE_COLOR[resolved];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        color,
        padding: '1px 7px',
        borderRadius: 999,
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {external ? 'EXT·' : ''}
      {resolved.toUpperCase()}
    </span>
  );
}

const controlButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 9px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
};

export function CodeCanvasTileExecutor({
  tile,
  workspaceId,
}: {
  tile: CodeCanvasTile;
  workspaceId: string;
}) {
  const slug = tile.executorSlug;
  const removeCanvasTile = useCodeModeStore((s) => s.removeCanvasTile);
  const addCanvasTile = useCodeModeStore((s) => s.addCanvasTile);
  const [session, setSession] = useState<ExecutorSession | null>(null);
  const [tail, setTail] = useState('');
  const [artifacts, setArtifacts] = useState<CodeArtifact[]>([]);
  const [prompt, setPrompt] = useState('');
  const [report, setReport] = useState<ReviewResult | null>(null);
  const [busy, setBusy] = useState<'watch' | 'send' | 'kill' | 'review' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tailRef = useRef<HTMLPreElement>(null);

  const state: ExecutorState | undefined = session?.state;
  const isTerminal = state !== undefined && TERMINAL_STATES.includes(state);

  const refresh = useCallback(async () => {
    if (!slug) return;
    try {
      const [status, output, receiptPage] = await Promise.all([
        getExecutorStatus(slug),
        tailExecutor(slug, 120).catch(() => ({ output: '' })),
        // The orchestrator bridge tags executor receipts with node_id = slug.
        // Receipts live on /api/rails (Rust allternit-api :8013) — resolve to
        // null when the Rails API is disabled by flag instead of polling it.
        isRailsApiEnabled()
          ? railsApi.receipts.query({ node_id: slug, limit: 50 }).catch(() => null)
          : Promise.resolve(null),
      ]);
      setSession(status.session);
      setTail(typeof output === 'string' ? output : output.output);
      if (receiptPage) {
        setArtifacts(
          receiptPage.receipts.flatMap((receipt) => {
            const payload = receipt.payload;
            if (!payload || typeof payload !== 'object') return [];
            const record = payload as Record<string, unknown>;
            return [record.artifact, record.artifact_url, record.path, record.file]
              .filter((value): value is string => typeof value === 'string')
              .map((reference) => ({
                ...artifactFromReference(reference, receipt.run_id),
                id: `${receipt.receipt_id}:${reference}`,
                source: 'tool' as const,
                receiptId: receipt.receipt_id,
                createdAt: new Date(receipt.timestamp).getTime(),
              }));
          }),
        );
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Executor status unavailable');
    }
  }, [slug]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(interval);
  }, [refresh]);

  // Keep the transcript pinned to the bottom as new output arrives.
  useEffect(() => {
    const el = tailRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [tail]);

  const handleSend = useCallback(async () => {
    if (!slug || !prompt.trim()) return;
    setBusy('send');
    try {
      const result = await sendExecutorMessage(slug, prompt.trim());
      if (!result.submitted) {
        setError(result.reason ?? 'Message was not accepted by the executor');
      } else {
        setPrompt('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setBusy(null);
    }
  }, [slug, prompt]);

  const handleWatch = useCallback(async () => {
    if (!slug) return;
    setBusy('watch');
    try {
      setReport(await watchExecutor(slug));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Watch failed');
    } finally {
      setBusy(null);
    }
  }, [slug]);

  const handleReview = useCallback(
    async (decision: 'accepted' | 'rejected') => {
      if (!slug) return;
      setBusy('review');
      try {
        await reviewExecutor(slug, decision);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Review failed');
      } finally {
        setBusy(null);
      }
    },
    [slug, refresh],
  );

  const handleKill = useCallback(async () => {
    if (!slug) return;
    setBusy('kill');
    try {
      await killExecutor(slug);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kill failed');
    } finally {
      setBusy(null);
    }
  }, [slug, refresh]);

  const openArtifact = useCallback(
    (artifact: CodeArtifact) => {
      const reference = artifact.uri ?? artifact.name;
      const isLink = artifact.kind === 'link';
      const type = artifact.kind === 'diff' ? 'diff' : 'preview';
      const size = CANVAS_TILE_DEFAULT_SIZE[type];
      addCanvasTile(workspaceId, {
        type,
        x: tile.x + 40,
        y: tile.y + 40,
        width: size.width,
        height: size.height,
        zIndex: Date.now(),
        label: artifact.name,
        url: isLink ? reference : undefined,
        filePath: isLink ? undefined : reference,
      });
    },
    [addCanvasTile, workspaceId, tile.x, tile.y],
  );

  if (!slug) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        Executor tile is missing its slug.
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Action bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => void handleWatch()}
          disabled={busy !== null}
          style={controlButtonStyle}
          className="border border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer"
          title="Watch for the completion report"
        >
          <Eye size={12} />
          {busy === 'watch' ? 'Watching…' : 'Watch'}
        </button>
        <button
          type="button"
          onClick={() => void handleReview('accepted')}
          disabled={busy !== null || state !== 'done'}
          style={{ ...controlButtonStyle, opacity: state === 'done' ? 1 : 0.45 }}
          className="border border-[var(--border-subtle)] bg-transparent text-[var(--status-success)] hover:bg-[var(--surface-hover)] cursor-pointer"
          title="Accept the executor's work"
        >
          <Check size={12} />
          Accept
        </button>
        <button
          type="button"
          onClick={() => void handleReview('rejected')}
          disabled={busy !== null || state !== 'done'}
          style={{ ...controlButtonStyle, opacity: state === 'done' ? 1 : 0.45 }}
          className="border border-[var(--border-subtle)] bg-transparent text-[var(--status-error)] hover:bg-[var(--surface-hover)] cursor-pointer"
          title="Reject and send back"
        >
          <XIcon size={12} />
          Reject
        </button>
        {isTerminal ? (
          <button
            type="button"
            onClick={() => removeCanvasTile(workspaceId, tile.tileId)}
            style={{ ...controlButtonStyle, marginLeft: 'auto' }}
            className="border border-[var(--border-subtle)] bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-hover)] cursor-pointer"
            title="Remove this tile from the canvas"
          >
            <Trash size={12} />
            Dismiss
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleKill()}
            disabled={busy !== null}
            style={{ ...controlButtonStyle, marginLeft: 'auto' }}
            className="border border-[var(--border-subtle)] bg-transparent text-[var(--status-error)] hover:bg-[var(--surface-hover)] cursor-pointer"
            title="Kill the executor session"
          >
            <Skull size={12} />
            {busy === 'kill' ? 'Killing…' : 'Kill'}
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: '4px 10px',
            fontSize: 11,
            color: 'var(--status-error)',
            borderBottom: '1px solid color-mix(in srgb, var(--status-error) 24%, transparent)',
            background: 'var(--status-error-bg)',
            flexShrink: 0,
          }}
        >
          {error}
        </div>
      )}

      {/* Artifact strip — live outputs the executor has announced via rails */}
      {artifacts.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            overflowX: 'auto',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          {artifacts.map((artifact) => (
            <button
              key={artifact.id}
              type="button"
              onClick={() => openArtifact(artifact)}
              title={`${artifact.kind} · ${artifact.uri ?? artifact.name}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 9px',
                borderRadius: 999,
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-panel)',
                color: 'var(--text-secondary)',
                fontSize: 10,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {artifact.name}
            </button>
          ))}
        </div>
      )}

      {/* Transcript tail */}
      <pre
        ref={tailRef}
        style={{
          flex: 1,
          minHeight: 0,
          margin: 0,
          padding: 10,
          overflow: 'auto',
          background: 'var(--surface-panel)',
          color: 'var(--text-secondary)',
          fontSize: 11,
          lineHeight: 1.5,
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {tail || (session ? 'Waiting for output…' : 'Connecting to executor…')}
      </pre>

      {/* Steer input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: 8,
          borderTop: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={isTerminal ? 'Executor has ended' : 'Steer this agent…'}
          disabled={isTerminal}
          aria-label="Message to executor"
          style={{
            flex: 1,
            minWidth: 0,
            padding: '6px 10px',
            borderRadius: 7,
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-panel)',
            color: 'var(--text-primary)',
            fontSize: 12,
            outline: 'none',
            opacity: isTerminal ? 0.5 : 1,
          }}
        />
        <button
          type="submit"
          disabled={busy !== null || isTerminal || !prompt.trim()}
          aria-label="Send to executor"
          style={{
            ...controlButtonStyle,
            padding: '6px 10px',
            opacity: isTerminal || !prompt.trim() ? 0.45 : 1,
          }}
          className="border border-[var(--border-subtle)] bg-transparent text-[var(--accent-code)] hover:bg-[var(--surface-hover)] cursor-pointer"
        >
          <PaperPlaneRight size={13} />
        </button>
      </form>

      {/* Completion report overlay */}
      {report && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            background: 'color-mix(in srgb, var(--surface-floating) 92%, transparent)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            flexDirection: 'column',
            padding: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              Completion report
            </span>
            <button
              type="button"
              onClick={() => setReport(null)}
              aria-label="Close report"
              style={controlButtonStyle}
              className="border border-[var(--border-subtle)] bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-hover)] cursor-pointer"
            >
              <XIcon size={12} />
            </button>
          </div>
          <pre
            style={{
              flex: 1,
              minHeight: 0,
              margin: 0,
              overflow: 'auto',
              fontSize: 11,
              lineHeight: 1.55,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {formatReport(report)}
          </pre>
        </div>
      )}
    </div>
  );
}

function formatReport(result: ReviewResult): string {
  const { outcome } = result;
  if (outcome.kind === 'done') {
    const r = outcome.report;
    const lines = [
      `status: ${r.status}`,
      `notes: ${r.notesPath}`,
      '',
      'files changed:',
      ...(r.filesChanged.length ? r.filesChanged.map((f) => `  ${f}`) : ['  (none)']),
    ];
    if (r.deviations.length) {
      lines.push('', 'deviations:', ...r.deviations.map((d) => `  ${d}`));
    }
    if (r.remaining.length) {
      lines.push('', 'remaining:', ...r.remaining.map((d) => `  ${d}`));
    }
    lines.push('', r.notesBody);
    return lines.join('\n');
  }
  if (outcome.kind === 'dead') {
    return `Executor died before completing.\ntranscript: ${outcome.transcriptPath ?? 'unknown'}`;
  }
  return 'Watch timed out before the executor completed.';
}

// Referenced by the canvas sync hook; kept here so the tile module is the
// single place that knows how executor state maps to visuals.
export function executorBadgeFor(
  session: ExecutorSession | undefined,
): React.ReactNode {
  return <ExecutorStateBadge state={session?.state} external={session?.external} />;
}
