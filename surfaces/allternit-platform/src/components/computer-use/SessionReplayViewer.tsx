"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  ArrowLeft,
  ArrowRight,
  SkipBack,
  SkipForward,
  Camera,
  Clock,
  CheckCircle,
  XCircle,
  Globe,
} from '@phosphor-icons/react';
import { BACKGROUND, SAND, STATUS, TEXT } from '@/design/allternit.tokens';

// ============================================================================
// Types
// ============================================================================

interface ActionRecord {
  action_id: string;
  step: number;
  action_type: string;
  result_success: boolean;
  result_error?: string;
  duration_ms: number;
  url_before?: string;
  url_after?: string;
  before_screenshot?: string;
  after_screenshot?: string;
  before_dom?: string;
  after_dom?: string;
  console_logs?: string[];
}

interface SessionReplayViewerProps {
  sessionId: string;
  records: ActionRecord[];
  onClose?: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function actionLabel(kind: string): string {
  const MAP: Record<string, string> = {
    navigate: 'Navigate',
    click: 'Click',
    type: 'Type',
    scroll: 'Scroll',
    select: 'Select',
    screenshot: 'Screenshot',
    extract: 'Extract',
    wait: 'Wait',
    assert: 'Assert',
  };
  return MAP[kind] || kind;
}

// ============================================================================
// SessionReplayViewer
// ============================================================================

export function SessionReplayViewer({
  sessionId,
  records,
  onClose,
}: SessionReplayViewerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showBefore, setShowBefore] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const totalSteps = records.length;
  const current = records[currentStep] ?? null;

  // Auto-play logic
  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setCurrentStep((s) => {
        if (s >= totalSteps - 1) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 800);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, totalSteps]);

  const goTo = useCallback(
    (step: number) => {
      setCurrentStep(Math.max(0, Math.min(step, totalSteps - 1)));
    },
    [totalSteps]
  );

  const screenshot = showBefore
    ? current?.before_screenshot
    : current?.after_screenshot;

  const scrubberWidth = totalSteps > 1 ? (currentStep / (totalSteps - 1)) * 100 : 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: BACKGROUND.primary,
        color: TEXT.primary,
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          borderBottom: '1px solid var(--ui-border-muted)',
          flexShrink: 0,
        }}
      >
        <Camera size={15} color={SAND[500]} />
        <span style={{ fontWeight: 600, color: SAND[400] }}>Session Replay</span>
        <code style={{ fontSize: 10, color: `${SAND[500]}60`, marginLeft: 2 }}>
          {sessionId.slice(0, 8)}
        </code>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: `${SAND[500]}60` }}>
          {currentStep + 1} / {totalSteps}
        </span>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'var(--ui-border-muted)',
              border: 'none',
              borderRadius: 4,
              color: `${SAND[500]}80`,
              cursor: 'pointer',
              padding: '4px 8px',
              fontSize: 11,
            }}
          >
            Close
          </button>
        )}
      </div>

      {/* Main layout: sidebar + viewport */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Step sidebar */}
        <div
          style={{
            width: 180,
            borderRight: '1px solid var(--ui-border-muted)',
            overflowY: 'auto',
            flexShrink: 0,
          }}
        >
          {records.map((r, idx) => {
            const active = idx === currentStep;
            return (
              <button
                key={r.action_id}
                onClick={() => goTo(idx)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '7px 12px',
                  background: active ? 'var(--ui-border-muted)' : 'none',
                  border: 'none',
                  borderLeft: active ? `2px solid ${SAND[500]}` : '2px solid transparent',
                  cursor: 'pointer',
                  color: active ? TEXT.primary : `${TEXT.primary}80`,
                  fontSize: 12,
                  textAlign: 'left',
                  transition: 'all 0.1s',
                }}
              >
                <span style={{ color: `${SAND[500]}60`, width: 20, fontSize: 10 }}>
                  {r.step}
                </span>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: r.result_success ? STATUS.success : STATUS.error,
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {actionLabel(r.action_type)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Viewport + detail */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Screenshot */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface-panel)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {screenshot ? (
              <img
                src={`data:image/png;base64,${screenshot}`}
                alt={`step ${currentStep}`}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: 4,
                  boxShadow: '0 4px 24px var(--shell-overlay-backdrop)',
                }}
              />
            ) : (
              <div style={{ color: `${SAND[500]}40`, fontSize: 12 }}>
                No screenshot for this step
              </div>
            )}

            {/* Before/After toggle */}
            {(current?.before_screenshot || current?.after_screenshot) && (
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  display: 'flex',
                  gap: 4,
                }}
              >
                {['before', 'after'].map((label) => (
                  <button
                    key={label}
                    onClick={() => setShowBefore(label === 'before')}
                    style={{
                      padding: '3px 8px',
                      fontSize: 10,
                      borderRadius: 4,
                      border: 'none',
                      cursor: 'pointer',
                      background:
                        (label === 'before') === showBefore
                          ? SAND[500]
                          : 'rgba(0,0,0,0.4)',
                      color: (label === 'before') === showBefore
                        ? BACKGROUND.primary
                        : `${SAND[500]}90`,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Step detail bar */}
          {current && (
            <div
              style={{
                padding: '8px 16px',
                borderTop: '1px solid var(--ui-border-muted)',
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                flexShrink: 0,
                flexWrap: 'wrap',
                fontSize: 11,
              }}
            >
              <span
                style={{
                  color: current.result_success ? STATUS.success : STATUS.error,
                  fontWeight: 600,
                }}
              >
                {actionLabel(current.action_type)}
              </span>
              {current.url_after && (
                <span
                  style={{
                    color: `${SAND[500]}70`,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 300,
                  }}
                >
                  <Globe size={11} style={{ marginRight: 3 }} />
                  {current.url_after}
                </span>
              )}
              <span style={{ color: `${SAND[500]}60` }}>
                <Clock size={11} style={{ marginRight: 3 }} />
                {formatMs(current.duration_ms)}
              </span>
              {current.result_error && (
                <span style={{ color: STATUS.error }}>{current.result_error}</span>
              )}
              {(current.console_logs?.length ?? 0) > 0 && (
                <span style={{ color: `${SAND[500]}50` }}>
                  {current.console_logs!.length} console log{current.console_logs!.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scrubber + controls */}
      <div
        style={{
          borderTop: '1px solid var(--ui-border-muted)',
          padding: '10px 16px',
          flexShrink: 0,
        }}
      >
        {/* Scrubber */}
        <div
          style={{
            position: 'relative',
            height: 4,
            background: 'var(--ui-border-muted)',
            borderRadius: 2,
            marginBottom: 12,
            cursor: 'pointer',
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            goTo(Math.round(pct * (totalSteps - 1)));
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${scrubberWidth}%`,
              background: SAND[500],
              borderRadius: 2,
              transition: 'width 0.1s',
            }}
          />
          {/* Step markers */}
          {records.map((r, idx) => (
            <div
              key={r.action_id}
              style={{
                position: 'absolute',
                top: -2,
                left: `${totalSteps > 1 ? (idx / (totalSteps - 1)) * 100 : 0}%`,
                transform: 'translateX(-50%)',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: r.result_success ? STATUS.success : STATUS.error,
                border: `1px solid ${BACKGROUND.primary}`,
              }}
            />
          ))}
        </div>

        {/* Playback controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {[
            { icon: <SkipBack size={15} />, action: () => goTo(0), label: 'First' },
            { icon: <ArrowLeft size={15} />, action: () => goTo(currentStep - 1), label: 'Prev' },
            {
              icon: playing ? <Pause size={16} /> : <Play size={16} />,
              action: () => setPlaying((p) => !p),
              label: playing ? 'Pause' : 'Play',
              primary: true,
            },
            { icon: <ArrowRight size={15} />, action: () => goTo(currentStep + 1), label: 'Next' },
            { icon: <SkipForward size={15} />, action: () => goTo(totalSteps - 1), label: 'Last' },
          ].map(({ icon, action, label, primary }) => (
            <button
              key={label}
              onClick={action}
              title={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: primary ? 36 : 30,
                height: primary ? 36 : 30,
                borderRadius: primary ? 8 : 6,
                background: primary ? SAND[500] : 'var(--ui-border-muted)',
                border: 'none',
                color: primary ? BACKGROUND.primary : `${SAND[500]}90`,
                cursor: 'pointer',
              }}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SessionReplayViewer;
