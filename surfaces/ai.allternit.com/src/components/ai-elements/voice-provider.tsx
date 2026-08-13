"use client";

/**
 * Voice Session Provider
 *
 * High-level context for managing conversational voice sessions.
 * Composes the lower-level VoiceProvider (from @/providers/voice-provider)
 * and adds session lifecycle, conversation history, and message management.
 *
 * Usage:
 *   <VoiceSessionProvider onSendMessage={handleMessage}>
 *     <VoiceSession />
 *   </VoiceSessionProvider>
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVoice } from "@/providers/voice-provider";
import { speechToText } from "@/services/voice";

// ─── Types ───────────────────────────────────────────────────────────────────

export type VoiceSessionRole = "user" | "assistant" | "system";

export interface VoiceSessionTurn {
  id: string;
  role: VoiceSessionRole;
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export type VoiceSessionStatus =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "error";

interface VoiceSessionContextValue {
  // Session lifecycle
  sessionActive: boolean;
  startSession: () => Promise<void>;
  endSession: () => void;

  // Current state
  isListening: boolean;
  isSpeaking: boolean;
  status: VoiceSessionStatus;
  currentVoice: string;
  language: string;

  // Conversation
  turns: VoiceSessionTurn[];
  interimText: string;
  sendMessage: (text: string) => Promise<void>;
  clearHistory: () => void;

  // Settings
  selectVoice: (voiceId: string) => void;
  setLanguage: (lang: string) => void;
  speechRate: number;
  setSpeechRate: (rate: number) => void;
  autoListen: boolean;
  setAutoListen: (enabled: boolean) => void;

  // Errors
  error: string | null;
  dismissError: () => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const VoiceSessionContext = createContext<VoiceSessionContextValue | null>(null);

// ─── Props ───────────────────────────────────────────────────────────────────

export interface VoiceSessionProviderProps {
  children: React.ReactNode;
  /**
   * Called when the user finishes speaking (final transcript ready).
   * The consumer should process the message and optionally call
   * `sendMessage` with the assistant's reply to speak it back.
   */
  onSendMessage?: (text: string) => Promise<string | void>;
  /** Maximum silence duration (ms) before auto-stopping in auto-listen mode. */
  silenceTimeoutMs?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let turnCounter = 0;
function nextTurnId(): string {
  turnCounter += 1;
  return `vt-${Date.now()}-${turnCounter}`;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function VoiceSessionProvider({
  children,
  onSendMessage,
  silenceTimeoutMs = 3000,
}: VoiceSessionProviderProps) {
  const voice = useVoice();

  // Session state
  const [sessionActive, setSessionActive] = useState(false);
  const [turns, setTurns] = useState<VoiceSessionTurn[]>([]);
  const [interimText, setInterimText] = useState("");
  const [autoListen, setAutoListen] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [localError, setLocalError] = useState<string | null>(null);

  // Refs
  const autoListenRef = useRef(autoListen);
  const sessionActiveRef = useRef(sessionActive);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onSendMessageRef = useRef(onSendMessage);

  // Keep refs in sync
  useEffect(() => {
    autoListenRef.current = autoListen;
  }, [autoListen]);
  useEffect(() => {
    sessionActiveRef.current = sessionActive;
  }, [sessionActive]);
  useEffect(() => {
    onSendMessageRef.current = onSendMessage;
  }, [onSendMessage]);

  // Derive state from the underlying voice provider
  const isListening = voice.isRecording;
  const isSpeaking = voice.isPlaying;

  const status: VoiceSessionStatus = useMemo(() => {
    if (voice.error) return "error";
    if (voice.personaState === "thinking") return "processing";
    if (isSpeaking) return "speaking";
    if (isListening) return "listening";
    return "idle";
  }, [voice.personaState, isListening, isSpeaking, voice.error]);

  // ── Listen for final transcripts from STT ──────────────────────────────────

  useEffect(() => {
    const unsubscribe = speechToText.subscribe((event) => {
      if (!sessionActiveRef.current) return;

      if (event.type === "result" && event.result) {
        if (event.result.isFinal && event.result.transcript) {
          const text = event.result.transcript.trim();
          if (text) {
            // Commit user turn
            const userTurn: VoiceSessionTurn = {
              id: nextTurnId(),
              role: "user",
              text,
              timestamp: Date.now(),
              isFinal: true,
            };
            setTurns((prev) => [...prev, userTurn]);
            setInterimText("");

            // Forward to consumer
            if (onSendMessageRef.current) {
              onSendMessageRef.current(text).then((reply) => {
                if (typeof reply === "string" && reply.trim()) {
                  // Speak the reply and add assistant turn
                  const assistantTurn: VoiceSessionTurn = {
                    id: nextTurnId(),
                    role: "assistant",
                    text: reply,
                    timestamp: Date.now(),
                    isFinal: true,
                  };
                  setTurns((prev) => [...prev, assistantTurn]);
                  voice.speak(reply);
                }
              }).catch((err: unknown) => {
                setLocalError(
                  err instanceof Error ? err.message : "Failed to process message",
                );
              });
            }
          }
        } else if (!event.result.isFinal && event.result.transcript) {
          setInterimText(event.result.transcript);
        }
      }
    });

    return () => unsubscribe();
  }, [voice]);

  // ── Auto-listen: restart recording after assistant finishes speaking ───────

  useEffect(() => {
    if (
      autoListenRef.current &&
      sessionActive &&
      !isSpeaking &&
      !isListening &&
      status === "idle"
    ) {
      // Small delay to avoid re-triggering immediately
      silenceTimerRef.current = setTimeout(() => {
        if (autoListenRef.current && sessionActiveRef.current) {
          voice.startRecording().catch(() => {
            // Silent — will retry on next cycle
          });
        }
      }, silenceTimeoutMs);
    }

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };
  }, [isSpeaking, isListening, status, sessionActive, voice, silenceTimeoutMs]);

  // ── Session lifecycle ──────────────────────────────────────────────────────

  const startSession = useCallback(async () => {
    setLocalError(null);
    setSessionActive(true);

    // Probe health if not already known
    if (!voice.serviceAvailable) {
      const ok = await voice.checkHealth();
      if (!ok) {
        setLocalError("Voice service is offline. Start the voice backend to continue.");
        return;
      }
    }

    // Begin listening immediately
    await voice.startRecording();
  }, [voice]);

  const endSession = useCallback(() => {
    setSessionActive(false);
    voice.stopRecording();
    voice.stopAudio();
    setInterimText("");
  }, [voice]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Add user turn
      const userTurn: VoiceSessionTurn = {
        id: nextTurnId(),
        role: "user",
        text: trimmed,
        timestamp: Date.now(),
        isFinal: true,
      };
      setTurns((prev) => [...prev, userTurn]);

      // Stop listening while processing
      if (isListening) {
        voice.stopRecording();
      }

      // Forward to consumer
      if (onSendMessageRef.current) {
        try {
          const reply = await onSendMessageRef.current(trimmed);
          if (typeof reply === "string" && reply.trim()) {
            const assistantTurn: VoiceSessionTurn = {
              id: nextTurnId(),
              role: "assistant",
              text: reply,
              timestamp: Date.now(),
              isFinal: true,
            };
            setTurns((prev) => [...prev, assistantTurn]);
            await voice.speak(reply);
          }
        } catch (err: unknown) {
          setLocalError(
            err instanceof Error ? err.message : "Failed to process message",
          );
        }
      }
    },
    [isListening, voice],
  );

  const clearHistory = useCallback(() => {
    setTurns([]);
    setInterimText("");
  }, []);

  const selectVoice = useCallback(
    (voiceId: string) => {
      voice.setVoice(voiceId);
    },
    [voice],
  );

  const setLanguage = useCallback(
    (lang: string) => {
      voice.setLanguage(lang);
    },
    [voice],
  );

  const dismissError = useCallback(() => {
    setLocalError(null);
  }, []);

  // ── Context value ──────────────────────────────────────────────────────────

  const value: VoiceSessionContextValue = {
    sessionActive,
    startSession,
    endSession,

    isListening,
    isSpeaking,
    status,
    currentVoice: voice.currentVoice,
    language: voice.sttLanguage,

    turns,
    interimText,
    sendMessage,
    clearHistory,

    selectVoice,
    setLanguage,
    speechRate,
    setSpeechRate,
    autoListen,
    setAutoListen,

    error: localError ?? voice.error,
    dismissError,
  };

  return (
    <VoiceSessionContext.Provider value={value}>
      {children}
    </VoiceSessionContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVoiceSession(): VoiceSessionContextValue {
  const context = useContext(VoiceSessionContext);
  if (!context) {
    throw new Error(
      "useVoiceSession must be used within a VoiceSessionProvider",
    );
  }
  return context;
}

export { VoiceSessionContext };
