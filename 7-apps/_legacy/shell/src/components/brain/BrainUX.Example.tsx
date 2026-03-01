/**
 * BrainUX Usage Example
 * 
 * Integrate BrainUX animations into your chat interface:
 */

import React from 'react';
import { BrainUX, BrainUXProvider, useUXState, type UXState } from './BrainUX';
import { useBrain } from '../../runtime/BrainContext';

export const ChatWithBrainUX: React.FC = () => {
  const { activeSessionId } = useBrain();

  return (
    <div className="chat-container">
      {/* Your existing chat interface */}
      <div className="chat-messages">
        {/* ... existing message rendering ... */}
      </div>
      
      {/* BrainUX animations - shows during AI processing */}
      {activeSessionId && (
        <BrainUX 
          sessionId={activeSessionId}
          showAnimations={true}
          enableSound={false}
          onUXStateChange={(state: UXState) => {
            console.log('UX State changed:', state.type);
          }}
        />
      )}
      
      {/* Your input component */}
      <div className="chat-input">
        {/* ... existing input ... */}
      </div>
    </div>
  );
};

// Using the UX State in your components
export const ExampleWithUXState: React.FC = () => {
  const { uxState, setUXState } = useUXState();

  // Trigger different UX states for testing
  const testThinking = () => setUXState({ type: 'thinking', message: 'Analyzing...' });
  const testSearching = () => setUXState({ type: 'searching', query: 'React hooks tutorial' });
  const testTool = () => setUXState({ type: 'tool_use', tool_name: 'file_search', status: 'running' });
  const testGenerating = () => setUXState({ type: 'generating', progress: 45 });
  const testReasoning = () => setUXState({ type: 'reasoning', step: 2, total_steps: 5, description: 'Analyzing requirements' });
  const testError = () => setUXState({ type: 'error', message: 'Connection failed', retryable: true });
  const testIdle = () => setUXState({ type: 'idle' });

  return (
    <div>
      <BrainUXProvider enableSound={false}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <button onClick={testThinking}>Thinking</button>
          <button onClick={testSearching}>Searching</button>
          <button onClick={testTool}>Tool Use</button>
          <button onClick={testGenerating}>Generating</button>
          <button onClick={testReasoning}>Reasoning</button>
          <button onClick={testError}>Error</button>
          <button onClick={testIdle}>Idle</button>
        </div>
        
        <BrainUX sessionId="demo" />
      </BrainUXProvider>
    </div>
  );
};

export default BrainUX;
