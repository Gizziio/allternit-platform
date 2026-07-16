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
 */

import { useIsClient } from '@/lib/hooks/use-is-client';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useBrowserAgentStore, type AXTreeNode, type NotificationEntry } from './browserAgent.store';

import { CursorOverlay } from './CursorOverlay';
import { executeGatewayAction } from '../../integration/computer-use-engine';
import { ConformanceDashboard } from './ConformanceDashboard';
import { ContextWindowCard } from '@/components/ai-elements/ContextWindowCard';
import { cn } from '@/lib/utils';

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
    <div 
      className="absolute border-2 border-solid rounded z-10 transition-all duration-[180ms] pointer-events-none"
      style={{ 
        left, top, width, height,
        borderColor: color,
        backgroundColor: color.replace('0.85)', '0.07)'),
        boxShadow: `0 0 0 1px ${color.replace('0.85)', '0.2)')}, 0 0 10px ${color.replace('0.85)', '0.12)')}`,
      }}
    >
      {box.label && (
        <div 
          className="absolute -top-5 left-0 px-1.5 py-0.5 bg-[rgba(10,9,8,0.92)] border border-solid rounded text-[12px] font-bold font-mono uppercase tracking-[0.06em] whitespace-nowrap"
          style={{ 
            color,
            borderColor: color.replace('0.85)', '0.4)'),
          }}
        >
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
  const riskColor = (approvalRiskTier ?? 0) >= 4 ? 'var(--status-error)'
                  : (approvalRiskTier ?? 0) >= 3 ? 'var(--status-warning)'
                  : 'var(--status-info)';

  return (
    <div className="m-3 p-3.5 px-4 bg-[var(--surface-floating)] border border-solid border-[var(--ui-border-default)] rounded-[10px] shadow-[var(--shadow-lg)]">
      <div className="text-[12px] font-bold text-[var(--accent-primary)] mb-1">
        Approval Required
      </div>
      {approvalRiskTier && (
        <div 
          className="text-[12px] uppercase tracking-[0.15em] mb-2.5 font-mono"
          style={{ color: riskColor }}
        >
          ⚠ Risk: {approvalRiskTier}
        </div>
      )}
      {approvalActionSummary && (
        <div className="bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] rounded-md p-2 px-2.5 text-[12px] text-[var(--ui-text-muted)] leading-relaxed mb-3 font-mono">
          {approvalActionSummary}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button"
          onClick={() => approveAction?.()}
          className="flex-1 h-8 bg-[color-mix(in_srgb,var(--accent-primary)_12%,var(--surface-panel))] border border-solid border-[color-mix(in_srgb,var(--accent-primary)_28%,transparent)] rounded-md text-[12px] font-bold text-[var(--accent-primary)] tracking-[0.08em] uppercase cursor-pointer transition-colors hover:opacity-90"
        >
          Approve
        </button>
        <button type="button"
          onClick={() => denyAction?.()}
          className="h-8 px-3.5 bg-[var(--status-error-bg)] border border-solid border-[color-mix(in_srgb,var(--status-error)_30%,transparent)] rounded-md text-[12px] font-bold text-[var(--status-error)] tracking-[0.08em] uppercase cursor-pointer transition-colors hover:opacity-90"
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
  const canonicalProviders  = useBrowserAgentStore((s) => s.canonicalProviders);
  const canonicalProviderDiagnostics = useBrowserAgentStore((s) => s.canonicalProviderDiagnostics);
  const canonicalObservation = useBrowserAgentStore((s) => s.canonicalObservation);
  const canonicalOutcome    = useBrowserAgentStore((s) => s.canonicalOutcome);
  const canonicalTrajectory = useBrowserAgentStore((s) => s.canonicalTrajectory);
  const canonicalError      = useBrowserAgentStore((s) => s.canonicalError);
  const canonicalLoading    = useBrowserAgentStore((s) => s.canonicalLoading);
  const discoverCanonicalProviders = useBrowserAgentStore((s) => s.discoverCanonicalProviders);
  const loadCanonicalTrajectory = useBrowserAgentStore((s) => s.loadCanonicalTrajectory);

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
  const [showCanonical, setShowCanonical]         = useState(false);

  const imgRef            = useRef<HTMLImageElement | null>(null);
  const containerRef      = useRef<HTMLDivElement | null>(null);
  const imgContainerRef   = useRef<HTMLDivElement | null>(null);
  const dragRef           = useRef<{ startX: number; startW: number } | null>(null);
  const prevAxTreeRef     = useRef<AXTreeNode | null>(null);

  // Portal needs document.body — only available client-side
  useEffect(() => { setMounted(true); }, [])

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
  if (!isActive) return null;
  if (suppressInBrowserMode && isBrowserCapsuleActive) return null;

  const statusColor = status === 'Running'         ? 'var(--status-success)'
                    : status === 'WaitingApproval'  ? 'var(--status-warning)'
                    : status === 'Done'              ? 'var(--status-info)'
                    : 'var(--ui-text-muted)';

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
          className="fixed top-0 bottom-0 right-[var(--resizer-right)] w-1.5 cursor-col-resize z-[1001] flex items-center justify-center"
          style={{ '--resizer-right': `${panelWidth - 3}px` } as React.CSSProperties}
        >
          <div className="w-[3px] h-10 rounded-full bg-[var(--ui-border-default)]" />
        </div>
      )}

      {/* Main panel — standard (right panel) or full (viewport overlay) */}
      <div
        className={cn(
          "fixed flex flex-col bg-[var(--surface-canvas)] z-[120] overflow-hidden",
          viewMode === 'full' ? "inset-0 animate-[aci-sidecar-slide-in_0.18s_cubic-bezier(0.22,1,0.36,1)_both]" : "top-0 right-0 bottom-0 border-l border-solid border-[var(--ui-border-muted)] shadow-[var(--shadow-xl)] animate-[aci-sidecar-slide-in_0.22s_cubic-bezier(0.22,1,0.36,1)_both]"
        )}
        style={viewMode === 'standard' ? { width: panelWidth } : {}}
      >
        {/* ── Header ── */}
        <div className="h-[42px] bg-[var(--surface-panel)] border-b border-solid border-[var(--ui-border-muted)] flex items-center p-0 px-3 gap-2 shrink-0">
          {/* Status dot */}
          <div 
            className={cn(
              "size-1.5 rounded-full shrink-0",
              isBusy && "animate-[aci-sidecar-pulse_1.8s_ease-in-out_infinite]"
            )}
            style={{ 
              background: statusColor,
              boxShadow: isBusy ? `0 0 6px ${statusColor}aa` : 'none',
            }}
          />

          <ContextWindowCard>
            <button type="button" className="bg-transparent border-none p-0 cursor-pointer text-[12px] font-bold text-[var(--ui-text-muted)] uppercase tracking-[0.12em] font-mono shrink-0">
              COMPUTER USE
            </button>
          </ContextWindowCard>

          <div className="w-px h-3 bg-[var(--ui-border-muted)] shrink-0" />

          {/* Message */}
          <span className={cn(
            "flex-1 text-[12px] overflow-hidden text-ellipsis whitespace-nowrap",
            status === 'WaitingApproval' ? "text-[var(--status-warning)] font-semibold" : "text-[var(--ui-text-secondary)] font-normal"
          )}>
            {lastEventMessage || goal || (status === 'Done' ? 'Task complete' : 'Waiting…')}
          </span>

          {/* Step counter */}
          {currentAction?.stepIndex != null && currentAction?.totalSteps != null && currentAction.totalSteps > 1 && (
            <span className="text-[12px] text-[var(--ui-text-muted)] font-mono font-bold shrink-0">
              {currentAction.stepIndex}/{currentAction.totalSteps}
            </span>
          )}

          {/* Adapter chip */}
          {adapterLabel && (
            <span className="text-[12px] text-[var(--ui-text-muted)] font-mono shrink-0">
              {adapterLabel}{currentLayer ? ` · ${currentLayer}` : ''}
            </span>
          )}

          {/* View mode toggle — Standard ↔ Full */}
          <button type="button"
            onClick={() => setViewMode((v) => v === 'standard' ? 'full' : 'standard')}
            title={viewMode === 'standard' ? 'Fit to viewport (fullscreen)' : 'Back to standard view'}
            className={cn(
              "size-[22px] flex items-center justify-center border border-solid border-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)] rounded-[5px] cursor-pointer shrink-0 transition-colors",
              viewMode === 'full' ? "bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent)] text-[var(--accent-primary)]" : "bg-[var(--surface-hover)] text-[var(--ui-text-muted)]"
            )}
          >
            {viewMode === 'standard' ? (
              /* expand icon */
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 3.5V1h2.5M6.5 1H9v2.5M9 6.5V9H6.5M3.5 9H1V6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              /* compress icon */
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M3.5 1v2.5H1M9 3.5H6.5V1M6.5 9V6.5H9M1 6.5h2.5V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>

          {/* AX Tree toggle */}
          <button type="button" onClick={() => setShowAxTree((v) => !v)} title="Accessibility Tree"
            className={cn(
              "px-1.5 py-0.5 text-[12px] border border-solid rounded cursor-pointer shrink-0 transition-colors",
              showAxTree ? "bg-[rgba(168,85,247,0.2)] border-[rgba(168,85,247,0.4)] text-[#a855f7]" : "bg-[var(--surface-hover)] border-[var(--ui-border-muted)] text-[var(--ui-text-muted)]"
            )}>
            AX
          </button>

          {/* Windows toggle */}
          <button type="button" onClick={() => { setShowWindows((v) => !v); if (!showWindows) void fetchWindows(); }} title="Open Windows"
            className={cn(
              "px-1.5 py-0.5 text-[12px] border border-solid rounded cursor-pointer shrink-0 transition-colors",
              showWindows ? "bg-[rgba(59,130,246,0.2)] border-[rgba(59,130,246,0.4)] text-[var(--status-info)]" : "bg-[var(--surface-hover)] border-[var(--ui-border-muted)] text-[var(--ui-text-muted)]"
            )}>
            ⊞
          </button>

          {/* Notifications toggle */}
          <button type="button" onClick={() => { setShowNotifications((v) => !v); if (!showNotifications) void fetchNotifications(); }} title="Notifications"
            className={cn(
              "px-1.5 py-0.5 text-[12px] border border-solid rounded cursor-pointer shrink-0 transition-colors",
              showNotifications ? "bg-[rgba(251,191,36,0.2)] border-[rgba(251,191,36,0.4)] text-[var(--status-warning)]" : "bg-[var(--surface-hover)] border-[var(--ui-border-muted)] text-[var(--ui-text-muted)]"
            )}>
            🔔
          </button>

          {/* Direct control toggle */}
          <button type="button" onClick={() => setDirectControlMode((v) => !v)} title="Direct click control"
            className={cn(
              "px-1.5 py-0.5 text-[12px] border border-solid rounded cursor-pointer shrink-0 transition-colors",
              directControlMode ? "bg-[rgba(99,252,241,0.2)] border-[rgba(99,252,241,0.4)] text-[#0f766e]" : "bg-[var(--surface-hover)] border-[var(--ui-border-muted)] text-[var(--ui-text-muted)]"
            )}>
            ⊕ Direct
          </button>

          {/* Conformance dashboard toggle */}
          <button type="button" onClick={() => setShowConformance((v) => !v)} title="Conformance Dashboard"
            className={cn(
              "px-1.5 py-0.5 text-[12px] border border-solid rounded cursor-pointer shrink-0 transition-colors",
              showConformance ? "bg-[rgba(34,197,94,0.2)] border-[rgba(34,197,94,0.4)] text-[var(--status-success)]" : "bg-[var(--surface-hover)] border-[var(--ui-border-muted)] text-[var(--ui-text-muted)]"
            )}>
            ✓ Conf
          </button>

          <button type="button" onClick={() => {
            setShowCanonical((value) => !value);
            if (!showCanonical) {
              if (canonicalProviders.length === 0) void discoverCanonicalProviders();
              void loadCanonicalTrajectory();
            }
          }} title="Canonical guarantees and evidence"
            className={cn(
              "px-1.5 py-0.5 text-[12px] border border-solid rounded cursor-pointer shrink-0 transition-colors",
              showCanonical ? "bg-[#3b82f6]/20 border-[#3b82f6]/40 text-[#60a5fa]" : "bg-[var(--surface-hover)] border-[var(--ui-border-muted)] text-[var(--ui-text-muted)]"
            )}>
            ◇ Trust
          </button>

          {/* Collapse → minimizes to ACIComputerUseBar above chat input */}
          <button type="button"
            onClick={toggleAciSidecar}
            title="Minimize to input bar"
            className="size-[22px] flex items-center justify-center bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] rounded-[5px] cursor-pointer shrink-0 transition-colors hover:bg-[var(--surface-active)] text-[var(--ui-text-muted)]"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3 5h4M7 5L5 3M7 5L5 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* ── Screen area ── */}
        {(
          <>
            <div
              ref={containerRef}
              className="flex-1 relative overflow-hidden bg-black min-h-0"
            >
              {/* Live screenshot + overlays */}
              <div role="button" tabIndex={0}
                ref={imgContainerRef}
                onClick={handleScreenshotClick}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleScreenshotClick(e as any); }}
                className={cn(
                  "relative size-full transition-all",
                  directControlMode ? "cursor-crosshair" : "cursor-default"
                )}
              >
                {screenshot ? (
                  <img
                    ref={imgRef}
                    src={screenshot}
                    alt="Live screen"
                    onLoad={recalcImgMetrics}
                    className="block max-w-full max-h-full size-full object-contain object-center"
                  />
                ) : isConnecting ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className="size-8 border-2 border-solid border-[rgba(212,176,140,0.15)] border-t-[rgba(212,176,140,0.6)] rounded-full animate-[aci-sidecar-spin_0.9s_linear_infinite]" />
                    <span className="text-[12px] text-[rgba(212,176,140,0.3)] font-mono tracking-[0.1em]">
                      CONNECTING…
                    </span>
                  </div>
                ) : serviceError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-5">
                    <span className="text-[12px] text-[rgba(239,68,68,0.7)] font-mono text-center">
                      {serviceError}
                    </span>
                    <span className="text-[12px] text-[rgba(212,176,140,0.3)] font-mono text-center">
                      Check the agent logs for details.
                    </span>
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-[linear-gradient(135deg,#0a0908_0%,#111010_100%)] flex items-center justify-center">
                    <span className="text-[12px] text-[var(--ui-border-default)] font-mono tracking-[0.1em]">
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
                  <div 
                    className={cn(
                      "absolute bottom-2 right-2 px-2 py-0.5 rounded border border-solid text-[12px] font-semibold z-10 pointer-events-none transition-colors",
                      lastVerification.verified_success ? "bg-[#22c55e]/20 border-[var(--status-success)] text-[var(--status-success)]" : "bg-[#ef4444]/20 border-[var(--status-error)] text-[var(--status-error)]"
                    )}
                  >
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
                  <div key={clickFlash.id} 
                    className="absolute size-6 rounded-full border-2 border-solid border-[rgba(99,252,241,0.8)] animate-[aci-sidecar-click-flash_0.4s_ease-out_forwards] z-20 pointer-events-none"
                    style={{
                      left: clickFlash.x - 12,
                      top: clickFlash.y - 12,
                    }}
                  />
                )}

                {/* Scan-line texture */}
                <div className="absolute inset-0 pointer-events-none z-[5] bg-[repeating-linear-gradient(0deg,transparent_0px,transparent_1px,rgba(0,0,0,0.035)_1px,rgba(0,0,0,0.035)_2px)]" />
              </div>
            </div>

            {/* Approval card */}
            {status === 'WaitingApproval' && <ApprovalCard />}

            {/* AX Tree panel */}
            {showAxTree && axTree && (
              <div className="border-t border-solid border-[var(--surface-hover)] p-2 max-h-[200px] overflow-y-auto shrink-0">
                <div className="text-[12px] font-bold text-white/60 mb-1 font-mono">
                  AX · {(axSurface ?? 'WINDOW').toUpperCase()}
                </div>
                {axDiff.size > 0 && (
                  <div className="flex gap-2 mb-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[12px] text-white/40 font-mono">
                      <span className="size-2 rounded-full bg-[var(--status-success)] inline-block shrink-0" />
                      Added
                    </span>
                    <span className="flex items-center gap-1 text-[12px] text-white/40 font-mono">
                      <span className="size-2 rounded-full bg-[var(--status-error)] inline-block shrink-0" />
                      Removed
                    </span>
                    <span className="flex items-center gap-1 text-[12px] text-white/40 font-mono">
                      <span className="size-2 rounded-full bg-[var(--status-warning)] inline-block shrink-0" />
                      Modified
                    </span>
                  </div>
                )}
                <AXTreeDisplay node={axTree} depth={0} axDiff={axDiff} />
              </div>
            )}

            {/* Windows panel */}
            {showWindows && (
              <div className="border-t border-solid border-[var(--surface-hover)] p-2 max-h-[150px] overflow-y-auto shrink-0">
                <div className="text-[12px] font-bold text-white/60 mb-1">OPEN WINDOWS</div>
                {windows.length === 0
                  ? <div className="text-[12px] text-white/25 italic">None found</div>
                  : windows.map((w) => (
                    <div key={w.window_id} className="flex items-center justify-between py-0.5 text-[12px]">
                      <span className="text-white/50 truncate max-w-[70%]">
                        {w.app_name} — {w.title}
                      </span>
                      <button type="button" onClick={() => useBrowserAgentStore.getState().focusWindow(w.window_id)}
                        className="text-[12px] px-1.5 py-0.5 bg-[#a855f7]/15 border border-solid border-[#a855f7]/30 rounded-[3px] text-[#a855f7] cursor-pointer hover:bg-[#a855f7]/25 transition-colors">
                        Focus
                      </button>
                    </div>
                  ))
                }
              </div>
            )}

            {/* Notifications panel */}
            {showNotifications && (
              <div className="border-t border-solid border-[var(--surface-hover)] p-2 max-h-[150px] overflow-y-auto shrink-0">
                <div className="text-[12px] font-bold text-white/60 mb-1">NOTIFICATIONS</div>
                {notifications.length === 0
                  ? <div className="text-[12px] text-white/25 italic">None</div>
                  : notifications.map((n: NotificationEntry) => (
                    <div key={n.notification_id} className="mb-1.5 p-1 px-1.5 bg-[var(--surface-hover)] rounded">
                      <div className="text-[12px] font-semibold text-white/75">{n.title}</div>
                      {n.body && <div className="text-[12px] text-white/40 mb-0.5">{n.body}</div>}
                      <button type="button" onClick={() => void dismissNotification(n.notification_id)}
                        className="text-[12px] px-1.5 py-0.5 bg-[var(--status-error-bg)] border border-solid border-[#ef4444]/30 rounded-[3px] text-[var(--status-error)] cursor-pointer hover:opacity-80 transition-opacity">
                        Dismiss
                      </button>
                    </div>
                  ))
                }
              </div>
            )}

            {/* Conformance dashboard panel */}
            {showConformance && (
              <div className="border-t border-solid border-[var(--surface-hover)] shrink-0 max-h-[300px] overflow-y-auto">
                <ConformanceDashboard />
              </div>
            )}

            {showCanonical && (
              <div className="border-t border-solid border-[var(--surface-hover)] p-2.5 shrink-0 max-h-[260px] overflow-y-auto font-mono">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-bold text-white/70">CANONICAL TRUST</span>
                  <span className="text-[12px] text-white/35">{canonicalLoading ? 'refreshing…' : `${Object.keys(canonicalProviderDiagnostics).length} routes`}</span>
                </div>
                {canonicalError && <div className="text-[12px] text-[var(--status-error)] mb-2 break-words">{canonicalError}</div>}
                <div className="space-y-1 mb-2">
                  {canonicalProviders.map((provider) => (
                    <div key={provider.provider_id} className="flex items-center justify-between gap-2 text-[12px] bg-white/[0.03] rounded px-1.5 py-1">
                      <span className="text-white/55 truncate">{provider.provider_id}</span>
                      <span className={provider.strict_background ? "text-[var(--status-success)]" : "text-[var(--status-warning)]"}>
                        {provider.strict_background ? 'strict bg' : 'foreground'}
                      </span>
                    </div>
                  ))}
                  {Object.entries(canonicalProviderDiagnostics)
                    .filter(([providerId, diagnostic]) => !diagnostic.available && !canonicalProviders.some((provider) => provider.provider_id === providerId))
                    .map(([providerId, diagnostic]) => (
                      <div key={providerId} className="text-[12px] bg-white/[0.03] rounded px-1.5 py-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-white/55 truncate">{providerId}</span>
                          <span className="text-[var(--status-error)]">setup required</span>
                        </div>
                        <div className="text-white/30 truncate" title={diagnostic.message ?? diagnostic.reason}>
                          {diagnostic.message ?? diagnostic.reason ?? 'runtime unavailable'}
                        </div>
                      </div>
                    ))}
                </div>
                {canonicalObservation && (
                  <div className="border-t border-white/5 pt-1.5 text-[12px] text-white/45 space-y-0.5">
                    <div>state <span className="text-white/70">{canonicalObservation.state_id}</span></div>
                    <div>epoch {canonicalObservation.epoch} · {canonicalObservation.elements.length} elements</div>
                    <div>evidence {canonicalObservation.image ? canonicalObservation.image.sha256.slice(0, 12) : 'semantic only'}</div>
                  </div>
                )}
                {canonicalOutcome && (
                  <div className="border-t border-white/5 mt-1.5 pt-1.5 text-[12px]">
                    <span className={canonicalOutcome.status === 'worked' ? "text-[var(--status-success)]" : canonicalOutcome.status === 'unknown' ? "text-[var(--status-warning)]" : "text-[var(--status-error)]"}>
                      {canonicalOutcome.status.toUpperCase()}
                    </span>
                    <span className="text-white/40"> · {canonicalOutcome.receipt_id ?? 'no receipt'}</span>
                  </div>
                )}
                {canonicalTrajectory && (
                  <div className="border-t border-white/5 mt-1.5 pt-1.5 text-[12px] text-white/45">
                    <div>{canonicalTrajectory.event_count ?? 0} ordered events</div>
                    <div className="truncate">trajectory {canonicalTrajectory.sha256?.slice(0, 16) ?? 'unhashed'}</div>
                    <div className="mt-1 space-y-0.5 max-h-20 overflow-y-auto">
                      {canonicalTrajectory.events?.slice(-5).map((event, index) => (
                        <div key={String(event.event_id ?? index)} className="truncate text-white/35">
                          {String(event.event_type ?? 'event')}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Done banner */}
            {status === 'Done' && (
              <div className="m-3 p-3 px-3.5 bg-[#10b981]/10 border border-solid border-[#10b981]/20 rounded-lg flex items-center gap-2 shrink-0 animate-[aci-sidecar-pulse_2s_ease-in-out_infinite]">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
                  <path d="M3 8l3 3 7-7" stroke="rgba(16,185,129,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="min-w-0">
                  <div className="text-[12px] font-bold text-[#10b981]/90 mb-0.5">Task Complete</div>
                  <div className="text-[12px] text-[#10b981]/50 font-mono truncate">
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
  const refLabel = node.ref_id ? `[${node.ref_id}] ` : '';
  const nameLabel = node.name ?? node.value ?? '';
  const key = `${node.role}:${node.name ?? ''}`;
  const change = axDiff?.get(key);

  return (
    <div 
      className={cn(
        "border-l-2 border-solid transition-colors duration-200",
        change === 'added' ? "border-[#22c55e] bg-[#22c55e]/10" :
        change === 'removed' ? "border-[#ef4444] opacity-40 line-through" :
        change === 'modified' ? "border-[#f59e0b] bg-[#f59e0b]/10" :
        "border-transparent"
      )}
      style={{ paddingLeft: `${depth * 10 + (change ? 4 : 0)}px` }}
    >
      <span className={cn("text-[12px] font-mono", node.is_interactive ? "text-[#a855f7]" : "text-white/30")}>
        {refLabel}<span className="text-white/50">{node.role}</span>
      </span>
      {nameLabel && (
        <span className="text-[12px] font-mono text-white/60 ml-1">
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

  const statusColor = status === 'Running'         ? 'var(--status-success)'
                    : status === 'WaitingApproval'  ? 'var(--status-warning)'
                    : status === 'Done'             ? 'var(--status-info)'
                    : 'var(--ui-text-muted)';

  const isBusy  = status === 'Running' || status === 'WaitingApproval';
  const message = lastEventMessage
    || (requiresApproval ? 'Awaiting approval…' : null)
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
        className={cn(
          "flex items-center gap-2 p-1.5 px-3 bg-[var(--surface-panel)] border-t border-solid border-[var(--ui-border-muted)] rounded-t-lg backdrop-blur-md animate-[aci-sidecar-slide-in_0.18s_ease_both]",
          className
        )}
      >
        {/* Status dot */}
        <div 
          className={cn(
            "size-1.5 rounded-full shrink-0",
            isBusy && "animate-[aci-sidecar-pulse_1.8s_ease-in-out_infinite]"
          )}
          style={{ 
            background: statusColor,
            boxShadow: isBusy ? `0 0 5px ${statusColor}99` : 'none',
          }}
        />

        {/* Label */}
        <ContextWindowCard>
          <button type="button" className="bg-transparent border-none p-0 cursor-pointer text-[12px] font-bold text-[var(--ui-text-muted)] uppercase tracking-[0.12em] font-mono shrink-0">
            Computer Use
          </button>
        </ContextWindowCard>

        <div className="w-px h-2.5 bg-[var(--ui-border-muted)] shrink-0" />

        {/* Message */}
        <span className={cn(
          "flex-1 text-[12px] overflow-hidden text-ellipsis whitespace-nowrap",
          status === 'WaitingApproval' ? "text-[var(--status-warning)] font-semibold" : "text-[var(--ui-text-secondary)] font-normal"
        )}>
          {message}
        </span>

        {/* Step counter */}
        {stepIndex != null && totalSteps != null && totalSteps > 1 && (
          <span className="text-[12px] font-mono font-bold text-[var(--ui-text-muted)] shrink-0">
            {stepIndex}/{totalSteps}
          </span>
        )}

        {/* Adapter */}
        {adapterLabel && (
          <span className="text-[12px] font-mono text-[var(--ui-text-muted)] shrink-0">
            {adapterLabel}
          </span>
        )}

        {/* Approve button (when waiting) */}
        {status === 'WaitingApproval' && (
          <button type="button"
            onClick={() => approveAction?.()}
            className="px-2 py-1 rounded bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent)] border border-solid border-[color-mix(in_srgb,var(--accent-primary)_28%,transparent)] text-[12px] font-bold text-[var(--accent-primary)] tracking-[0.08em] uppercase cursor-pointer shrink-0 transition-colors hover:opacity-90"
          >
            Approve
          </button>
        )}

        {/* Stop */}
        {status === 'Running' && (
          <button type="button"
            onClick={() => stopExecution?.()}
            className="px-2 py-1 rounded bg-[var(--status-error-bg)] border border-solid border-[#ef4444]/20 text-[12px] font-bold text-[#ef4444]/70 tracking-[0.08em] uppercase cursor-pointer shrink-0 transition-colors hover:opacity-90"
          >
            Stop
          </button>
        )}

        {/* Expand → opens full sidecar panel */}
        <button type="button"
          onClick={toggleAciSidecar}
          title="Open live screen"
          className="size-5 flex items-center justify-center bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] rounded cursor-pointer shrink-0 transition-colors hover:bg-[var(--surface-active)] text-[var(--ui-text-muted)]"
        >
          {/* chevron-left → open panel from right */}
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <path d="M7 5H3M3 5l2-2M3 5l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </>
  );
}
