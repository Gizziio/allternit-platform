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
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useBrowserAgentStore, type AXTreeNode, type NotificationEntry } from './browserAgent.store';
import { useAgentSurfaceModeStore } from '../../stores/agent-surface-mode.store';
import { CursorOverlay } from './CursorOverlay';
import { executeGatewayAction } from '../../integration/computer-use-engine';
import { ConformanceDashboard } from './ConformanceDashboard';
import { ContextWindowCard } from '@/components/ai-elements/ContextWindowCard';

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
  @keyframes aci-sidecar-click-flash {
    0%   { transform: scale(0.4); opacity: 1; }
    100% { transform: scale(2.2); opacity: 0; }
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
// AX Tree diff helpers
// ─────────────────────────────────────────────────────────────

function axNodeKey(node: AXTreeNode): string {
  return `${node.role}:${node.name ?? ''}`;
}

function collectAxNodes(node: AXTreeNode, map: Map<string, AXTreeNode>): void {
  const key = axNodeKey(node);
  map.set(key, node);
  if (node.children) {
    for (const child of node.children) {
      collectAxNodes(child, map);
    }
  }
}

function diffAxTrees(
  prev: AXTreeNode | null,
  next: AXTreeNode,
): Map<string, 'added' | 'removed' | 'modified'> {
  const result = new Map<string, 'added' | 'removed' | 'modified'>();
  if (!prev) return result;

  const prevMap = new Map<string, AXTreeNode>();
  const nextMap = new Map<string, AXTreeNode>();
  collectAxNodes(prev, prevMap);
  collectAxNodes(next, nextMap);

  // Nodes in next but not prev → added
  for (const [key] of nextMap) {
    if (!prevMap.has(key)) {
      result.set(key, 'added');
    }
  }

  // Nodes in prev but not next → removed
  for (const [key] of prevMap) {
    if (!nextMap.has(key)) {
      result.set(key, 'removed');
    }
  }

  // Nodes in both — check value/bounds change → modified
  for (const [key, nextNode] of nextMap) {
    if (prevMap.has(key)) {
      const prevNode = prevMap.get(key)!;
      const valueChanged = prevNode.value !== nextNode.value;
      const boundsChanged = JSON.stringify(prevNode.bounds) !== JSON.stringify(nextNode.bounds);
      if (valueChanged || boundsChanged) {
        result.set(key, 'modified');
      }
    }
  }

  return result;
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

  // New store bindings
  const cursorPosition      = useBrowserAgentStore((s) => s.cursorPosition);
  const coordinateContract  = useBrowserAgentStore((s) => s.coordinateContract);
  const axTree              = useBrowserAgentStore((s) => s.axTree);
  const axSurface           = useBrowserAgentStore((s) => s.axSurface);
  const lastVerification    = useBrowserAgentStore((s) => s.lastVerification);
  const windows             = useBrowserAgentStore((s) => s.windows);
  const notifications       = useBrowserAgentStore((s) => s.notifications);
  const fetchWindows        = useBrowserAgentStore((s) => s.fetchWindows);
  const fetchNotifications  = useBrowserAgentStore((s) => s.fetchNotifications);
  const dismissNotification = useBrowserAgentStore((s) => s.dismissNotification);

  const [highlights, setHighlights]         = useState<HighlightBox[]>([]);
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 0, h: 0 });
  const [imgDisplaySize, setImgDisplaySize] = useState({ w: 0, h: 0 });
  const [imgOffset, setImgOffset]           = useState({ x: 0, y: 0 });
  const [mounted, setMounted]               = useState(false);
  const [panelWidth, setPanelWidth]         = useState(PANEL_WIDTH);
  const [viewMode, setViewMode]             = useState<'standard' | 'full'>('standard');
  const [showAxTree, setShowAxTree]         = useState(false);
  const [showWindows, setShowWindows]       = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [imgContainerSize, setImgContainerSize]   = useState({ width: 0, height: 0 });
  const [directControlMode, setDirectControlMode] = useState(false);
  const [clickFlash, setClickFlash]               = useState<{ x: number; y: number; id: number } | null>(null);
  const [showConformance, setShowConformance]     = useState(false);

  const imgRef            = useRef<HTMLImageElement | null>(null);
  const containerRef      = useRef<HTMLDivElement | null>(null);
  const imgContainerRef   = useRef<HTMLDivElement | null>(null);
  const dragRef           = useRef<{ startX: number; startW: number } | null>(null);
  const prevAxTreeRef     = useRef<AXTreeNode | null>(null);

  // Must be declared before any useEffect that reads it (React hook ordering)
  const computerUseModeSelected = useAgentSurfaceModeStore(
    (s) => s.selectedModeBySurface[s.currentSurface] === 'computer-use',
  );

  // Portal needs document.body — only available client-side
  useEffect(() => { setMounted(true); }, []);

  // Auto-expand when computer-use mode is selected
  useEffect(() => {
    if (computerUseModeSelected && !expanded) {
      toggleAciSidecar();
    }
  }, [computerUseModeSelected]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Track img container size for CursorOverlay
  useEffect(() => {
    const el = imgContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setImgContainerSize({ width: e.contentRect.width, height: e.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // AX tree diff — computed whenever axTree changes
  const axDiff = useMemo(() => {
    if (!axTree) return new Map<string, 'added' | 'removed' | 'modified'>();
    const d = diffAxTrees(prevAxTreeRef.current, axTree);
    prevAxTreeRef.current = axTree;
    return d;
  }, [axTree]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear click flash after 400ms
  useEffect(() => {
    if (!clickFlash) return;
    const timer = setTimeout(() => setClickFlash(null), 400);
    return () => clearTimeout(timer);
  }, [clickFlash]);

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

  // Direct control: click on screenshot → send gateway click action
  const handleScreenshotClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!directControlMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    let modelX = relX, modelY = relY;
    if (coordinateContract) {
      const scaleX = coordinateContract.model_width / rect.width;
      const scaleY = coordinateContract.model_height / rect.height;
      modelX = Math.round(relX * scaleX);
      modelY = Math.round(relY * scaleY);
    }
    void executeGatewayAction('click', { x: modelX, y: modelY });
    setClickFlash({ x: relX, y: relY, id: Date.now() });
  }, [directControlMode, coordinateContract]);

  const isActive = status !== 'Idle';
  const isBusy = status === 'Running' || status === 'WaitingApproval';

  // Hide conditions
  if (!mounted) return null;
  if (!isActive && !computerUseModeSelected) return null;
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

          <ContextWindowCard>
            <button style={{
              background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
              fontSize: 9, fontWeight: 700,
              color: 'rgba(212,176,140,0.45)',
              textTransform: 'uppercase', letterSpacing: '0.12em',
              fontFamily: 'monospace', flexShrink: 0,
            }}>
              COMPUTER USE
            </button>
          </ContextWindowCard>

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

          {/* AX Tree toggle */}
          <button onClick={() => setShowAxTree((v) => !v)} title="Accessibility Tree"
            style={{ padding: '2px 5px', fontSize: 9, background: showAxTree ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${showAxTree ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 4, color: showAxTree ? '#a855f7' : 'rgba(255,255,255,0.3)', cursor: 'pointer', flexShrink: 0 }}>
            AX
          </button>

          {/* Windows toggle */}
          <button onClick={() => { setShowWindows((v) => !v); if (!showWindows) void fetchWindows(); }} title="Open Windows"
            style={{ padding: '2px 5px', fontSize: 9, background: showWindows ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${showWindows ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 4, color: showWindows ? '#60a5fa' : 'rgba(255,255,255,0.3)', cursor: 'pointer', flexShrink: 0 }}>
            ⊞
          </button>

          {/* Notifications toggle */}
          <button onClick={() => { setShowNotifications((v) => !v); if (!showNotifications) void fetchNotifications(); }} title="Notifications"
            style={{ padding: '2px 5px', fontSize: 9, background: showNotifications ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${showNotifications ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 4, color: showNotifications ? '#fbbf24' : 'rgba(255,255,255,0.3)', cursor: 'pointer', flexShrink: 0 }}>
            🔔
          </button>

          {/* Direct control toggle */}
          <button onClick={() => setDirectControlMode((v) => !v)} title="Direct click control"
            style={{ padding: '2px 5px', fontSize: 9,
              background: directControlMode ? 'rgba(99,252,241,0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${directControlMode ? 'rgba(99,252,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 4, color: directControlMode ? '#63fcf1' : 'rgba(255,255,255,0.3)',
              cursor: 'pointer', flexShrink: 0 }}>
            ⊕ Direct
          </button>

          {/* Conformance dashboard toggle */}
          <button onClick={() => setShowConformance((v) => !v)} title="Conformance Dashboard"
            style={{ padding: '2px 5px', fontSize: 9,
              background: showConformance ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${showConformance ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 4, color: showConformance ? '#22c55e' : 'rgba(255,255,255,0.3)',
              cursor: 'pointer', flexShrink: 0 }}>
            ✓ Conf
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
              {/* Live screenshot + overlays */}
              <div
                ref={imgContainerRef}
                onClick={handleScreenshotClick}
                style={{
                  position: 'relative', width: '100%', height: '100%',
                  cursor: directControlMode ? 'crosshair' : 'default',
                }}
              >
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

                {/* Animated cursor overlay */}
                <CursorOverlay
                  position={cursorPosition}
                  containerWidth={imgContainerSize.width}
                  containerHeight={imgContainerSize.height}
                  coordinateContract={coordinateContract}
                  profiles={[{ agentId: 'primary', color: '#a855f7', size: 8 }]}
                />

                {/* Verification badge */}
                {lastVerification && (
                  <div style={{
                    position: 'absolute', bottom: 8, right: 8,
                    padding: '2px 8px', borderRadius: 4,
                    background: lastVerification.verified_success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                    border: `1px solid ${lastVerification.verified_success ? '#22c55e' : '#ef4444'}`,
                    fontSize: 10, color: lastVerification.verified_success ? '#22c55e' : '#ef4444',
                    fontWeight: 600, pointerEvents: 'none', zIndex: 10,
                  }}>
                    {lastVerification.verified_success ? '✓ Verified' : '✗ Unverified'} {Math.round(lastVerification.confidence * 100)}%
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

                {/* Click-to-target flash ripple */}
                {clickFlash && (
                  <div key={clickFlash.id} style={{
                    position: 'absolute',
                    left: clickFlash.x - 12,
                    top: clickFlash.y - 12,
                    width: 24, height: 24, borderRadius: '50%',
                    border: '2px solid rgba(99,252,241,0.8)',
                    animation: 'aci-sidecar-click-flash 0.4s ease-out forwards',
                    pointerEvents: 'none', zIndex: 20,
                  }} />
                )}

                {/* Scan-line texture */}
                <div style={{
                  position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5,
                  background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 1px, rgba(0,0,0,0.035) 1px, rgba(0,0,0,0.035) 2px)',
                }} />
              </div>
            </div>

            {/* Approval card */}
            {status === 'WaitingApproval' && <ApprovalCard />}

            {/* AX Tree panel */}
            {showAxTree && axTree && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: 8, maxHeight: 200, overflowY: 'auto', flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 4, fontFamily: 'monospace' }}>
                  AX · {(axSurface ?? 'WINDOW').toUpperCase()}
                </div>
                {axDiff.size > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', flexShrink: 0 }} />
                      Added
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }} />
                      Removed
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0 }} />
                      Modified
                    </span>
                  </div>
                )}
                <AXTreeDisplay node={axTree} depth={0} axDiff={axDiff} />
              </div>
            )}

            {/* Windows panel */}
            {showWindows && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: 8, maxHeight: 150, overflowY: 'auto', flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>OPEN WINDOWS</div>
                {windows.length === 0
                  ? <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>None found</div>
                  : windows.map((w) => (
                    <div key={w.window_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0', fontSize: 10 }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                        {w.app_name} — {w.title}
                      </span>
                      <button onClick={() => useBrowserAgentStore.getState().focusWindow(w.window_id)}
                        style={{ fontSize: 9, padding: '1px 6px', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 3, color: '#a855f7', cursor: 'pointer' }}>
                        Focus
                      </button>
                    </div>
                  ))
                }
              </div>
            )}

            {/* Notifications panel */}
            {showNotifications && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: 8, maxHeight: 150, overflowY: 'auto', flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>NOTIFICATIONS</div>
                {notifications.length === 0
                  ? <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>None</div>
                  : notifications.map((n: NotificationEntry) => (
                    <div key={n.notification_id} style={{ marginBottom: 6, padding: '4px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{n.title}</div>
                      {n.body && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{n.body}</div>}
                      <button onClick={() => void dismissNotification(n.notification_id)}
                        style={{ fontSize: 9, padding: '1px 6px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 3, color: '#ef4444', cursor: 'pointer' }}>
                        Dismiss
                      </button>
                    </div>
                  ))
                }
              </div>
            )}

            {/* Conformance dashboard panel */}
            {showConformance && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, maxHeight: 300, overflowY: 'auto' }}>
                <ConformanceDashboard />
              </div>
            )}

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
// AXTreeDisplay
// ─────────────────────────────────────────────────────────────

function AXTreeDisplay({
  node,
  depth,
  axDiff,
}: {
  node: AXTreeNode;
  depth: number;
  axDiff?: Map<string, 'added' | 'removed' | 'modified'>;
}) {
  const indent = depth * 10;
  const refLabel = node.ref_id ? `[${node.ref_id}] ` : '';
  const nameLabel = node.name ?? node.value ?? '';
  const key = `${node.role}:${node.name ?? ''}`;
  const change = axDiff?.get(key);

  const diffStyle: React.CSSProperties = change === 'added'
    ? { borderLeft: '2px solid #22c55e', background: 'rgba(34,197,94,0.07)', paddingLeft: indent + 4 }
    : change === 'removed'
    ? { borderLeft: '2px solid #ef4444', opacity: 0.4, textDecoration: 'line-through', paddingLeft: indent + 4 }
    : change === 'modified'
    ? { borderLeft: '2px solid #f59e0b', background: 'rgba(245,158,11,0.07)', paddingLeft: indent + 4 }
    : { paddingLeft: indent };

  return (
    <div style={diffStyle}>
      <span style={{ fontSize: 10, fontFamily: 'monospace', color: node.is_interactive ? '#a855f7' : 'rgba(255,255,255,0.3)' }}>
        {refLabel}<span style={{ color: 'rgba(255,255,255,0.5)' }}>{node.role}</span>
      </span>
      {nameLabel && (
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.55)', marginLeft: 4 }}>
          {nameLabel.slice(0, 40)}
        </span>
      )}
      {node.children?.map((child, i) => (
        <AXTreeDisplay key={i} node={child} depth={depth + 1} axDiff={axDiff} />
      ))}
    </div>
  );
}

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
        <ContextWindowCard>
          <button style={{
            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: 9, fontWeight: 700,
            color: 'rgba(212,176,140,0.4)',
            textTransform: 'uppercase', letterSpacing: '0.12em',
            fontFamily: 'monospace', flexShrink: 0,
          }}>
            Computer Use
          </button>
        </ContextWindowCard>

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
