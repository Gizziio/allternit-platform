import React, { useCallback } from 'react';
import { useWindowManager } from './windowing/WindowManager';
import { useShellState } from '../runtime/ShellState';
import { CapsuleIcon } from '../iconography/CapsuleIconRegistry';

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    height: '48px',
    backgroundColor: 'rgba(30, 30, 30, 0.85)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '24px',
    padding: '0 12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    zIndex: 9999,
    userSelect: 'none',
  },
  button: {
    height: '32px',
    padding: '0 16px',
    borderRadius: '16px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#E0E0E0',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  },
  separator: {
    width: '1px',
    height: '24px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    margin: '0 4px',
  }
};

export const WorkspaceLauncher: React.FC = () => {
  const { spawnCapsule, setActiveCapsule, capsules } = useShellState();
  const { createWindow, focusWindow } = useWindowManager();

  const handleSpawnBrowser = React.useCallback(() => {
    const browserId = 'singleton-browser';
    const existingCapsule = capsules.find(c => c.capsuleId === browserId);

    if (existingCapsule) {
      setActiveCapsule(browserId);
      return;
    }

    createWindow({
      capsuleId: browserId,
      spaceId: 'browser-space',
      title: 'Browser',
      x: 100,
      y: 100,
      width: 900,
      height: 600,
    });

    spawnCapsule({
      capsuleId: browserId,
      title: 'Browser',
      icon: '🌐',
      category: 'utility',
      status: 'ephemeral' as any,
      runRef: { runId: 'browser', sessionId: 'browser' },
      bindings: { journalRefs: [], artifactRefs: [] },
      canvasBundle: [
        {
          canvasId: 'canvas-browser',
          viewType: 'browser_view',
          bindings: { data: {} },
          risk: 'read',
          provenanceUI: { showTrail: false }
        }
      ],
      toolScope: { allowedTools: [], deniedTools: [], requiresConfirmation: [] },
      sandboxPolicy: { allow_network: true, allow_filesystem: false, max_memory_mb: 512 },
      provenance: {
        frameworkId: 'browser',
        frameworkVersion: '1.0',
        agentId: 'user',
        modelId: 'browser',
        inputs: [],
        toolCalls: []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any);
  }, [createWindow, focusWindow, spawnCapsule, setActiveCapsule]);

  const handleSpawnInspector = React.useCallback(() => {
    const existingCapsule = capsules.find(c => c.capsuleId?.startsWith('inspector'));

    if (existingCapsule) {
      setActiveCapsule(existingCapsule.capsuleId);
      return;
    }

    const id = `inspector-${Date.now()}`;

    createWindow({
      capsuleId: 'inspector',
      spaceId: `inspector-space-${id}`,
      title: 'Inspector',
      x: 150,
      y: 120,
      width: 600,
      height: 500,
    });

    spawnCapsule({
      capsuleId: id,
      title: 'Inspector',
      icon: '🔍',
      category: 'utility',
      status: 'ephemeral' as any,
      runRef: { runId: id, sessionId: id },
      bindings: { journalRefs: [], artifactRefs: [] },
      canvasBundle: [
        {
          canvasId: `canvas-${id}`,
          viewType: 'inspector_view',
          bindings: { data: {} },
          risk: 'read',
          provenanceUI: { showTrail: false }
        }
      ],
      toolScope: { allowedTools: [], deniedTools: [], requiresConfirmation: [] },
      sandboxPolicy: { allow_network: true, allow_filesystem: false, max_memory_mb: 512 },
      provenance: {
        frameworkId: 'inspector',
        frameworkVersion: '1.0',
        agentId: 'user',
        modelId: 'inspector',
        inputs: [],
        toolCalls: []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any);
  }, [createWindow, focusWindow, spawnCapsule, setActiveCapsule]);

  const handleSpawnAgentSteps = React.useCallback(() => {
    const existingCapsule = capsules.find(c => c.capsuleId?.startsWith('agent-steps'));

    if (existingCapsule) {
      setActiveCapsule(existingCapsule.capsuleId);
      return;
    }

    const id = `agent-steps-${Date.now()}`;

    createWindow({
      capsuleId: 'agent-steps',
      spaceId: `agent-steps-space-${id}`,
      title: 'Agent Steps',
      x: 200,
      y: 140,
      width: 700,
      height: 550,
    });

    spawnCapsule({
      capsuleId: id,
      title: 'Agent Steps',
      icon: '🤖',
      category: 'utility',
      status: 'ephemeral' as any,
      runRef: { runId: id, sessionId: id },
      bindings: { journalRefs: [], artifactRefs: [] },
      canvasBundle: [
        {
          canvasId: `canvas-${id}`,
          viewType: 'agent_steps_view',
          bindings: { data: {} },
          risk: 'read',
          provenanceUI: { showTrail: false }
        }
      ],
      toolScope: { allowedTools: [], deniedTools: [], requiresConfirmation: [] },
      sandboxPolicy: { allow_network: true, allow_filesystem: false, max_memory_mb: 512 },
      provenance: {
        frameworkId: 'agent-steps',
        frameworkVersion: '1.0',
        agentId: 'user',
        modelId: 'agent-steps',
        inputs: [],
        toolCalls: []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any);
  }, [createWindow, focusWindow, spawnCapsule, setActiveCapsule]);

  return (
    <div style={styles.container}>
      <button style={styles.button} onClick={handleSpawnBrowser}>
        <CapsuleIcon type="browser" size={16} /> Browser
      </button>
      <div style={styles.separator} />
      <button style={styles.button} onClick={handleSpawnInspector}>
        <CapsuleIcon type="inspector" size={16} /> Inspector
      </button>
      <button style={styles.button} onClick={handleSpawnAgentSteps}>
        <CapsuleIcon type="agent-steps" size={16} /> Steps
      </button>
      <div style={styles.separator} />
      <button style={styles.button} onClick={() => {}}>
        <CapsuleIcon type="studio" size={16} /> Toolbox
      </button>
      <button
        style={styles.button}
        onClick={() => {
          // Dispatch a custom event to inject the patch
          const customEvent = new CustomEvent('agui:inject-patch', {
            detail: {
              patch: {
                op: 'add',
                path: ['props', 'children', 0, 'props', 'children', 0, 'props', 'children', 0, 'props', 'children', 3],
                value: {
                  type: 'button',
                  props: {
                    children: 'AGENT MAGIC',
                    className: 'primary'
                  }
                }
              }
            }
          });
          window.dispatchEvent(customEvent);
        }}
      >
        Inject Patch
      </button>
    </div>
  );
};
