"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { STUDIO_THEME } from "../AgentView.constants";

type VoiceStyle = "neutral" | "warm" | "professional" | "casual" | "enthusiastic";
type ToneStyle = "friendly" | "direct" | "witty" | "empathetic" | "technical";

interface AgentMascotHeroProps {
  voice?: VoiceStyle;
  tone?: ToneStyle;
  onVoiceChange?: (voice: VoiceStyle) => void;
  onToneChange?: (tone: ToneStyle) => void;
}

const VOICES: { id: VoiceStyle; label: string; description: string; color: string }[] = [
  { id: "neutral", label: "Neutral", description: "Balanced and clear", color: "#94a3b8" },
  { id: "warm", label: "Warm", description: "Kind and inviting", color: "#f59e0b" },
  { id: "professional", label: "Professional", description: "Polished and precise", color: "#3b82f6" },
  { id: "casual", label: "Casual", description: "Relaxed and natural", color: "#10b981" },
  { id: "enthusiastic", label: "Enthusiastic", description: "Energetic and upbeat", color: "#ec4899" },
];

const TONES: { id: ToneStyle; label: string; description: string; color: string }[] = [
  { id: "friendly", label: "Friendly", description: "Approachable and open", color: "#f59e0b" },
  { id: "direct", label: "Direct", description: "Straight to the point", color: "#ef4444" },
  { id: "witty", label: "Witty", description: "Clever and playful", color: "#8b5cf6" },
  { id: "empathetic", label: "Empathetic", description: "Understanding and supportive", color: "#ec4899" },
  { id: "technical", label: "Technical", description: "Detailed and exact", color: "#0ea5e9" },
];

const SAMPLES: Record<VoiceStyle, Record<ToneStyle, string>> = {
  neutral: {
    friendly: "Hi there! I'm ready to help however I can.",
    direct: "Tell me what you need. I'll handle it.",
    witty: "Greetings, human. Let's make some magic happen.",
    empathetic: "I understand this can be a lot. We'll work through it together.",
    technical: "State your requirements and I will process them.",
  },
  warm: {
    friendly: "Hey! So lovely to meet you. What are we working on today?",
    direct: "I'm here for you. What's the priority right now?",
    witty: "Well hello there! Grab a coffee and let's build something wonderful.",
    empathetic: "It's okay to feel overwhelmed. I'm right beside you.",
    technical: "Let's take a careful look at this together, step by step.",
  },
  professional: {
    friendly: "Good day. I'm pleased to assist with your request.",
    direct: "Please outline the objective. I'll execute accordingly.",
    witty: "At your service — efficiency with a dash of charm.",
    empathetic: "I appreciate the complexity here. Let's resolve it methodically.",
    technical: "Kindly specify the parameters so I can proceed with precision.",
  },
  casual: {
    friendly: "Yo! What's up? Ready to jam on some ideas?",
    direct: "What do you need? I'm on it.",
    witty: "Let's do this thing. Worst case, we learn something funny.",
    empathetic: "Totally get it. Rough day? I got you.",
    technical: "Hit me with the details and I'll sort it out.",
  },
  enthusiastic: {
    friendly: "Helloooo! I am SO excited to help you today!",
    direct: "Let's GO! What's the first move?",
    witty: "Buckle up, friend — we're about to make something awesome!",
    empathetic: "You're doing amazing. Let's crush this together!",
    technical: "This is going to be fantastic! Feed me those specs!",
  },
};

function useMood(voice: VoiceStyle, tone: ToneStyle) {
  // Map voice + tone to an expressive mood for the mascot.
  if (voice === "enthusiastic" || tone === "witty") return "excited";
  if (voice === "warm" || tone === "empathetic") return "happy";
  if (tone === "direct" || voice === "professional") return "focused";
  if (tone === "technical") return "curious";
  return "neutral";
}

function MascotFace({ mood }: { mood: string }) {
  const eyeY = mood === "excited" ? -3 : mood === "happy" ? -1.5 : mood === "focused" ? 1 : 0;
  const mouthPath =
    mood === "excited"
      ? "M 30 58 Q 50 72 70 58"
      : mood === "happy"
        ? "M 34 60 Q 50 70 66 60"
        : mood === "focused"
          ? "M 40 64 L 60 64"
          : mood === "curious"
            ? "M 36 62 Q 50 66 64 60"
            : "M 36 62 Q 50 68 64 62";

  return (
    <motion.g
      key={mood}
      initial={{ opacity: 0.8, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
    >
      {/* Eyes container */}
      <motion.g animate={{ y: eyeY }} transition={{ duration: 0.4 }}>
        {/* Left eye */}
        <ellipse cx="36" cy="46" rx="9" ry={mood === "excited" ? 11 : 10} fill="var(--text-primary)" />
        <circle cx="38" cy="44" r="3" fill="var(--bg-primary)" />
        {/* Right eye */}
        <ellipse cx="64" cy="46" rx="9" ry={mood === "excited" ? 11 : 10} fill="var(--text-primary)" />
        <circle cx="66" cy="44" r="3" fill="var(--bg-primary)" />
      </motion.g>

      {/* Mouth */}
      <motion.path
        d={mouthPath}
        fill="transparent"
        stroke="var(--text-primary)"
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ pathLength: 0.6 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4 }}
      />

      {/* Cheeks for warm/happy moods */}
      {(mood === "happy" || mood === "excited") && (
        <>
          <circle cx="26" cy="56" r="4" fill="var(--accent-primary)" opacity="0.25" />
          <circle cx="74" cy="56" r="4" fill="var(--accent-primary)" opacity="0.25" />
        </>
      )}
    </motion.g>
  );
}

function MascotCharacter({ mood, color }: { mood: string; color: string }) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Animated aura behind mascot */}
      <motion.div
        className="absolute rounded-full blur-2xl"
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.35, 0.55, 0.35],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: 220,
          height: 220,
          background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
        }}
      />

      {/* Floating mascot SVG */}
      <motion.svg
        width="200"
        height="240"
        viewBox="0 0 100 120"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10"
      >
        <defs>
          <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--surface-panel)" />
            <stop offset="100%" stopColor="var(--surface-hover)" />
          </linearGradient>
          <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={STUDIO_THEME.accent} />
          </linearGradient>
        </defs>

        {/* Antenna */}
        <motion.g
          animate={{ rotate: [0, mood === "excited" ? 8 : 4, 0, mood === "excited" ? -8 : -4, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{ originX: "50px", originY: "20px" }}
        >
          <line x1="50" y1="34" x2="50" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <circle cx="50" cy="10" r="5" fill={color}>
            <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
          </circle>
        </motion.g>

        {/* Body */}
        <rect x="22" y="30" width="56" height="62" rx="18" fill="url(#bodyGradient)" stroke={color} strokeWidth="2" />

        {/* Screen / face area */}
        <rect x="30" y="40" width="40" height="36" rx="10" fill="var(--bg-primary)" stroke="var(--border-subtle)" strokeWidth="1" />
        <MascotFace mood={mood} />

        {/* Hands */}
        <motion.g
          animate={{ y: [0, mood === "excited" ? -6 : -3, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <circle cx="14" cy="62" r="7" fill={color} opacity="0.9" />
          <circle cx="86" cy="62" r="7" fill={color} opacity="0.9" />
        </motion.g>

        {/* Base / feet glow */}
        <ellipse cx="38" cy="96" rx="8" ry="5" fill={color} opacity="0.6" />
        <ellipse cx="62" cy="96" rx="8" ry="5" fill={color} opacity="0.6" />
      </motion.svg>
    </div>
  );
}

export function AgentMascotHero({
  voice = "neutral",
  tone = "friendly",
  onVoiceChange,
  onToneChange,
}: AgentMascotHeroProps) {
  const mood = useMood(voice, tone);
  const voiceColor = VOICES.find((v) => v.id === voice)?.color ?? STUDIO_THEME.accent;
  const accentColor = voiceColor;
  const sampleText = SAMPLES[voice][tone];

  return (
    <div className="relative flex w-full flex-col items-center">
      {/* Mascot + speech bubble */}
      <div className="relative mb-6 flex w-full items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${voice}-${tone}`}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.3 }}
            className="absolute left-0 top-0 z-20 hidden w-56 rounded-2xl rounded-br-none border p-4 shadow-xl backdrop-blur-md sm:block"
            style={{
              background: "color-mix(in srgb, var(--surface-panel) 88%, transparent)",
              borderColor: STUDIO_THEME.borderSubtle,
              boxShadow: `0 16px 40px -12px ${accentColor}30`,
            }}
          >
            <div className="mb-2 flex items-center gap-2">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full"
                style={{ background: `${accentColor}20` }}
              >
                <div className="h-2 w-2 rounded-full" style={{ background: accentColor }} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: STUDIO_THEME.textMuted }}>
                Preview
              </span>
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: STUDIO_THEME.textPrimary }}>
              “{sampleText}”
            </p>
          </motion.div>
        </AnimatePresence>

        <MascotCharacter mood={mood} color={accentColor} />
      </div>

      {/* Voice selector */}
      <div className="w-full max-w-md">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: STUDIO_THEME.textSecondary }}>
            Voice
          </span>
          <span className="text-[10px]" style={{ color: STUDIO_THEME.textMuted }}>
            How they sound
          </span>
        </div>
        <div className="mb-5 flex flex-wrap gap-2">
          {VOICES.map((v) => {
            const active = voice === v.id;
            return (
              <motion.button
                key={v.id}
                type="button"
                onClick={() => onVoiceChange?.(v.id)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="relative overflow-hidden rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors"
                style={{
                  background: active ? `${v.color}15` : "color-mix(in srgb, var(--surface-panel) 70%, transparent)",
                  borderColor: active ? `${v.color}50` : STUDIO_THEME.borderSubtle,
                  color: active ? v.color : STUDIO_THEME.textSecondary,
                }}
              >
                {v.label}
                {active && (
                  <motion.div
                    layoutId="voice-pill"
                    className="absolute inset-0 rounded-full border-2"
                    style={{ borderColor: v.color }}
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Tone selector */}
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: STUDIO_THEME.textSecondary }}>
            Tone
          </span>
          <span className="text-[10px]" style={{ color: STUDIO_THEME.textMuted }}>
            How they speak
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => {
            const active = tone === t.id;
            return (
              <motion.button
                key={t.id}
                type="button"
                onClick={() => onToneChange?.(t.id)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="relative overflow-hidden rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors"
                style={{
                  background: active ? `${t.color}15` : "color-mix(in srgb, var(--surface-panel) 70%, transparent)",
                  borderColor: active ? `${t.color}50` : STUDIO_THEME.borderSubtle,
                  color: active ? t.color : STUDIO_THEME.textSecondary,
                }}
              >
                {t.label}
                {active && (
                  <motion.div
                    layoutId="tone-pill"
                    className="absolute inset-0 rounded-full border-2"
                    style={{ borderColor: t.color }}
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export type { VoiceStyle, ToneStyle };
