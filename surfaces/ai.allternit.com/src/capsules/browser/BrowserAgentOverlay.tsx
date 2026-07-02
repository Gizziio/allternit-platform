import React, { useCallback, useEffect, useRef } from "react";

/**
 * BrowserAgentOverlay - Execution plane visualization
 * 
 * Separate component (NOT coupled to BrowserAgentBar).
 * Mounted inside BrowserCapsuleEnhanced, positioned above web content.
 * 
 * Features:
 * - Element highlight overlay during agent execution
 * - Action badge (Click/Type/Scroll/Read/etc.)
 * - Cursor ghost/pointer
 * - Ephemeral (appears during action only)
 * - Subscribes to runtime events (targets, bounding boxes)
 * 
 * Placement:
 * - Absolute overlay above web content
 * - Below BrowserAgentBar (z-index managed by parent)
 */

"use client";
import {
  CursorClick,
  Hand,
  TextT,
  Scroll,
  Eye,
  Camera,
  DownloadSimple,
  Warning,
  Clock,
} from '@phosphor-icons/react';
import {
  BrowserActionType,
  OverlayHighlightEvent,
  BrowserAgentStatus,
} from './browserAgent.types';
import { getObservabilityService } from '@/capsules/browser/observabilityService';
// ============================================================================
// Props
// ============================================================================

export interface BrowserAgentOverlayProps {
  // Current agent status
  status: BrowserAgentStatus;
  
  // Current action being executed
  currentAction: {
    type: BrowserActionType;
    selector: string;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null;
    label?: string;
  } | null;
  
  // Event stream (for future subscription-based updates)
  onEvent?: (event: OverlayHighlightEvent) => void;
  
  // Styling
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function BrowserAgentOverlay({
  status,
  currentAction,
  onEvent,
  className,
}: BrowserAgentOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const prevStatusRef = React.useRef<BrowserAgentStatus | null>(null);

  // Log status transitions to observability
  useEffect(() => {
    if (prevStatusRef.current !== status) {
      const obs = getObservabilityService();
      obs.log({
        event_type: 'agent.status.transition',
        severity: status === 'Blocked' ? 'warn' : 'info',
        source: 'BrowserAgentOverlay',
        message: `Agent status changed: ${prevStatusRef.current} → ${status}`,
        payload: {
          previousStatus: prevStatusRef.current,
          newStatus: status,
          hasCurrentAction: !!currentAction,
        },
      });
      prevStatusRef.current = status;
    }
  }, [status, currentAction]);

  // Get action icon
  const getActionIcon = useCallback((actionType: BrowserActionType) => {
    switch (actionType) {
      case 'Click':
        return Hand;
      case 'Type':
        return TextT;
      case 'Scroll':
        return Scroll;
      case 'Navigate':
        return CursorClick;
      case 'Assert':
      case 'Extract':
        return Eye;
      case 'Screenshot':
        return Camera;
      case 'Download':
        return DownloadSimple;
      case 'ConfirmGate':
        return Warning;
      case 'Select':
      case 'Wait':
      default:
        return Clock;
    }
  }, []);

  // Get action configuration
  const getActionConfig = useCallback((actionType: BrowserActionType) => {
    switch (actionType) {
      case 'Click':
        return { 
          classes: 'bg-blue-500 border-blue-600 text-white', 
          hex: '#3b82f6',
          label: 'Clicking...' 
        };
      case 'Type':
        return { 
          classes: 'bg-purple-500 border-purple-600 text-white', 
          hex: '#a855f7',
          label: 'Typing...' 
        };
      case 'Scroll':
        return { 
          classes: 'bg-green-500 border-green-600 text-white', 
          hex: '#22c55e',
          label: 'Scrolling...' 
        };
      case 'Navigate':
        return { 
          classes: 'bg-blue-500 border-blue-600 text-white', 
          hex: '#3b82f6',
          label: 'Navigating...' 
        };
      case 'Assert':
      case 'Extract':
        return { 
          classes: 'bg-cyan-500 border-cyan-600 text-white', 
          hex: '#06b6d4',
          label: actionType === 'Assert' ? 'Checking...' : 'Extracting...' 
        };
      case 'Screenshot':
        return { 
          classes: 'bg-pink-500 border-pink-600 text-white', 
          hex: '#ec4899',
          label: 'Capturing...' 
        };
      case 'Download':
        return { 
          classes: 'bg-orange-500 border-orange-600 text-white', 
          hex: '#f97316',
          label: 'Downloading...' 
        };
      case 'ConfirmGate':
        return { 
          classes: 'bg-yellow-500 border-yellow-600 text-white animate-pulse', 
          hex: '#eab308',
          label: 'Requires Approval' 
        };
      case 'Select':
      case 'Wait':
      default:
        return { 
          classes: 'bg-zinc-500 border-zinc-600 text-white', 
          hex: '#71717a',
          label: actionType === 'Select' ? 'Selecting...' : 'Waiting...' 
        };
    }
  }, []);

  // Only show overlay when agent is running and has a current action
  const shouldShow =
    (status === 'Running' || status === 'WaitingApproval') &&
    currentAction &&
    currentAction.boundingBox;

  // Emit event when highlight changes
  useEffect(() => {
    if (shouldShow && currentAction && onEvent) {
      const config = getActionConfig(currentAction.type);
      const event: OverlayHighlightEvent = {
        sessionId: 'current', // Would come from context in real implementation
        actionId: 'current', // Would come from context
        selector: {
          strategy: 'css',
          value: currentAction.selector,
        },
        actionType: currentAction.type,
        boundingBox: currentAction.boundingBox || undefined,
        label: currentAction.label || config.label,
        visible: true,
      };
      onEvent(event);
      
      // Log action to observability
      const obs = getObservabilityService();
      obs.log({
        event_type: 'agent.action.highlight',
        severity: 'info',
        source: 'BrowserAgentOverlay',
        message: `Highlighting element for action: ${currentAction.type}`,
        payload: {
          actionType: currentAction.type,
          selector: currentAction.selector,
          boundingBox: currentAction.boundingBox,
          label: event.label,
        },
        context: {
          workspace_hash: window.location.hostname,
        },
      });
    }
  }, [shouldShow, currentAction, onEvent, getActionConfig]);

  if (!shouldShow || !currentAction.boundingBox) {
    return null;
  }

  const ActionIcon = getActionIcon(currentAction.type);
  const actionConfig = getActionConfig(currentAction.type);
  const label = currentAction.label || actionConfig.label;

  const { x, y, width, height } = currentAction.boundingBox;

  return (
    <div
      ref={overlayRef}
      className={`
        absolute inset-0 pointer-events-none
        z-40
        ${className || ''}
      `}
      style={{ overflow: 'hidden' }}
    >
      {/* Highlight Box */}
      <div
        ref={highlightRef}
        className={`
          absolute border-2 rounded-lg
          ${actionConfig.classes}
          bg-opacity-20
          animate-in fade-in duration-200
        `}
        style={{
          left: x,
          top: y,
          width,
          height,
          boxShadow: `0 0 20px ${actionConfig.hex}40`,
        }}
      >
        {/* Corner accents - Pure CSS mask approach for pixel-perfect scaling */}
        <div 
          className="absolute -inset-1 pointer-events-none text-current"
          style={{
            border: '2px solid currentColor',
            borderRadius: '12px',
            maskImage: `
              linear-gradient(black, black), 
              linear-gradient(black, black), 
              linear-gradient(black, black), 
              linear-gradient(black, black)
            `,
            maskSize: '12px 12px',
            maskPosition: '0 0, 100% 0, 0 100%, 100% 100%',
            maskRepeat: 'no-repeat',
            WebkitMaskImage: `
              linear-gradient(black, black), 
              linear-gradient(black, black), 
              linear-gradient(black, black), 
              linear-gradient(black, black)
            `,
            WebkitMaskSize: '12px 12px',
            WebkitMaskPosition: '0 0, 100% 0, 0 100%, 100% 100%',
            WebkitMaskRepeat: 'no-repeat',
          }}
        />
      </div>

      {/* Action Badge */}
      <div
        ref={badgeRef}
        className={`
          absolute flex items-center gap-1.5
          px-3 py-1.5 rounded-full
          ${actionConfig.classes}
          shadow-lg
          animate-in slide-in-from-top-2 duration-200
        `}
        style={{
          left: x + width / 2,
          top: y - 45,
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
        }}
      >
        <ActionIcon size={16} />
        <span className="text-xs font-semibold">{label}</span>
      </div>

      {/* Cursor Ghost (optional visual flair) */}
      {status === 'Running' && (
        <div
          className="absolute pointer-events-none animate-in fade-in duration-300"
          style={{
            left: x + width * 0.7,
            top: y + height * 0.3,
          }}
        >
          <CursorClick
            className="size-6  text-blue-500 opacity-60"
            style={{
              filter: 'drop-shadow(0 2px 4px var(--surface-panel))',
            }}
          />
        </div>
      )}

      {/* Waiting Approval Overlay */}
      {status === 'WaitingApproval' && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]">
          <div className="absolute top-4 left-1/2 -tranzinc-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/90 text-white shadow-lg animate-pulse">
            <Warning size={16} />
            <span className="text-sm font-medium">Waiting for approval…</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Default Export
// ============================================================================

export default BrowserAgentOverlay;
