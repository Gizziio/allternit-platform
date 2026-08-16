"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Sparkle,
  Robot,
  ArrowRight,
  ArrowLeft,
  ChatTeardropText,
  Code,
  ShieldCheck,
  Wrench,
  Lightning,
  Brain,
  Globe,
  MagnifyingGlass,
  Palette,
  UsersThree,
  UploadSimple,
  FileZip,
  Warning,
  CheckCircle,
} from "@phosphor-icons/react";
import { STUDIO_THEME } from "../AgentView.constants";
import { importBotFromZip, previewBotImport, type BotImportResult } from "@/lib/bots/bot-import";
import { BOT_TEMPLATES, type BotTemplate } from "@/lib/bots/bots.manifest";
import type { Agent } from "@/lib/agents";

interface CreateAgentLandingProps {
  onStart: () => void;
  onBack?: () => void;
  onBrowseAgents?: () => void;
  onBotImported?: (agent: Agent) => void;
  onStartFromTemplate?: (template: BotTemplate) => void;
}

const FEATURES = [
  {
    icon: Brain,
    title: "Own the personality",
    description: "Backstory, traits, voice, and guardrails make every agent feel distinct.",
    color: "var(--accent-primary)",
  },
  {
    icon: Wrench,
    title: "Plug in skills",
    description: "Give agents tools, surfaces, and capabilities they can actually use.",
    color: "var(--status-info)",
  },
  {
    icon: ShieldCheck,
    title: "Set the rules",
    description: "Trust tiers, hard bans, and approval gates keep agents safe by default.",
    color: "var(--status-success)",
  },
  {
    icon: Lightning,
    title: "Run anywhere",
    description: "Deploy to chat, code, cowork, and design — then monitor from Analytics.",
    color: "var(--status-warning)",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

function OrbitingCard({
  icon: Icon,
  label,
  angle,
  radius,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  angle: number;
  radius: number;
  delay: number;
}) {
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * radius;
  const y = Math.sin(rad) * radius;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5 }}
      className="absolute flex flex-col items-center gap-1.5"
      style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, translateX: "-50%", translateY: "-50%" }}
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3 + delay, repeat: Infinity, ease: "easeInOut" }}
        className="flex flex-col items-center gap-1.5 rounded-xl border px-3 py-2.5 shadow-lg backdrop-blur-md"
        style={{
          background: "color-mix(in srgb, var(--surface-panel) 80%, transparent)",
          borderColor: STUDIO_THEME.borderSubtle,
          boxShadow: "0 12px 32px -12px rgba(0,0,0,0.35)",
        }}
      >
        <Icon size={22} weight="duotone" style={{ color: STUDIO_THEME.accent }} />
        <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: STUDIO_THEME.textSecondary }}>
          {label}
        </span>
      </motion.div>
    </motion.div>
  );
}

function AgentBuilderIllustration() {
  return (
    <div className="relative mx-auto h-[320px] w-[320px] sm:h-[400px] sm:w-[400px]">
      {/* Orbital rings */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 rounded-full border border-dashed"
        style={{ borderColor: STUDIO_THEME.accent30 }}
      />
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        className="absolute inset-8 rounded-full border border-dashed"
        style={{ borderColor: STUDIO_THEME.accent14 }}
      />
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        className="absolute inset-16 rounded-full border"
        style={{ borderColor: STUDIO_THEME.accent30 }}
      />

      {/* Connector dots along outer ring */}
      {[0, 72, 144, 216, 288].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <motion.div
            key={deg}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{
              left: `calc(50% + ${Math.cos(rad) * 50}%)`,
              top: `calc(50% + ${Math.sin(rad) * 50}%)`,
              translateX: "-50%",
              translateY: "-50%",
              background: STUDIO_THEME.accent,
            }}
            animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.4, 1] }}
            transition={{ duration: 2, repeat: Infinity, delay: deg / 360 * 2 }}
          />
        );
      })}

      {/* Central orb */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ background: STUDIO_THEME.accent30, width: 140, height: 140, left: -70, top: -70 }}
        />
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="relative flex h-28 w-28 items-center justify-center rounded-full border-2 sm:h-32 sm:w-32"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${STUDIO_THEME.accent14}, ${STUDIO_THEME.accent30})`,
            borderColor: STUDIO_THEME.accent30,
            boxShadow: `0 0 60px ${STUDIO_THEME.accent30}`,
          }}
        >
          <Robot size={56} weight="duotone" style={{ color: STUDIO_THEME.accent }} />
        </motion.div>
      </div>

      {/* Connection lines */}
      <svg
        className="pointer-events-none absolute inset-0"
        viewBox="0 0 400 400"
        style={{ overflow: "visible" }}
      >
        {[0, 90, 180, 270].map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const x2 = 200 + Math.cos(rad) * 150;
          const y2 = 200 + Math.sin(rad) * 150;
          return (
            <motion.line
              key={deg}
              x1={200}
              y1={200}
              x2={x2}
              y2={y2}
              stroke={STUDIO_THEME.accent}
              strokeWidth={1}
              strokeDasharray="4 4"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.35 }}
              transition={{ duration: 1.2, delay: 0.4 + i * 0.15 }}
            />
          );
        })}
      </svg>

      {/* Orbiting cards */}
      <OrbitingCard icon={ChatTeardropText} label="Chat" angle={0} radius={150} delay={0.2} />
      <OrbitingCard icon={Code} label="Code" angle={90} radius={150} delay={0.4} />
      <OrbitingCard icon={ShieldCheck} label="Guardrails" angle={180} radius={150} delay={0.6} />
      <OrbitingCard icon={Globe} label="Web" angle={270} radius={150} delay={0.8} />

      {/* Chat preview bubble */}
      <motion.div
        initial={{ opacity: 0, y: -20, rotate: 4 }}
        animate={{ opacity: 1, y: 0, rotate: 2 }}
        transition={{ delay: 1.1, duration: 0.5 }}
        className="absolute left-2 top-8 sm:left-6 sm:top-14"
      >
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          className="w-48 overflow-hidden rounded-2xl rounded-tl-none border shadow-xl backdrop-blur-md"
          style={{
            background: "color-mix(in srgb, var(--surface-panel) 85%, transparent)",
            borderColor: STUDIO_THEME.borderSubtle,
            boxShadow: "0 16px 40px -12px rgba(0,0,0,0.4)",
          }}
        >
          <div className="p-3">
            <div className="mb-2 flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full"
                style={{ background: STUDIO_THEME.accent14 }}
              >
                <ChatTeardropText size={14} weight="duotone" style={{ color: STUDIO_THEME.accent }} />
              </div>
              <span className="text-[11px] font-semibold" style={{ color: STUDIO_THEME.textSecondary }}>
                You
              </span>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: STUDIO_THEME.textPrimary }}>
              Build a React component that fetches agent stats and renders cards.
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Agent preview card */}
      <motion.div
        initial={{ opacity: 0, y: 20, rotate: -4 }}
        animate={{ opacity: 1, y: 0, rotate: -2 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="absolute bottom-2 right-2 sm:bottom-6 sm:right-6"
      >
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="w-56 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md"
          style={{
            background: "color-mix(in srgb, var(--surface-panel) 85%, transparent)",
            borderColor: STUDIO_THEME.borderSubtle,
            boxShadow: "0 20px 50px -16px rgba(0,0,0,0.45)",
          }}
        >
          <div
            className="h-1.5 w-full"
            style={{ background: `linear-gradient(to right, ${STUDIO_THEME.accent}, var(--accent-secondary))` }}
          />
          <div className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: STUDIO_THEME.accent14 }}
              >
                <Robot size={22} weight="duotone" style={{ color: STUDIO_THEME.accent }} />
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: STUDIO_THEME.textPrimary }}>
                  Engineering Agent
                </div>
                <div className="text-[11px]" style={{ color: STUDIO_THEME.textMuted }}>
                  GPT-4o · Workspace scope
                </div>
              </div>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {["Code", "Review", "Terminal"].map((chip) => (
                <span
                  key={chip}
                  className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: STUDIO_THEME.accent10, color: STUDIO_THEME.accent }}
                >
                  {chip}
                </span>
              ))}
            </div>
            <div
              className="rounded-lg border p-2.5 text-[11px] leading-relaxed"
              style={{ background: "color-mix(in srgb, var(--surface-hover) 60%, transparent)", borderColor: STUDIO_THEME.borderSubtle }}
            >
              <span style={{ color: STUDIO_THEME.textMuted }}>I can write tests, review PRs, and run shell commands in the workspace.</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export function CreateAgentLanding({ onStart, onBack, onBrowseAgents, onBotImported, onStartFromTemplate }: CreateAgentLandingProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [importSuccess, setImportSuccess] = React.useState<BotImportResult | null>(null);

  const handleFileSelect = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsImporting(true);
      setImportError(null);
      setImportSuccess(null);

      try {
        const preview = await previewBotImport(file);
        if (!preview.valid) {
          setImportError(`Invalid bot package: ${preview.errors.join('; ')}`);
          setIsImporting(false);
          return;
        }

        const result = await importBotFromZip(file, { importPrompt: 'Import into Allternit Agent Studio.' });
        if (!result.success || !result.agent) {
          setImportError(result.error ?? 'Import failed');
          setIsImporting(false);
          return;
        }

        setImportSuccess(result);
        onBotImported?.(result.agent);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Import failed');
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [onBotImported]
  );

  return (
    <div className="relative h-full w-full overflow-y-auto bg-[var(--shell-frame-bg)]">
      {/* Animated mesh background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
          className="absolute -left-1/4 -top-1/4 h-[70vw] w-[70vw] rounded-full blur-[140px]"
          style={{ background: `radial-gradient(circle, ${STUDIO_THEME.accent14} 0%, transparent 70%)` }}
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.2 }}
          className="absolute -bottom-1/4 -right-1/4 h-[60vw] w-[60vw] rounded-full blur-[120px]"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--accent-secondary) 14%, transparent) 0%, transparent 70%)",
          }}
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.4 }}
          className="absolute left-1/3 top-1/2 h-[40vw] w-[40vw] rounded-full blur-[100px]"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--status-info) 10%, transparent) 0%, transparent 70%)",
          }}
        />
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto flex min-h-full max-w-6xl flex-col items-center px-6 py-10"
      >
        {/* Hero split */}
        <div className="grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Left copy */}
          <motion.div variants={fadeUp} className="order-2 text-center lg:order-1 lg:text-left">
            <div
              className="mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wider"
              style={{
                background: STUDIO_THEME.accent10,
                borderColor: STUDIO_THEME.accent30,
                color: STUDIO_THEME.accent,
              }}
            >
              <Sparkle size={14} weight="duotone" />
              Agent Studio
            </div>

            <h1
              className="mb-5 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
              style={{ color: STUDIO_THEME.textPrimary }}
            >
              Build agents that{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${STUDIO_THEME.accent}, var(--accent-secondary))`,
                }}
              >
                work for you
              </span>
            </h1>
            <p
              className="mb-8 text-base leading-relaxed sm:text-lg"
              style={{ color: STUDIO_THEME.textSecondary }}
            >
              Create autonomous AI teammates with their own identity, skills, and guardrails.
              Deploy them across every surface in Allternit and watch them get things done.
            </p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <motion.button
                type="button"
                onClick={onStart}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="group flex items-center gap-2.5 rounded-xl px-7 py-3.5 text-[15px] font-semibold shadow-lg transition-shadow hover:shadow-xl"
                style={{
                  background: `linear-gradient(135deg, ${STUDIO_THEME.accent}, var(--accent-secondary))`,
                  color: "var(--ui-text-inverse)",
                  boxShadow: `0 12px 32px -10px ${STUDIO_THEME.accent30}`,
                }}
              >
                <Robot size={22} weight="duotone" />
                Start building
                <ArrowRight
                  size={18}
                  className="transition-transform duration-200 group-hover:translate-x-1"
                />
              </motion.button>
              <motion.button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                whileHover={{ scale: isImporting ? 1 : 1.03 }}
                whileTap={{ scale: isImporting ? 1 : 0.98 }}
                className="flex items-center gap-2 rounded-xl border px-6 py-3.5 text-[15px] font-medium backdrop-blur-sm transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  borderColor: STUDIO_THEME.border,
                  color: STUDIO_THEME.textSecondary,
                  background: "color-mix(in srgb, var(--surface-panel) 60%, transparent)",
                }}
              >
                {isImporting ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Importing…
                  </>
                ) : (
                  <>
                    <UploadSimple size={18} />
                    Import bot
                  </>
                )}
              </motion.button>
              {(onBrowseAgents || onBack) && (
                <motion.button
                  type="button"
                  onClick={onBrowseAgents ?? onBack}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 rounded-xl border px-6 py-3.5 text-[15px] font-medium backdrop-blur-sm transition-colors hover:bg-[var(--surface-hover)]"
                  style={{
                    borderColor: STUDIO_THEME.border,
                    color: STUDIO_THEME.textSecondary,
                    background: "color-mix(in srgb, var(--surface-panel) 60%, transparent)",
                  }}
                >
                  {onBrowseAgents ? (
                    <>
                      <ArrowRight size={18} />
                      Browse agents
                    </>
                  ) : (
                    <>
                      <ArrowLeft size={18} />
                      Back to agents
                    </>
                  )}
                </motion.button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {(importError || importSuccess) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px]"
                style={{
                  background: importError
                    ? 'color-mix(in srgb, var(--status-error) 10%, transparent)'
                    : 'color-mix(in srgb, var(--status-success) 10%, transparent)',
                  borderColor: importError
                    ? 'color-mix(in srgb, var(--status-error) 30%, transparent)'
                    : 'color-mix(in srgb, var(--status-success) 30%, transparent)',
                  color: importError ? 'var(--status-error)' : 'var(--status-success)',
                }}
              >
                {importError ? <Warning size={18} /> : <CheckCircle size={18} />}
                <span>
                  {importError ??
                    `Imported ${importSuccess?.agent?.name}. ${importSuccess?.warnings.length
                      ? `${importSuccess.warnings.length} warning(s).`
                      : ''}`}
                </span>
              </motion.div>
            )}
          </motion.div>

          {/* Right illustration */}
          <motion.div
            variants={fadeUp}
            className="order-1 flex items-center justify-center lg:order-2"
          >
            <AgentBuilderIllustration />
          </motion.div>
        </div>

        {/* Templates */}
        <motion.div variants={fadeUp} className="mt-16 w-full">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: STUDIO_THEME.textPrimary }}>
              Start from a template
            </h2>
            <span className="text-[12px] font-medium" style={{ color: STUDIO_THEME.textMuted }}>
              Or build your own
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BOT_TEMPLATES.map((template, i) => {
              const Icon = template.icon;
              const bot = template.create();
              const accentColor = bot.botProfile?.accentColor ?? STUDIO_THEME.accent;
              return (
                <motion.button
                  key={template.id}
                  type="button"
                  onClick={() => onStartFromTemplate?.(template)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.08, duration: 0.4 }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  className="group relative overflow-hidden rounded-2xl border p-5 text-left transition-colors"
                  style={{
                    background: `linear-gradient(180deg, color-mix(in srgb, var(--surface-panel) 70%, transparent), color-mix(in srgb, var(--surface-hover) 70%, transparent))`,
                    borderColor: STUDIO_THEME.borderSubtle,
                  }}
                >
                  <div
                    className="absolute left-0 top-0 h-full w-1 transition-all group-hover:w-1.5"
                    style={{ background: accentColor }}
                  />
                  <div
                    className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{
                      background: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
                      color: accentColor,
                    }}
                  >
                    <Icon size={24} />
                  </div>
                  <h3 className="mb-1 text-sm font-semibold" style={{ color: STUDIO_THEME.textPrimary }}>
                    {bot.botProfile?.displayName ?? bot.name}
                  </h3>
                  <p className="text-[12px] leading-relaxed" style={{ color: STUDIO_THEME.textMuted }}>
                    {bot.description}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Features */}
        <motion.div variants={fadeUp} className="mt-16 w-full">
          <h2
            className="mb-6 text-center text-sm font-semibold uppercase tracking-widest"
            style={{ color: STUDIO_THEME.textMuted }}
          >
            Everything you need
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 + i * 0.08, duration: 0.4 }}
                  whileHover={{ y: -4 }}
                  className="group rounded-2xl border p-5 transition-colors hover:border-[var(--accent-primary)]"
                  style={{
                    background: `linear-gradient(180deg, color-mix(in srgb, var(--surface-panel) 60%, transparent), color-mix(in srgb, var(--surface-hover) 60%, transparent))`,
                    borderColor: STUDIO_THEME.borderSubtle,
                  }}
                >
                  <motion.div
                    className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{
                      background: `color-mix(in srgb, ${feature.color} 14%, transparent)`,
                      color: feature.color,
                    }}
                    whileHover={{ rotate: [0, -10, 10, 0], scale: 1.08 }}
                    transition={{ duration: 0.5 }}
                  >
                    <Icon size={24} weight="duotone" />
                  </motion.div>
                  <h3 className="mb-1 text-sm font-semibold" style={{ color: STUDIO_THEME.textPrimary }}>
                    {feature.title}
                  </h3>
                  <p className="text-[12px] leading-relaxed" style={{ color: STUDIO_THEME.textMuted }}>
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
