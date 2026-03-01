import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { api } from '../runtime/ApiClient';
import type { ActionProposal } from '../../../shared/contracts';
import { SuperconductorUI } from '@ui-tars/superconductor-integration';
import { isSuperconductorEnabled, getSuperconductorConfig } from '@ui-tars/config';

interface UITarsWidgetProps {
  onProposalExecute: (proposal: ActionProposal) => void;
  onProposalHover?: (proposal: ActionProposal | null) => void;
}

type WidgetState = 'minimized' | 'expanded';
type OrbState = 'idle' | 'processing' | 'ready' | 'error';
type UITab = 'chat' | 'conductor';

export const UITarsWidget: React.FC<UITarsWidgetProps> = ({
  onProposalExecute,
  onProposalHover,
}) => {
  const [state, setState] = useState<WidgetState>('minimized');
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [proposals, setProposals] = useState<ActionProposal[]>([]);
  const [reasoning, setReasoning] = useState('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState<Array<{
    id: string;
    type: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>>([]);
  const [activeTab, setActiveTab] = useState<UITab>('chat');
  const orbRef = useRef<HTMLButtonElement>(null);

  // No API key needed for internal Superconductor implementation

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    // Add user message to conversation
    const userMessage = {
      id: `msg_${Date.now()}_user`,
      type: 'user' as const,
      content: input,
      timestamp: new Date(),
    };
    setConversation(prev => [...prev, userMessage]);

    setIsLoading(true);
    setOrbState('processing');

    try {
      // First, capture a screenshot
      const captureRes = await fetch('/api/v1/gui/observe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      let screenshotId = 'current_screen';
      if (captureRes.ok) {
        const captureData = await captureRes.json();
        screenshotId = captureData.screenshot_id || captureData.id || 'current_screen';
      }

      // Then get proposals from UI-TARS
      const response = await api.propose(screenshotId, input);

      if (response && response.proposals && response.proposals.length > 0) {
        setProposals(response.proposals);
        setReasoning(response.reasoning || '');

        // Add assistant response to conversation
        const assistantMessage = {
          id: `msg_${Date.now()}_assistant`,
          type: 'assistant' as const,
          content: `I found ${response.proposals.length} action${response.proposals.length !== 1 ? 's' : ''} you can take:`,
          timestamp: new Date(),
        };
        setConversation(prev => [...prev, assistantMessage]);

        setOrbState('ready');
      } else {
        setProposals([]);
        setReasoning('');

        // Add assistant response indicating no proposals
        const assistantMessage = {
          id: `msg_${Date.now()}_assistant_no_prop`,
          type: 'assistant' as const,
          content: "I couldn't find any specific actions to take based on your request. Could you be more specific?",
          timestamp: new Date(),
        };
        setConversation(prev => [...prev, assistantMessage]);

        setOrbState('idle');
      }
    } catch (err) {
      console.error('Failed to get proposals:', err);
      setOrbState('error');

      // Add error message to conversation
      const errorMessage = {
        id: `msg_${Date.now()}_error`,
        type: 'assistant' as const,
        content: "Sorry, I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      };
      setConversation(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setInput('');
    }
  };

  const handleProposalClick = (proposal: ActionProposal) => {
    onProposalExecute(proposal);

    // Add execution message to conversation
    const executionMessage = {
      id: `msg_${Date.now()}_exec`,
      type: 'assistant' as const,
      content: `Executing: ${proposal.description}`,
      timestamp: new Date(),
    };
    setConversation(prev => [...prev, executionMessage]);

    // Clear proposals after execution
    setProposals([]);
    setReasoning('');
    setOrbState('idle');
  };

  // Add pulsing animation effect when processing
  useEffect(() => {
    if (orbState === 'processing') {
      const interval = setInterval(() => {
        if (orbRef.current) {
          orbRef.current.classList.toggle('pulsing');
        }
      }, 1000);

      return () => {
        clearInterval(interval);
        if (orbRef.current) {
          orbRef.current.classList.remove('pulsing');
        }
      };
    }
  }, [orbState]);

  // Render different orb based on state
  const renderOrbContent = () => {
    switch (orbState) {
      case 'processing':
        return '🧠'; // Brain for processing
      case 'error':
        return '⚠️'; // Warning when error
      case 'ready':
        return '💡'; // Lightbulb when ready with proposals
      default:
        return ''; // No icon for idle state - just the liquid orb
    }
  };

  if (state === 'minimized') {
    return (
      <div className="uitars-widget minimized">
        <button
          ref={orbRef}
          className={`uitars-orb ${orbState} minimized`}
          onClick={() => setState('expanded')}
          title="Open UI Assistant"
          type="button"
        >
          {renderOrbContent()}
          {proposals.length > 0 && (
            <span className="uitars-badge">{proposals.length}</span>
          )}
        </button>
      </div>
    );
  }

  // Superconductor is always available now since it's internal
  const isSuperconductorAvailable = true;

  return (
    <div className="uitars-widget expanded">
      <div className="uitars-header">
        <div className="uitars-tabs">
          <button
            className={`uitars-tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
          <button
            className={`uitars-tab ${activeTab === 'conductor' ? 'active' : ''}`}
            onClick={() => setActiveTab('conductor')}
          >
            Conductor
          </button>
        </div>
        <button
          className="uitars-minimize"
          onClick={() => setState('minimized')}
          title="Minimize"
          type="button"
        >
          −
        </button>
      </div>

      <div className="uitars-body">
        {activeTab === 'chat' ? (
          <div className="uitars-conversation">
            {conversation.length === 0 && proposals.length === 0 && !isLoading ? (
              <div className="uitars-empty">
                <p>Hello! I'm Gizziio, your AI assistant.</p>
                <p>I can help you interact with the interface:</p>
                <ul className="uitars-tips">
                  <li>• "Click the save button"</li>
                  <li>• "Open the settings menu"</li>
                  <li>• "Find the user profile"</li>
                </ul>
              </div>
            ) : (
              <>
                {conversation.map((msg) => (
                  <div
                    key={msg.id}
                    className={`uitars-message ${msg.type}`}
                  >
                    <div className="uitars-message-content">{msg.content}</div>
                    <div className="uitars-message-time">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="uitars-message assistant">
                    <div className="uitars-thinking-indicator">
                      <div className="dot"></div>
                      <div className="dot"></div>
                      <div className="dot"></div>
                    </div>
                  </div>
                )}

                {reasoning && (
                  <div className="uitars-reasoning">
                    <strong>Analysis:</strong> {reasoning}
                  </div>
                )}

                {proposals.length > 0 && (
                  <div className="uitars-proposals-section">
                    <h4>Possible Actions:</h4>
                    <div className="uitars-proposals">
                      {proposals.map((proposal, index) => (
                        <div
                          key={index}
                          className="uitars-proposal"
                          onClick={() => handleProposalClick(proposal)}
                          onMouseEnter={() => onProposalHover?.(proposal)}
                          onMouseLeave={() => onProposalHover?.(null)}
                        >
                          <div className="uitars-proposal-desc">{proposal.description}</div>
                          <div className="uitars-proposal-meta">
                            <span className="uitars-proposal-type">{proposal.type}</span>
                            <button
                              className="uitars-execute-btn"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleProposalClick(proposal);
                              }}
                            >
                              Execute
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <SuperconductorUI
            onRunStart={(runId) => console.log('Parallel run started:', runId)}
            onRunComplete={(result) => console.log('Parallel run completed:', result)}
            onRunUpdate={(update) => console.log('Run update:', update)}
            onError={(error) => console.error('Superconductor error:', error)}
          />
        )}
      </div>

      {activeTab === 'chat' && (
        <div className="uitars-footer">
          <input
            className="uitars-input"
            type="text"
            placeholder={
              orbState === 'processing'
                ? 'Processing...'
                : 'Ask me to interact with the UI...'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isLoading) {
                handleSubmit();
              }
            }}
            disabled={isLoading}
          />
          <button
            className="uitars-send"
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            title="Send message"
            type="button"
          >
            {isLoading ? '...' : '➤'}
          </button>
        </div>
      )}
    </div>
  );
};