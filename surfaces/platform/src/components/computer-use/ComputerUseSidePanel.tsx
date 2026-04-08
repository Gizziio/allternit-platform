"use client";

import React from 'react';
import {
  X,
  Monitor,
  Lightning,
  Warning,
  CheckCircle,
  Clock,
  ArrowRight,
} from '@phosphor-icons/react';
import { useBrowserAgentStore } from '@/capsules/browser/browserAgent.store';
import { type AgentModeSurface } from '@/stores/agent-surface-mode.store';
import { BACKGROUND, SAND, STATUS, TEXT } from '@/design/allternit.tokens';

// ============================================================================
// Types
// ============================================================================

interface ComputerUseSidePanelProps {
  onClose: () => void;
  agentModeSurface?: AgentModeSurface;
  onEnableAgentMode?: () => void;
}

// ============================================================================
// Status config
// ============================================================================

const STATUS_CONFIG = {
  Idle:             { label: 'Ready',           color: 'rgba(255,255,255,0.3)',  bg: 'rgba(255,255,255,0.06)' },
  Running:          { label: 'Running',          color: STATUS.success,                bg: 'rgba(16,185,129,0.12)'  },
  WaitingApproval:  { label: 'Waiting',          color: STATUS.warning,                bg: `${STATUS.warning}1f`  },
  Blocked:          { label: 'Blocked',          color: STATUS.error,                bg: '#ef44441f'   },
  Done:             { label: 'Done',             color: SAND[500],                bg: `${SAND[500]}1f` },
} as const;

// ============================================================================
// ComputerUseSidePanel
// ============================================================================

export function ComputerUseSidePanel({ onClose, agentModeSurface, onEnableAgentMode }: ComputerUseSidePanelProps) {
  const status = useBrowserAgentStore((s) => s.status);
  const lastEventMessage = useBrowserAgentStore((s) => s.lastEventMessage);
  const lastEventType = useBrowserAgentStore((s) => s.lastEventType);
  const engineHealthy = useBrowserAgentStore((s) => s.engineHealthy);
  const engineStatusMessage = useBrowserAgentStore((s) => s.engineStatusMessage);
  const goal = useBrowserAgentStore((s) => s.goal);
  const eventHistory = useBrowserAgentStore((s) => s.eventHistory);
  const currentAdapterId = useBrowserAgentStore((s) => s.currentAdapterId);

  const agentModeOn = false; // agent mode is now derived from the embedded session, not stored explicitly

  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.Idle;
  const recentEvents = eventHistory.slice(-6).reverse();

  function handleEnableAgentMode() {
    onEnableAgentMode?.();
  }

  return (
    <div
      style={{
        width: '440px',
        minWidth: '440px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#1C1814',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        animation: 'a2r-panel-slidein 0.22s cubic-bezier(0.22,1,0.36,1)',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Monitor size={15} style={{ color: SAND[500] }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: TEXT.primary }}>
            Computer Use
          </span>
          <span style={{
            fontSize: '10px',
            fontWeight: 600,
            padding: '2px 7px',
            borderRadius: '10px',
            background: statusCfg.bg,
            color: statusCfg.color,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            {statusCfg.label}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '26px',
            height: '26px',
            borderRadius: '8px',
            border: 'none',
            background: 'transparent',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = TEXT.primary; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

        {/* ── Upgrade prompt (agent mode OFF) ── */}
        {!agentModeOn && (
          <div style={{
            marginBottom: '16px',
            padding: '14px 16px',
            borderRadius: '12px',
            border: `1px solid ${SAND[500]}33`,
            background: `${SAND[500]}0a`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Lightning size={13} style={{ color: SAND[500] }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: SAND[500] }}>
                Headless Mode Active
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: '0 0 12px' }}>
              Computer use is running invisibly in the background.
              Enable Agent Mode to unlock a visible browser, live action replay,
              and desktop automation.
            </p>
            <button
              onClick={handleEnableAgentMode}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#1C1814',
                background: SAND[500],
                border: 'none',
                borderRadius: '8px',
                padding: '7px 14px',
                cursor: 'pointer',
              }}
            >
              Enable Agent Mode
              <ArrowRight size={12} />
            </button>
          </div>
        )}

        {/* ── Engine status ── */}
        <div style={{
          marginBottom: '16px',
          padding: '12px 14px',
          borderRadius: '10px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Engine
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {engineHealthy === true && <CheckCircle size={11} style={{ color: STATUS.success }} />}
              {engineHealthy === false && <Warning size={11} style={{ color: STATUS.error }} />}
              {engineHealthy === null && <Clock size={11} style={{ color: 'rgba(255,255,255,0.3)' }} />}
              <span style={{ fontSize: '11px', color: engineHealthy ? STATUS.success : engineHealthy === false ? STATUS.error : 'rgba(255,255,255,0.3)' }}>
                {engineHealthy === true ? 'Connected' : engineHealthy === false ? 'Unreachable' : 'Checking...'}
              </span>
            </div>
          </div>
          {currentAdapterId && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
              {currentAdapterId}
            </div>
          )}
          {engineStatusMessage && engineHealthy === false && (
            <div style={{ fontSize: '11px', color: '#ef4444b2', marginTop: '4px', wordBreak: 'break-word' }}>
              {engineStatusMessage}
            </div>
          )}
        </div>

        {/* ── Active goal ── */}
        {goal && (
          <div style={{
            marginBottom: '16px',
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
              Goal
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
              {goal}
            </div>
          </div>
        )}

        {/* ── Last action ── */}
        {lastEventMessage && (
          <div style={{
            marginBottom: '16px',
            padding: '10px 14px',
            borderRadius: '10px',
            background: statusCfg.bg,
            border: `1px solid ${statusCfg.color}22`,
          }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: statusCfg.color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '5px' }}>
              {lastEventType ?? 'Last Action'}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
              {lastEventMessage}
            </div>
          </div>
        )}

        {/* ── Event history ── */}
        {recentEvents.length > 0 && (
          <div>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
              Recent Actions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {recentEvents.map((event, i) => {
                const ev = event as Record<string, unknown>;
                const msg = typeof ev.message === 'string' ? ev.message : typeof ev.type === 'string' ? ev.type : '';
                const ts = typeof ev.timestamp === 'string' ? ev.timestamp : '';
                return (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <div style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      background: i === 0 ? statusCfg.color : 'rgba(255,255,255,0.2)',
                      marginTop: '5px',
                      flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                        {msg}
                      </div>
                      {ts && (
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>
                          {new Date(ts).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {status === 'Idle' && !goal && recentEvents.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'rgba(255,255,255,0.25)', fontSize: '12px', lineHeight: 1.7 }}>
            <Monitor size={28} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.25 }} />
            No active session.
            <br />
            Ask the model to browse the web or use the computer.
          </div>
        )}
      </div>
    </div>
  );
}
