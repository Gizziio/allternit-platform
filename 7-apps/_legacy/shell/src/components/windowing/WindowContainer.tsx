/**
 * Window Container
 *
 * Renders all windowed capsules from WindowManager state.
 * This component bridges WindowManager state to actual UI rendering.
 */

import React from 'react';
import { useWindowManager } from './WindowManager';
import { CapsuleWindowFrame } from './CapsuleWindowFrame';
import { WindowedBrowserView } from './WindowedBrowserView';
import { InspectorCapsule } from './InspectorCapsule';
import { AgentStepsCapsule } from './AgentStepsCapsule';
import { proofRecorder } from '../../proof/ProofRecorder';

export const WindowContainer: React.FC = () => {
  const { state: { windows } } = useWindowManager();

  React.useEffect(() => {
    proofRecorder.mark('WindowContainer mounted');
    console.log('[PROOF] WindowContainer mounted');
    console.log('[WINDOW_CONTAINER] Rendering windows:', windows.size);
  }, [windows]);

  const windowArray = Array.from(windows.values());

  return (
    <>
      {windowArray.map(window => {
        // Determine content based on capsuleId / type
        const isBrowser = window.capsuleId?.includes('browser') || window.title?.toLowerCase().includes('browser');
        const isInspector = window.capsuleId?.includes('inspector') || window.title?.toLowerCase().includes('inspector');
        const isAgentSteps = window.capsuleId?.includes('agent-steps') || window.title?.toLowerCase().includes('steps');

        console.log(`[WINDOW_CONTAINER] Rendering window ${window.id} type=${window.capsuleId} state=${window.state}`);

        return (
          <CapsuleWindowFrame
            key={window.id}
            windowId={window.id}
            onClose={() => {}}
            onMinimize={() => {}}
            onMaximize={() => {}}
            showControls={true}
            showTitle={true}
          >
            {isBrowser && (
              <WindowedBrowserView
                capsuleId={window.capsuleId || 'browser'}
                spaceId={window.spaceId || 'browser-space'}
                initialUrl="https://www.google.com"
              />
            )}
            {isInspector && (
              <InspectorCapsule
                capsuleId={window.capsuleId || 'inspector'}
                spaceId={window.spaceId || 'inspector-space'}
              />
            )}
            {isAgentSteps && (
              <AgentStepsCapsule
                capsuleId={window.capsuleId || 'agent-steps'}
                spaceId={window.spaceId || 'agent-steps-space'}
              />
            )}
            {!isBrowser && !isInspector && !isAgentSteps && (
              <div style={{
                padding: '20px',
                color: '#fff',
                textAlign: 'center',
              }}>
                <h3>{window.title || 'Capsule'}</h3>
                <p style={{ opacity: 0.7 }}>Content not yet implemented</p>
              </div>
            )}
          </CapsuleWindowFrame>
        );
      })}
    </>
  );
};

export default WindowContainer;
