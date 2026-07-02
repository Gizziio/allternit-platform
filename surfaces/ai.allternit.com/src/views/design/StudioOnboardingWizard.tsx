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
import { cn } from "@/lib/utils";

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
      className="w-full aspect-video bg-black/60 rounded-2xl border border-solid border-white/5 mb-6 relative overflow-hidden cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setPlaying((p) => !p)}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPlaying((p) => !p); }}
    >
      {/* Gradient bg */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_30%_40%,rgba(226,124,89,0.12),transparent_55%),radial-gradient(circle_at_70%_60%,rgba(59,130,246,0.08),transparent_55%)]" />

      {/* Simulated UI frames */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center gap-4 p-8">
          {[{ h: "60%", bg: "bg-white/5" }, { h: "80%", bg: "bg-[var(--accent-primary,#e27c59)]/10" }, { h: "50%", bg: "bg-white/5" }].map((f, i) => (
            <motion.div key={`studioonboardingwizard-${i}`} animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, delay: i * 0.6 }} className={cn("flex-1 rounded-xl border border-solid border-white/5", f.h === "60%" ? "h-[60%]" : f.h === "80%" ? "h-[80%]" : "h-[50%]", f.bg)} />
          ))}
        </div>
      )}

      {/* Playing scan-line */}
      {playing && (
        <motion.div animate={{ x: [`${progress - 2}%`, `${progress}%`] }} className="absolute top-0 bottom-0 w-0.5 bg-[var(--accent-primary,#e27c59)] opacity-50 z-[2]" />
      )}

      {/* Center play/pause */}
      <AnimatePresence>
        {(!playing || hovered) && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-[3]">
            <div className="w-[60px] h-[60px] rounded-full bg-black/50 backdrop-blur-md border border-solid border-white/15 flex items-center justify-center">
              {playing ? <div className="w-3.5 h-3.5 flex gap-1"><div className="flex-1 bg-white rounded-sm" /><div className="flex-1 bg-white rounded-sm" /></div> : <PlayCircle size={32} className="text-[var(--accent-primary,#e27c59)] ml-1" weight="fill" />}
            </div>
            {!playing && <span className="text-[12px] font-semibold text-white/50">Featured Walkthrough — 3:03</span>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 p-[8px_16px_12px] bg-gradient-to-t from-black/70 to-transparent z-[4]">
        <div role="button" tabIndex={0} className="h-0.5 bg-white/10 rounded-full mb-2 relative cursor-pointer group" onClick={(e) => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setProgress(((e.clientX - rect.left) / rect.width) * 100); }}>
          <div className="h-full bg-[var(--accent-primary,#e27c59)] rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold text-[var(--text-secondary)] tabular-nums">{fmt(elapsed)} / 3:03</span>
          <div className="flex gap-2.5">
            {VIDEO_CHAPTERS.map((ch) => (
              <button type="button" key={ch.label} className="text-[12px] font-bold px-1.5 py-0.5 rounded bg-[var(--surface-hover)] border border-solid border-white/10 text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--surface-active)] transition-colors">{ch.label}</button>
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
    <div className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-xl flex items-center justify-center font-sans p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
        className="w-full max-w-[720px] max-h-[90vh] bg-[var(--surface-panel)] rounded-[24px] border border-solid border-[var(--border-subtle)] shadow-[0_40px_80px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden relative"
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between p-[20px_24px_0]">
          <div className="flex items-center gap-2">
            <MagicWand size={18} className="text-[var(--accent-primary)]" weight="duotone" />
            <span className="text-[12px] font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
              Allternit Design
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-bold text-[var(--text-tertiary)] tabular-nums">
              {String(step + 1).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}
            </span>
            <button type="button"
              onClick={onSkip || onComplete}
              className="bg-transparent border-none text-[var(--text-tertiary)] cursor-pointer p-1 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="h-0.5 bg-[var(--border-default)] rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="h-full bg-[var(--accent-primary)] rounded-full"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-[28px_32px]">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-[12px] font-extrabold tracking-widest text-[var(--text-tertiary)] uppercase mb-3">
                  {stepLabels[0]}
                </div>
                <h2 className="text-[32px] font-bold text-[var(--text-primary)] leading-tight mb-2 tracking-tight">
                  Let's shape your first{" "}
                  <span className="text-[var(--accent-primary)] italic">Allternit</span>{" "}
                  session.
                </h2>
                <p className="text-[14px] text-[var(--text-secondary)] mb-8 leading-relaxed">
                  A couple quick signals help us tailor onboarding, prompts, and what we send
                  your way next.
                </p>

                {/* What do you design most? */}
                <div className="mb-7">
                  <div className="block text-[12px] font-extrabold tracking-widest text-[var(--text-tertiary)] uppercase mb-3">
                    What do you design most?
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {DESIGN_FOCUS_OPTIONS.map((opt) => {
                      const active = data.designFocus.includes(opt.id);
                      return (
                        <button type="button"
                          key={opt.id}
                          onClick={() => toggleArrayValue("designFocus", opt.id)}
                          className={cn(
                            "flex items-center gap-1.5 p-[8px_14px] rounded-xl border border-solid text-[13px] font-semibold cursor-pointer transition-all duration-200",
                            active ? "border-[var(--accent-primary)] bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent)] text-[var(--accent-primary)]" : "border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                          )}
                        >
                          {opt.icon}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* What tools do you use daily? */}
                <div className="mb-7">
                  <div className="block text-[12px] font-extrabold tracking-widest text-[var(--text-tertiary)] uppercase mb-3">
                    What tools do you use daily?
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {TOOL_OPTIONS.map((opt) => {
                      const active = data.dailyTools.includes(opt.id);
                      return (
                        <button type="button"
                          key={opt.id}
                          onClick={() => toggleArrayValue("dailyTools", opt.id)}
                          className={cn(
                            "flex items-center gap-1.5 p-[8px_14px] rounded-xl border border-solid text-[13px] font-semibold cursor-pointer transition-all duration-200",
                            active ? "border-[var(--accent-primary)] bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent)] text-[var(--accent-primary)]" : "border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                          )}
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
                  <div className="block text-[12px] font-extrabold tracking-widest text-[var(--text-tertiary)] uppercase mb-3">
                    How did you hear about us?
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {REFERRAL_OPTIONS.map((opt) => {
                      const active = data.referralSource === opt.id;
                      return (
                        <button type="button"
                          key={opt.id}
                          onClick={() => setData((prev) => ({ ...prev, referralSource: opt.id }))}
                          className={cn(
                            "flex items-center gap-1.5 p-[8px_14px] rounded-xl border border-solid text-[13px] font-semibold cursor-pointer transition-all duration-200",
                            active ? "border-[var(--accent-primary)] bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent)] text-[var(--accent-primary)]" : "border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                          )}
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
                <div className="text-[12px] font-extrabold tracking-widest text-[var(--text-tertiary)] uppercase mb-3">
                  {stepLabels[1]}
                </div>
                <h2 className="text-[32px] font-bold text-[var(--text-primary)] leading-tight mb-2 tracking-tight">
                  Get the best prompts & templates weekly. For free.
                </h2>
                <p className="text-[14px] text-[var(--text-secondary)] mb-8 leading-relaxed">
                  Subscribe to design drops, prompt engineering guides, and major product
                  updates.
                </p>

                <div className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] rounded-2xl p-6 mb-6">
                  <div className="block text-[12px] font-extrabold tracking-widest text-[var(--text-tertiary)] uppercase mb-4">
                    Subscribe to updates
                  </div>
                  <p className="text-[14px] text-[var(--text-secondary)] mb-5 leading-relaxed">
                    Email the best prompts, remixable design drops, and major product updates.
                    We will send a confirmation email first.
                  </p>
                  <div className="flex gap-2.5">
                    <div className="relative flex-1">
                      <Envelope
                        size={16}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                      />
                      <input aria-label="your@email.com" type="email"
                        placeholder="your@email.com"
                        value={data.email}
                        onChange={(e) => {
                          setData((prev) => ({ ...prev, email: e.target.value }));
                          setEmailError("");
                        }}
                        className={cn(
                          "w-full p-[12px_14px_12px_40px] rounded-xl border border-solid bg-[var(--bg-primary)] text-[var(--text-primary)] text-[14px] outline-none font-inherit transition-all",
                          emailError ? "border-[#ef4444]" : "border-[var(--border-subtle)] focus:border-[var(--accent-primary)]"
                        )}
                      />
                    </div>
                    <button type="button"
                      onClick={() => {
                        if (data.email && validateEmail(data.email)) {
                          setData((prev) => ({ ...prev, subscribed: true }));
                        } else if (data.email) {
                          setEmailError("Please enter a valid email.");
                        }
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-5 rounded-xl border-none text-white text-[13px] font-bold cursor-pointer whitespace-nowrap transition-colors",
                        data.subscribed ? "bg-green-500" : "bg-[var(--accent-primary)] hover:opacity-90"
                      )}
                    >
                      {data.subscribed ? <Check size={16} weight="bold" /> : <Envelope size={16} />}
                      {data.subscribed ? "Subscribed" : "Subscribe for free"}
                    </button>
                  </div>
                  {emailError && (
                    <p className="text-[12px] text-[#ef4444] mt-2 m-0">{emailError}</p>
                  )}
                </div>

                {/* Preview card */}
                <div className="bg-gradient-to-br from-[var(--accent-primary)]/10 to-blue-500/10 border border-solid border-[var(--border-subtle)] rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[var(--accent-primary)]/15 flex items-center justify-center shrink-0">
                    <MagicWand size={24} className="text-[var(--accent-primary)]" weight="duotone" />
                  </div>
                  <div>
                    <div className="text-[14px] font-bold text-[var(--text-primary)] mb-1">
                      Weekly Design Drops
                    </div>
                    <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
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
                <div className="text-[12px] font-extrabold tracking-widest text-[var(--text-tertiary)] uppercase mb-3">
                  {stepLabels[2]}
                </div>
                <h2 className="text-[32px] font-bold text-[var(--text-primary)] leading-tight mb-2 tracking-tight">
                  3 Steps to Start
                </h2>
                <p className="text-[14px] text-[var(--text-secondary)] mb-6 leading-relaxed">
                  Watch how Allternit turns your first prompt into a shipped design system.
                </p>

                {/* Video Player */}
                <VideoPlayer />

                {/* Feature Cards */}
                <div className="grid grid-cols-3 gap-3 mb-2">
                  {WALKTHROUGH_FEATURES.map((feat, idx) => (
                    <div
                      key={`studioonboardingwizard-${idx}`}
                      className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] rounded-xl p-4.5 flex flex-col gap-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[var(--accent-primary)]/12 flex items-center justify-center text-[var(--accent-primary)] text-[12px] font-extrabold">
                          {feat.step}
                        </div>
                        <div className="text-[var(--text-secondary)]">{feat.icon}</div>
                      </div>
                      <div className="text-[12px] font-extrabold tracking-widest text-[var(--text-tertiary)] uppercase">
                        {feat.title}
                      </div>
                      <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed m-0">
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
        <div className="p-[16px_24px_20px] border-t border-solid border-[var(--border-subtle)] flex items-center justify-between">
          <button type="button"
            onClick={onSkip || onComplete}
            className="bg-transparent border-none text-[var(--text-tertiary)] text-[13px] font-medium cursor-pointer p-[8px_0] hover:text-[var(--text-secondary)] transition-colors"
          >
            Skip for now
          </button>

          <div className="flex items-center gap-2.5">
            {step > 0 && (
              <button type="button"
                onClick={handleBack}
                className="p-[10px_18px] rounded-xl bg-[var(--surface-hover)] border border-solid border-[var(--border-subtle)] text-[var(--text-secondary)] text-[13px] font-semibold cursor-pointer hover:bg-[var(--surface-active)] transition-colors"
              >
                Back
              </button>
            )}
            <button type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              className={cn(
                "flex items-center gap-1.5 p-[10px_20px] rounded-xl border-none text-white text-[13px] font-bold transition-all duration-200",
                canProceed() ? "bg-[var(--accent-primary)] cursor-pointer hover:opacity-90" : "bg-[var(--surface-hover)] text-[var(--text-tertiary)] cursor-not-allowed"
              )}
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
