"use client";

/**
 * Voice Session
 *
 * Full-screen voice conversation interface with:
 * - Real-time transcript display (user and assistant turns)
 * - Animated persona avatar responding to audio levels
 * - Status indicators (listening, thinking, speaking)
 * - Controls bar (mute, end session, switch to text)
 * - Auto-scrolling transcript
 *
 * Must be wrapped in <VoiceSessionProvider> to function.
 */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useVoice } from "@/providers/voice-provider";
import { useVoiceSession } from "./voice-provider";
import { VoiceVisualizer } from "./voice-visualizer";
import type { VoiceSessionTurn } from "./voice-provider";
import {
  Microphone,
  MicrophoneSlash,
  X,
  TextT,
  Phone,
  PhoneDisconnect,
} from "@phosphor-icons/react";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface VoiceSessionProps {
  className?: string;
  /** Callback when user clicks "Switch to text" button. */
  onSwitchToText?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VoiceSession({ className, onSwitchToText }: VoiceSessionProps) {
  const voice = useVoice();
  const session = useVoiceSession();

  const transcriptRef = useRef<HTMLDivElement>(null);
  const startSessionRef = useRef(session.startSession);
  startSessionRef.current = session.startSession;
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Auto-scroll transcript ────────────────────────────────────────────────

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [session.turns, session.interimText]);

  // ── Mute toggle ───────────────────────────────────────────────────────────

  const handleMuteToggle = async () => {
    if (isMuted) {
      // Unmute: start listening
      setIsMuted(false);
      await session.startSession();
    } else {
      // Mute: stop listening
      setIsMuted(true);
      voice.stopRecording();
    }
  };

  // ── End session ───────────────────────────────────────────────────────────

  const handleEndSession = () => {
    session.endSession();
    if (onSwitchToText) {
      onSwitchToText();
    }
  };

  // ── Status text ───────────────────────────────────────────────────────────

  const statusText = (() => {
    switch (session.status) {
      case "listening":
        return "Listening...";
      case "processing":
        return "Thinking...";
      case "speaking":
        return "Speaking...";
      case "error":
        return "Error";
      default:
        return session.sessionActive ? "Ready" : "Session ended";
    }
  })();

  const statusColor = (() => {
    switch (session.status) {
      case "listening":
        return "text-blue-500";
      case "processing":
        return "text-amber-500";
      case "speaking":
        return "text-green-500";
      case "error":
        return "text-red-500";
      default:
        return "text-muted-foreground";
    }
  })();

  // ── Start session on mount if not active ──────────────────────────────────

  useEffect(() => {
    if (!isMuted) {
      startSessionRef.current().catch(() => {
        // Error already set in context
      });
    }
  }, [isMuted]);

  // ── Render ────────────────────────────────────────────────────────────────

  const content = (
    <div
      className={cn(
        "flex flex-col bg-background text-foreground",
        isFullscreen ? "fixed inset-0 z-50" : "relative w-full h-full",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Phone className="size-5 text-primary" weight="fill" />
          <div>
            <h2 className="font-semibold text-sm">Voice Session</h2>
            <p className={cn("text-xs", statusColor)}>{statusText}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isFullscreen && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(false)}
              className="size-8"
            >
              <X className="size-4" />
            </Button>
          )}
          {!isFullscreen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(true)}
              className="text-xs"
            >
              Expand
            </Button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Persona and visualizer */}
        <div className="flex-shrink-0 flex items-center justify-center py-8 px-4">
          <div className="relative">
            {/* Visualizer */}
            <VoiceVisualizer
              mode="compact"
              status={session.status}
              audioLevel={voice.audioLevel}
              className="size-32"
            />

            {/* Status indicator ring */}
            <div
              className={cn(
                "absolute inset-0 rounded-full border-2 transition-colors duration-300",
                session.status === "listening" && "border-blue-500",
                session.status === "processing" && "border-amber-500",
                session.status === "speaking" && "border-green-500",
                session.status === "idle" && "border-muted-foreground",
                session.status === "error" && "border-red-500",
              )}
            />
          </div>
        </div>

        {/* Transcript area */}
        <div
          ref={transcriptRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        >
          {session.turns.length === 0 && !session.interimText && (
            <div className="text-center text-muted-foreground text-sm py-8">
              <p>Start speaking to begin the conversation</p>
            </div>
          )}

          {session.turns.map((turn) => (
            <TranscriptTurn key={turn.id} turn={turn} />
          ))}

          {/* Interim text (currently being spoken) */}
          {session.interimText && (
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-lg px-4 py-2 bg-primary/10 border border-primary/20">
                <p className="text-sm text-foreground italic">
                  {session.interimText}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Listening...
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Waveform bar (expanded mode) */}
        {isFullscreen && (
          <div className="flex-shrink-0 h-24 border-t bg-muted/30 p-4">
            <VoiceVisualizer
              mode="expanded"
              status={session.status}
              audioLevel={voice.audioLevel}
              className="w-full h-full"
            />
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex-shrink-0 border-t bg-muted/20 p-4">
        <div className="flex items-center justify-center gap-3">
          {/* Mute button */}
          <Button
            variant={isMuted ? "destructive" : "outline"}
            size="icon"
            onClick={handleMuteToggle}
            className="size-12 rounded-full"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <MicrophoneSlash className="size-5" weight="fill" />
            ) : (
              <Microphone className="size-5" weight="fill" />
            )}
          </Button>

          {/* End session button */}
          <Button
            variant="destructive"
            size="icon"
            onClick={handleEndSession}
            className="size-12 rounded-full"
            title="End session"
          >
            <PhoneDisconnect className="size-5" weight="fill" />
          </Button>

          {/* Switch to text button */}
          {onSwitchToText && (
            <Button
              variant="outline"
              size="icon"
              onClick={onSwitchToText}
              className="size-12 rounded-full"
              title="Switch to text"
            >
              <TextT className="size-5" weight="fill" />
            </Button>
          )}
        </div>

        {/* Error display */}
        {session.error && (
          <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-md">
            <p className="text-xs text-red-400 text-center">
              {session.error}
              <button
                type="button"
                onClick={session.dismissError}
                className="ml-2 underline hover:no-underline"
              >
                Dismiss
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // ── Portal for fullscreen mode ────────────────────────────────────────────

  if (isFullscreen && typeof document !== "undefined") {
    return createPortal(content, document.body);
  }

  return content;
}

// ─── Transcript Turn Sub-component ───────────────────────────────────────────

interface TranscriptTurnProps {
  turn: VoiceSessionTurn;
}

function TranscriptTurn({ turn }: TranscriptTurnProps) {
  const isUser = turn.role === "user";
  const isAssistant = turn.role === "assistant";
  const isSystem = turn.role === "system";

  return (
    <div
      className={cn("flex", isUser && "justify-end", isAssistant && "justify-start", isSystem && "justify-center")}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-2",
          isUser && "bg-primary/10 border border-primary/20",
          isAssistant && "bg-muted border border-border",
          isSystem && "bg-amber-500/10 border border-amber-500/20",
        )}
      >
        {isUser && (
          <p className="text-xs text-primary font-medium mb-1">You</p>
        )}
        {isAssistant && (
          <p className="text-xs text-muted-foreground font-medium mb-1">
            Assistant
          </p>
        )}
        {isSystem && (
          <p className="text-xs text-amber-600 font-medium mb-1">System</p>
        )}
        <p className="text-sm text-foreground">{turn.text}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(turn.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

export default VoiceSession;
