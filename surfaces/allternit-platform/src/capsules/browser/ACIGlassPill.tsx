"use client";

/**
 * ACIGlassPill — Agent Computer Interface state overlay
 *
 * Floats inside the ACI viewport (top-left). Shows what the engine is
 * doing right now: action label, step progress, adapter, controls.
 *
 * Inspired by: Kimi's Computer header pattern.
 * Allternit aesthetic: dark glass, copper accent, minimal chrome.
 *
 * Hidden when idle. Appears on engine activity. No heavy strips.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Square,
  Pause,
  Play,
  Check,
  X,
  Monitor,
} from '@phosphor-icons/react';
import { useBrowserAgentStore } from './browserAgent.store';
import { BACKGROUND, SAND, STATUS, TEXT } from '@/design/allternit.tokens';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + '…';
}

function formatAdapter(adapterId: string | null): string | null {
  if (!adapterId) return null;
  // "browser.platform_webview" → "platform_webview"
  const parts = adapterId.split('.');
  return parts.length > 1 ? parts.slice(1).join('.') : adapterId;
}

// ─────────────────────────────────────────────────────────
// Pill visibility logic
// ─────────────────────────────────────────────────────────

type VisibilityPhase = 'hidden' | 'entering' | 'visible' | 'exiting';

function useVisibility(active: boolean): VisibilityPhase {
  const [phase, setPhase] = useState<VisibilityPhase>('hidden');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (active) {
      setPhase('entering');
      timerRef.current = setTimeout(() => setPhase('visible'), 20);
    } else {
      if (phase === 'hidden') return;
      setPhase('exiting');
      timerRef.current = setTimeout(() => setPhase('hidden'), 400);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return phase;
}

// ─────────────────────────────────────────────────────────
// Status dot
// ─────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const isRunning = status === 'Running';
  const isWaiting = status === 'WaitingApproval';
  const isBlocked = status === 'Blocked';
  const isDone    = status === 'Done';

  const color = isRunning  ? SAND[500]
              : isWaiting  ? STATUS.warning
              : isBlocked  ? STATUS.error
              : isDone     ? STATUS.success
              : 'var(--ui-text-muted)';

  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        animation: isRunning ? 'aci-pulse 1.8s ease-in-out infinite' : 'none',
        boxShadow: isRunning ? `0 0 6px ${color}99` : 'none',
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────
// Action text
// ─────────────────────────────────────────────────────────

function resolveActionText(
  lastEventMessage: string | null,
  currentActionLabel: string | undefined,
  status: string,
  goal: string,
): string {
  if (status === 'Done') return 'Done';
  if (status === 'Blocked') return 'Paused';
  if (lastEventMessage) return truncate(lastEventMessage, 52);
  if (currentActionLabel) return truncate(currentActionLabel, 52);
  if (goal) return truncate(goal, 52);
  return 'Running…';
}

// ─────────────────────────────────────────────────────────
// Pill button
// ─────────────────────────────────────────────────────────

function PillButton({
  onClick,
  title,
  children,
  accent,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  accent?: 'green' | 'red';
}) {
  const bg = accent === 'green' ? 'rgba(16,185,129,0.15)'
           : accent === 'red'   ? '#ef44441f'
           : 'var(--ui-border-muted)';
  const hoverBg = accent === 'green' ? 'rgba(16,185,129,0.25)'
                : accent === 'red'   ? '#ef444438'
                : 'var(--ui-border-default)';
  const color = accent === 'green' ? STATUS.success
              : accent === 'red'   ? STATUS.error
              : 'rgba(255,255,255,0.55)';

  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: 6,
        border: 'none',
        background: hovered ? hoverBg : bg,
        color: hovered ? (accent ? color : 'rgba(255,255,255,0.85)') : color,
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.15s, color 0.15s',
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────
// ACIGlassPill
// ─────────────────────────────────────────────────────────

export interface ACIGlassPillProps {
  /** Override placement — defaults to top-left */
  placement?: 'top-left' | 'top-right' | 'bottom-center';
  /** Extra bottom offset in px for bottom-center placement (e.g. to clear an agent bar) */
  bottomOffset?: number;
}

export function ACIGlassPill({ placement = 'top-left', bottomOffset = 0 }: ACIGlassPillProps) {
  const status              = useBrowserAgentStore((s) => s.status);
  const goal                = useBrowserAgentStore((s) => s.goal);
  const currentAction       = useBrowserAgentStore((s) => s.currentAction);
  const lastEventMessage    = useBrowserAgentStore((s) => s.lastEventMessage);
  const currentAdapterId    = useBrowserAgentStore((s) => s.currentAdapterId);
  const currentLayer        = useBrowserAgentStore((s) => s.currentLayer);
  const fallbackCount       = useBrowserAgentStore((s) => s.fallbackCount);
  const requiresApproval    = useBrowserAgentStore((s) => s.requiresApproval);
  const approvalActionSummary = useBrowserAgentStore((s) => s.approvalActionSummary);
  const approveAction       = useBrowserAgentStore((s) => s.approveAction);
  const denyAction          = useBrowserAgentStore((s) => s.denyAction);
  const stopExecution       = useBrowserAgentStore((s) => s.stopExecution);
  const pauseExecution      = useBrowserAgentStore((s) => s.pauseExecution);
  const resumeExecution     = useBrowserAgentStore((s) => s.resumeExecution);

  const isActive = status === 'Running' || status === 'WaitingApproval' || status === 'Blocked' || status === 'Done';
  const phase = useVisibility(isActive);

  if (phase === 'hidden') return null;

  const actionText = requiresApproval && approvalActionSummary
    ? truncate(approvalActionSummary, 52)
    : resolveActionText(lastEventMessage, currentAction?.label, status, goal);

  const stepIndex  = currentAction?.stepIndex ?? null;
  const totalSteps = currentAction?.totalSteps ?? null;
  const hasSteps   = stepIndex !== null && totalSteps !== null && totalSteps > 1;

  const adapter = formatAdapter(currentAdapterId);

  // Placement
  const placementStyle: React.CSSProperties =
    placement === 'top-right'    ? { top: 14, right: 14 }
    : placement === 'bottom-center' ? { bottom: 14 + bottomOffset, left: '50%', transform: 'translateX(-50%)' }
    : { top: 14, left: 14 };

  // Fade/slide animation
  const opacityStyle: React.CSSProperties = {
    opacity: phase === 'visible' ? 1 : 0,
    transform: phase === 'visible'
      ? (placement === 'bottom-center' ? 'translateX(-50%) translateY(0)' : 'translateY(0)')
      : (placement === 'bottom-center' ? 'translateX(-50%) translateY(6px)' : 'translateY(-6px)'),
    transition: phase === 'exiting'
      ? 'opacity 0.35s ease, transform 0.35s ease'
      : 'opacity 0.22s ease, transform 0.22s ease',
  };

  return (
    <>
      <style>{`
        @keyframes aci-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #D4B08C99; }
          50% { opacity: 0.5; box-shadow: 0 0 2px #D4B08C55; }
        }
        @keyframes aci-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          position: 'absolute',
          ...placementStyle,
          ...opacityStyle,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          pointerEvents: 'auto',
        }}
      >
        {/* ── Main pill ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 10px',
            background: 'rgba(20, 18, 16, 0.86)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: requiresApproval
              ? `1px solid ${STATUS.warning}59`
              : `1px solid ${SAND[500]}2e`,
            borderRadius: 12,
            boxShadow: requiresApproval
              ? `0 0 0 1px ${STATUS.warning}1a, 0 4px 24px rgba(0,0,0,0.45)`
              : '0 4px 24px rgba(0,0,0,0.45)',
            minWidth: 0,
            maxWidth: 420,
          }}
        >
          {/* ACI label + dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <Monitor size={11} style={{ color: `${SAND[500]}8c`, flexShrink: 0 }} />
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: `${SAND[500]}a6`,
              textTransform: 'uppercase',
              fontFamily: 'monospace',
            }}>
              ACI
            </span>
            <StatusDot status={status} />
          </div>

          {/* Divider */}
          <span style={{ width: 1, height: 14, background: 'var(--ui-border-default)', flexShrink: 0 }} />

          {/* Action text */}
          <span style={{
            fontSize: 12,
            color: requiresApproval ? STATUS.warning : '#DEDEDE',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
            minWidth: 0,
          }}>
            {actionText}
          </span>

          {/* Step counter */}
          {hasSteps && (
            <>
              <span style={{ width: 1, height: 14, background: 'var(--ui-border-default)', flexShrink: 0 }} />
              <span style={{
                fontSize: 11,
                color: `${SAND[500]}b2`,
                fontFamily: 'monospace',
                fontWeight: 600,
                flexShrink: 0,
                letterSpacing: '0.03em',
              }}>
                {stepIndex}/{totalSteps}
              </span>
            </>
          )}

          {/* Fallback badge */}
          {fallbackCount > 0 && (
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              color: `${STATUS.warning}cc`,
              background: `${STATUS.warning}1a`,
              border: `1px solid ${STATUS.warning}33`,
              borderRadius: 4,
              padding: '1px 5px',
              letterSpacing: '0.05em',
              flexShrink: 0,
            }}>
              {fallbackCount}↑
            </span>
          )}

          {/* Divider before controls */}
          <span style={{ width: 1, height: 14, background: 'var(--ui-border-default)', flexShrink: 0 }} />

          {/* Controls */}
          {requiresApproval ? (
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <PillButton onClick={() => void approveAction()} title="Approve" accent="green">
                <Check size={12} />
              </PillButton>
              <PillButton onClick={() => void denyAction()} title="Deny" accent="red">
                <X size={12} />
              </PillButton>
            </div>
          ) : status === 'Running' ? (
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <PillButton onClick={() => void pauseExecution()} title="Pause">
                <Pause size={11} />
              </PillButton>
              <PillButton onClick={() => void stopExecution()} title="Stop" accent="red">
                <Square size={10} />
              </PillButton>
            </div>
          ) : status === 'Blocked' ? (
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <PillButton onClick={() => void resumeExecution()} title="Resume" accent="green">
                <Play size={11} />
              </PillButton>
              <PillButton onClick={() => void stopExecution()} title="Stop" accent="red">
                <Square size={10} />
              </PillButton>
            </div>
          ) : null}
        </div>

        {/* ── Secondary chip — adapter / layer ── */}
        {(adapter || currentLayer) && status === 'Running' && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              alignSelf: placement === 'top-right' ? 'flex-end' : 'flex-start',
              padding: '3px 8px',
              background: 'rgba(20, 18, 16, 0.72)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid var(--ui-border-muted)',
              borderRadius: 8,
            }}
          >
            {currentLayer && (
              <span style={{
                fontSize: 9,
                fontWeight: 600,
                color: `${SAND[500]}80`,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontFamily: 'monospace',
              }}>
                {currentLayer}
              </span>
            )}
            {currentLayer && adapter && (
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)' }}>·</span>
            )}
            {adapter && (
              <span style={{
                fontSize: 9,
                color: 'rgba(255,255,255,0.35)',
                fontFamily: 'monospace',
              }}>
                {adapter}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default ACIGlassPill;
