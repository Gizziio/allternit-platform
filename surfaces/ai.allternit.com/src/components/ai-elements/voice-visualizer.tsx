"use client";

/**
 * Voice Visualizer
 *
 * Canvas-based audio visualization with multiple display modes:
 * - Compact: pulsing circle that responds to audio levels
 * - Expanded: full waveform display with frequency bars
 *
 * Color states reflect the current voice session status:
 * - idle (gray) — no audio activity
 * - listening (blue) — microphone active
 * - processing (amber) — speech being transcribed
 * - speaking (green) — assistant audio playing
 */

import React, { useContext, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useVoice } from "@/providers/voice-provider";
import { VoiceSessionContext } from "./voice-provider";
import type { VoiceSessionStatus } from "./voice-provider";

// ─── Constants ───────────────────────────────────────────────────────────────

const COLOR_MAP: Record<VoiceSessionStatus, string> = {
  idle: "rgb(156, 163, 175)", // gray-400
  listening: "rgb(59, 130, 246)", // blue-500
  processing: "rgb(245, 158, 11)", // amber-500
  speaking: "rgb(34, 197, 94)", // green-500
  error: "rgb(239, 68, 68)", // red-500
};

const GLOW_MAP: Record<VoiceSessionStatus, string> = {
  idle: "rgba(156, 163, 175, 0.3)",
  listening: "rgba(59, 130, 246, 0.4)",
  processing: "rgba(245, 158, 11, 0.4)",
  speaking: "rgba(34, 197, 94, 0.4)",
  error: "rgba(239, 68, 68, 0.4)",
};

const BAR_COUNT = 32;
const MIN_BAR_HEIGHT = 4;
const MAX_BAR_HEIGHT_RATIO = 0.8;

// ─── Props ───────────────────────────────────────────────────────────────────

export interface VoiceVisualizerProps {
  className?: string;
  /** Compact mode shows a pulsing circle; expanded shows full waveform. */
  mode?: "compact" | "expanded";
  /** Override the status color (otherwise derived from voice session). */
  status?: VoiceSessionStatus;
  /** Override the audio level (0-1, otherwise from voice context). */
  audioLevel?: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VoiceVisualizer({
  className,
  mode = "compact",
  status: statusOverride,
  audioLevel: levelOverride,
}: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const levelHistoryRef = useRef<number[]>([]);

  // Get state from context (session context is optional)
  const voiceContext = useVoice();
  const sessionContext = useContext(VoiceSessionContext);

  const status = statusOverride ?? sessionContext?.status ?? (voiceContext.isRecording ? "listening" : voiceContext.isPlaying ? "speaking" : "idle");
  const audioLevel = levelOverride ?? voiceContext.audioLevel;

  // ── Expanded mode: canvas waveform (hook must run before conditional return) ─

  useEffect(() => {
    if (mode === "compact") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Update level history
      levelHistoryRef.current.push(audioLevel);
      if (levelHistoryRef.current.length > BAR_COUNT) {
        levelHistoryRef.current.shift();
      }

      const barWidth = (width - (BAR_COUNT - 1) * 2) / BAR_COUNT;
      const centerY = height / 2;
      const maxBarHeight = height * MAX_BAR_HEIGHT_RATIO;

      const color = COLOR_MAP[status];
      const glowColor = GLOW_MAP[status];

      // Draw frequency bars (mirrored from center)
      for (let i = 0; i < BAR_COUNT; i++) {
        const level = levelHistoryRef.current[i] ?? 0;
        const barHeight = Math.max(
          MIN_BAR_HEIGHT,
          level * maxBarHeight + Math.sin(i * 0.3 + Date.now() * 0.002) * 2,
        );

        const x = i * (barWidth + 2);
        const yTop = centerY - barHeight / 2;

        // Bar glow
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = level > 0.3 ? 8 : 4;

        // Draw bar (rounded rectangle)
        ctx.fillStyle = color;
        ctx.beginPath();
        const radius = Math.min(barWidth / 2, barHeight / 2);
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(x, yTop, barWidth, barHeight, radius);
        } else {
          // Fallback: plain rect
          ctx.rect(x, yTop, barWidth, barHeight);
        }
        ctx.fill();

        // Reset shadow for next bar
        ctx.shadowBlur = 0;
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioLevel, status, mode]);

  // ── Compact mode: pulsing circle ──────────────────────────────────────────

  if (mode === "compact") {
    return (
      <CompactCircle
        status={status}
        audioLevel={audioLevel}
        className={className}
      />
    );
  }

  // ── Expanded mode: canvas element ─────────────────────────────────────────

  return (
    <div className={cn("relative w-full h-full", className)}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: "block" }}
      />
    </div>
  );
}

// ─── Compact Circle Sub-component ────────────────────────────────────────────

interface CompactCircleProps {
  status: VoiceSessionStatus;
  audioLevel: number;
  className?: string;
}

function CompactCircle({ status, audioLevel, className }: CompactCircleProps) {
  const baseSize = 48;
  const scale = 1 + audioLevel * 0.4;
  const color = COLOR_MAP[status];
  const glowColor = GLOW_MAP[status];

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-full",
        "transition-all duration-150",
        className,
      )}
      style={{
        width: baseSize,
        height: baseSize,
        backgroundColor: color,
        boxShadow: `0 0 ${12 + audioLevel * 20}px ${glowColor}`,
        transform: `scale(${scale})`,
      }}
    >
      {/* Inner highlight */}
      <div
        className="absolute inset-2 rounded-full bg-white/20"
        style={{
          opacity: 0.3 + audioLevel * 0.5,
        }}
      />

      {/* Pulse rings when active */}
      {status !== "idle" && (
        <>
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{
              backgroundColor: color,
              animationDuration: "1.5s",
            }}
          />
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{
              backgroundColor: color,
              animationDuration: "2s",
              animationDelay: "0.3s",
            }}
          />
        </>
      )}
    </div>
  );
}

export default VoiceVisualizer;
