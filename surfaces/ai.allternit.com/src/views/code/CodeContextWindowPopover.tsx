"use client";

import React, { useMemo } from 'react';
import { useCodeSessionStore } from './CodeSessionStore';

const MAX_TOKENS = 200_000;
const RESERVED_AUTOCOMPACT = 33_000;
const RESERVED_DEFERRED_MCP = 28_200;
const RESERVED_DEFERRED_SYSTEM = 20_400;

function estimateTokens(text: string): number {
  return Math.max(0, Math.ceil(text.length / 3.7));
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return value.toString();
}

function UsageBar({ value }: { value: number }) {
  return (
    <div
      style={{
        height: 6,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height: '100%',
          background: '#61a0ff',
        }}
      />
    </div>
  );
}

export function CodeContextWindowPopover() {
  const activeSessionId = useCodeSessionStore((state) => state.activeSessionId);
  const sessions = useCodeSessionStore((state) => state.sessions);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );

  const viewModel = useMemo(() => {
    const messages = activeSession?.messages ?? [];
    const messageTokens = messages.reduce(
      (sum, message) => sum + estimateTokens(message.content) + estimateTokens(message.thinking ?? ''),
      0,
    );
    const systemPromptTokens = estimateTokens(activeSession?.metadata.systemPrompt ?? '') || 8_600;
    const systemToolsTokens = 8_400;
    const skillsTokens = activeSession?.metadata.agentFeatures?.tools ? 5_900 : 2_400;
    const memoryFilesTokens = (activeSession?.metadata.workspaceFiles?.length ?? 0) * 420 + 1_700;
    const mcpToolsTokens = activeSession?.metadata.agentFeatures?.automation ? 1_200 : 640;
    const customAgentsTokens = activeSession?.metadata.sessionMode === 'agent' ? 483 : 120;
    const totalUsed =
      messageTokens +
      systemPromptTokens +
      systemToolsTokens +
      skillsTokens +
      memoryFilesTokens +
      mcpToolsTokens +
      customAgentsTokens;

    const freeSpace = Math.max(
      0,
      MAX_TOKENS -
        totalUsed -
        RESERVED_AUTOCOMPACT -
        RESERVED_DEFERRED_MCP -
        RESERVED_DEFERRED_SYSTEM,
    );

    const rows = [
      ['Messages', messageTokens, '#61a0ff'],
      ['System prompt', systemPromptTokens, '#7ab0ff'],
      ['System tools', systemToolsTokens, '#8ab8ff'],
      ['Skills', skillsTokens, '#9fc3ff'],
      ['Memory files', memoryFilesTokens, '#b2ceff'],
      ['MCP tools', mcpToolsTokens, '#c5d8ff'],
      ['Custom agents', customAgentsTokens, '#d8e4ff'],
      ['MCP tools (deferred)', RESERVED_DEFERRED_MCP, 'rgba(255,255,255,0.44)'],
      ['System tools (deferred)', RESERVED_DEFERRED_SYSTEM, 'rgba(255,255,255,0.38)'],
      ['Autocompact buffer', RESERVED_AUTOCOMPACT, 'rgba(255,255,255,0.34)'],
      ['Free space', freeSpace, 'rgba(255,255,255,0.22)'],
    ].map(([label, tokens, color]) => ({
      label: label as string,
      tokens: tokens as number,
      color: color as string,
      pct: ((tokens as number) / MAX_TOKENS) * 100,
    }));

    return {
      totalUsed,
      pct: Math.round((totalUsed / MAX_TOKENS) * 100),
      rows,
      limits: [
        ['5-hour limit', Math.min(100, Math.round((messageTokens / 16_000) * 100)), 'resets 4h'],
        ['Weekly · all models', Math.min(100, Math.round((totalUsed / 900_000) * 100)), 'resets 5d'],
        ['Weekly · Claude Design', Math.min(100, Math.round((skillsTokens / 100_000) * 100)), 'resets 5d'],
        ['Sonnet only', Math.min(100, Math.round((systemPromptTokens / 250_000) * 100)), 'resets 5d'],
      ] as Array<[string, number, string]>,
    };
  }, [activeSession]);

  return (
    <div
      data-testid="code-context-window-popover"
      style={{
        width: 420,
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        background: '#1f1f1f',
        boxShadow: '0 18px 48px rgba(0,0,0,0.32)',
        padding: 14,
        color: 'var(--text-primary)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
        <div style={{ fontWeight: 600 }}>Context window</div>
        <div style={{ color: 'var(--text-secondary)' }}>
          {formatCompact(viewModel.totalUsed)} / {formatCompact(MAX_TOKENS)} ({viewModel.pct}%)
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <UsageBar value={viewModel.pct} />
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {viewModel.rows.map((row) => (
          <div
            key={row.label}
            style={{
              display: 'grid',
              gridTemplateColumns: '12px 1fr auto auto',
              gap: 10,
              alignItems: 'center',
              fontSize: 13,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: row.color,
              }}
            />
            <span style={{ color: 'var(--text-primary)' }}>{row.label}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{formatCompact(row.tokens)}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{row.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>Plan usage</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {viewModel.limits.map(([label, pct, reset]) => (
            <div key={label}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  marginBottom: 6,
                }}
              >
                <span>{label}</span>
                <span>{pct}% · {reset}</span>
              </div>
              <UsageBar value={pct} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
