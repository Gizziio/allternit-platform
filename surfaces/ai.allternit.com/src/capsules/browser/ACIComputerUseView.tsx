"use client";

/**
 * ACIComputerUseView — Kimi Computer-style live ACI viewport
 *
 * Shows a real-time visual feed from the computer-use service while
 * the agent is executing. Screenshot is pushed via SSE stream from
 * /api/aci/stream/[id] and held in the computer agent store — no polling.
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
      className="absolute top-0 left-0 right-0 h-[34px] bg-[rgba(14,12,10,0.85)] backdrop-blur-[10px] border-b border-solid border-[rgba(212,176,140,0.09)] flex items-center px-3 gap-2 z-[20] shrink-0"
    >
      {/* Status dot */}
      <div
        className={`size-[7px] rounded-full shrink-0 ${isRunning || isApproval ? 'animate-[aci-cv-pulse_1.8s_ease-in-out_infinite]' : ''} bg-[var(--dot-color)] shadow-[var(--dot-shadow)]`}
        style={{
          '--dot-color': dotColor,
          '--dot-shadow': isRunning ? `0 0 6px ${dotColor}aa` : 'none',
        } as React.CSSProperties}
      />

      {/* Label */}
      <span className="text-[12px] font-bold text-[rgba(212,176,140,0.45)] uppercase tracking-[0.12em] font-mono shrink-0">
        COMPUTER USE
      </span>

      <div className="w-px h-3 bg-[var(--ui-border-muted)] shrink-0" />

      {/* Active message */}
      <span
        className={`text-[12px] flex-1 overflow-hidden text-ellipsis whitespace-nowrap ${isApproval ? 'text-[#fde68a] font-semibold' : 'text-[var(--ui-text-muted)] font-normal'}`}
      >
        {lastEventMessage || goal || (isDone ? 'Task complete' : 'Waiting…')}
      </span>

      {/* Step counter */}
      {stepIndex != null && totalSteps != null && totalSteps > 1 && (
        <>
          <div className="w-px h-3 bg-[var(--ui-border-muted)] shrink-0" />
          <span className="text-[12px] text-[rgba(212,176,140,0.65)] font-mono font-bold shrink-0">
            {stepIndex}/{totalSteps}
          </span>
        </>
      )}

      {/* Adapter / layer chip */}
      {adapterLabel && (
        <>
          <div className="w-px h-3 bg-[var(--ui-border-muted)] shrink-0" />
          <span className="text-[12px] text-[rgba(255,255,255,0.25)] font-mono tracking-[0.05em] shrink-0">
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
      className="absolute border-2 border-solid rounded-[4px] pointer-events-none z-[40] transition-all duration-[0.18s] ease-[ease] border-[var(--box-color)] bg-[var(--box-bg)] shadow-[var(--box-shadow)]"
      style={{
        left, top, width, height,
        '--box-color': color,
        '--box-bg': color.replace('0.85)', '0.07)'),
        '--box-shadow': `0 0 0 1px ${color.replace('0.85)', '0.25)')}, 0 0 12px ${color.replace('0.85)', '0.15)')}`,
      } as React.CSSProperties}
    >
      {box.label && (
        <div
          className="absolute -top-5 left-0 px-1.5 py-0.5 bg-[rgba(10,9,8,0.92)] border border-solid border-[var(--label-border)] rounded-[4px] text-[12px] font-bold font-mono uppercase tracking-[0.06em] whitespace-nowrap text-[var(--label-color)]"
          style={{
            '--label-border': color.replace('0.85)', '0.4)'),
            '--label-color': color,
          } as React.CSSProperties}
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

      <div className="absolute inset-0 bg-[var(--bg-primary)] flex flex-col z-[5] overflow-hidden">
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
          className="absolute top-[34px] left-0 right-0 flex items-center justify-center p-2 overflow-hidden"
          style={{ bottom: agentBarHeight }}
        >
          {/* Loading state */}
          {isConnecting && !serviceError && (
            <div className="flex flex-col items-center gap-4 opacity-[0.45]">
              <div className="size-7 border-2 border-solid border-[var(--ui-border-default)] border-t-[var(--accent-primary)] rounded-full animate-[aci-cv-spin_1s_linear_infinite]" />
              <div className="text-[12px] font-mono text-[#555] uppercase tracking-[0.5em]">
                CONNECTING
              </div>
            </div>
          )}

          {/* Error state */}
          {serviceError && (
            <div className="flex flex-col items-center gap-2.5 max-w-[320px] text-center">
              <div className="text-[28px] opacity-40">⚡</div>
              <div className="text-[12px] font-mono text-[var(--status-error)] tracking-[0.08em]">
                {serviceError}
              </div>
              <div className="text-[12px] text-[#444] leading-[1.5]">
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
                className="max-w-full max-h-full object-contain border border-solid border-[rgba(212,176,140,0.08)] rounded-[3px] shadow-[0_0_48px_var(--shell-overlay-backdrop)] select-none block"
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
          className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0)_0px,rgba(0,0,0,0)_3px,rgba(0,0,0,0.06)_3px,rgba(0,0,0,0.06)_4px)] pointer-events-none z-[6]"
        />
      </div>
    </>
  );
}

export default ACIComputerUseView;
