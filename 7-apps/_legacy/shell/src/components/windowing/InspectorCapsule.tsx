/**
 * Inspector Capsule
 *
 * A miniapp capsule that shows browser/agent state for debugging and monitoring.
 * Subscribes to browser and agent events via Capsule SDK.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useWindowManager, useWindow } from './index';
import { onBrowserEvent, emitAgentStep, type AgentStep } from '../../host/browserEvents';
import { CapsuleWindowFrame } from './CapsuleWindowFrame';
import type { CapsuleWindow } from './types';
import { A2UISurface } from '../a2ui/A2UISurface';
import { inspectorAdapter } from './InspectorAdapter';

// ============================================================================
// Types
// ============================================================================

export interface InspectorState {
  connectedBrowserId: string | null;
  url: string;
  intent: 'user' | 'agent';
  agentSteps: AgentStep[];
  domSnapshot: DOMSnapshot | null;
  fps: number;
  latency: number;
  lastUpdated: number;
}

export interface AgentStep {
  id: string;
  status: 'pending' | 'running' | 'done' | 'error';
  description: string;
  timestamp: number;
}

export interface DOMSnapshot {
  timestamp: number;
  htmlLength: number;
  title: string;
  url: string;
}

// ============================================================================
// Component Props
// ============================================================================

interface InspectorCapsuleProps {
  capsuleId: string;
  spaceId: string;
  connectedBrowserId?: string;
  windowId?: string;
  onClose?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const InspectorCapsule: React.FC<InspectorCapsuleProps> = ({
  capsuleId,
  spaceId,
  connectedBrowserId,
  windowId: providedWindowId,
  onClose,
}) => {
  const { createWindow, focusWindow, getWindow, closeWindow } = useWindowManager();
  const [windowId, setWindowId] = useState<string | null>(providedWindowId ?? null);
  const [state, setState] = useState<InspectorState>({
    connectedBrowserId: connectedBrowserId || null,
    url: 'https://example.com',
    intent: 'user',
    agentSteps: [],
    domSnapshot: null,
    fps: 0,
    latency: 0,
    lastUpdated: Date.now(),
  });

  // Create window on mount
  useEffect(() => {
    if (!windowId && !providedWindowId?.startsWith('docked-')) {
      const id = createWindow({
        capsuleId,
        spaceId,
        title: '🔍 Inspector',
        x: 1200 + Math.random() * 100,
        y: 100 + Math.random() * 200,
        width: 320,
        height: 480,
      });
      setWindowId(id);
    } else if (providedWindowId?.startsWith('docked-')) {
      setWindowId(providedWindowId);
    }
  }, [windowId, providedWindowId, capsuleId, spaceId, createWindow]);

  // Get window state
  const window = windowId && !windowId.startsWith('docked-') ? useWindow(windowId) : null;

  // Focus window on mount
  useEffect(() => {
    if (windowId && !windowId.startsWith('docked-')) {
      focusWindow(windowId);
    }
  }, [windowId, focusWindow]);

  // Subscribe to browser/agent events
  useEffect(() => {
    // Subscribe to intent changes
    const unsubIntent = onBrowserEvent('browser.intent.changed', (event) => {
      setState(prev => ({
        ...prev,
        connectedBrowserId: event.payload.tabId,
        intent: event.payload.intent,
        lastUpdated: Date.now(),
      }));
    });

    // Subscribe to navigation requested
    const unsubNav = onBrowserEvent('browser.nav.requested', (event) => {
      setState(prev => ({
        ...prev,
        url: event.payload.url,
        lastUpdated: Date.now(),
      }));
    });

    // Subscribe to agent steps
    const unsubStep = onBrowserEvent('browser.agent.step', (event) => {
      setState(prev => ({
        ...prev,
        agentSteps: [...prev.agentSteps.slice(-19), {
          id: event.payload.stepId,
          status: event.payload.status,
          description: event.payload.description,
          timestamp: event.payload.timestamp,
        }],
        lastUpdated: Date.now(),
      }));
    });

    // Emit a test agent step to show the system is working
    emitAgentStep('init', 'done', 'Inspector connected');

    return () => {
      unsubIntent();
      unsubNav();
      unsubStep();
    };
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    if (windowId) {
      closeWindow(windowId);
    }
    onClose?.();
  }, [windowId, closeWindow, onClose]);

  const schema = useMemo(() => inspectorAdapter.render(state), [state]);

  // Don't render if no window
  if (!windowId || !window) {
    return (
      <div style={{ padding: '12px', color: 'var(--text-secondary, #9ca3af)', fontSize: '12px' }}>
        Initializing inspector...
      </div>
    );
  }

  const content = (
    <div style={{ height: '100%', overflow: 'auto', backgroundColor: 'var(--bg-primary, #0f0f0f)', color: 'var(--text-primary, #e4e4e7)' }}>
      <div style={{
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        backgroundColor: 'var(--bg-secondary, #1a1a2e)',
        borderBottom: '1px solid var(--border-color, #2a2a4a)',
        fontSize: '11px',
        fontWeight: 500,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>🔍</span>
          <span>Inspector</span>
        </div>
        <button 
          style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary, #6b7280)', cursor: 'pointer' }}
          onClick={handleClose}
        >✕</button>
      </div>
      <A2UISurface schema={schema} dataModel={state as any} />
    </div>
  );

  if (windowId?.startsWith('docked-')) {
    return content;
  }

  return (
    <CapsuleWindowFrame
      windowId={windowId!}
      onClose={handleClose}
      showControls={false}
      showTitle={false}
    >
      {content}
    </CapsuleWindowFrame>
  );
};

export default InspectorCapsule;
