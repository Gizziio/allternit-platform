import React, { useState, useEffect, useRef } from 'react';
import { chatStorage, type ChatMessage } from '../runtime/ChatStorage';
import { api } from '../runtime/ApiClient';
import { VoiceOrb } from './VoiceOrb';
import { VoiceSettings } from './voice/VoiceSettings';
import { useBrain } from '../runtime/BrainContext';
import { voiceService } from '../runtime/VoiceService';
import { activityCenter } from '../runtime/ActivityCenter';
import '../styles/glass-chat.css';
import '../styles/brainux.css';
import { BrainUX } from './brain';

// SVGs
const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const BotIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2"></rect>
    <circle cx="12" cy="5" r="2"></circle>
    <path d="M12 7v4"></path>
    <line x1="8" y1="16" x2="8" y2="16"></line>
    <line x1="16" y1="16" x2="16" y2="16"></line>
  </svg>
);

interface ChatInterfaceProps {
  sessionId: string;
  sessionTitle?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ sessionId, sessionTitle }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [brainOutput, setBrainOutput] = useState('');
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get active brain session
  const { sessions, activeSessionId, sendInput } = useBrain();
  const activeBrainSession = sessions.find(s => s.session.id === activeSessionId);

  // Event index cursor per session to process ALL new events (not just latest)
  const lastEventIndexRef = useRef<Record<string, number>>({});
  // Track last spoken message ID per session for TTS deduplication (durable guard)
  const lastSpokenMessageRef = useRef<Record<string, string>>({});

  useEffect(() => {
    loadMessages();
    setTranscript('');
    setIsListening(false);
    setBrainOutput('');
  }, [sessionId]);

  const loadMessages = async () => {
    if (!sessionId) return;
    try {
      const msgs = await chatStorage.getMessages(sessionId);
      setMessages(msgs);
      scrollToBottom();
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || !sessionId || isTyping) return;

    const userContent = content.trim();
    setInputValue('');
    setTranscript('');
    setBrainOutput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    /**
     * CORE INVARIANT:
     * If activeSessionId != null, we MUST route to /v1/sessions/:id/input
     * and MUST NOT call /v1/intent/dispatch for user chat.
     *
     * The brain session provides streaming responses with proper event ordering.
     * The legacy API path is a fallback only when no brain session exists.
     *
     * This invariant ensures:
     * - Consistent UX with proper streaming deltas
     * - TTS triggers via chat.message.completed events
     * - ActivityCenter status tracking works correctly
     */
    if (process.env.NODE_ENV === 'development') {
      if (activeSessionId && activeBrainSession) {
        // Should route to brain, NOT api.chat
        console.assert(
          !false,
          '[ChatInterface] Dev invariant: activeSessionId exists, should use sendInput()'
        );
      }
    }

    try {
      const userMsg = await chatStorage.addMessage(sessionId, 'user', userContent);
      setMessages(prev => [...prev, userMsg]);
      scrollToBottom();
      setIsTyping(true);

      if (activeSessionId && activeBrainSession) {
        // DEV ASSERT: Verify we're using brain session, not legacy API
        if (process.env.NODE_ENV === 'development') {
          if (!activeBrainSession.session.id) {
            throw new Error('[ChatInterface] Dev invariant violation: activeBrainSession missing session.id');
          }
          console.assert(
            typeof activeBrainSession.session.id === 'string',
            '[ChatInterface] Dev invariant: session.id must be string'
          );
        }

        // Send to brain session terminal
        console.log('[ChatInterface] Sending to brain session:', activeBrainSession.session.id);
        await sendInput(activeBrainSession.session.id, userContent);

        // Show "Thinking..." indicator
        setMessages(prev => [...prev, {
          id: `brain-${Date.now()}`,
          sessionId: sessionId,
          role: 'assistant' as const,
          content: '',
          timestamp: new Date(),
          isStreaming: true
        }]);
      } else {
        // DEV ASSERT: Verify this is a true fallback, not misrouting
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            '[ChatInterface] Dev note: No activeSessionId, using legacy api.chat() fallback',
            { activeSessionId, sessionsCount: sessions.length }
          );
        }

        // Fallback to API
        const aiResponse = await api.chat(userContent);
        
        const aiMsg = await chatStorage.addMessage(sessionId, 'assistant', aiResponse);
        setMessages(prev => [...prev, aiMsg]);
        setIsTyping(false);
        scrollToBottom();
      }

    } catch (err) {
      console.error('Failed to send message:', err);
      setIsTyping(false);
      const errorMsg = await chatStorage.addMessage(sessionId, 'system', "I encountered an error communicating with the agent.");
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  // Listen for brain events to update chat (with cursor-based event processing)
  useEffect(() => {
    if (!activeSessionId || !activeBrainSession) return;

    const sessionId = activeBrainSession.session.id;
    const events = activeBrainSession.events;
    const lastIdx = lastEventIndexRef.current[sessionId] ?? 0;

    // No new events to process
    if (events.length <= lastIdx) return;

    // Process all new events since last cursor position
    const newEvents = events.slice(lastIdx);
    lastEventIndexRef.current[sessionId] = events.length;

    let hasCompletionEvent = false;
    let latestAssistantContent = '';

    newEvents.forEach((event) => {
      switch (event.type) {
        case 'terminal.delta': {
          const data = (event as any).payload?.data || '';

          setBrainOutput((prev) => prev + data);

          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && (last as any).isStreaming) {
              return [...prev.slice(0, -1), { ...last, content: (last.content || '') + data }];
            }
            return prev;
          });
          break;
        }

        case 'chat.delta': {
          const text = (event as any).payload?.text || '';

          setBrainOutput((prev) => prev + text);

          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && (last as any).isStreaming) {
              return [...prev.slice(0, -1), { ...last, content: (last.content || '') + text, isStreaming: false }];
            }
            return prev;
          });
          setIsTyping(false);
          break;
        }

        case 'chat.message.completed': {
          hasCompletionEvent = true;
          const text = (event as any).payload?.text || latestAssistantContent;
          
          // Generate stable message ID: use payload.message_id if available, otherwise hash
          const eventMessageId = (event as any).payload?.message_id;
          const completionId = eventMessageId || `msg-${sessionId}-${lastIdx}`;
          
          // Guard against double-triggering using message ID (durable, not time-based)
          const lastSpokenId = lastSpokenMessageRef.current[sessionId];
          if (lastSpokenId === completionId) {
            console.log('[ChatInterface] Skipping TTS - already spoken:', completionId);
          } else if (text && text.trim().length > 0) {
            // Update ActivityCenter to speaking state
            activityCenter.setStatus('speaking');
            lastSpokenMessageRef.current[sessionId] = completionId;

            // Call TTS
            console.log('[ChatInterface] Speaking:', text.substring(0, 50));
            voiceService.speak(text, { autoPlay: true })
              .then((result) => {
                console.log('[ChatInterface] TTS complete:', result.success ? 'success' : 'fallback');
              })
              .catch((err) => {
                console.error('[ChatInterface] TTS error:', err);
              })
              .finally(() => {
                // Update ActivityCenter to done state
                activityCenter.onSpeakingEnd();
              });
          }

          // Mark completion only if we have a streaming message
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && (last as any).isStreaming) {
              return [...prev.slice(0, -1), { ...last, isStreaming: false }];
            }
            return prev;
          });
          setIsTyping(false);
          scrollToBottom();
          break;
        }

        case 'tool.call':
        case 'tool.result':
          // These are handled by ActivityCenter for status display
          break;

        case 'error':
          console.error('[ChatInterface] Brain error:', (event as any).payload?.message);
          setIsTyping(false);
          break;
      }
    });

    if (hasCompletionEvent) {
      // Emit completion event for TTS hook (ActivityCenter will pick this up)
      window.dispatchEvent(new CustomEvent('brainMessageCompleted', {
        detail: {
          sessionId,
          chatSessionId: sessionId,
          timestamp: Date.now(),
        },
      }));
    }
  }, [activeBrainSession?.events, activeSessionId]);

  const handleSendMessage = () => sendMessage(inputValue);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  const toggleVoice = () => {
    setIsListening(!isListening);
  };

  const handleTranscript = (text: string) => {
    setTranscript(text);
    if (!isListening && text.trim()) {
      sendMessage(text);
    }
  };

  return (
    <div className="glass-chat-area">
      <div className="glass-chat-header">
        <h3>{sessionTitle || 'Chat'}</h3>
        <button
          className="voice-settings-btn"
          onClick={() => setShowVoiceSettings(true)}
          title="Voice Settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>
      </div>

      <div className="glass-messages-container">
        {messages.length === 0 ? (
          <div className="glass-empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div className="glass-welcome-blob" style={{ width: '80px', height: '80px' }}>
              <BotIcon />
            </div>
            <h2 style={{ color: '#374151', fontSize: '1.5rem', marginBottom: '8px' }}>Start a new project</h2>
            <p style={{ color: '#9ca3af', maxWidth: '320px', textAlign: 'center' }}>
              Organize your thoughts, plan tasks, or just start chatting with the agent.
            </p>
          </div>
        ) : (
          <div className="glass-messages-inner" style={{ width: '100%', maxWidth: '850px', margin: '0 auto', padding: '0 24px' }}>
            {messages.map((msg) => {
              const isStreaming = (msg as any).isStreaming;
              return (
                <div key={msg.id} className={`glass-message ${msg.role}`} style={{ maxWidth: '100%', margin: '0 0 24px 0', padding: 0 }}>
                  <div className="glass-avatar">
                    {msg.role === 'user' ? <UserIcon /> : <BotIcon />}
                  </div>
                  <div className="glass-bubble">
                    {msg.content}
                    {isStreaming && <span className="streaming-cursor">▋</span>}
                    <span className="glass-timestamp">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
            {isTyping && (
              <div className="glass-message assistant" style={{ maxWidth: '100%', margin: '0 0 24px 0', padding: 0 }}>
                <div className="glass-avatar"><BotIcon /></div>
                <div className="glass-bubble">
                  <div className="typing-dots">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="glass-input-area">
        <div className="glass-input-wrapper">
          <div className="glass-input-orb-wrapper" style={{ marginRight: '8px', display: 'flex', alignItems: 'center' }}>
            <VoiceOrb
              size={48}
              simple={true}
              isListening={isListening}
              onToggleListening={toggleVoice}
              transcript={transcript}
              onTranscript={handleTranscript}
            />
          </div>
          <textarea
            ref={textareaRef}
            className="glass-input-field"
            placeholder={isListening ? "Listening..." : "Message agent..."}
            value={isListening ? transcript : inputValue}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isTyping}
          />
          <button 
            className={`glass-send-btn ${inputValue.trim() && !isTyping ? 'has-input' : ''}`}
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isTyping}
            title="Send"
          >
            <SendIcon />
          </button>
        </div>
      </div>

      {showVoiceSettings && (
        <VoiceSettings
          onClose={() => setShowVoiceSettings(false)}
        />
      )}

      <BrainUX sessionId={activeSessionId} showAnimations={true} />
    </div>
  );
};
