/**
 * ChatPanel Component
 *
 * Chat mode for Gizzi panel.
 * Shows current activity status and deep-link to main ChatInterface.
 * NOT a second chat client - just a launcher view.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { activityCenter } from '../../runtime/ActivityCenter';
import { chatStorage, type ChatMessage } from '../../runtime/ChatStorage';
import { api } from '../../runtime/ApiClient';
import { useBrain } from '../../runtime/BrainContext';
import { conversationStore } from '../../runtime/ConversationStore';
import { VoiceOrb } from '../VoiceOrb';
import { voiceService } from '../../runtime/VoiceService';
import {
  getDefaultVoiceId,
  getVoicePersonas,
  syncVoicePersonasFromService,
  VOICE_PERSONAS_EVENT,
  VOICE_PERSONAS_STORAGE_KEY,
} from '../../config/voicePersonas';
import { BrainUX } from '../brain';
import '../../styles/brainux.css';

interface ChatPanelProps {
  /** Close handler */
  onClose: () => void;
}

type PanelMessage = ChatMessage & { isStreaming?: boolean };

export const ChatPanel: React.FC<ChatPanelProps> = ({ onClose }) => {
  const activity = activityCenter.getCurrentActivity();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<PanelMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voicePersonas, setVoicePersonas] = useState(getVoicePersonas());
  const [selectedVoice, setSelectedVoice] = useState(getDefaultVoiceId(voicePersonas));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastEventIndexRef = useRef<Record<string, number>>({});
  const lastSpokenMessageRef = useRef<Record<string, string>>({});
  const lastVoiceSentRef = useRef<string>('');

  const { sessions, activeSessionId, sendInput } = useBrain();
  const activeBrainSession = sessions.find(s => s.session.id === activeSessionId);

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
        console.error('[ChatPanel] Orb TTS failed, falling back:', err);
      }
    }
    await voiceService.speak(text, { autoPlay: true, voice: selectedVoice });
  }, [selectedPersona, selectedVoice]);

  useEffect(() => {
    if (activity?.chatSessionId) {
      setSessionId(activity.chatSessionId);
    }
  }, [activity?.chatSessionId]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!sessionId) {
        setMessages([]);
        return;
      }
      try {
        const msgs = await chatStorage.getMessages(sessionId);
        setMessages(msgs);
        scrollToBottom();
      } catch (err) {
        console.error('[ChatPanel] Failed to load messages:', err);
      }
    };
    loadMessages();
  }, [sessionId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length]);

  const ensureSession = async (seedText: string) => {
    if (sessionId) return sessionId;
    const title = seedText.trim().substring(0, 40) || 'New Chat';
    const { chatSessionId } = await conversationStore.createConversation({
      source: 'text',
      title,
    });
    setSessionId(chatSessionId);
    return chatSessionId;
  };

  const handleOpenChat = () => {
    const targetSessionId = sessionId || (activity?.navTarget?.kind === 'chatSession'
      ? activity.navTarget.chatSessionId
      : undefined);
    if (targetSessionId) {
      const event = new CustomEvent('navigateToTarget', {
        detail: { kind: 'chatSession', chatSessionId: targetSessionId },
        bubbles: true,
      });
      window.dispatchEvent(event);
    }
  };

  const getStatusText = () => {
    if (!activity) return 'No active activity';
    switch (activity.status) {
      case 'idle': return 'Ready for chat';
      case 'connecting': return 'Connecting...';
      case 'thinking': return 'Thinking...';
      case 'streaming': return 'Streaming response...';
      case 'speaking': return 'Speaking...';
      case 'done': return 'Conversation complete';
      case 'error': return 'Error occurred';
      default: return 'Ready';
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isTyping) return;

    const userContent = content.trim();
    setInputValue('');
    setTranscript('');

    try {
      const activeChatSessionId = await ensureSession(userContent);
      const userMsg = await chatStorage.addMessage(activeChatSessionId, 'user', userContent);
      setMessages(prev => [...prev, userMsg]);
      scrollToBottom();
      setIsTyping(true);

      if (activeSessionId && activeBrainSession) {
        await sendInput(activeSessionId, userContent);
        setMessages(prev => [...prev, {
          id: `brain-${Date.now()}`,
          sessionId: activeChatSessionId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          isStreaming: true,
        }]);
      } else {
        const aiResponse = await api.chat(userContent);
        const aiMsg = await chatStorage.addMessage(activeChatSessionId, 'assistant', aiResponse);
        setMessages(prev => [...prev, aiMsg]);
        setIsTyping(false);
        speakResponse(aiResponse);
      }
    } catch (err) {
      console.error('[ChatPanel] Failed to send message:', err);
      setIsTyping(false);
      if (sessionId) {
        const errorMsg = await chatStorage.addMessage(sessionId, 'system', 'I encountered an error communicating with the agent.');
        setMessages(prev => [...prev, errorMsg]);
      }
    }
  };

  useEffect(() => {
    if (!activeSessionId || !activeBrainSession) return;

    const events = activeBrainSession.events;
    const lastIdx = lastEventIndexRef.current[activeSessionId] ?? 0;
    if (events.length <= lastIdx) return;

    const newEvents = events.slice(lastIdx);
    lastEventIndexRef.current[activeSessionId] = events.length;

    let hasCompletionEvent = false;
    let latestAssistantContent = '';

    newEvents.forEach((event) => {
      switch (event.type) {
        case 'terminal.delta': {
          const data = (event as any).payload?.data || '';
          if (!data) break;
          latestAssistantContent += data;
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
          if (!text) break;
          latestAssistantContent += text;
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
          const eventMessageId = (event as any).payload?.message_id;
          const completionId = eventMessageId || `msg-${activeSessionId}-${lastIdx}`;
          const lastSpokenId = lastSpokenMessageRef.current[activeSessionId];
          if (lastSpokenId !== completionId && text && text.trim().length > 0) {
            lastSpokenMessageRef.current[activeSessionId] = completionId;
            activityCenter.setStatus('speaking');
            speakResponse(text)
              .catch((err) => console.error('[ChatPanel] TTS error:', err))
              .finally(() => activityCenter.onSpeakingEnd());
          }
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && (last as any).isStreaming) {
              return [...prev.slice(0, -1), { ...last, isStreaming: false }];
            }
            return prev;
          });
          setIsTyping(false);
          break;
        }
        default:
          break;
      }
    });

    if (hasCompletionEvent) {
      window.dispatchEvent(new CustomEvent('brainMessageCompleted', {
        detail: {
          sessionId: activeSessionId,
          chatSessionId: sessionId || activeSessionId,
          timestamp: Date.now(),
        },
      }));
    }
  }, [activeBrainSession?.events, activeSessionId, sessionId]);

  const handleSendMessage = () => sendMessage(inputValue);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleToggleListening = () => {
    setIsListening(prev => {
      const next = !prev;
      if (next) {
        lastVoiceSentRef.current = '';
        setTranscript('');
      } else {
        const trimmed = transcript.trim();
        if (trimmed && trimmed !== lastVoiceSentRef.current) {
          lastVoiceSentRef.current = trimmed;
          sendMessage(trimmed);
          setTranscript('');
        }
      }
      return next;
    });
  };

  const handleTranscript = (text: string) => {
    setTranscript(text);
    const trimmed = text.trim();
    if (!isListening && trimmed && trimmed !== lastVoiceSentRef.current) {
      lastVoiceSentRef.current = trimmed;
      sendMessage(trimmed);
      setTranscript('');
    }
  };

  return (
    <div className="gizzi-chat-panel">
      <div className="gizzi-panel-header">
        <h3>Chat</h3>
        <button className="gizzi-close-btn" onClick={onClose}>×</button>
      </div>

      <div className="gizzi-chat-content">
        {/* Activity Status */}
        <div className="gizzi-chat-status">
          <div className="gizzi-status-indicator" data-status={activity?.status || 'idle'} />
          <span>{getStatusText()}</span>
        </div>

        {/* Messages */}
        <div className="gizzi-chat-messages">
          {messages.length === 0 && !isTyping ? (
            <div className="gizzi-chat-empty">
              <div className="gizzi-chat-avatar">💬</div>
              <p>Start a conversation with Gizzi</p>
              <p className="gizzi-hint small">Ask a question or describe what you want to do.</p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={`gizzi-chat-message ${msg.role}`}>
                  <div className="gizzi-message-avatar">
                    {msg.role === 'user' ? '👤' : msg.role === 'assistant' ? '🤖' : 'ℹ️'}
                  </div>
                  <div className="gizzi-message-body">
                    <div className="gizzi-message-content">
                      {msg.content}
                      {(msg as any).isStreaming && <span className="gizzi-streaming-cursor">▋</span>}
                    </div>
                    <div className="gizzi-message-time">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="gizzi-chat-message assistant">
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
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Deep-link to main ChatInterface */}
        <div className="gizzi-chat-actions">
          {sessionId ? (
            <button className="gizzi-action-btn primary" onClick={handleOpenChat}>
              Open in Chat Interface
            </button>
          ) : (
            <p className="gizzi-hint">Start a conversation to chat with Gizzi</p>
          )}
        </div>
      </div>

      <div className="gizzi-chat-footer">
        <div className="gizzi-chat-voice">
          <VoiceOrb
            size={28}
            simple={true}
            isListening={isListening}
            onToggleListening={handleToggleListening}
            transcript={transcript}
            onTranscript={handleTranscript}
            onSpeak={() => {}}
            voice={selectedVoice}
          />
        </div>
        <select
          className="gizzi-chat-voice-select"
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
          className="gizzi-chat-input"
          type="text"
          placeholder={isListening ? 'Listening...' : 'Type a message...'}
          value={isListening ? transcript : inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isTyping || isListening}
        />
        <button
          className="gizzi-chat-send"
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || isTyping || isListening}
          title="Send message"
          type="button"
        >
          {isTyping ? '...' : '➤'}
        </button>
      </div>
      <BrainUX sessionId={activeSessionId} showAnimations={true} />
    </div>
  );
};

export default ChatPanel;
