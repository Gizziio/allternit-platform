"use client";

/**
 * VoiceCallMode — full-screen voice conversation surface.
 *
 * macOS-first: when running inside the Allternit Desktop shell, dictation can
 * be delegated to the native `DictationHelper` (SFSpeechRecognizer) via IPC.
 * Native dictation is optional; if the helper is not staged, the user declines
 * permissions, or the platform is not macOS, the surface falls back to the
 * browser's Web Speech API through the existing `useSTT()` hook.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Microphone,
  MicrophoneSlash,
  PhoneDisconnect,
  Spinner,
  X,
  Waveform,
} from "@phosphor-icons/react";
import { GlassSurface } from "@/design/glass/GlassSurface";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVoice, useSTT } from "@/providers/voice-provider";

interface VoiceCallModeProps {
  open: boolean;
  onClose: () => void;
  /** Bot/agent name shown in the call header. */
  agentName?: string;
  /** Optional accent color for the call chrome. */
  accentColor?: string;
  /** Called with finalized transcript text when the user finishes speaking. */
  onTranscript?: (text: string) => void;
}

export function VoiceCallMode({
  open,
  onClose,
  agentName = "Assistant",
  accentColor = "var(--accent-chat, #D4B08C)",
  onTranscript,
}: VoiceCallModeProps) {
  const {
    isPlaying,
    audioLevel,
    personaState,
    stopAudio,
    speak,
    transcript: globalTranscript,
    clearTranscript,
    interimTranscript,
  } = useVoice();

  const {
    startRecording,
    stopRecording,
    isRecording,
    isSupported: sttSupported,
  } = useSTT();

  const [muted, setMuted] = useState(false);
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [nativeDictation, setNativeDictation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localTranscript, setLocalTranscript] = useState<string>("");
  const committedRef = useRef(false);

  const desktop = useMemo(() => {
    if (typeof window === "undefined") return null;
    const w = window as unknown as {
      allternit?: {
        voice?: {
          startDictation?: () => Promise<{ success: boolean; error?: string }>;
          stopDictation?: () => Promise<void>;
          isAvailable?: () => Promise<boolean>;
          onTranscript?: (callback: (event: { text: string; isFinal: boolean }) => void) => (() => void);
        };
      };
    };
    return w.allternit ?? null;
  }, []);

  // Probe whether the desktop shell offers native dictation.
  useEffect(() => {
    if (!desktop?.voice?.isAvailable) {
      setNativeAvailable(false);
      setNativeDictation(false);
      return;
    }
    desktop.voice
      .isAvailable()
      .then((available) => {
        setNativeAvailable(available);
        // Default to native dictation when it is available; the user can toggle
        // back to Web Speech from the call controls.
        setNativeDictation(available);
      })
      .catch(() => {
        setNativeAvailable(false);
        setNativeDictation(false);
      });
  }, [desktop]);

  // Start listening when the call opens.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setLocalTranscript("");
    clearTranscript();
    committedRef.current = false;

    const start = async () => {
      if (nativeDictation && desktop?.voice?.startDictation) {
        const result = await desktop.voice.startDictation();
        if (!result.success) {
          setError(result.error ?? "Native dictation failed to start.");
          setNativeDictation(false);
        }
        return;
      }

      if (sttSupported) {
        const started = await startRecording();
        if (!started) {
          setError("Microphone access is required for voice mode.");
        }
      } else {
        setError("Voice input is not supported in this browser.");
      }
    };

    void start();

    return () => {
      if (nativeDictation) {
        desktop?.voice?.stopDictation?.().catch(() => {});
      }
      stopRecording();
      stopAudio();
    };
  }, [open, nativeDictation, desktop, sttSupported, startRecording, stopRecording, stopAudio, clearTranscript]);

  // Subscribe to native transcript events from the desktop helper.
  useEffect(() => {
    if (!open || !nativeDictation || !desktop?.voice?.onTranscript) return;

    const unsubscribe = desktop.voice.onTranscript((event) => {
      setLocalTranscript((prev) => {
        const next = event.isFinal ? event.text : `${prev} ${event.text}`.trim();
        return next;
      });
    });

    return () => {
      unsubscribe?.();
    };
  }, [open, nativeDictation, desktop]);

  // Commit finalized transcript to the callback.
  useEffect(() => {
    if (!open || !onTranscript) return;
    const source = nativeDictation ? localTranscript : globalTranscript;
    if (source && source.trim() && !committedRef.current) {
      committedRef.current = true;
      onTranscript(source.trim());
    }
  }, [open, onTranscript, globalTranscript, localTranscript, nativeDictation]);

  const handleToggleMute = useCallback(() => {
    setMuted((m) => !m);
    if (muted) {
      // Unmuting: restart the active input stream.
      if (nativeDictation) {
        desktop?.voice?.startDictation?.().catch(() => {});
      } else if (!isRecording) {
        void startRecording();
      }
    } else {
      // Muting: stop listening but keep call open.
      if (nativeDictation) {
        desktop?.voice?.stopDictation?.().catch(() => {});
      } else {
        stopRecording();
      }
    }
  }, [desktop, isRecording, muted, nativeDictation, startRecording, stopRecording]);

  const handleToggleDictation = useCallback(() => {
    const next = !nativeDictation;
    setNativeDictation(next);
    setError(null);

    if (next) {
      // Switching to native: stop Web Speech and start the helper.
      stopRecording();
      desktop?.voice?.startDictation?.().catch((err) => {
        setError(err instanceof Error ? err.message : "Native dictation unavailable");
        setNativeDictation(false);
      });
    } else {
      // Switching to Web Speech: stop native helper and start browser STT.
      desktop?.voice?.stopDictation?.().catch(() => {});
      if (sttSupported && !isRecording) {
        void startRecording();
      }
    }
  }, [desktop, isRecording, nativeDictation, startRecording, stopRecording, sttSupported]);

  const handleEndCall = useCallback(() => {
    if (nativeDictation) {
      desktop?.voice?.stopDictation?.().catch(() => {});
    }
    stopRecording();
    stopAudio();
    setNativeDictation(false);
    onClose();
  }, [desktop, nativeDictation, onClose, stopAudio, stopRecording]);

  const activeState = personaState === "speaking" || isPlaying ? "speaking" : isRecording ? "listening" : "idle";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--shell-overlay-backdrop)] backdrop-blur-md p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleEndCall();
          }}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="w-full max-w-md"
          >
            <GlassSurface
              variant="default"
              border="subtle"
              blur="xl"
              opacity="high"
              rounded="xl"
              padding="none"
              className="overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-3">
                  <div
                    className="size-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold"
                    style={{ backgroundColor: accentColor }}
                  >
                    {agentName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--text-primary)]">{agentName}</p>
                    <p className="text-[12px] text-[var(--text-tertiary)]">
                      {nativeDictation ? "On-device dictation" : sttSupported ? "Web Speech" : "Voice unavailable"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleEndCall}
                  className="p-2 rounded-lg hover:bg-white/5 text-[var(--text-secondary)] transition-colors"
                  aria-label="End call"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Visualizer */}
              <div className="flex flex-col items-center justify-center py-10 gap-6">
                <div
                  className={cn(
                    "relative size-32 rounded-full flex items-center justify-center transition-all duration-300",
                    activeState === "speaking" && "animate-pulse",
                    activeState === "listening" && "animate-pulse"
                  )}
                  style={{
                    background: `radial-gradient(circle, ${accentColor}22 0%, transparent 70%)`,
                    boxShadow: `0 0 ${40 + audioLevel * 60}px ${accentColor}${Math.round(audioLevel * 60 + 20).toString(16).padStart(2, "0")}`,
                  }}
                >
                  <div
                    className="size-20 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    {activeState === "speaking" ? (
                      <Waveform size={32} weight="fill" />
                    ) : activeState === "listening" ? (
                      <Microphone size={32} weight="fill" />
                    ) : (
                      <Microphone size={32} weight="fill" />
                    )}
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <p className="text-[15px] font-medium text-[var(--text-primary)] capitalize">
                    {activeState === "idle" ? "Listening…" : activeState}
                  </p>
                  {(interimTranscript || localTranscript) && (
                    <p className="text-[14px] text-[var(--text-secondary)] px-6 min-h-[1.5em]">
                      {interimTranscript || localTranscript}
                    </p>
                  )}
                </div>

                {error && (
                  <div className="mx-6 rounded-lg bg-[var(--status-error)]/10 px-4 py-2 text-[12px] text-[var(--status-error)]">
                    {error}
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4 px-6 pb-6">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleToggleMute}
                  className={cn(
                    "size-12 rounded-full border-[var(--border-subtle)]",
                    muted && "bg-[var(--status-error)]/10 text-[var(--status-error)] border-[var(--status-error)]/30"
                  )}
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  {muted ? <MicrophoneSlash size={20} /> : <Microphone size={20} />}
                </Button>

                <Button
                  type="button"
                  size="icon"
                  onClick={handleEndCall}
                  className="size-14 rounded-full"
                  style={{ backgroundColor: "var(--status-error)" }}
                  aria-label="End call"
                >
                  <PhoneDisconnect size={24} weight="fill" />
                </Button>

                {nativeAvailable && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleToggleDictation}
                    className="rounded-full border-[var(--border-subtle)] text-[var(--text-secondary)]"
                    aria-label={nativeDictation ? "Switch to Web Speech" : "Switch to native dictation"}
                  >
                    {nativeDictation ? "Native" : "Web Speech"}
                  </Button>
                )}
              </div>
            </GlassSurface>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default VoiceCallMode;
