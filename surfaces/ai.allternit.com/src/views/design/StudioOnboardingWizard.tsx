"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ArrowRight,
  Globe,
  DeviceMobile,
  Palette,
  Cube,
  VideoCamera,
  Pencil,
  ChatCircle,
  Cursor,
  FramerLogo,
  Lightning,
  GithubLogo,
  XLogo,
  InstagramLogo,
  MagnifyingGlass,
  SlackLogo,
  Envelope,
  Check,
  PlayCircle,
  UploadSimple,
  Sparkle,
  Stack,
  MagicWand,
} from "@phosphor-icons/react";

interface OnboardingData {
  designFocus: string[];
  dailyTools: string[];
  referralSource: string;
  email: string;
  subscribed: boolean;
}

interface StudioOnboardingWizardProps {
  onComplete: () => void;
  onSkip?: () => void;
}

const DESIGN_FOCUS_OPTIONS = [
  { id: "web", label: "Web", icon: <Globe size={16} /> },
  { id: "mobile", label: "Mobile", icon: <DeviceMobile size={16} /> },
  { id: "branding", label: "Branding", icon: <Palette size={16} /> },
  { id: "product", label: "Product", icon: <Cube size={16} /> },
  { id: "3d", label: "3D", icon: <VideoCamera size={16} /> },
  { id: "motion", label: "Motion", icon: <PlayCircle size={16} /> },
];

const TOOL_OPTIONS = [
  { id: "figma", label: "Figma", icon: <Pencil size={16} /> },
  { id: "chatgpt", label: "ChatGPT", icon: <ChatCircle size={16} /> },
  { id: "cursor", label: "Cursor", icon: <Cursor size={16} /> },
  { id: "framer", label: "Framer", icon: <FramerLogo size={16} /> },
  { id: "v0", label: "v0", icon: <Lightning size={16} /> },
  { id: "allternit", label: "Allternit", icon: <Sparkle size={16} /> },
];

const REFERRAL_OPTIONS = [
  { id: "twitter", label: "X / Twitter", icon: <XLogo size={14} /> },
  { id: "instagram", label: "Instagram", icon: <InstagramLogo size={14} /> },
  { id: "search", label: "Search", icon: <MagnifyingGlass size={14} /> },
  { id: "slack", label: "Slack", icon: <SlackLogo size={14} /> },
  { id: "github", label: "GitHub", icon: <GithubLogo size={14} /> },
  { id: "other", label: "Other", icon: <Lightning size={14} /> },
];

const STORAGE_KEY = "allternit-onboarding-wizard";

function loadWizardData(): Partial<OnboardingData> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveWizardData(data: OnboardingData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const WALKTHROUGH_FEATURES = [
  {
    step: "01",
    title: "DRAG AND DROP SCREENSHOTS",
    desc: "Drop in references, flows, or inspiration so Allternit understands your vision before generating.",
    icon: <UploadSimple size={20} weight="duotone" />,
  },
  {
    step: "02",
    title: "USE MANY SKILLS",
    desc: "Combine prompts with skills to shape layouts, code, copy, and iterations faster inside one workflow.",
    icon: <Sparkle size={20} weight="duotone" />,
  },
  {
    step: "03",
    title: "TURN DESIGNS TO SKILLS",
    desc: "Lock strong directions into reusable skills so future prompts keep the same quality and consistency.",
    icon: <Stack size={20} weight="duotone" />,
  },
];

const VIDEO_CHAPTERS = [
  { label: "Drop references", time: "0:00" },
  { label: "Prompt → Design", time: "0:42" },
  { label: "Export to code", time: "1:38" },
];

function VideoPlayer() {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { setPlaying(false); return 100; }
        return p + 0.5;
      });
    }, 90);
    return () => clearInterval(id);
  }, [playing]);

  const elapsed = Math.floor((progress / 100) * 183);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "16/9",
        background: "rgba(0,0,0,0.6)",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        marginBottom: 24,
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setPlaying((p) => !p)}
    >
      {/* Gradient bg */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 30% 40%, rgba(226,124,89,0.12), transparent 55%), radial-gradient(circle at 70% 60%, rgba(59,130,246,0.08), transparent 55%)" }} />

      {/* Simulated UI frames */}
      {!playing && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
          {[{ h: "60%", bg: "rgba(255,255,255,0.04)" }, { h: "80%", bg: "rgba(226,124,89,0.08)" }, { h: "50%", bg: "rgba(255,255,255,0.04)" }].map((f, i) => (
            <motion.div key={i} animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, delay: i * 0.6 }} style={{ flex: 1, height: f.h, borderRadius: 12, background: f.bg, border: "1px solid rgba(255,255,255,0.06)" }} />
          ))}
        </div>
      )}

      {/* Playing scan-line */}
      {playing && (
        <motion.div animate={{ x: [`${progress - 2}%`, `${progress}%`] }} style={{ position: "absolute", top: 0, bottom: 0, width: 2, background: "#e27c59", opacity: 0.5, zIndex: 2 }} />
      )}

      {/* Center play/pause */}
      <AnimatePresence>
        {(!playing || hovered) && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, zIndex: 3 }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {playing ? <div style={{ width: 14, height: 14, display: "flex", gap: 4 }}><div style={{ flex: 1, background: "#fff", borderRadius: 2 }} /><div style={{ flex: 1, background: "#fff", borderRadius: 2 }} /></div> : <PlayCircle size={32} color="#e27c59" weight="fill" style={{ marginLeft: 3 }} />}
            </div>
            {!playing && <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>Featured Walkthrough — 3:03</span>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 16px 12px", background: "linear-gradient(transparent, rgba(0,0,0,0.7))", zIndex: 4 }}>
        <div style={{ height: 3, background: "rgba(255,255,255,0.12)", borderRadius: 2, marginBottom: 8, position: "relative", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setProgress(((e.clientX - rect.left) / rect.width) * 100); }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "#e27c59", borderRadius: 2, transition: "width 0.1s" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}>{fmt(elapsed)} / 3:03</span>
          <div style={{ display: "flex", gap: 10 }}>
            {VIDEO_CHAPTERS.map((ch) => (
              <button key={ch.label} style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>{ch.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StudioOnboardingWizard({ onComplete, onSkip }: StudioOnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(() => {
    const saved = loadWizardData();
    return {
      designFocus: saved?.designFocus || [],
      dailyTools: saved?.dailyTools || [],
      referralSource: saved?.referralSource || "",
      email: saved?.email || "",
      subscribed: saved?.subscribed || false,
    };
  });
  const [emailError, setEmailError] = useState("");

  const totalSteps = 3;

  const toggleArrayValue = useCallback((field: "designFocus" | "dailyTools", value: string) => {
    setData((prev) => {
      const arr = prev[field];
      const exists = arr.includes(value);
      return {
        ...prev,
        [field]: exists ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  }, []);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const canProceed = () => {
    if (step === 0) return true; // preferences are optional
    if (step === 1) return true; // email is optional
    return true;
  };

  const handleNext = () => {
    if (step === 1 && data.email && !validateEmail(data.email)) {
      setEmailError("Please enter a valid email.");
      return;
    }
    setEmailError("");
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
    } else {
      saveWizardData(data);
      onComplete();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const progressPercent = ((step + 1) / totalSteps) * 100;

  const stepLabels = ["WELCOME", "STAY IN THE LOOP", "WATCH THE WORKFLOW"];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-sans)",
        padding: "24px",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "90vh",
          background: "#111113",
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 40px 80px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Top Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MagicWand size={18} color="#e27c59" weight="duotone" />
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.5)",
                textTransform: "uppercase",
              }}
            >
              Allternit Studio
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(255,255,255,0.3)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {String(step + 1).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}
            </span>
            <button
              onClick={onSkip || onComplete}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.4)",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ padding: "16px 24px 0" }}>
          <div
            style={{
              height: 2,
              background: "rgba(255,255,255,0.06)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <motion.div
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              style={{
                height: "100%",
                background: "#e27c59",
                borderRadius: 2,
              }}
            />
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.15em",
                    color: "rgba(255,255,255,0.35)",
                    textTransform: "uppercase",
                    marginBottom: 12,
                  }}
                >
                  {stepLabels[0]}
                </div>
                <h2
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: "#fff",
                    lineHeight: 1.15,
                    marginBottom: 8,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Let's shape your first{" "}
                  <span style={{ color: "#e27c59", fontStyle: "italic" }}>Allternit</span>{" "}
                  session.
                </h2>
                <p
                  style={{
                    fontSize: 14,
                    color: "rgba(255,255,255,0.45)",
                    marginBottom: 32,
                    lineHeight: 1.5,
                  }}
                >
                  A couple quick signals help us tailor onboarding, prompts, and what we send
                  your way next.
                </p>

                {/* What do you design most? */}
                <div style={{ marginBottom: 28 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.15em",
                      color: "rgba(255,255,255,0.35)",
                      textTransform: "uppercase",
                      marginBottom: 12,
                    }}
                  >
                    What do you design most?
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {DESIGN_FOCUS_OPTIONS.map((opt) => {
                      const active = data.designFocus.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => toggleArrayValue("designFocus", opt.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "8px 14px",
                            borderRadius: 10,
                            border: `1px solid ${active ? "#e27c59" : "rgba(255,255,255,0.08)"}`,
                            background: active ? "rgba(226,124,89,0.12)" : "rgba(255,255,255,0.03)",
                            color: active ? "#e27c59" : "rgba(255,255,255,0.6)",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                        >
                          {opt.icon}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* What tools do you use daily? */}
                <div style={{ marginBottom: 28 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.15em",
                      color: "rgba(255,255,255,0.35)",
                      textTransform: "uppercase",
                      marginBottom: 12,
                    }}
                  >
                    What tools do you use daily?
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {TOOL_OPTIONS.map((opt) => {
                      const active = data.dailyTools.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => toggleArrayValue("dailyTools", opt.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "8px 14px",
                            borderRadius: 10,
                            border: `1px solid ${active ? "#e27c59" : "rgba(255,255,255,0.08)"}`,
                            background: active ? "rgba(226,124,89,0.12)" : "rgba(255,255,255,0.03)",
                            color: active ? "#e27c59" : "rgba(255,255,255,0.6)",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                        >
                          {opt.icon}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* How did you hear about us? */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.15em",
                      color: "rgba(255,255,255,0.35)",
                      textTransform: "uppercase",
                      marginBottom: 12,
                    }}
                  >
                    How did you hear about us?
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {REFERRAL_OPTIONS.map((opt) => {
                      const active = data.referralSource === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setData((prev) => ({ ...prev, referralSource: opt.id }))}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "8px 14px",
                            borderRadius: 10,
                            border: `1px solid ${active ? "#e27c59" : "rgba(255,255,255,0.08)"}`,
                            background: active ? "rgba(226,124,89,0.12)" : "rgba(255,255,255,0.03)",
                            color: active ? "#e27c59" : "rgba(255,255,255,0.6)",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                        >
                          {opt.icon}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.15em",
                    color: "rgba(255,255,255,0.35)",
                    textTransform: "uppercase",
                    marginBottom: 12,
                  }}
                >
                  {stepLabels[1]}
                </div>
                <h2
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: "#fff",
                    lineHeight: 1.15,
                    marginBottom: 8,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Get the best prompts & templates weekly. For free.
                </h2>
                <p
                  style={{
                    fontSize: 14,
                    color: "rgba(255,255,255,0.45)",
                    marginBottom: 32,
                    lineHeight: 1.5,
                  }}
                >
                  Subscribe to design drops, prompt engineering guides, and major product
                  updates.
                </p>

                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 16,
                    padding: 24,
                    marginBottom: 24,
                  }}
                >
                  <label
                    style={{
                      display: "block",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.15em",
                      color: "rgba(255,255,255,0.35)",
                      textTransform: "uppercase",
                      marginBottom: 16,
                    }}
                  >
                    Subscribe to updates
                  </label>
                  <p
                    style={{
                      fontSize: 14,
                      color: "rgba(255,255,255,0.6)",
                      lineHeight: 1.6,
                      marginBottom: 20,
                    }}
                  >
                    Email the best prompts, remixable design drops, and major product updates.
                    We will send a confirmation email first.
                  </p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <Envelope
                        size={16}
                        style={{
                          position: "absolute",
                          left: 14,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "rgba(255,255,255,0.25)",
                        }}
                      />
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={data.email}
                        onChange={(e) => {
                          setData((prev) => ({ ...prev, email: e.target.value }));
                          setEmailError("");
                        }}
                        style={{
                          width: "100%",
                          padding: "12px 14px 12px 40px",
                          borderRadius: 10,
                          border: `1px solid ${emailError ? "#ef4444" : "rgba(255,255,255,0.1)"}`,
                          background: "rgba(255,255,255,0.05)",
                          color: "#fff",
                          fontSize: 14,
                          outline: "none",
                          fontFamily: "inherit",
                        }}
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (data.email && validateEmail(data.email)) {
                          setData((prev) => ({ ...prev, subscribed: true }));
                        } else if (data.email) {
                          setEmailError("Please enter a valid email.");
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "0 20px",
                        borderRadius: 10,
                        background: data.subscribed ? "#22c55e" : "#e27c59",
                        border: "none",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {data.subscribed ? <Check size={16} weight="bold" /> : <Envelope size={16} />}
                      {data.subscribed ? "Subscribed" : "Subscribe for free"}
                    </button>
                  </div>
                  {emailError && (
                    <p style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>{emailError}</p>
                  )}
                </div>

                {/* Preview card */}
                <div
                  style={{
                    background: "linear-gradient(135deg, rgba(226,124,89,0.1), rgba(59,130,246,0.1))",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 16,
                    padding: 20,
                    display: "flex",
                    gap: 16,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: "rgba(226,124,89,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <MagicWand size={24} color="#e27c59" weight="duotone" />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#fff",
                        marginBottom: 4,
                      }}
                    >
                      Weekly Design Drops
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                      Prompts, templates, and system updates curated for your design workflow.
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.15em",
                    color: "rgba(255,255,255,0.35)",
                    textTransform: "uppercase",
                    marginBottom: 12,
                  }}
                >
                  {stepLabels[2]}
                </div>
                <h2
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: "#fff",
                    lineHeight: 1.15,
                    marginBottom: 8,
                    letterSpacing: "-0.02em",
                  }}
                >
                  3 Steps to Start
                </h2>
                <p
                  style={{
                    fontSize: 14,
                    color: "rgba(255,255,255,0.45)",
                    marginBottom: 24,
                    lineHeight: 1.5,
                  }}
                >
                  Watch how Allternit turns your first prompt into a shipped design system.
                </p>

                {/* Video Player */}
                <VideoPlayer />

                {/* Feature Cards */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 12,
                    marginBottom: 8,
                  }}
                >
                  {WALKTHROUGH_FEATURES.map((feat, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 14,
                        padding: 18,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: "rgba(226,124,89,0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#e27c59",
                            fontSize: 10,
                            fontWeight: 800,
                          }}
                        >
                          {feat.step}
                        </div>
                        <div style={{ color: "rgba(255,255,255,0.5)" }}>{feat.icon}</div>
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: "0.08em",
                          color: "rgba(255,255,255,0.35)",
                          textTransform: "uppercase",
                        }}
                      >
                        {feat.title}
                      </div>
                      <p
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.45)",
                          lineHeight: 1.5,
                          margin: 0,
                        }}
                      >
                        {feat.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Actions */}
        <div
          style={{
            padding: "16px 24px 20px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            onClick={onSkip || onComplete}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.35)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              padding: "8px 0",
            }}
          >
            Skip for now
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {step > 0 && (
              <button
                onClick={handleBack}
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 20px",
                borderRadius: 10,
                background: canProceed() ? "#fff" : "rgba(255,255,255,0.1)",
                border: "none",
                color: canProceed() ? "#111" : "rgba(255,255,255,0.3)",
                fontSize: 13,
                fontWeight: 700,
                cursor: canProceed() ? "pointer" : "not-allowed",
                transition: "all 0.2s",
              }}
            >
              {step === totalSteps - 1 ? "Start creating" : "Next"}
              <ArrowRight size={16} weight="bold" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
