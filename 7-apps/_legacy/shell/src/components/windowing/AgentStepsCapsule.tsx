/**
 * Agent Steps Capsule
 *
 * A miniapp capsule that shows the timeline of agent execution steps.
 * Subscribes to browser.agent.step events via Capsule SDK.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useWindowManager, useWindow } from './index';
import { onBrowserEvent, type BrowserAgentStepEvent } from '../../host/browserEvents';
import { CapsuleWindowFrame } from './CapsuleWindowFrame';
import { A2UISurface } from '../a2ui/A2UISurface';
import { agentStepsAdapter, AGENT_STEPS_ACTION_IDS } from './AgentStepsAdapter';

// ============================================================================
// Types
// ============================================================================

export interface AgentStepsState {
  connectedBrowserId: string | null;
  steps: AgentStep[];
  displaySteps: AgentStep[]; // Reversed for UI
  lastUpdated: number;
}

export interface AgentStep {
  id: string;
  status: 'pending' | 'running' | 'done' | 'error';
  description: string;
  timestamp: number;
  artifacts?: string[]; // IDs of screenshots/snapshots
}

// ============================================================================
// Component Props
// ============================================================================

interface AgentStepsCapsuleProps {
  capsuleId: string;
  spaceId: string;
  connectedBrowserId?: string;
  windowId?: string;
  onClose?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const AgentStepsCapsule: React.FC<AgentStepsCapsuleProps> = ({
  capsuleId,
  spaceId,
  connectedBrowserId,
  windowId: providedWindowId,
  onClose,
}) => {
  const { createWindow, focusWindow, closeWindow } = useWindowManager();
  const [windowId, setWindowId] = useState<string | null>(providedWindowId ?? null);
  const [state, setState] = useState<AgentStepsState>({
    connectedBrowserId: connectedBrowserId || null,
    steps: [],
    displaySteps: [],
    lastUpdated: Date.now(),
  });

  // Create window on mount
  useEffect(() => {
    if (!windowId && !providedWindowId?.startsWith('docked-')) {
      const id = createWindow({
        capsuleId,
        spaceId,
        title: '🤖 Agent Steps',
        x: 1250 + Math.random() * 50,
        y: 150 + Math.random() * 50,
        width: 300,
        height: 500,
      });
      setWindowId(id);
    } else if (providedWindowId?.startsWith('docked-')) {
      setWindowId(providedWindowId);
    }
  }, [windowId, providedWindowId, capsuleId, spaceId, createWindow]);

  // Focus window on mount
  useEffect(() => {
    if (windowId && !windowId.startsWith('docked-')) {
      focusWindow(windowId);
    }
  }, [windowId, focusWindow]);

  // Subscribe to agent events
  useEffect(() => {
    const unsubStep = onBrowserEvent('browser.agent.step', (event) => {
      setState(prev => {
        const newSteps = [...prev.steps, {
          id: event.payload.stepId,
          status: event.payload.status,
          description: event.payload.description,
          timestamp: event.payload.timestamp,
        }];
        return {
          ...prev,
          steps: newSteps,
          displaySteps: [...newSteps].reverse().slice(0, 50),
          lastUpdated: Date.now(),
        };
      });
    });

    return () => {
      unsubStep();
    };
  }, []);

  // Handle actions
  const handleAction = useCallback((actionId: string) => {
    switch (actionId) {
      case AGENT_STEPS_ACTION_IDS.CLEAR_STEPS:
        setState(prev => ({ ...prev, steps: [], displaySteps: [], lastUpdated: Date.now() }));
        break;
    }
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    if (windowId) {
      closeWindow(windowId);
    }
    onClose?.();
  }, [windowId, closeWindow, onClose]);

  const schema = useMemo(() => agentStepsAdapter.render(state), [state]);

  // Don't render if no window
  if (!windowId) {
    return null;
  }

  const content = (
    <div style={{ height: '100%', overflow: 'auto', backgroundColor: 'var(--bg-primary, #0f0f0f)', color: 'var(--text-primary, #e4e4e7)' }}>
      <div style={{
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        backgroundColor: 'var(--bg-secondary, #1a1a2e)',
        borderBottom: '1px solid var(--border-color, #2a2a4a)',
        fontSize: '12px',
        fontWeight: 500,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>🤖</span>
          <span>Agent Steps</span>
        </div>
        <button 
          style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary, #6b7280)', cursor: 'pointer', fontSize: '14px' }}
          onClick={handleClose}
        >✕</button>
      </div>
      <A2UISurface schema={schema} dataModel={state as any} onAction={handleAction} />
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

export default AgentStepsCapsule;
