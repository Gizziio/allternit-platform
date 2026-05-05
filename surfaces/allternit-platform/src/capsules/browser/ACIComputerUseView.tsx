"use client";

/**
 * ACIComputerUseView — Kimi Computer-style live ACI viewport
 *
 * Shows a real-time visual feed from the computer-use service while
 * the agent is executing. Screenshot is pushed via SSE stream from
 * /api/aci/stream/[id] and held in the browser agent store — no polling.
 * Overlays step progress, action labels, and element highlight boxes.
 *
 * Layout (mirrors Kimi Computer reference):
 *   ┌──────────────────────────────────────────────┐
 *   │  Top strip — adapter · step · run state      │
 *   ├──────────────────────────────────────────────┤
 *   │                                              │
 *   │   Live screenshot of controlled browser      │
 *   │                                              │
 *   │   [element highlight overlay on action]      │
 *   │                                              │
 *   │         ◆ ACIGlassPill (bottom-center)       │
 *   └──────────────────────────────────────────────┘
 *
 * Activated when:
 *   - useBrowserAgentStore.status !== 'Idle'  AND
 *   - endpoint?.type === 'computer_use' or always in ACI mode
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useBrowserAgentStore } from './browserAgent.store';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface HighlightBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  kind?: string; // click | type | scroll | read
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const KIND_COLOR: Record<string, string> = {
  click:     'rgba(99,252,241,0.85)',
  type:      'rgba(168,85,247,0.85)',
  scroll:    'rgba(251,191,36,0.85)',
  read:      'rgba(59,130,246,0.85)',
  navigate:  'rgba(34,197,94,0.85)',
  extract:   'rgba(249,115,22,0.85)',
  default:   'rgba(99,252,241,0.85)',
};

function kindColor(kind?: string): string {
  return KIND_COLOR[kind ?? 'default'] ?? KIND_COLOR.default;
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function TopStrip({
  goal,
  lastEventMessage,
  status,
  stepIndex,
  totalSteps,
  adapterId,
  layer,
}: {
  goal: string;
  lastEventMessage: string | null;
  status: string;
  stepIndex: number | null | undefined;
  totalSteps: number | null | undefined;
  adapterId: string | null;
  layer: string | null;
}) {
  const isRunning = status === 'Running';
  const isApproval = status === 'WaitingApproval';
  const isDone = status === 'Done';

  const dotColor = isRunning  ? 'var(--status-success)'
                : isApproval  ? 'var(--status-warning)'
                : isDone      ? 'var(--status-info)'
                : 'var(--ui-text-muted)';

  const adapterLabel = adapterId
    ? adapterId.split('.').slice(1).join('.') || adapterId
    : null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 34,
        background: 'rgba(14,12,10,0.85)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(212,176,140,0.09)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 8,
        zIndex: 20,
        flexShrink: 0,
      }}
    >
      {/* Status dot */}
      <div
        style={{
          width: 7, height: 7, borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
          boxShadow: isRunning ? `0 0 6px ${dotColor}aa` : 'none',
          animation: isRunning || isApproval ? 'aci-cv-pulse 1.8s ease-in-out infinite' : 'none',
        }}
      />

      {/* Label */}
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: 'rgba(212,176,140,0.45)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontFamily: 'var(--font-mono)',
          flexShrink: 0,
        }}
      >
        COMPUTER USE
      </span>

      <div style={{ width: 1, height: 12, background: 'var(--ui-border-muted)', flexShrink: 0 }} />

      {/* Active message */}
      <span
        style={{
          fontSize: 11,
          color: isApproval ? '#fde68a' : 'var(--ui-text-muted)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: isApproval ? 600 : 400,
        }}
      >
        {lastEventMessage || goal || (isDone ? 'Task complete' : 'Waiting…')}
      </span>

      {/* Step counter */}
      {stepIndex != null && totalSteps != null && totalSteps > 1 && (
        <>
          <div style={{ width: 1, height: 12, background: 'var(--ui-border-muted)', flexShrink: 0 }} />
          <span
            style={{
              fontSize: 10,
              color: 'rgba(212,176,140,0.65)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {stepIndex}/{totalSteps}
          </span>
        </>
      )}

      {/* Adapter / layer chip */}
      {adapterLabel && (
        <>
          <div style={{ width: 1, height: 12, background: 'var(--ui-border-muted)', flexShrink: 0 }} />
          <span
            style={{
              fontSize: 9,
              color: 'rgba(255,255,255,0.25)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.05em',
              flexShrink: 0,
            }}
          >
            {adapterLabel}{layer ? ` · ${layer}` : ''}
          </span>
        </>
      )}
    </div>
  );
}

function ElementHighlight({
  box,
  containerWidth,
  containerHeight,
  imgNaturalWidth,
  imgNaturalHeight,
  imgDisplayWidth,
  imgDisplayHeight,
  imgOffsetX,
  imgOffsetY,
}: {
  box: HighlightBox;
  containerWidth: number;
  containerHeight: number;
  imgNaturalWidth: number;
  imgNaturalHeight: number;
  imgDisplayWidth: number;
  imgDisplayHeight: number;
  imgOffsetX: number;
  imgOffsetY: number;
}) {
  if (!imgNaturalWidth || !imgDisplayWidth) return null;

  const scaleX = imgDisplayWidth / imgNaturalWidth;
  const scaleY = imgDisplayHeight / imgNaturalHeight;

  const left   = imgOffsetX + box.x * scaleX;
  const top    = imgOffsetY + box.y * scaleY;
  const width  = box.width * scaleX;
  const height = box.height * scaleY;

  const color = kindColor(box.kind);

  return (
    <div
      style={{
        position: 'absolute',
        left, top, width, height,
        border: `2px solid ${color}`,
        borderRadius: 4,
        background: color.replace('0.85)', '0.07)'),
        boxShadow: `0 0 0 1px ${color.replace('0.85)', '0.25)')}, 0 0 12px ${color.replace('0.85)', '0.15)')}`,
        pointerEvents: 'none',
        zIndex: 40,
        transition: 'all 0.18s ease',
      }}
    >
      {box.label && (
        <div
          style={{
            position: 'absolute',
            top: -20, left: 0,
            padding: '2px 6px',
            background: 'rgba(10,9,8,0.92)',
            border: `1px solid ${color.replace('0.85)', '0.4)')}`,
            borderRadius: 4,
            fontSize: 9,
            fontWeight: 700,
            color,
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
          }}
        >
          {box.kind ? `${box.kind.toUpperCase()} · ` : ''}{box.label}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export interface ACIComputerUseViewProps {
  /** Extra bottom inset to reserve below the live screenshot area */
  agentBarHeight?: number;
}

export function ACIComputerUseView({
  agentBarHeight = 54,
}: ACIComputerUseViewProps) {
  const status           = useBrowserAgentStore((s) => s.status);
  const goal             = useBrowserAgentStore((s) => s.goal);
  const currentAction    = useBrowserAgentStore((s) => s.currentAction);
  const lastEventMessage = useBrowserAgentStore((s) => s.lastEventMessage);
  const currentAdapterId = useBrowserAgentStore((s) => s.currentAdapterId);
  const currentLayer     = useBrowserAgentStore((s) => s.currentLayer);
  // Screenshot fed by SSE stream via store — no local polling needed
  const screenshotB64    = useBrowserAgentStore((s) => s.screenshot);

  const screenshot   = screenshotB64 ? `data:image/png;base64,${screenshotB64}` : null;
  const isConnecting = status !== 'Idle' && status !== 'Done' && screenshot === null;
  const serviceError = (status as string) === 'Error' ? 'Agent run encountered an error.' : null;

  const [highlights, setHighlights]           = useState<HighlightBox[]>([]);
  const [imgNaturalSize, setImgNaturalSize]   = useState({ w: 0, h: 0 });
  const [imgDisplaySize, setImgDisplaySize]   = useState({ w: 0, h: 0 });
  const [imgOffset, setImgOffset]             = useState({ x: 0, y: 0 });

  const imgRef         = useRef<HTMLImageElement | null>(null);
  const containerRef   = useRef<HTMLDivElement | null>(null);

  // Build highlights from currentAction bounding box
  useEffect(() => {
    if (!currentAction?.boundingBox) {
      setHighlights([]);
      return;
    }
    const bb = currentAction.boundingBox;
    setHighlights([{
      x: bb.x, y: bb.y, width: bb.width, height: bb.height,
      label: currentAction.label ?? currentAction.selector ?? undefined,
      kind: currentAction.type?.toLowerCase(),
    }]);
  }, [currentAction]);

  // Recalculate image display metrics after load or container resize
  const recalcImgMetrics = useCallback(() => {
    const img = imgRef.current;
    const ctr = containerRef.current;
    if (!img || !ctr) return;

    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    if (!natW || !natH) return;

    const ctrRect = ctr.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();

    setImgNaturalSize({ w: natW, h: natH });
    setImgDisplaySize({ w: imgRect.width, h: imgRect.height });
    setImgOffset({
      x: imgRect.left - ctrRect.left,
      y: imgRect.top  - ctrRect.top,
    });
  }, []);

  // Resize observer to keep metrics current
  useEffect(() => {
    const ctr = containerRef.current;
    if (!ctr) return;
    const ro = new ResizeObserver(recalcImgMetrics);
    ro.observe(ctr);
    return () => ro.disconnect();
  }, [recalcImgMetrics]);

  // ── Render ──────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes aci-cv-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        @keyframes aci-cv-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#0A0908',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 5,
          overflow: 'hidden',
        }}
      >
        {/* ── Top status strip ── */}
        <TopStrip
          goal={goal}
          lastEventMessage={lastEventMessage}
          status={status}
          stepIndex={currentAction?.stepIndex}
          totalSteps={currentAction?.totalSteps}
          adapterId={currentAdapterId}
          layer={currentLayer}
        />

        {/* ── Screenshot + overlays ── */}
        <div
          ref={containerRef}
          style={{
            position: 'absolute',
            top: 34,
            left: 0,
            right: 0,
            bottom: agentBarHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 8,
            overflow: 'hidden',
          }}
        >
          {/* Loading state */}
          {isConnecting && !serviceError && (
            <div
              style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 16, opacity: 0.45,
              }}
            >
              <div
                style={{
                  width: 28, height: 28,
                  border: '2px solid var(--ui-border-default)',
                  borderTop: '2px solid #D4B08C',
                  borderRadius: '50%',
                  animation: 'aci-cv-spin 1s linear infinite',
                }}
              />
              <div
                style={{
                  fontSize: 9,
                  fontFamily: 'var(--font-mono)',
                  color: '#555',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5em',
                }}
              >
                CONNECTING
              </div>
            </div>
          )}

          {/* Error state */}
          {serviceError && (
            <div
              style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 10, maxWidth: 320, textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 28, opacity: 0.4 }}>⚡</div>
              <div
                style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)',
                  color: 'var(--status-error)', letterSpacing: '0.08em',
                }}
              >
                {serviceError}
              </div>
              <div style={{ fontSize: 10, color: '#444', lineHeight: 1.5 }}>
                Check the agent logs for details.
              </div>
            </div>
          )}

          {/* Live screenshot */}
          {screenshot && !serviceError && (
            <>
              <img
                ref={imgRef}
                src={screenshot}
                alt="Computer use live view"
                onLoad={recalcImgMetrics}
                draggable={false}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  border: '1px solid rgba(212,176,140,0.08)',
                  borderRadius: 3,
                  boxShadow: '0 0 48px var(--shell-overlay-backdrop)',
                  userSelect: 'none',
                  display: 'block',
                }}
              />

              {/* Element highlights — positioned relative to displayed image */}
              {highlights.map((box, i) => (
                <ElementHighlight
                  key={i}
                  box={box}
                  containerWidth={containerRef.current?.clientWidth ?? 0}
                  containerHeight={containerRef.current?.clientHeight ?? 0}
                  imgNaturalWidth={imgNaturalSize.w}
                  imgNaturalHeight={imgNaturalSize.h}
                  imgDisplayWidth={imgDisplaySize.w}
                  imgDisplayHeight={imgDisplaySize.h}
                  imgOffsetX={imgOffset.x}
                  imgOffsetY={imgOffset.y}
                />
              ))}
            </>
          )}
        </div>

        {/* ── Scan-line texture overlay (dark glass aesthetic) ── */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)',
            pointerEvents: 'none',
            zIndex: 6,
          }}
        />
      </div>
    </>
  );
}

export default ACIComputerUseView;
