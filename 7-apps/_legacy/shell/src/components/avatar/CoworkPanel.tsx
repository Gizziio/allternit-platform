/**
 * CoworkPanel Component
 *
 * Cowork mode for Gizzi panel - tailored computer-use interface.
 * Based on UITarsWidget.Chat but adapted for coworker context.
 *
 * Features:
 * - Computer-use focused conversation
 * - Proposal display and execution
 * - Real-time screenshot capture integration
 * - Input for computer use commands
 * - Brain event streaming for CLI sessions
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../runtime/ApiClient';
import { useBrain } from '../../runtime/BrainContext';
import { useBrainEventCursor } from '../../hooks/brain/useBrainEventCursor';
import { voiceService } from '../../runtime/VoiceService';
import type { ActionProposal } from '../../../shared/contracts';
import {
  getDefaultVoiceId,
  getVoicePersonas,
  syncVoicePersonasFromService,
  VOICE_PERSONAS_EVENT,
  VOICE_PERSONAS_STORAGE_KEY,
} from '../../config/voicePersonas';
import { BrainUX } from '../brain';
import '../../styles/brainux.css';

type ProposalStatus = 'pending' | 'running' | 'done' | 'error';

interface ProposalState {
  callId: string;
  toolId: string;
  args: any;
  status: ProposalStatus;
  result?: any;
  logs?: string;
  createdAt: number;
  description?: string;
}

interface CoworkPanelProps {
  /** Close handler */
  onClose: () => void;
}

interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  reasoning?: string;
  proposals?: ActionProposal[];
  requestId?: string;  // Track which request this message belongs to
}

export const CoworkPanel: React.FC<CoworkPanelProps> = ({ onClose }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [proposals, setProposals] = useState<ActionProposal[]>([]);
  const [reasoning, setReasoning] = useState('');
  const [orbState, setOrbState] = useState<'idle' | 'processing' | 'ready' | 'error'>('idle');
  const [voicePersonas, setVoicePersonas] = useState(getVoicePersonas());
  const [selectedVoice, setSelectedVoice] = useState(getDefaultVoiceId(voicePersonas));
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { sessions, activeSessionId, sendInput } = useBrain();
  const { sessionId: activeSessionIdFromCursor, newEvents, reset: resetCursor } = useBrainEventCursor('cowork');

  // Brain proposal tracking
  const [brainProposals, setBrainProposals] = useState<Map<string, ProposalState>>(new Map());

  // CLI terminal output buffer for accumulating plain text responses
  const [terminalOutput, setTerminalOutput] = useState('');
  
  // Track current request for output isolation
  const currentRequestIdRef = useRef<string | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);

  // Check if CLI brain is active
  const activeSession = useMemo(
    () => sessions.find(s => s.session.id === activeSessionId),
    [sessions, activeSessionId]
  );
  const isCliBrain = activeSession?.session.brain_name?.toLowerCase().includes('cli') ?? false;

  // Process new Brain events
  useEffect(() => {
    if (!isCliBrain || newEvents.length === 0) return;

    setBrainProposals(prev => {
      const next = new Map(prev);

      for (const event of newEvents) {
        switch (event.type) {
          case 'tool.call': {
            const { call_id, tool_id, args } = event.payload;
            next.set(call_id, {
              callId: call_id,
              toolId: tool_id,
              args,
              status: 'pending',
              createdAt: Date.now(),
            });
            break;
          }
          case 'tool.result': {
            const { call_id, result } = event.payload;
            const proposal = next.get(call_id);
            if (proposal) {
              next.set(call_id, {
                ...proposal,
                status: result ? 'done' : 'error',
                result,
              });
            }
            break;
          }
          case 'error': {
            const { message } = event.payload;
            const recentPending = Array.from(next.values())
              .filter(p => p.status === 'pending' || p.status === 'running')
              .sort((a, b) => a.createdAt - b.createdAt);
            if (recentPending.length > 0) {
              const latest = recentPending[recentPending.length - 1];
              next.set(latest.callId, {
                ...latest,
                status: 'error',
                logs: (latest.logs || '') + '\nError: ' + message,
              });
            }
            break;
          }
          case 'terminal.delta': {
            const { data } = event.payload;
            const recentPending = Array.from(next.values())
              .filter(p => p.status === 'pending' || p.status === 'running')
              .sort((a, b) => a.createdAt - b.createdAt);
            if (recentPending.length > 0) {
              const latest = recentPending[recentPending.length - 1];
              next.set(latest.callId, {
                ...latest,
                status: 'running',
                logs: (latest.logs || '') + data,
              });
            }
            break;
          }
        }
      }

      return next;
    });
  }, [newEvents, isCliBrain]);

  // Process terminal output for CLI agents - accumulate plain text responses
  useEffect(() => {
    if (!isCliBrain || newEvents.length === 0) return;

    for (const event of newEvents) {
      switch (event.type) {
        case 'chat.delta': {
          const { text } = event.payload;
          
          // Only append to current request's message
          const currentMsgId = currentMessageIdRef.current;
          if (currentMsgId) {
            setConversation(prev => {
              // Find and update the current request's message
              const updated = prev.map(msg => {
                if (msg.id === currentMsgId) {
                  return { ...msg, content: msg.content + text };
                }
                return msg;
              });
              return updated;
            });
          } else {
            // Fallback: update last assistant message if no current request
            const lastMessage = conversation[conversation.length - 1];
            if (lastMessage?.type === 'assistant') {
              setConversation(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...lastMessage,
                  content: lastMessage.content + text,
                };
                return updated;
              });
            }
          }
          break;
        }
        case 'terminal.delta': {
          const { data } = event.payload;
          
          // Check if there's an active proposal
          const hasActiveProposal = Array.from(brainProposals.values())
            .some(p => p.status === 'pending' || p.status === 'running');
          
          // Only accumulate terminal output if no active proposal
          if (!hasActiveProposal) {
            const currentMsgId = currentMessageIdRef.current;
            if (currentMsgId) {
              // Append to current request's message
              setConversation(prev => {
                const updated = prev.map(msg => {
                  if (msg.id === currentMsgId) {
                    return { ...msg, content: msg.content + data };
                  }
                  return msg;
                });
                return updated;
              });
            } else if (conversation[conversation.length - 1]?.type === 'assistant') {
              // Fallback: append to last assistant message
              setConversation(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.type === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: last.content + data };
                }
                return updated;
              });
            }
          }
          break;
        }
        case 'session.status': {
          const { status } = event.payload;
          // Reset request context on session status change
          if (status === 'running') {
            currentRequestIdRef.current = null;
            currentMessageIdRef.current = null;
          }
          break;
        }
      }
    }
  }, [newEvents, isCliBrain, brainProposals, conversation]);

  // Convert Brain proposals to ActionProposal format for display
  const brainProposalList = useMemo(() => {
    return Array.from(brainProposals.values()).map(p => ({
      description: `${p.toolId} ${p.status === 'done' ? '✓' : p.status === 'error' ? '✗' : '→'} ${p.logs?.slice(-50) || ''}`,
      type: p.toolId,
      call_id: p.callId,
      args: p.args,
    })) as ActionProposal[];
  }, [brainProposals]);

  // Use Brain proposals when CLI brain is active, otherwise fall back to API proposals
  const displayProposals = isCliBrain ? brainProposalList : proposals;

  useEffect(() => {
    if (!voicePersonas.find((persona) => persona.id === selectedVoice)) {
      setSelectedVoice(getDefaultVoiceId(voicePersonas));
    }
  }, [voicePersonas, selectedVoice]);

  const selectedPersona = voicePersonas.find((persona) => persona.id === selectedVoice) || null;

  useEffect(() => {
    const handleUpdate = () => setVoicePersonas(getVoicePersonas());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === VOICE_PERSONAS_STORAGE_KEY) {
        handleUpdate();
      }
    };
    window.addEventListener(VOICE_PERSONAS_EVENT, handleUpdate as EventListener);
    window.addEventListener('storage', handleStorage);
    const controller = new AbortController();
    void syncVoicePersonasFromService(controller.signal);
    return () => {
      window.removeEventListener(VOICE_PERSONAS_EVENT, handleUpdate as EventListener);
      window.removeEventListener('storage', handleStorage);
      controller.abort();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, displayProposals]);

  const speakResponse = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const orbSpeak = typeof window !== 'undefined' ? (window as any).__voiceOrbSpeak : null;
    if (selectedPersona?.referenceAudioUrl) {
      if (typeof orbSpeak !== 'function') {
        await voiceService.speakWithVoice(text, selectedPersona.referenceAudioUrl, true);
        return;
      }
      const cloneResult = await voiceService.speakWithVoice(text, selectedPersona.referenceAudioUrl, false);
      if (cloneResult.success && cloneResult.audioUrl) {
        await orbSpeak(text, { audioUrl: cloneResult.audioUrl });
        return;
      }
    }
    if (typeof orbSpeak === 'function') {
      try {
        await orbSpeak(text, selectedVoice);
        return;
      } catch (err) {
        console.error('[CoworkPanel] Orb TTS failed, falling back:', err);
      }
    }
    await voiceService.speak(text, { autoPlay: true, voice: selectedVoice });
  }, [selectedPersona, selectedVoice]);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    if (isCliBrain && activeSessionId) {
      // Generate request ID for output isolation
      const requestId = `req_${Date.now()}`;
      const messageId = `msg_${Date.now()}_assistant`;
      
      // Set current request context
      currentRequestIdRef.current = requestId;
      currentMessageIdRef.current = messageId;
      
      // Clear previous terminal output
      setTerminalOutput('');
      
      await sendInput(activeSessionId, input);
      
      // Add user message
      const userMessage: ConversationMessage = {
        id: `msg_${Date.now()}_user`,
        type: 'user',
        content: input,
        timestamp: new Date(),
      };
      
      // Create placeholder assistant message for this request
      const assistantMessage: ConversationMessage = {
        id: messageId,
        type: 'assistant',
        content: '',
        timestamp: new Date(),
        requestId,
      };
      
      setConversation(prev => [...prev, userMessage, assistantMessage]);
      setInput('');
      return;
    }

    // Non-CLI brain: Add user message
    const userMessage: ConversationMessage = {
      id: `msg_${Date.now()}_user`,
      type: 'user',
      content: input,
      timestamp: new Date(),
    };
    setConversation(prev => [...prev, userMessage]);

    setIsLoading(true);
    setOrbState('processing');

    try {
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

      const response = await api.propose(screenshotId, input);

      if (response && response.proposals && response.proposals.length > 0) {
        setProposals(response.proposals);
        setReasoning(response.reasoning || '');

        const assistantMessage: ConversationMessage = {
          id: `msg_${Date.now()}_assistant`,
          type: 'assistant',
          content: `I found ${response.proposals.length} action${response.proposals.length !== 1 ? 's' : ''} you can take:`,
          timestamp: new Date(),
          reasoning: response.reasoning,
          proposals: response.proposals,
        };
        setConversation(prev => [...prev, assistantMessage]);
        speakResponse(assistantMessage.content);

        setOrbState('ready');
      } else {
        setProposals([]);
        setReasoning('');

        const assistantMessage: ConversationMessage = {
          id: `msg_${Date.now()}_no_prop`,
          type: 'assistant',
          content: "I couldn't find any specific actions. Could you be more specific?",
          timestamp: new Date(),
        };
        setConversation(prev => [...prev, assistantMessage]);
        speakResponse(assistantMessage.content);

        setOrbState('idle');
      }
    } catch (err) {
      console.error('Failed to get proposals:', err);
      setOrbState('error');

      const errorMessage: ConversationMessage = {
        id: `msg_${Date.now()}_error`,
        type: 'assistant',
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setConversation(prev => [...prev, errorMessage]);
      speakResponse(errorMessage.content);
    } finally {
      setIsLoading(false);
      setInput('');
    }
  };

  const handleProposalClick = async (proposal: ActionProposal) => {
    if (isCliBrain && proposal.call_id && activeSessionId) {
      await sendInput(activeSessionId, `APPROVE ${proposal.call_id}`);
      const executionMessage: ConversationMessage = {
        id: `msg_${Date.now()}_exec`,
        type: 'assistant',
        content: `Approving tool call: ${proposal.call_id}`,
        timestamp: new Date(),
      };
      setConversation(prev => [...prev, executionMessage]);
      return;
    }

    console.log('Executing proposal:', proposal.description);

    const executionMessage: ConversationMessage = {
      id: `msg_${Date.now()}_exec`,
      type: 'assistant',
      content: `Executing: ${proposal.description}`,
      timestamp: new Date(),
    };
    setConversation(prev => [...prev, executionMessage]);

    setProposals([]);
    setReasoning('');
    setOrbState('idle');
  };

  return (
    <div className="gizzi-cowork-panel">
      <div className="gizzi-panel-header">
        <h3>Cowork</h3>
        <button className="gizzi-close-btn" onClick={onClose}>×</button>
      </div>

      <div className="gizzi-cowork-content">
        {/* Conversation area */}
        <div className="gizzi-cowork-messages">
          {conversation.length === 0 && displayProposals.length === 0 && !isLoading ? (
            <div className="gizzi-cowork-empty">
              <div className="gizzi-cowork-avatar">🤖</div>
              <p>I'm your Cowork assistant</p>
              <p className="gizzi-hint">I can help you interact with the interface</p>
              <ul className="gizzi-cowork-tips">
                <li>"Click the save button"</li>
                <li>"Open the settings menu"</li>
                <li>"Find the user profile"</li>
              </ul>
            </div>
          ) : (
            <>
              {conversation.map((msg) => (
                <div key={msg.id} className={`gizzi-cowork-message ${msg.type}`}>
                  <div className="gizzi-message-avatar">
                    {msg.type === 'user' ? '👤' : '🤖'}
                  </div>
                  <div className="gizzi-message-body">
                    {msg.reasoning && (
                      <div className="gizzi-reasoning">
                        <strong>Analysis:</strong> {msg.reasoning}
                      </div>
                    )}
                    <div className="gizzi-message-content">{msg.content}</div>
                    <div className="gizzi-message-time">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="gizzi-cowork-message assistant">
                  <div className="gizzi-message-avatar">🤖</div>
                  <div className="gizzi-message-body">
                    <div className="gizzi-thinking-indicator">
                      <div className="dot"></div>
                      <div className="dot"></div>
                      <div className="dot"></div>
                    </div>
                  </div>
                </div>
              )}

              {displayProposals.length > 0 && (
                <div className="gizzi-proposals-section">
                  <h4>Possible Actions:</h4>
                  <div className="gizzi-proposals">
                    {displayProposals.map((proposal, index) => (
                      <div
                        key={proposal.call_id || index}
                        className="gizzi-proposal"
                        onClick={() => handleProposalClick(proposal)}
                      >
                        <div className="gizzi-proposal-desc">{proposal.description}</div>
                        <div className="gizzi-proposal-meta">
                          <span className="gizzi-proposal-type">{proposal.type}</span>
                          <button
                            className="gizzi-execute-btn"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProposalClick(proposal);
                            }}
                          >
                            {isCliBrain && proposal.call_id ? 'Approve' : 'Execute'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="gizzi-cowork-footer">
        <select
          className="gizzi-cowork-voice-select"
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value)}
          aria-label="Voice persona"
        >
          {voicePersonas.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.label}
            </option>
          ))}
        </select>
        <input
          className="gizzi-cowork-input"
          type="text"
          placeholder={isLoading ? 'Processing...' : 'Ask me to interact with the UI...'}
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
          className="gizzi-cowork-send"
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading}
          title="Send message"
          type="button"
        >
          {isLoading ? '...' : '➤'}
        </button>
      </div>
      <BrainUX sessionId={activeSessionId} showAnimations={true} />
    </div>
  );
};

export default CoworkPanel;
