"use client";

/**
 * ACIComputerUseSidecar
 *
 * Global right-side panel that slides in from the right whenever the ACI
 * computer-use engine is active (status !== 'Idle') in Chat, Cowork, or Code
 * mode. This is the Kimi Computer-style split: your chat/workspace stays on
 * the left canvas; the live screen feed appears on the right.
 *
 * Unlike ACIComputerUseView (which is a full-screen overlay *inside* the
 * BrowserCapsule), this component renders as a React Portal directly on
 * document.body — it is mode-agnostic and always floats above the shell grid.
 *
 * Suppressed automatically when the BrowserCapsule is mounted (it has its own
 * full-screen viewport via ACIComputerUseView).
 *
 * Layout:
 *   ┌────────────────────────────────┐
 *   │  [COMPUTER USE] · step · msg   │   ← TopStrip
 *   │  [─] [↗]                      │   ← collapse / popout
 *   ├────────────────────────────────┤
 *   │                                │
 *   │   Live screenshot              │
 *   │   + element highlight overlay  │
 *   │                                │
 *   ├────────────────────────────────┤
 *   │  approval card (conditional)   │
 *   └────────────────────────────────┘
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useBrowserAgentStore } from './browserAgent.store';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const PANEL_WIDTH = 500; // default width in px

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
// Keyframes (injected once)
// ─────────────────────────────────────────────────────────────

const STYLES = `
  @keyframes aci-sidecar-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.45; }
  }
  @keyframes aci-sidecar-slide-in {
    from { transform: translateX(100%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
  @keyframes aci-sidecar-slide-out {
    from { transform: translateX(0);    opacity: 1; }
    to   { transform: translateX(100%); opacity: 0; }
  }
  @keyframes aci-sidecar-spin {
    to { transform: rotate(360deg); }
  }
`;

// ─────────────────────────────────────────────────────────────
// Highlight overlay (same bounding-box math as ACIComputerUseView)
// ─────────────────────────────────────────────────────────────

interface HighlightBox {
  x: number; y: number; width: number; height: number;
  label?: string; kind?: string;
}

function ElementHighlight({
  box, imgNaturalWidth, imgNaturalHeight, imgDisplayWidth, imgDisplayHeight, imgOffsetX, imgOffsetY,
}: {
  box: HighlightBox;
  imgNaturalWidth: number; imgNaturalHeight: number;
  imgDisplayWidth: number; imgDisplayHeight: number;
  imgOffsetX: number; imgOffsetY: number;
}) {
  if (!imgNaturalWidth || !imgDisplayWidth) return null;

  const scaleX = imgDisplayWidth / imgNaturalWidth;
  const scaleY = imgDisplayHeight / imgNaturalHeight;
  const left   = imgOffsetX + box.x * scaleX;
  const top    = imgOffsetY + box.y * scaleY;
  const width  = box.width  * scaleX;
  const height = box.height * scaleY;
  const color  = kindColor(box.kind);

  return (
    <div style={{
      position: 'absolute', left, top, width, height,
      border: `2px solid ${color}`,
      borderRadius: 4,
      background: color.replace('0.85)', '0.07)'),
      boxShadow: `0 0 0 1px ${color.replace('0.85)', '0.2)')}, 0 0 10px ${color.replace('0.85)', '0.12)')}`,
      pointerEvents: 'none',
      zIndex: 10,
      transition: 'all 0.18s ease',
    }}>
      {box.label && (
        <div style={{
          position: 'absolute', top: -20, left: 0,
          padding: '2px 6px',
          background: 'rgba(10,9,8,0.92)',
          border: `1px solid ${color.replace('0.85)', '0.4)')}`,
          borderRadius: 4,
          fontSize: 9, fontWeight: 700,
          color,
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
        }}>
          {box.kind ? `${box.kind.toUpperCase()} · ` : ''}{box.label}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Approval card (shown when status === 'WaitingApproval')
// ─────────────────────────────────────────────────────────────

function ApprovalCard() {
  const approveAction         = useBrowserAgentStore((s) => s.approveAction);
  const denyAction            = useBrowserAgentStore((s) => s.denyAction);
  const approvalActionSummary = useBrowserAgentStore((s) => s.approvalActionSummary);
  const approvalRiskTier      = useBrowserAgentStore((s) => s.approvalRiskTier);

  // approvalRiskTier is numeric (0–4)
  const riskColor = (approvalRiskTier ?? 0) >= 4 ? '#ef4444'
                  : (approvalRiskTier ?? 0) >= 3 ? '#f59e0b'
                  : '#3b82f6';

  return (
    <div style={{
      margin: '0 12px 12px',
      padding: '14px 16px',
      background: 'rgba(18,16,14,0.98)',
      border: '1px solid rgba(212,176,140,0.18)',
      borderRadius: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(212,176,140,0.9)', marginBottom: 3 }}>
        Approval Required
      </div>
      {approvalRiskTier && (
        <div style={{
          fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em',
          color: riskColor, marginBottom: 10, fontFamily: 'monospace',
        }}>
          ⚠ Risk: {approvalRiskTier}
        </div>
      )}
      {approvalActionSummary && (
        <div style={{
          background: 'rgba(212,176,140,0.05)',
          border: '1px solid rgba(212,176,140,0.1)',
          borderRadius: 6,
          padding: '8px 10px',
          fontSize: 10,
          color: 'rgba(212,176,140,0.65)',
          lineHeight: 1.5,
          marginBottom: 12,
          fontFamily: 'monospace',
        }}>
          {approvalActionSummary}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => approveAction?.()}
          style={{
            flex: 1, height: 32,
            background: 'rgba(212,176,140,0.12)',
            border: '1px solid rgba(212,176,140,0.28)',
            borderRadius: 6,
            fontSize: 10, fontWeight: 700,
            color: 'rgba(212,176,140,0.9)',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Approve
        </button>
        <button
          onClick={() => denyAction?.()}
          style={{
            height: 32, padding: '0 14px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 6,
            fontSize: 10, fontWeight: 700,
            color: 'rgba(239,68,68,0.7)',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Deny
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export interface ACIComputerUseSidecarProps {
  /** Skip showing if the BrowserCapsule is active (it has its own full-screen view) */
  suppressInBrowserMode?: boolean;
}

export function ACIComputerUseSidecar({ suppressInBrowserMode = true }: ACIComputerUseSidecarProps) {
  const status           = useBrowserAgentStore((s) => s.status);
  const goal             = useBrowserAgentStore((s) => s.goal);
  const currentAction    = useBrowserAgentStore((s) => s.currentAction);
  const lastEventMessage = useBrowserAgentStore((s) => s.lastEventMessage);
  const currentAdapterId = useBrowserAgentStore((s) => s.currentAdapterId);
  const currentLayer     = useBrowserAgentStore((s) => s.currentLayer);
  const isBrowserCapsuleActive = useBrowserAgentStore((s) => s.isBrowserCapsuleMounted ?? false);

  const expanded         = useBrowserAgentStore((s) => s.aciSidecarExpanded);
  const toggleAciSidecar = useBrowserAgentStore((s) => s.toggleAciSidecar);

  // Screenshot fed via SSE → store; no local polling
  const screenshotB64  = useBrowserAgentStore((s) => s.screenshot);
  const screenshot     = screenshotB64 ? `data:image/png;base64,${screenshotB64}` : null;
  const isConnecting   = status !== 'Idle' && status !== 'Done' && screenshot === null;
  const serviceError   = (status as string) === 'Error' ? 'Agent run encountered an error.' : null;

  const [highlights, setHighlights]         = useState<HighlightBox[]>([]);
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 0, h: 0 });
  const [imgDisplaySize, setImgDisplaySize] = useState({ w: 0, h: 0 });
  const [imgOffset, setImgOffset]           = useState({ x: 0, y: 0 });
  const [mounted, setMounted]               = useState(false);
  const [panelWidth, setPanelWidth]         = useState(PANEL_WIDTH);
  const [viewMode, setViewMode]             = useState<'standard' | 'full'>('standard');

  const imgRef         = useRef<HTMLImageElement | null>(null);
  const containerRef   = useRef<HTMLDivElement | null>(null);
  const dragRef        = useRef<{ startX: number; startW: number } | null>(null);

  // Portal needs document.body — only available client-side
  useEffect(() => { setMounted(true); }, []);

  // Build highlights
  useEffect(() => {
    if (!currentAction?.boundingBox) { setHighlights([]); return; }
    const bb = currentAction.boundingBox;
    setHighlights([{
      x: bb.x, y: bb.y, width: bb.width, height: bb.height,
      label: currentAction.label ?? currentAction.selector ?? undefined,
      kind: currentAction.type?.toLowerCase(),
    }]);
  }, [currentAction]);

  // Recalculate image layout after load/resize
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
    setImgOffset({ x: imgRect.left - ctrRect.left, y: imgRect.top - ctrRect.top });
  }, []);

  // Resize handle drag
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: panelWidth };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - ev.clientX;
      setPanelWidth(Math.min(800, Math.max(320, dragRef.current.startW + delta)));
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [panelWidth]);

  const isActive = status !== 'Idle';
  const isBusy   = status === 'Running' || status === 'WaitingApproval';

  // Hide conditions
  if (!mounted) return null;
  if (!isActive) return null;
  if (suppressInBrowserMode && isBrowserCapsuleActive) return null;

  const statusColor = status === 'Running'         ? '#10b981'
                    : status === 'WaitingApproval'  ? '#d97706'
                    : status === 'Done'              ? '#3b82f6'
                    : '#6b7280';

  const adapterLabel = currentAdapterId
    ? (currentAdapterId.split('.').slice(1).join('.') || currentAdapterId)
    : null;

  // When not expanded, don't render the panel — ACIComputerUseBar shows instead
  if (!expanded) return null;

  const panel = (
    <>
      <style>{STYLES}</style>
      {/* Resize handle — left edge of panel (standard mode only) */}
      {expanded && viewMode === 'standard' && (
        <div
          onMouseDown={onResizeStart}
          style={{
            position: 'fixed',
            top: 0, bottom: 0,
            right: panelWidth - 3,
            width: 6,
            cursor: 'col-resize',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: 3, height: 40, borderRadius: 2, background: 'rgba(212,176,140,0.3)' }} />
        </div>
      )}

      {/* Main panel — standard (right panel) or full (viewport overlay) */}
      <div
        style={viewMode === 'full' ? {
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0908',
          animation: 'aci-sidecar-slide-in 0.18s cubic-bezier(0.22, 1, 0.36, 1) both',
          overflow: 'hidden',
        } : {
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: panelWidth,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0908',
          borderLeft: '1px solid rgba(212,176,140,0.12)',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.6)',
          animation: 'aci-sidecar-slide-in 0.22s cubic-bezier(0.22, 1, 0.36, 1) both',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          height: 42,
          background: 'rgba(12,11,10,0.96)',
          borderBottom: '1px solid rgba(212,176,140,0.1)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 8,
          flexShrink: 0,
        }}>
          {/* Status dot */}
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: statusColor,
            boxShadow: isBusy ? `0 0 6px ${statusColor}aa` : 'none',
            animation: isBusy ? 'aci-sidecar-pulse 1.8s ease-in-out infinite' : 'none',
            flexShrink: 0,
          }} />

          <span style={{
            fontSize: 9, fontWeight: 700,
            color: 'rgba(212,176,140,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.12em',
            fontFamily: 'monospace', flexShrink: 0,
          }}>
            COMPUTER USE
          </span>

          <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

          {/* Message */}
          <span style={{
            flex: 1,
            fontSize: 11,
            color: status === 'WaitingApproval' ? '#fde68a' : 'rgba(212,176,140,0.7)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: status === 'WaitingApproval' ? 600 : 400,
          }}>
            {lastEventMessage || goal || (status === 'Done' ? 'Task complete' : 'Waiting…')}
          </span>

          {/* Step counter */}
          {currentAction?.stepIndex != null && currentAction?.totalSteps != null && currentAction.totalSteps > 1 && (
            <span style={{
              fontSize: 10, color: 'rgba(212,176,140,0.5)',
              fontFamily: 'monospace', fontWeight: 700, flexShrink: 0,
            }}>
              {currentAction.stepIndex}/{currentAction.totalSteps}
            </span>
          )}

          {/* Adapter chip */}
          {adapterLabel && (
            <span style={{
              fontSize: 9, color: 'rgba(255,255,255,0.22)',
              fontFamily: 'monospace', flexShrink: 0,
            }}>
              {adapterLabel}{currentLayer ? ` · ${currentLayer}` : ''}
            </span>
          )}

          {/* View mode toggle — Standard ↔ Full */}
          <button
            onClick={() => setViewMode((v) => v === 'standard' ? 'full' : 'standard')}
            title={viewMode === 'standard' ? 'Fit to viewport (fullscreen)' : 'Back to standard view'}
            style={{
              width: 22, height: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: viewMode === 'full' ? 'rgba(212,176,140,0.12)' : 'rgba(212,176,140,0.06)',
              border: '1px solid rgba(212,176,140,0.1)',
              borderRadius: 5,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {viewMode === 'standard' ? (
              /* expand icon */
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 3.5V1h2.5M6.5 1H9v2.5M9 6.5V9H6.5M3.5 9H1V6.5" stroke="rgba(212,176,140,0.6)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              /* compress icon */
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M3.5 1v2.5H1M9 3.5H6.5V1M6.5 9V6.5H9M1 6.5h2.5V9" stroke="rgba(212,176,140,0.8)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>

          {/* Collapse → minimizes to ACIComputerUseBar above chat input */}
          <button
            onClick={toggleAciSidecar}
            title="Minimize to input bar"
            style={{
              width: 22, height: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(212,176,140,0.06)',
              border: '1px solid rgba(212,176,140,0.1)',
              borderRadius: 5,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3 5h4M7 5L5 3M7 5L5 7" stroke="rgba(212,176,140,0.6)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* ── Screen area ── */}
        {(
          <>
            <div
              ref={containerRef}
              style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000', minHeight: 0 }}
            >
              {/* Live screenshot */}
              {screenshot ? (
                <img
                  ref={imgRef}
                  src={screenshot}
                  alt="Live screen"
                  onLoad={recalcImgMetrics}
                  style={{
                    display: 'block',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    objectPosition: 'center',
                  }}
                />
              ) : isConnecting ? (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 12,
                }}>
                  <div style={{
                    width: 32, height: 32, border: '2px solid rgba(212,176,140,0.15)',
                    borderTopColor: 'rgba(212,176,140,0.6)',
                    borderRadius: '50%',
                    animation: 'aci-sidecar-spin 0.9s linear infinite',
                  }} />
                  <span style={{ fontSize: 10, color: 'rgba(212,176,140,0.3)', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                    CONNECTING…
                  </span>
                </div>
              ) : serviceError ? (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: 20,
                }}>
                  <span style={{ fontSize: 10, color: 'rgba(239,68,68,0.7)', fontFamily: 'monospace', textAlign: 'center' }}>
                    {serviceError}
                  </span>
                  <span style={{ fontSize: 9, color: 'rgba(212,176,140,0.3)', fontFamily: 'monospace', textAlign: 'center' }}>
                    Check the agent logs for details.
                  </span>
                </div>
              ) : (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(135deg, #0a0908 0%, #111010 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 10, color: 'rgba(212,176,140,0.2)', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                    NO SIGNAL
                  </span>
                </div>
              )}

              {/* Element highlights */}
              {highlights.map((box, i) => (
                <ElementHighlight
                  key={i}
                  box={box}
                  imgNaturalWidth={imgNaturalSize.w}
                  imgNaturalHeight={imgNaturalSize.h}
                  imgDisplayWidth={imgDisplaySize.w}
                  imgDisplayHeight={imgDisplaySize.h}
                  imgOffsetX={imgOffset.x}
                  imgOffsetY={imgOffset.y}
                />
              ))}

              {/* Scan-line texture */}
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5,
                background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 1px, rgba(0,0,0,0.035) 1px, rgba(0,0,0,0.035) 2px)',
              }} />
            </div>

            {/* Approval card */}
            {status === 'WaitingApproval' && <ApprovalCard />}

            {/* Done banner */}
            {status === 'Done' && (
              <div style={{
                margin: '0 12px 12px',
                padding: '12px 14px',
                background: 'rgba(16,185,129,0.06)',
                border: '1px solid rgba(16,185,129,0.18)',
                borderRadius: 8,
                display: 'flex', alignItems: 'center', gap: 8,
                flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l3 3 7-7" stroke="rgba(16,185,129,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(16,185,129,0.85)', marginBottom: 1 }}>Task Complete</div>
                  <div style={{ fontSize: 9, color: 'rgba(16,185,129,0.5)', fontFamily: 'monospace' }}>
                    {lastEventMessage || goal}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  return createPortal(panel, document.body);
}

export default ACIComputerUseSidecar;

// ─────────────────────────────────────────────────────────────
// ACIComputerUseBar
//
// Compact row that mounts ABOVE the chat input bar when the
// ACI sidecar is collapsed (aciSidecarExpanded === false).
// Clicking the expand button re-opens the full right panel.
//
// Usage: render directly above <ChatComposer> in ChatView.tsx.
// Same store state, same suppress logic — just a different shape.
// ─────────────────────────────────────────────────────────────

export interface ACIComputerUseBarProps {
  suppressInBrowserMode?: boolean;
  className?: string;
}

export function ACIComputerUseBar({ suppressInBrowserMode = true, className }: ACIComputerUseBarProps) {
  const status               = useBrowserAgentStore((s) => s.status);
  const goal                 = useBrowserAgentStore((s) => s.goal);
  const currentAction        = useBrowserAgentStore((s) => s.currentAction);
  const lastEventMessage     = useBrowserAgentStore((s) => s.lastEventMessage);
  const currentAdapterId     = useBrowserAgentStore((s) => s.currentAdapterId);
  const requiresApproval     = useBrowserAgentStore((s) => s.requiresApproval);
  const approveAction        = useBrowserAgentStore((s) => s.approveAction);
  const stopExecution        = useBrowserAgentStore((s) => s.stopExecution);
  const expanded             = useBrowserAgentStore((s) => s.aciSidecarExpanded);
  const toggleAciSidecar     = useBrowserAgentStore((s) => s.toggleAciSidecar);
  const isBrowserCapsuleActive = useBrowserAgentStore((s) => s.isBrowserCapsuleMounted ?? false);

  const isActive = status !== 'Idle';

  // Only show when agent is active, not in browser mode, and sidecar is collapsed
  if (!isActive) return null;
  if (suppressInBrowserMode && isBrowserCapsuleActive) return null;
  if (expanded) return null; // full panel is showing — bar not needed

  const statusColor = status === 'Running'         ? '#10b981'
                    : status === 'WaitingApproval'  ? '#d97706'
                    : status === 'Done'             ? '#3b82f6'
                    : '#6b7280';

  const isBusy  = status === 'Running' || status === 'WaitingApproval';
  const message = lastEventMessage
    || (requiresApproval ? 'Awaiting approval...' : null)
    || currentAction?.label
    || goal
    || (status === 'Done' ? 'Task complete' : 'Waiting…');

  const adapterLabel = currentAdapterId
    ? (currentAdapterId.split('.').slice(1).join('.') || currentAdapterId)
    : null;

  const stepIndex  = currentAction?.stepIndex;
  const totalSteps = currentAction?.totalSteps;

  return (
    <>
      <style>{STYLES}</style>
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          background: 'rgba(12, 11, 10, 0.88)',
          borderTop: '1px solid rgba(212,176,140,0.1)',
          borderRadius: '8px 8px 0 0',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          animation: 'aci-sidecar-slide-in 0.18s ease both',
        }}
      >
        {/* Status dot */}
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: statusColor,
          boxShadow: isBusy ? `0 0 5px ${statusColor}99` : 'none',
          animation: isBusy ? 'aci-sidecar-pulse 1.8s ease-in-out infinite' : 'none',
          flexShrink: 0,
        }} />

        {/* Label */}
        <span style={{
          fontSize: 9, fontWeight: 700,
          color: 'rgba(212,176,140,0.4)',
          textTransform: 'uppercase', letterSpacing: '0.12em',
          fontFamily: 'monospace', flexShrink: 0,
        }}>
          Computer Use
        </span>

        <div style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

        {/* Message */}
        <span style={{
          flex: 1,
          fontSize: 11,
          color: status === 'WaitingApproval' ? '#fde68a' : 'rgba(212,176,140,0.65)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: status === 'WaitingApproval' ? 600 : 400,
        }}>
          {message}
        </span>

        {/* Step counter */}
        {stepIndex != null && totalSteps != null && totalSteps > 1 && (
          <span style={{
            fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
            color: 'rgba(212,176,140,0.4)', flexShrink: 0,
          }}>
            {stepIndex}/{totalSteps}
          </span>
        )}

        {/* Adapter */}
        {adapterLabel && (
          <span style={{
            fontSize: 9, fontFamily: 'monospace',
            color: 'rgba(255,255,255,0.18)', flexShrink: 0,
          }}>
            {adapterLabel}
          </span>
        )}

        {/* Approve button (when waiting) */}
        {status === 'WaitingApproval' && (
          <button
            onClick={() => approveAction?.()}
            style={{
              padding: '3px 9px', borderRadius: 4,
              background: 'rgba(212,176,140,0.12)',
              border: '1px solid rgba(212,176,140,0.28)',
              fontSize: 9, fontWeight: 700,
              color: 'rgba(212,176,140,0.85)',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            Approve
          </button>
        )}

        {/* Stop */}
        {status === 'Running' && (
          <button
            onClick={() => stopExecution?.()}
            style={{
              padding: '3px 8px', borderRadius: 4,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.18)',
              fontSize: 9, fontWeight: 700,
              color: 'rgba(239,68,68,0.65)',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            Stop
          </button>
        )}

        {/* Expand → opens full sidecar panel */}
        <button
          onClick={toggleAciSidecar}
          title="Open live screen"
          style={{
            width: 20, height: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(212,176,140,0.06)',
            border: '1px solid rgba(212,176,140,0.1)',
            borderRadius: 4,
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          {/* chevron-left → open panel from right */}
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <path d="M7 5H3M3 5l2-2M3 5l2 2" stroke="rgba(212,176,140,0.55)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </>
  );
}
