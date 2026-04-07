'use client';

/**
 * OnboardingFlow — Production-quality setup wizard
 *
 * Layout:
 *  - Welcome / Done: single-column hero, full card width
 *  - Inner steps: left sidebar (step nav) + right content panel
 *
 * Animations (framer-motion):
 *  - Card entrance: fade + scale from 0.96
 *  - Step transitions: direction-aware horizontal slide
 *  - Option cards: selection micro-animations
 *
 * Colors: 100% CSS custom properties — zero hardcoded values except
 *  ThemeStep swatches (which intentionally preview theme colours).
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  CheckCircle,
  CaretRight,
  CaretLeft,
  HardDrive,
  Cloud,
  Desktop,
  WifiHigh,
  Eye,
  EyeSlash,
  Sparkle,
  Sun,
  Moon,
  Monitor,
  ArrowRight,
  Key,
  Lock,
  ArrowSquareOut,
  Warning,
  ArrowClockwise,
  ChatCircle,
  Robot,
  Code,
  Globe,
  ShieldCheck,
  Lightning,
} from '@phosphor-icons/react';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useThemeStore, getSystemTheme } from '@/design/ThemeStore';
import { GizziMascot } from '../ai-elements/GizziMascot';
import { MatrixLogo } from '../ai-elements/MatrixLogo';
import { AuthPreview } from '../auth/AuthPreview';
import {
  testSSHConnection,
  installBackend,
  type SSHConnectionConfig,
  type InstallProgress,
  VPS_PROVIDERS,
  savePurchaseIntent,
} from './ssh-service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardData {
  theme: 'light' | 'dark' | 'system';
  infraType: 'local' | 'connect' | 'purchase' | 'remote';
  sshConfig: SSHConnectionConfig;
  selectedModes: string[];
  workspacePath: string;
  defaultProvider?: string;
  defaultModelId?: string;
  apiKeysConfigured?: boolean;
  configuredKeys?: Record<string, string>; // provider -> key
}

type Screen = 'welcome' | 'infra' | 'appearance' | 'modes' | 'done';

const SCREEN_ORDER: Screen[] = ['welcome', 'infra', 'appearance', 'modes', 'done'];

const INNER_STEPS = [
  { key: 'infra' as const,      num: 1, label: 'Where it runs', hint: 'Your computer or a server' },
  { key: 'appearance' as const, num: 2, label: 'Style',         hint: 'Dark, light, or system' },
  { key: 'modes' as const,      num: 3, label: 'Your AI',       hint: 'Connect your brain' },
];

function screenIdx(s: Screen) { return SCREEN_ORDER.indexOf(s); }

// ─── Animation variants ───────────────────────────────────────────────────────

const CARD_ENTRANCE = {
  hidden:  { opacity: 0, scale: 0.96, y: 8 },
  visible: { opacity: 1, scale: 1,    y: 0, transition: { duration: 0.28, ease: [0.25, 0.1, 0.25, 1] } },
};

const stepVariants = {
  enter:  (d: number) => ({ x: d * 36, opacity: 0 }),
  center: {
    x: 0, opacity: 1,
    transition: { duration: 0.24, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: (d: number) => ({
    x: d * -36, opacity: 0,
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
  }),
};

// ─── Step sidebar ─────────────────────────────────────────────────────────────

function StepSidebar({ screen }: { screen: Screen }) {
  const cIdx = screenIdx(screen);
  return (
    <div style={{
      width: 196,
      flexShrink: 0,
      background: 'var(--surface-panel)',
      borderRight: '1px solid var(--ui-border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      padding: '28px 20px',
      gap: 0,
    }}>
      {/* Logo + brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
        <MatrixLogo state="idle" size={36} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ui-text-primary)', letterSpacing: '-0.01em' }}>
            Allternit
          </div>
          <div style={{ fontSize: 10, color: 'var(--ui-text-muted)', marginTop: 1 }}>
            Setup wizard
          </div>
        </div>
      </div>

      {/* Step list with connecting lines */}
      <div style={{ flex: 1 }}>
        {INNER_STEPS.map((step, i) => {
          const stepScreenIdx = i + 1;
          const isDone = cIdx > stepScreenIdx;
          const isActive = cIdx === stepScreenIdx;

          return (
            <div key={step.key} style={{ display: 'flex', gap: 12 }}>
              {/* Dot + line column */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24 }}>
                <motion.div
                  animate={{
                    background: isDone ? 'var(--accent-primary)' : isActive
                      ? 'color-mix(in srgb, var(--accent-primary) 12%, var(--surface-panel))'
                      : 'var(--surface-panel)',
                    borderColor: isDone || isActive ? 'var(--accent-primary)' : 'var(--ui-border-default)',
                  }}
                  transition={{ duration: 0.2 }}
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    border: '2px solid',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {isDone ? (
                    <Check weight="bold" size={11} style={{ color: 'var(--text-inverse)' }} />
                  ) : (
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: isActive ? 'var(--accent-primary)' : 'var(--ui-text-muted)',
                    }}>
                      {step.num}
                    </span>
                  )}
                </motion.div>

                {i < INNER_STEPS.length - 1 && (
                  <motion.div
                    animate={{ background: cIdx > stepScreenIdx + 1 ? 'var(--accent-primary)' : 'var(--ui-border-subtle)' }}
                    transition={{ duration: 0.3 }}
                    style={{ width: 2, flex: 1, minHeight: 28, marginBlock: 4, borderRadius: 1 }}
                  />
                )}
              </div>

              {/* Text */}
              <div style={{ paddingTop: 3, paddingBottom: i < INNER_STEPS.length - 1 ? 28 : 0 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  color: isDone || isActive ? 'var(--ui-text-primary)' : 'var(--ui-text-muted)',
                  transition: 'color 0.2s',
                  lineHeight: 1.3,
                }}>
                  {step.label}
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'var(--ui-text-muted)',
                  marginTop: 2,
                  lineHeight: 1.4,
                }}>
                  {step.hint}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        fontSize: 11, color: 'var(--ui-text-muted)', lineHeight: 1.6,
        borderTop: '1px solid var(--ui-border-subtle)',
        paddingTop: 16,
      }}>
        3 steps · takes<br />
        <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>~90 seconds</span>
      </div>
    </div>
  );
}

// ─── Rotating capability deck (welcome screen marketing) ─────────────────────

const DECK_CARDS = [
  {
    label: 'A:// chat',
    sub: 'Any AI model. One clean interface, every conversation.',
    accent: '#6366f1',
    Icon: ChatCircle,
  },
  {
    label: 'A:// agents',
    sub: 'Multi-step tasks done autonomously — come back to finished work.',
    accent: '#f59e0b',
    Icon: Robot,
  },
  {
    label: 'A:// code',
    sub: 'Write, review, and ship code with AI at your side.',
    accent: '#10b981',
    Icon: Code,
  },
  {
    label: 'A:// browser',
    sub: 'AI that navigates the web, reads pages, and acts on your behalf.',
    accent: '#ec4899',
    Icon: Globe,
  },
  {
    label: 'A:// private',
    sub: 'Your data stays on your infrastructure. Nothing leaves without you.',
    accent: '#06b6d4',
    Icon: ShieldCheck,
  },
];

function RotatingDeck() {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const t = setInterval(() => {
      setDirection(1);
      setActive(i => (i + 1) % DECK_CARDS.length);
    }, 3200);
    return () => clearInterval(t);
  }, []);

  const card = DECK_CARDS[active];

  return (
    <div style={{ position: 'relative', width: '100%', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Ghost card behind */}
      <div style={{
        position: 'absolute',
        width: 260,
        height: 100,
        borderRadius: 18,
        background: 'var(--surface-panel)',
        border: '1px solid var(--ui-border-subtle)',
        transform: 'translateY(-10px) scale(0.93)',
        opacity: 0.35,
        zIndex: 1,
      }} />

      {/* Active card */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={active}
          custom={direction}
          initial={{ x: direction * 48, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direction * -48, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          style={{
            position: 'relative',
            width: 280,
            borderRadius: 18,
            background: `color-mix(in srgb, ${card.accent} 8%, var(--shell-dialog-bg))`,
            border: `1px solid color-mix(in srgb, ${card.accent} 30%, var(--ui-border-subtle))`,
            boxShadow: `0 8px 32px color-mix(in srgb, ${card.accent} 18%, transparent)`,
            padding: '22px 24px',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `color-mix(in srgb, ${card.accent} 18%, transparent)`,
          }}>
            <card.Icon size={22} weight="bold" style={{ color: card.accent }} />
          </div>
          <div>
            <div style={{
              fontSize: 15, fontWeight: 700, color: 'var(--ui-text-primary)',
              letterSpacing: '-0.01em', lineHeight: 1.3, marginBottom: 4,
            }}>
              {card.label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ui-text-secondary)', lineHeight: 1.4 }}>
              {card.sub}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Dot indicators */}
      <div style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 5, zIndex: 3,
      }}>
        {DECK_CARDS.map((_, i) => (
          <button
            key={i}
            onClick={() => { setDirection(i > active ? 1 : -1); setActive(i); }}
            style={{
              width: i === active ? 20 : 6, height: 6,
              borderRadius: 3, border: 'none', cursor: 'pointer', padding: 0,
              background: i === active ? card.accent : 'var(--ui-border-default)',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Welcome screen ───────────────────────────────────────────────────────────

function WelcomeScreen({ onNext }: { onNext: () => void }) {
  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: '100%',
      minHeight: 0,
    }}>
      {/* Left — brand + copy + CTA */}
      <div style={{
        flex: '0 0 420px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '48px 52px',
        borderRight: '1px solid var(--ui-border-subtle)',
      }}>
        {/* Gizzi mascot */}
        <div style={{ marginBottom: 28 }}>
          <GizziMascot emotion="pleased" size={72} />
        </div>

        <h1 style={{
          fontSize: 32, fontWeight: 800, letterSpacing: '-0.035em',
          lineHeight: 1.15, marginBottom: 12,
          color: 'var(--ui-text-primary)',
        }}>
          Welcome to{' '}
          <span style={{ color: 'var(--accent-primary)' }}>Allternit.</span>
        </h1>

        <p style={{
          fontSize: 14, lineHeight: 1.7,
          color: 'var(--ui-text-secondary)',
          marginBottom: 32, maxWidth: 300,
        }}>
          Your private AI platform — any model, real agents, your own server.
          No subscriptions. No data sharing.
        </p>

        {/* Reassurance pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 13px', borderRadius: 999,
          background: 'color-mix(in srgb, var(--accent-primary) 8%, var(--surface-panel))',
          border: '1px solid color-mix(in srgb, var(--accent-primary) 18%, transparent)',
          fontSize: 11, color: 'var(--ui-text-secondary)',
          marginBottom: 28, alignSelf: 'flex-start',
        }}>
          <Sparkle size={11} style={{ color: 'var(--accent-primary)' }} weight="fill" />
          90 seconds · no technical experience needed
        </div>

        {/* CTA */}
        <motion.button
          onClick={onNext}
          whileHover={{ scale: 1.02, boxShadow: '0 8px 32px color-mix(in srgb, var(--accent-primary) 40%, transparent)' }}
          whileTap={{ scale: 0.98 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 28px', borderRadius: 999,
            background: 'var(--accent-primary)',
            color: 'var(--text-inverse)',
            fontSize: 15, fontWeight: 700,
            border: 'none', cursor: 'pointer',
            boxShadow: 'var(--shadow-md)',
            alignSelf: 'flex-start',
          }}
        >
          Get Started
          <ArrowRight weight="bold" size={16} />
        </motion.button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--ui-text-muted)', marginTop: 16 }}>
          Where it runs
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
          Style
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
          Your AI
        </div>
      </div>

      {/* Right — interactive A:// preview */}
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '24px 32px',
        background: 'color-mix(in srgb, var(--accent-primary) 3%, var(--surface-panel))',
        overflow: 'hidden',
      }}>
        <AuthPreview />
      </div>
    </div>
  );
}

// ─── Non-technical hint box ───────────────────────────────────────────────────

function HintBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 9,
      padding: '10px 13px', borderRadius: 12, marginBottom: 14,
      background: 'color-mix(in srgb, var(--accent-primary) 5%, var(--surface-panel))',
      border: '1px solid color-mix(in srgb, var(--accent-primary) 14%, transparent)',
    }}>
      <Sparkle size={13} weight="fill" style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 1 }} />
      <p style={{ fontSize: 12, color: 'var(--ui-text-secondary)', lineHeight: 1.55, margin: 0 }}>
        {children}
      </p>
    </div>
  );
}

// ─── Infrastructure step ──────────────────────────────────────────────────────

function InfraStep({ data, onUpdate }: { data: WizardData; onUpdate: (d: Partial<WizardData>) => void }) {
  const [showPw, setShowPw] = useState(false);
  const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'ok' | 'err'>('idle');
  const [connMsg, setConnMsg] = useState('');
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [installing, setInstalling] = useState(false);

  const options: { id: WizardData['infraType']; Icon: React.ElementType; label: string; desc: string }[] = [
    { id: 'local',    Icon: HardDrive, label: 'Use this computer',   desc: 'Easiest — runs right here, no extra cost' },
    { id: 'connect',  Icon: WifiHigh,  label: 'I have a server',     desc: 'Connect your VPS, NAS, or cloud box' },
    { id: 'purchase', Icon: Cloud,     label: 'Get a cloud server',  desc: 'We\'ll help you rent one from $4/mo' },
    { id: 'remote',   Icon: Desktop,   label: 'Remote desktop',      desc: 'Control a remote computer via the browser' },
  ];

  const testConn = async () => {
    setConnStatus('testing'); setConnMsg('Testing connection…');
    try {
      const r = await testSSHConnection(data.sshConfig);
      if (r.success) { setConnStatus('ok');  setConnMsg(r.info?.os ? `Connected — ${r.info.os}` : 'Connected'); }
      else            { setConnStatus('err'); setConnMsg(r.error || 'Connection failed'); }
    } catch (e) { setConnStatus('err'); setConnMsg(e instanceof Error ? e.message : 'Failed'); }
  };

  const doInstall = () => {
    setInstalling(true);
    installBackend(data.sshConfig, setProgress, (r) => {
      setInstalling(false);
      if (r.success) { setConnStatus('ok');  setConnMsg('Backend installed!'); }
      else           { setConnStatus('err'); setConnMsg(r.error || 'Installation failed'); }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HintBox>
        Think of this like choosing where to plug in Allternit's brain.
        Not sure? Pick <strong>"Use this computer"</strong> — you can always change it later.
      </HintBox>
      {options.map(({ id, Icon, label, desc }) => {
        const sel = data.infraType === id;
        return (
          <motion.button
            key={id}
            onClick={() => onUpdate({ infraType: id })}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px',
              borderRadius: 14,
              border: `2px solid ${sel ? 'var(--accent-primary)' : 'var(--ui-border-subtle)'}`,
              background: sel
                ? 'color-mix(in srgb, var(--accent-primary) 8%, var(--surface-panel))'
                : 'var(--surface-panel)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 150ms, background 150ms',
            }}
          >
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: sel
                ? 'color-mix(in srgb, var(--accent-primary) 16%, var(--surface-panel))'
                : 'var(--surface-panel-muted)',
              color: sel ? 'var(--accent-primary)' : 'var(--ui-text-muted)',
              transition: 'background 150ms, color 150ms',
            }}>
              <Icon size={18} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: 'var(--ui-text-primary)',
                lineHeight: 1.3,
              }}>
                {label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-muted)', marginTop: 2 }}>
                {desc}
              </div>
            </div>

            {/* Radio */}
            <motion.div
              animate={{
                background: sel ? 'var(--accent-primary)' : 'transparent',
                borderColor: sel ? 'var(--accent-primary)' : 'var(--ui-border-default)',
              }}
              style={{
                width: 18, height: 18, borderRadius: '50%',
                border: '2px solid',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {sel && <Check weight="bold" size={10} style={{ color: 'var(--text-inverse)' }} />}
            </motion.div>
          </motion.button>
        );
      })}

      {/* Local ready banner */}
      <AnimatePresence>
        {data.infraType === 'local' && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            style={{
              overflow: 'hidden',
              borderRadius: 12,
              background: 'var(--status-success-bg)',
              border: '1px solid color-mix(in srgb, var(--status-success) 25%, transparent)',
              padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <CheckCircle weight="fill" size={18} style={{ color: 'var(--status-success)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text-primary)' }}>
                Local backend detected
              </div>
              <div style={{ fontSize: 11, color: 'var(--ui-text-muted)' }}>
                Allternit is running on this machine — no setup needed.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SSH form — for Connect VPS and Remote Desktop */}
      <AnimatePresence>
        {(data.infraType === 'connect' || data.infraType === 'remote') && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              overflow: 'hidden',
              borderRadius: 14,
              background: 'var(--surface-panel)',
              border: '1px solid var(--ui-border-subtle)',
              padding: 16,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: 12 }}>
              SSH Details
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type="text" value={data.sshConfig.host}
                onChange={e => onUpdate({ sshConfig: { ...data.sshConfig, host: e.target.value } })}
                placeholder="Hostname or IP"
                style={inputStyle}
              />
              <input
                type="number" value={data.sshConfig.port}
                onChange={e => onUpdate({ sshConfig: { ...data.sshConfig, port: parseInt(e.target.value) || 22 } })}
                placeholder="22" style={{ ...inputStyle, width: 72, flexShrink: 0 }}
              />
            </div>

            <input
              type="text" value={data.sshConfig.username}
              onChange={e => onUpdate({ sshConfig: { ...data.sshConfig, username: e.target.value } })}
              placeholder="Username"
              style={{ ...inputStyle, width: '100%', marginBottom: 8 }}
            />

            {/* Auth type toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {(['key', 'password'] as const).map((type) => {
                const sel = data.sshConfig.authType === type;
                return (
                  <button
                    key={type}
                    onClick={() => onUpdate({ sshConfig: { ...data.sshConfig, authType: type } })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${sel ? 'var(--accent-primary)' : 'var(--ui-border-default)'}`,
                      background: sel ? 'color-mix(in srgb, var(--accent-primary) 10%, var(--surface-panel))' : 'transparent',
                      color: sel ? 'var(--accent-primary)' : 'var(--ui-text-muted)',
                      cursor: 'pointer', transition: 'all 150ms',
                    }}
                  >
                    {type === 'key' ? <Key size={12} /> : <Lock size={12} />}
                    {type === 'key' ? 'SSH Key' : 'Password'}
                  </button>
                );
              })}
            </div>

            {/* Auth fields */}
            {data.sshConfig.authType === 'password' ? (
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={data.sshConfig.password || ''}
                  onChange={e => onUpdate({ sshConfig: { ...data.sshConfig, password: e.target.value } })}
                  placeholder="Password"
                  style={{ ...inputStyle, width: '100%', paddingRight: 40 }}
                />
                <button
                  onClick={() => setShowPw(p => !p)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--ui-text-muted)', display: 'flex', padding: 0,
                  }}
                >
                  {showPw ? <EyeSlash size={14} /> : <Eye size={14} />}
                </button>
              </div>
            ) : (
              <input
                type="text" value={data.sshConfig.privateKey || '~/.ssh/id_rsa'}
                onChange={e => onUpdate({ sshConfig: { ...data.sshConfig, privateKey: e.target.value } })}
                placeholder="~/.ssh/id_rsa"
                style={{ ...inputStyle, width: '100%', marginBottom: 8 }}
              />
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: connMsg ? 8 : 0 }}>
              <button
                onClick={testConn} disabled={connStatus === 'testing' || installing}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  border: '1px solid var(--ui-border-default)',
                  background: 'transparent', color: 'var(--accent-primary)',
                  cursor: 'pointer', opacity: connStatus === 'testing' || installing ? 0.4 : 1,
                }}
              >
                {connStatus === 'testing' ? 'Testing…' : 'Test Connection'}
              </button>
              <button
                onClick={doInstall} disabled={connStatus !== 'ok' || installing}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  border: 'none',
                  background: connStatus === 'ok' ? 'var(--accent-primary)' : 'var(--surface-panel-muted)',
                  color: connStatus === 'ok' ? 'var(--text-inverse)' : 'var(--ui-text-muted)',
                  cursor: connStatus === 'ok' ? 'pointer' : 'not-allowed',
                  transition: 'background 200ms, color 200ms',
                }}
              >
                {installing ? 'Installing…' : 'Install Backend'}
              </button>
            </div>

            {connMsg && (
              <div style={{
                fontSize: 12, padding: '9px 12px', borderRadius: 10,
                background: connStatus === 'err' ? 'var(--status-error-bg)' : connStatus === 'ok' ? 'var(--status-success-bg)' : 'var(--surface-hover)',
                color: connStatus === 'err' ? 'var(--status-error)' : connStatus === 'ok' ? 'var(--status-success)' : 'var(--ui-text-secondary)',
              }}>
                {connMsg}
              </div>
            )}

            {progress && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ui-text-muted)', marginBottom: 6 }}>
                  <span>{progress.message}</span><span>{progress.progress}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--ui-border-subtle)', overflow: 'hidden' }}>
                  <motion.div
                    animate={{ width: `${progress.progress}%` }}
                    transition={{ duration: 0.4 }}
                    style={{ height: '100%', background: 'var(--accent-primary)', borderRadius: 2 }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase VPS panel */}
      <AnimatePresence>
        {data.infraType === 'purchase' && (
          <PurchaseVPSPanel sshConfig={data.sshConfig} onUpdate={onUpdate} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Purchase VPS panel ───────────────────────────────────────────────────────

function PurchaseVPSPanel({
  sshConfig,
  onUpdate,
}: {
  sshConfig: SSHConnectionConfig;
  onUpdate: (d: Partial<WizardData>) => void;
}) {
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'ok' | 'err'>('idle');
  const [connMsg, setConnMsg] = useState('');
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [installing, setInstalling] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  function openProvider(url: string, providerId: string) {
    setSelectedProvider(providerId);
    window.open(url, '_blank', 'noopener,noreferrer');
    // After opening, show the connect form after a short delay so the user
    // knows to come back and fill in their new VPS details.
    setTimeout(() => setShowConnectForm(true), 1500);
  }

  const testConn = async () => {
    setConnStatus('testing'); setConnMsg('Testing connection…');
    try {
      const r = await testSSHConnection(sshConfig);
      if (r.success) { setConnStatus('ok');  setConnMsg(r.info?.os ? `Connected — ${r.info.os}` : 'Connected'); }
      else            { setConnStatus('err'); setConnMsg(r.error || 'Connection failed'); }
    } catch (e) { setConnStatus('err'); setConnMsg(e instanceof Error ? e.message : 'Failed'); }
  };

  const doInstall = () => {
    setInstalling(true);
    installBackend(sshConfig, setProgress, (r) => {
      setInstalling(false);
      if (r.success) {
        setConnStatus('ok');
        setConnMsg('Backend installed!');
        if (selectedProvider) {
          savePurchaseIntent(selectedProvider, {
            expectedIp: sshConfig.host,
            rootPassword: sshConfig.password,
          });
        }
      } else {
        setConnStatus('err');
        setConnMsg(r.error || 'Installation failed');
      }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      style={{ overflow: 'hidden' }}
    >
      <div style={{
        borderRadius: 14,
        background: 'var(--surface-panel)',
        border: '1px solid var(--ui-border-subtle)',
        padding: 16,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent-primary)' }}>
          Choose a VPS Provider
        </div>

        {/* Provider cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {VPS_PROVIDERS.map((provider) => (
            <motion.button
              key={provider.id}
              onClick={() => openProvider(provider.url, provider.id)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 12, border: 'none', cursor: 'pointer', textAlign: 'left',
                background: selectedProvider === provider.id
                  ? 'color-mix(in srgb, var(--accent-primary) 8%, var(--surface-panel))'
                  : 'var(--surface-panel-muted)',
                outline: selectedProvider === provider.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                outlineOffset: 0,
                transition: 'outline-color 150ms, background 150ms',
              }}
            >
              {/* Logo */}
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: 'var(--surface-panel)',
                border: '1px solid var(--ui-border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                <img
                  src={provider.logo}
                  alt={provider.name}
                  width={20} height={20}
                  style={{ objectFit: 'contain' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text-primary)', lineHeight: 1.3 }}>
                  {provider.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ui-text-muted)', marginTop: 1 }}>
                  {provider.description}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)' }}>
                  {provider.startingPrice}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ui-text-muted)' }}>
                  Open <ArrowSquareOut size={10} />
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Tip */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          padding: '10px 12px', borderRadius: 10,
          background: 'color-mix(in srgb, var(--accent-primary) 6%, var(--surface-panel))',
          border: '1px solid color-mix(in srgb, var(--accent-primary) 15%, transparent)',
        }}>
          <Warning size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--ui-text-secondary)', lineHeight: 1.5 }}>
            After purchasing, come back here. Enter your VPS IP and root credentials below to install the Allternit backend automatically.
          </span>
        </div>

        {/* "I already have my VPS" toggle */}
        <button
          onClick={() => setShowConnectForm(f => !f)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
            border: '1px solid var(--ui-border-default)',
            background: 'transparent', color: 'var(--accent-primary)',
            cursor: 'pointer',
          }}
        >
          {showConnectForm ? '▲ Hide' : '▼ I already have my VPS — connect now'}
        </button>

        {/* SSH connect form (same as Connect VPS) */}
        <AnimatePresence>
          {showConnectForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ui-text-muted)' }}>
                  VPS Connection
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text" value={sshConfig.host}
                    onChange={e => onUpdate({ sshConfig: { ...sshConfig, host: e.target.value } })}
                    placeholder="VPS IP address"
                    style={inputStyle}
                  />
                  <input
                    type="number" value={sshConfig.port}
                    onChange={e => onUpdate({ sshConfig: { ...sshConfig, port: parseInt(e.target.value) || 22 } })}
                    placeholder="22" style={{ ...inputStyle, width: 72, flexShrink: 0 }}
                  />
                </div>

                <input
                  type="text" value={sshConfig.username || 'root'}
                  onChange={e => onUpdate({ sshConfig: { ...sshConfig, username: e.target.value } })}
                  placeholder="root"
                  style={{ ...inputStyle, width: '100%' }}
                />

                {/* Auth type toggle */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['password', 'key'] as const).map((type) => {
                    const sel = sshConfig.authType === type;
                    return (
                      <button
                        key={type}
                        onClick={() => onUpdate({ sshConfig: { ...sshConfig, authType: type } })}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          border: `1px solid ${sel ? 'var(--accent-primary)' : 'var(--ui-border-default)'}`,
                          background: sel ? 'color-mix(in srgb, var(--accent-primary) 10%, var(--surface-panel))' : 'transparent',
                          color: sel ? 'var(--accent-primary)' : 'var(--ui-text-muted)',
                          cursor: 'pointer', transition: 'all 150ms',
                        }}
                      >
                        {type === 'key' ? <Key size={12} /> : <Lock size={12} />}
                        {type === 'key' ? 'SSH Key' : 'Password'}
                      </button>
                    );
                  })}
                </div>

                {sshConfig.authType === 'password' ? (
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={sshConfig.password || ''}
                      onChange={e => onUpdate({ sshConfig: { ...sshConfig, password: e.target.value } })}
                      placeholder="Root password"
                      style={{ ...inputStyle, width: '100%', paddingRight: 40 }}
                    />
                    <button
                      onClick={() => setShowPw(p => !p)}
                      style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--ui-text-muted)', display: 'flex', padding: 0,
                      }}
                    >
                      {showPw ? <EyeSlash size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                ) : (
                  <input
                    type="text" value={sshConfig.privateKey || '~/.ssh/id_rsa'}
                    onChange={e => onUpdate({ sshConfig: { ...sshConfig, privateKey: e.target.value } })}
                    placeholder="~/.ssh/id_rsa"
                    style={{ ...inputStyle, width: '100%' }}
                  />
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={testConn} disabled={connStatus === 'testing' || installing}
                    style={{
                      flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      border: '1px solid var(--ui-border-default)',
                      background: 'transparent', color: 'var(--accent-primary)',
                      cursor: 'pointer', opacity: connStatus === 'testing' || installing ? 0.4 : 1,
                    }}
                  >
                    {connStatus === 'testing' ? 'Testing…' : 'Test Connection'}
                  </button>
                  <button
                    onClick={doInstall} disabled={connStatus !== 'ok' || installing}
                    style={{
                      flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                      border: 'none',
                      background: connStatus === 'ok' ? 'var(--accent-primary)' : 'var(--surface-panel-muted)',
                      color: connStatus === 'ok' ? 'var(--text-inverse)' : 'var(--ui-text-muted)',
                      cursor: connStatus === 'ok' ? 'pointer' : 'not-allowed',
                      transition: 'background 200ms, color 200ms',
                    }}
                  >
                    {installing ? 'Installing…' : 'Install Backend'}
                  </button>
                </div>

                {connMsg && (
                  <div style={{
                    fontSize: 12, padding: '9px 12px', borderRadius: 10,
                    background: connStatus === 'err' ? 'var(--status-error-bg)' : connStatus === 'ok' ? 'var(--status-success-bg)' : 'var(--surface-hover)',
                    color: connStatus === 'err' ? 'var(--status-error)' : connStatus === 'ok' ? 'var(--status-success)' : 'var(--ui-text-secondary)',
                  }}>
                    {connMsg}
                  </div>
                )}

                {progress && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ui-text-muted)', marginBottom: 6 }}>
                      <span>{progress.message}</span><span>{progress.progress}%</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--ui-border-subtle)', overflow: 'hidden' }}>
                      <motion.div
                        animate={{ width: `${progress.progress}%` }}
                        transition={{ duration: 0.4 }}
                        style={{ height: '100%', background: 'var(--accent-primary)', borderRadius: 2 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Appearance step ──────────────────────────────────────────────────────────

const THEME_OPTIONS: { id: 'dark' | 'light' | 'system'; label: string; desc: string; Icon: React.ElementType; swatches: [string, string, string] }[] = [
  { id: 'dark',   label: 'Dark',   desc: 'Sleek & focused',  Icon: Moon,    swatches: ['#1A1612', '#2A211A', '#3C2E24'] },
  { id: 'light',  label: 'Light',  desc: 'Clean & bright',   Icon: Sun,     swatches: ['#FDF8F3', '#F5EDE3', '#E8D9C8'] },
  { id: 'system', label: 'System', desc: 'Follows your OS',  Icon: Monitor, swatches: ['#1A1612', '#FDF8F3', '#B08D6E'] },
];

function AppearanceStep({ theme, onChange }: { theme: WizardData['theme']; onChange: (t: WizardData['theme']) => void; }) {
  const { setTheme: persistTheme } = useThemeStore();

  function handleThemeChange(t: WizardData['theme']) {
    // 1. Persist to ThemeStore (localStorage key 'allternit-theme-storage')
    persistTheme(t);
    // 2. Immediately apply data-theme on <html> for live preview
    if (typeof document !== 'undefined') {
      const resolved = t === 'system' ? getSystemTheme() : t;
      document.documentElement.setAttribute('data-theme', resolved);
    }
    // 3. Update wizard local state
    onChange(t);
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <HintBox>
        This only affects how the app looks — like dark mode on your phone. Your work and data are not affected. You can change this anytime in Settings.
      </HintBox>
      {THEME_OPTIONS.map((opt) => {
        const sel = theme === opt.id;
        return (
          <motion.button
            key={opt.id}
            onClick={() => handleThemeChange(opt.id)}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px', borderRadius: 14, border: 'none', cursor: 'pointer',
              textAlign: 'left',
              background: sel
                ? 'color-mix(in srgb, var(--accent-primary) 8%, var(--surface-panel))'
                : 'var(--surface-panel)',
              outline: sel ? '2px solid var(--accent-primary)' : '2px solid var(--ui-border-subtle)',
              outlineOffset: 0,
              transition: 'outline-color 150ms, background 150ms',
            }}
          >
            {/* Swatch strip */}
            <div style={{
              width: 52, height: 38, borderRadius: 10, overflow: 'hidden',
              display: 'flex', flexShrink: 0,
              border: '1px solid var(--ui-border-subtle)',
            }}>
              {opt.swatches.map((c, i) => (
                <div key={i} style={{ flex: 1, background: c }} />
              ))}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 13, fontWeight: 600,
                color: sel ? 'var(--accent-primary)' : 'var(--ui-text-primary)',
                transition: 'color 150ms',
              }}>
                {opt.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-muted)', marginTop: 2 }}>
                {opt.desc}
              </div>
            </div>

            <opt.Icon size={16} style={{ color: sel ? 'var(--accent-primary)' : 'var(--ui-text-muted)', flexShrink: 0, transition: 'color 150ms' }} />

            <motion.div
              animate={{
                background: sel ? 'var(--accent-primary)' : 'transparent',
                borderColor: sel ? 'var(--accent-primary)' : 'var(--ui-border-default)',
              }}
              style={{
                width: 18, height: 18, borderRadius: '50%', border: '2px solid',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              {sel && <Check weight="bold" size={10} style={{ color: 'var(--text-inverse)' }} />}
            </motion.div>
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── AI / Brain connector step ────────────────────────────────────────────────

interface DiscoveredModel {
  id: string;
  modelId: string;
  name: string;
  provider: string;
  source: string;
  badge?: string;
  size?: string;
}

interface DiscoveryResult {
  ollama: { running: boolean; models: DiscoveredModel[] };
  lmstudio: { running: boolean; models: DiscoveredModel[] };
  cli: DiscoveredModel[];
}

// ─── Provider brand logos (inline SVG) ────────────────────────────────────────

function AnthropicLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.304 3.541h-3.672l6.696 16.918h3.672zm-10.608 0L0 20.459h3.744l1.368-3.6h6.624l1.368 3.6h3.744L8.016 3.541zm-.264 10.656 1.944-5.112 1.944 5.112z" />
    </svg>
  );
}

function OpenAILogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  );
}

function GoogleGeminiLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C9.33 6.67 6.67 9.33 2 12c4.67 2.67 7.33 5.33 10 10 2.67-4.67 5.33-7.33 10-10C17.33 9.33 14.67 6.67 12 2z" fill="#4285F4"/>
    </svg>
  );
}

const CLOUD_PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    tagline: 'Best for analysis, long documents & nuanced reasoning',
    badge: 'Recommended',
    badgeColor: '#d97757',
    Logo: AnthropicLogo,
    logoBg: '#d97757',
    keyPlaceholder: 'sk-ant-…',
    keyHint: 'Get your key at console.anthropic.com',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    tagline: 'Best for coding, images & wide tool support',
    badge: null,
    badgeColor: '',
    Logo: OpenAILogo,
    logoBg: '#10A37F',
    keyPlaceholder: 'sk-…',
    keyHint: 'Get your key at platform.openai.com',
  },
  {
    id: 'google',
    name: 'Google AI',
    tagline: 'Best for real-time search & multimodal tasks',
    badge: null,
    badgeColor: '',
    Logo: GoogleGeminiLogo,
    logoBg: '#4285F4',
    keyPlaceholder: 'AIza…',
    keyHint: 'Get your key at aistudio.google.com',
  },
] as const;

type CloudProviderId = (typeof CLOUD_PROVIDERS)[number]['id'];
type KeyStatus = 'idle' | 'checking' | 'valid' | 'invalid';

function ModesStep({ data, onUpdate }: { data: WizardData; onUpdate: (d: Partial<WizardData>) => void }) {
  // Discovery state
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [scanning, setScanning] = useState(true);

  // Cloud key state
  const [expandedProvider, setExpandedProvider] = useState<CloudProviderId | null>(null);
  const [keyDraft, setKeyDraft] = useState<Partial<Record<CloudProviderId, string>>>({});
  const [keyStatus, setKeyStatus] = useState<Partial<Record<CloudProviderId, KeyStatus>>>({});
  const [keyModels, setKeyModels] = useState<Partial<Record<CloudProviderId, Array<{ id: string; name: string }>>>>({});
  const [keyError, setKeyError] = useState<Partial<Record<CloudProviderId, string>>>({});
  const [showKey, setShowKey] = useState<Partial<Record<CloudProviderId, boolean>>>({});

  const selected = data.defaultProvider;

  // Run discovery on mount
  useEffect(() => {
    setScanning(true);
    fetch('/api/onboarding/discover')
      .then((r) => r.json())
      .then((d) => setDiscovery(d as DiscoveryResult))
      .catch(() => setDiscovery({ ollama: { running: false, models: [] }, lmstudio: { running: false, models: [] }, cli: [] }))
      .finally(() => setScanning(false));
  }, []);

  // Validate an API key against the backend
  async function validateKey(provider: CloudProviderId) {
    const key = (keyDraft[provider] ?? '').trim();
    if (key.length < 10) return;

    setKeyStatus((s) => ({ ...s, [provider]: 'checking' }));
    setKeyError((s) => ({ ...s, [provider]: undefined }));

    try {
      const res = await fetch('/api/onboarding/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key }),
      });
      const json = await res.json() as { valid: boolean; models?: Array<{ id: string; name: string }>; error?: string };

      if (json.valid) {
        setKeyStatus((s) => ({ ...s, [provider]: 'valid' }));
        setKeyModels((s) => ({ ...s, [provider]: json.models ?? [] }));
        // Store the key + mark provider active
        const keys = { ...(data.configuredKeys ?? {}), [provider]: key };
        onUpdate({ configuredKeys: keys, apiKeysConfigured: true, defaultProvider: provider });
      } else {
        setKeyStatus((s) => ({ ...s, [provider]: 'invalid' }));
        setKeyError((s) => ({ ...s, [provider]: json.error ?? 'Key rejected' }));
      }
    } catch {
      setKeyStatus((s) => ({ ...s, [provider]: 'invalid' }));
      setKeyError((s) => ({ ...s, [provider]: 'Could not reach validation server' }));
    }
  }

  // Select a discovered local/CLI model
  function selectDiscovered(m: DiscoveredModel) {
    onUpdate({ defaultProvider: m.source, defaultModelId: m.modelId });
  }

  const allLocalModels: DiscoveredModel[] = [
    ...(discovery?.ollama.models ?? []),
    ...(discovery?.lmstudio.models ?? []),
    ...(discovery?.cli ?? []),
  ];

  const hasLocalModels = allLocalModels.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <HintBox>
        Connect the AI "brain" you want to use. If you have Ollama or other tools installed, we found them automatically. Or paste an API key from a cloud provider.
      </HintBox>

      {/* ── Local / CLI section ── */}
      <div>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
          color: 'var(--ui-text-muted)', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 7,
        }}>
          Found on this machine
          {scanning && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{ display: 'flex' }}
            >
              <ArrowClockwise size={11} style={{ color: 'var(--accent-primary)' }} />
            </motion.div>
          )}
        </div>

        {scanning && (
          <div style={{
            padding: '12px 14px', borderRadius: 12, fontSize: 12,
            color: 'var(--ui-text-muted)',
            background: 'var(--surface-panel)',
            border: '1px solid var(--ui-border-subtle)',
          }}>
            Scanning for Ollama, LM Studio and AI CLI tools…
          </div>
        )}

        {!scanning && !hasLocalModels && (
          <div style={{
            padding: '12px 14px', borderRadius: 12, fontSize: 12,
            color: 'var(--ui-text-muted)',
            background: 'var(--surface-panel)',
            border: '1px solid var(--ui-border-subtle)',
          }}>
            Nothing found — no Ollama, LM Studio or CLI agents detected. Use a cloud key below.
          </div>
        )}

        {!scanning && allLocalModels.map((m) => {
          const sel = selected === m.source && data.defaultModelId === m.modelId;
          return (
            <motion.button
              key={m.id}
              onClick={() => selectDiscovered(m)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                width: '100%', marginBottom: 6,
                padding: '11px 14px', borderRadius: 12,
                border: 'none', cursor: 'pointer', textAlign: 'left',
                background: sel
                  ? 'color-mix(in srgb, var(--accent-primary) 8%, var(--surface-panel))'
                  : 'var(--surface-panel)',
                outline: sel ? '2px solid var(--accent-primary)' : '2px solid var(--ui-border-subtle)',
                outlineOffset: 0,
                transition: 'outline-color 150ms, background 150ms',
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: sel
                  ? 'color-mix(in srgb, var(--accent-primary) 18%, var(--surface-panel))'
                  : 'var(--surface-panel-muted)',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
                color: sel ? 'var(--accent-primary)' : 'var(--ui-text-muted)',
                fontFamily: 'monospace',
              }}>
                {m.source === 'ollama' ? 'OL' : m.source === 'lmstudio' ? 'LM' : 'AI'}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text-primary)' }}>
                    {m.name}
                  </span>
                  {m.size && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4,
                      background: 'color-mix(in srgb, var(--ui-text-muted) 12%, transparent)',
                      color: 'var(--ui-text-muted)',
                    }}>
                      {m.size}
                    </span>
                  )}
                  {m.badge && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                      background: 'color-mix(in srgb, #10b981 15%, transparent)',
                      color: '#10b981', letterSpacing: '0.04em',
                    }}>
                      {m.badge}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ui-text-muted)', marginTop: 1 }}>
                  {m.modelId}
                </div>
              </div>

              <motion.div
                animate={{
                  background: sel ? 'var(--accent-primary)' : 'transparent',
                  borderColor: sel ? 'var(--accent-primary)' : 'var(--ui-border-default)',
                }}
                style={{
                  width: 17, height: 17, borderRadius: '50%', border: '2px solid',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                {sel && <Check weight="bold" size={9} style={{ color: 'var(--text-inverse)' }} />}
              </motion.div>
            </motion.button>
          );
        })}
      </div>

      {/* ── Cloud providers section ── */}
      <div>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
          color: 'var(--ui-text-muted)', marginBottom: 7,
        }}>
          Cloud AI (paste your API key)
        </div>

        {CLOUD_PROVIDERS.map((p) => {
          const isExpanded = expandedProvider === p.id;
          const status = keyStatus[p.id] ?? 'idle';
          const isValid = status === 'valid';
          const isChecking = status === 'checking';
          const models = keyModels[p.id] ?? [];
          const selectedModel = data.defaultModelId && data.defaultProvider === p.id
            ? data.defaultModelId : null;
          const sel = data.defaultProvider === p.id && isValid;

          return (
            <div key={p.id} style={{ marginBottom: 6 }}>
              {/* Provider row */}
              <motion.button
                onClick={() => setExpandedProvider(isExpanded ? null : p.id)}
                whileHover={{ scale: 1.005 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '11px 14px', borderRadius: isExpanded ? '12px 12px 0 0' : 12,
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: sel
                    ? 'color-mix(in srgb, var(--accent-primary) 8%, var(--surface-panel))'
                    : 'var(--surface-panel)',
                  outline: sel ? '2px solid var(--accent-primary)' : isExpanded ? '2px solid var(--ui-border-default)' : '2px solid var(--ui-border-subtle)',
                  outlineOffset: 0,
                  transition: 'outline-color 150ms, background 150ms, border-radius 100ms',
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: p.logoBg,
                  color: '#fff',
                }}>
                  <p.Logo size={18} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text-primary)' }}>
                      {p.name}
                    </span>
                    {p.badge && !isValid && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: `color-mix(in srgb, ${p.badgeColor} 15%, transparent)`,
                        color: p.badgeColor, letterSpacing: '0.04em',
                      }}>
                        {p.badge}
                      </span>
                    )}
                    {isValid && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: 'color-mix(in srgb, #10b981 15%, transparent)',
                        color: '#10b981', letterSpacing: '0.04em',
                      }}>
                        <Check weight="bold" size={9} style={{ marginRight: 2 }} /> Connected
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ui-text-muted)', marginTop: 1 }}>
                    {p.tagline}
                  </div>
                </div>

                <CaretRight
                  size={13}
                  style={{
                    color: 'var(--ui-text-muted)', flexShrink: 0,
                    transform: isExpanded ? 'rotate(90deg)' : 'none',
                    transition: 'transform 200ms',
                  }}
                />
              </motion.button>

              {/* Expandable key entry */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                    style={{
                      overflow: 'hidden',
                      background: 'var(--surface-panel)',
                      border: '2px solid var(--ui-border-default)',
                      borderTop: 'none',
                      borderRadius: '0 0 12px 12px',
                    }}
                  >
                    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Key input */}
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showKey[p.id] ? 'text' : 'password'}
                          value={keyDraft[p.id] ?? ''}
                          onChange={(e) => {
                            setKeyDraft((d) => ({ ...d, [p.id]: e.target.value }));
                            if (keyStatus[p.id] !== 'idle') setKeyStatus((s) => ({ ...s, [p.id]: 'idle' }));
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') validateKey(p.id); }}
                          placeholder={p.keyPlaceholder}
                          style={{ ...inputStyle, width: '100%', paddingRight: 80, fontFamily: 'monospace' }}
                          autoFocus
                        />
                        <button
                          onClick={() => setShowKey((s) => ({ ...s, [p.id]: !s[p.id] }))}
                          style={{
                            position: 'absolute', right: 40, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--ui-text-muted)', display: 'flex', padding: 4,
                          }}
                        >
                          {showKey[p.id] ? <EyeSlash size={13} /> : <Eye size={13} />}
                        </button>
                        <button
                          onClick={() => validateKey(p.id)}
                          disabled={isChecking || (keyDraft[p.id] ?? '').trim().length < 10}
                          style={{
                            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                            padding: '4px 8px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                            border: 'none', cursor: 'pointer',
                            background: isChecking ? 'var(--surface-panel-muted)' : 'var(--accent-primary)',
                            color: isChecking ? 'var(--ui-text-muted)' : 'var(--text-inverse)',
                            opacity: (keyDraft[p.id] ?? '').trim().length < 10 ? 0.4 : 1,
                            transition: 'opacity 150ms, background 150ms',
                            display: 'flex', alignItems: 'center', gap: 3,
                          }}
                        >
                          {isChecking ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                              style={{ display: 'flex' }}
                            >
                              <ArrowClockwise size={11} />
                            </motion.div>
                          ) : 'Test'}
                        </button>
                      </div>

                      {/* Error / hint */}
                      {keyError[p.id] && status === 'invalid' && (
                        <div style={{
                          fontSize: 11, padding: '7px 10px', borderRadius: 8,
                          background: 'var(--status-error-bg)', color: 'var(--status-error)',
                        }}>
                          {keyError[p.id]}
                        </div>
                      )}

                      {!keyError[p.id] && (
                        <div style={{ fontSize: 11, color: 'var(--ui-text-muted)' }}>
                          {p.keyHint}
                        </div>
                      )}

                      {/* Model picker once key is valid */}
                      {isValid && models.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 4 }}>
                          <div style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                            color: 'var(--ui-text-muted)',
                          }}>
                            Choose default model
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {models.map((m) => {
                              const mSel = selectedModel === m.id;
                              return (
                                <button
                                  key={m.id}
                                  onClick={() => onUpdate({ defaultModelId: m.id, defaultProvider: p.id })}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 9,
                                    padding: '8px 10px', borderRadius: 9,
                                    border: `1px solid ${mSel ? 'var(--accent-primary)' : 'var(--ui-border-subtle)'}`,
                                    background: mSel
                                      ? 'color-mix(in srgb, var(--accent-primary) 8%, var(--surface-panel))'
                                      : 'var(--surface-panel-muted)',
                                    cursor: 'pointer', textAlign: 'left',
                                    transition: 'border-color 150ms, background 150ms',
                                  }}
                                >
                                  {mSel && <Check weight="bold" size={10} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />}
                                  <span style={{ fontSize: 12, fontWeight: mSel ? 600 : 400, color: 'var(--ui-text-primary)' }}>
                                    {m.name}
                                  </span>
                                  <span style={{ fontSize: 10, color: 'var(--ui-text-muted)', marginLeft: 'auto', fontFamily: 'monospace' }}>
                                    {m.id}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {!selected && !scanning && (
        <div style={{ fontSize: 11, color: 'var(--ui-text-muted)', textAlign: 'center', marginTop: 2 }}>
          Select a brain above to continue — you can add more in Settings anytime.
        </div>
      )}
    </div>
  );
}

// ─── Done screen — mode showcase ─────────────────────────────────────────────

type ModeKey = 'chat' | 'code' | 'browser' | 'agents' | 'private';

const MODE_TABS: Array<{
  key: ModeKey;
  label: string;
  Icon: React.ElementType;
  color: string;
  bg: string;
}> = [
  { key: 'chat',    label: 'A:// Chat',    Icon: ChatCircle,  color: '#6366f1', bg: 'rgba(99,102,241,0.1)'  },
  { key: 'code',    label: 'A:// Code',    Icon: Code,        color: '#10b981', bg: 'rgba(16,185,129,0.1)'  },
  { key: 'browser', label: 'A:// Browser', Icon: Globe,       color: '#ec4899', bg: 'rgba(236,72,153,0.1)'  },
  { key: 'agents',  label: 'A:// Agents',  Icon: Robot,       color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  { key: 'private', label: 'Private',      Icon: ShieldCheck, color: '#06b6d4', bg: 'rgba(6,182,212,0.1)'   },
];

function ModePreviewChat() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          maxWidth: '72%', padding: '8px 12px', borderRadius: '14px 14px 4px 14px',
          background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)',
          fontSize: 12, color: 'var(--ui-text-primary)', lineHeight: 1.5,
        }}>
          Explain quantum computing simply
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 2,
          background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MatrixLogo state="idle" size={13} />
        </div>
        <div style={{
          flex: 1, padding: '8px 12px', borderRadius: '4px 14px 14px 14px',
          background: 'var(--surface-panel)', border: '1px solid var(--ui-border-subtle)',
          fontSize: 12, color: 'var(--ui-text-secondary)', lineHeight: 1.6,
        }}>
          Quantum computers use qubits that can exist as both 0 and 1 simultaneously — unlike classical bits. This lets them solve certain problems exponentially faster.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, paddingLeft: 30, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(99,102,241,0.5)' }}
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.7, 1, 0.7] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  );
}

function ModePreviewCode() {
  const lines = [
    { text: '$ allternit code --fix auth.ts', color: 'rgba(255,255,255,0.55)' },
    { text: '',                                color: '' },
    { text: '✓ Scanning workspace…',           color: '#10b981' },
    { text: '✓ Found issue in auth.ts:42',     color: '#10b981' },
    { text: '~ Applying null-check fix…',      color: '#f59e0b' },
    { text: '',                                color: '' },
    { text: '1 file patched — 0 errors remain', color: 'rgba(255,255,255,0.4)' },
  ];
  return (
    <div style={{
      background: 'rgba(0,0,0,0.35)', borderRadius: 10, padding: '12px 14px',
      fontFamily: 'ui-monospace, monospace', fontSize: 11.5,
      border: '1px solid rgba(255,255,255,0.07)',
    }}>
      {lines.map((l, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08 + i * 0.07, duration: 0.22 }}
          style={{ height: l.text ? 'auto' : 6, color: l.color || 'transparent', lineHeight: 1.7 }}
        >
          {l.text}
        </motion.div>
      ))}
    </div>
  );
}

function ModePreviewBrowser() {
  const steps = [
    'Navigating to competitor.com/pricing…',
    'Page loaded — extracting content',
    'Found 3 pricing tiers',
    'Starter $9/mo · Pro $29/mo · Enterprise',
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Browser chrome bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
        background: 'rgba(0,0,0,0.25)', borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {['#ff5f57','#febc2e','#28c840'].map(c => (
            <div key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c, opacity: 0.7 }} />
          ))}
        </div>
        <div style={{
          flex: 1, padding: '3px 8px', borderRadius: 5,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'ui-monospace, monospace',
        }}>
          competitor.com/pricing
        </div>
      </div>
      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingLeft: 4 }}>
        {steps.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.12, duration: 0.25 }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}
          >
            <div style={{
              width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: i < 2 ? '#ec4899' : 'rgba(255,255,255,0.2)',
            }} />
            <span style={{ color: i < 2 ? 'var(--ui-text-primary)' : 'var(--ui-text-secondary)', lineHeight: 1.45 }}>
              {s}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ModePreviewAgents() {
  const tasks = [
    { label: 'Search for relevant papers',  done: true  },
    { label: 'Extract key findings',         done: true  },
    { label: 'Writing summary report…',      done: false, active: true },
    { label: 'Send to your inbox',           done: false, active: false },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        padding: '7px 10px', borderRadius: 8,
        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)',
        fontSize: 11.5, color: 'rgba(245,158,11,0.9)', fontWeight: 600,
      }}>
        Task: Research AI landscape + compile report
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 2 }}>
        {tasks.map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 + i * 0.1, duration: 0.22 }}
            style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12 }}
          >
            <div style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: t.done ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${t.done ? 'rgba(245,158,11,0.4)' : t.active ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.1)'}`,
            }}>
              {t.done ? (
                <Check size={9} weight="bold" style={{ color: '#f59e0b' }} />
              ) : t.active ? (
                <motion.div
                  style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                />
              ) : null}
            </div>
            <span style={{
              color: t.done ? 'var(--ui-text-muted)' : t.active ? 'var(--ui-text-primary)' : 'var(--ui-text-muted)',
              textDecoration: t.done ? 'line-through' : 'none',
              opacity: t.done ? 0.55 : 1,
              lineHeight: 1.45,
            }}>
              {t.label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ModePreviewPrivate() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
        borderRadius: 9, background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.18)',
      }}>
        <motion.div
          style={{ width: 7, height: 7, borderRadius: '50%', background: '#06b6d4', flexShrink: 0 }}
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(6,182,212,0.9)' }}>
          Running entirely on your machine
        </span>
      </div>
      {[
        { label: 'Model',   value: 'llama3.2 · Ollama' },
        { label: 'Device',  value: 'Your computer' },
        { label: 'Network', value: 'None — fully offline' },
      ].map(({ label, value }) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
          <span style={{ color: 'var(--ui-text-muted)' }}>{label}</span>
          <span style={{ color: 'var(--ui-text-primary)', fontWeight: 500 }}>{value}</span>
        </div>
      ))}
      <div style={{ paddingTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ui-text-muted)', marginBottom: 5 }}>
          <span>Inference load</span><span>72%</span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <motion.div
            style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #06b6d4, #0891b2)' }}
            initial={{ width: '0%' }}
            animate={{ width: '72%' }}
            transition={{ delay: 0.3, duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
          />
        </div>
      </div>
    </div>
  );
}

const MODE_PREVIEW_MAP: Record<ModeKey, React.ComponentType> = {
  chat:    ModePreviewChat,
  code:    ModePreviewCode,
  browser: ModePreviewBrowser,
  agents:  ModePreviewAgents,
  private: ModePreviewPrivate,
};

function ModeShowcase() {
  const [active, setActive] = useState<ModeKey>('chat');
  const [userPicked, setUserPicked] = useState(false);
  const CYCLE_MS = 3400;

  useEffect(() => {
    if (userPicked) return;
    const keys: ModeKey[] = ['chat', 'code', 'browser', 'agents', 'private'];
    const id = setInterval(() => {
      setActive(curr => keys[(keys.indexOf(curr) + 1) % keys.length]);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [userPicked]);

  const activeTab = MODE_TABS.find(t => t.key === active)!;
  const PreviewComponent = MODE_PREVIEW_MAP[active];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Preview card */}
      <div style={{
        borderRadius: 16, overflow: 'hidden',
        border: `1px solid color-mix(in srgb, ${activeTab.color} 22%, var(--ui-border-subtle))`,
        background: 'var(--surface-panel)',
        transition: 'border-color 0.35s',
      }}>
        {/* Colored top bar */}
        <div style={{
          padding: '11px 14px',
          borderBottom: '1px solid var(--ui-border-subtle)',
          display: 'flex', alignItems: 'center', gap: 9,
          background: `color-mix(in srgb, ${activeTab.color} 6%, var(--surface-panel))`,
          transition: 'background 0.35s',
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: activeTab.bg, transition: 'background 0.35s',
          }}>
            <activeTab.Icon size={14} weight="bold" style={{ color: activeTab.color }} />
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: activeTab.color, transition: 'color 0.35s', letterSpacing: '-0.01em' }}>
            {activeTab.label}
          </span>
        </div>
        {/* Animated preview */}
        <div style={{ padding: '14px 16px', minHeight: 148 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <PreviewComponent />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Tab strip */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {MODE_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActive(tab.key); setUserPicked(true); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 11.5, fontWeight: active === tab.key ? 700 : 500,
              background: active === tab.key ? tab.bg : 'transparent',
              color: active === tab.key ? tab.color : 'var(--ui-text-muted)',
              outline: active === tab.key ? `1px solid color-mix(in srgb, ${tab.color} 30%, transparent)` : '1px solid transparent',
              transition: 'all 0.18s',
            }}
          >
            <tab.Icon size={11} weight={active === tab.key ? 'bold' : 'regular'} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Auto-cycle progress dots */}
      {!userPicked && (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          {MODE_TABS.map(tab => (
            <div
              key={tab.key}
              style={{
                height: 3, borderRadius: 2,
                width: active === tab.key ? 18 : 6,
                background: active === tab.key ? tab.color : 'rgba(255,255,255,0.1)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DoneScreen({ data, onFinish }: { data: WizardData; onFinish: () => void }) {
  const infraLabel = data.infraType === 'local' ? 'This machine' : data.infraType === 'connect' ? 'Remote server' : data.infraType === 'purchase' ? 'New VPS' : 'Remote';
  const modelLabel = data.defaultModelId ?? data.defaultProvider ?? null;
  const keyCount = Object.keys(data.configuredKeys ?? {}).length;

  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', gap: 0,
      height: '100%', minHeight: 0,
    }}>
      {/* Left — celebration + summary + CTA */}
      <div style={{
        width: 320, flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center',
        padding: '40px 32px 36px',
        borderRight: '1px solid var(--ui-border-subtle)',
      }}>
        {/* MatrixLogo with success ring */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 340, damping: 24 }}
          style={{ position: 'relative', marginBottom: 24, display: 'inline-flex' }}
        >
          <motion.div
            animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.15, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute', inset: -14, borderRadius: '50%',
              border: '1px solid color-mix(in srgb, var(--accent-primary) 35%, transparent)',
              pointerEvents: 'none',
            }}
          />
          <MatrixLogo state="idle" size={52} />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.45, type: 'spring', stiffness: 320, damping: 18 }}
            style={{
              position: 'absolute', bottom: -4, right: -4,
              width: 22, height: 22, borderRadius: '50%',
              background: 'linear-gradient(135deg, #34d399, #10b981)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(16,185,129,0.45)',
            }}
          >
            <Check weight="bold" size={11} style={{ color: '#fff' }} />
          </motion.div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--ui-text-primary)', marginBottom: 6 }}
        >
          Allternit is ready.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.3 }}
          style={{ fontSize: 13, color: 'var(--ui-text-muted)', marginBottom: 24, lineHeight: 1.55, maxWidth: 220 }}
        >
          Everything is configured. Here's what you set up —
        </motion.p>

        {/* Setup summary */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, duration: 0.28 }}
          style={{
            width: '100%', display: 'flex', flexDirection: 'column', gap: 7,
            marginBottom: 28, padding: '12px 14px', borderRadius: 12,
            background: 'var(--surface-panel)', border: '1px solid var(--ui-border-subtle)',
          }}
        >
          {[
            { label: 'Runs on',  value: infraLabel },
            ...(modelLabel ? [{ label: 'AI model', value: modelLabel }] : []),
            { label: 'API keys', value: keyCount > 0 ? `${keyCount} configured` : 'None — use local models' },
            { label: 'Modes',    value: `${data.selectedModes.length} enabled` },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: 'var(--ui-text-muted)' }}>{label}</span>
              <span style={{ color: 'var(--ui-text-primary)', fontWeight: 600, textAlign: 'right', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
            </div>
          ))}
        </motion.div>

        <motion.button
          onClick={onFinish}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.26 }}
          whileHover={{ scale: 1.03, boxShadow: '0 8px 28px color-mix(in srgb, var(--accent-primary) 35%, transparent)' }}
          whileTap={{ scale: 0.97 }}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '13px 0', borderRadius: 999,
            background: 'var(--accent-primary)', color: 'var(--text-inverse)',
            fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          Open Allternit
          <ArrowRight weight="bold" size={16} />
        </motion.button>
      </div>

      {/* Right — mode showcase */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        style={{
          flex: 1, minWidth: 0,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '32px 36px',
        }}
      >
        <p style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.09em',
          textTransform: 'uppercase', color: 'var(--ui-text-muted)',
          marginBottom: 16,
        }}>
          What you can do now
        </p>
        <ModeShowcase />
      </motion.div>
    </div>
  );
}

// ─── Input shared style ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '9px 12px', borderRadius: 10, fontSize: 13,
  background: 'var(--surface-canvas)',
  border: '1px solid var(--ui-border-default)',
  color: 'var(--ui-text-primary)',
  outline: 'none',
};

// ─── Step header ──────────────────────────────────────────────────────────────

const STEP_META: Record<Screen, { title: string; sub: string }> = {
  welcome:    { title: '',              sub: '' },
  infra:      { title: 'Where should Allternit run?', sub: 'This is like choosing where to plug in the engine — don\'t worry, any option works great' },
  appearance: { title: 'Pick your style',             sub: 'Dark or light — just how the app looks, you can change this anytime' },
  modes:      { title: 'Connect your brain',            sub: 'Pick an AI model to power Allternit — we scanned your machine for anything already installed' },
  done:       { title: '',              sub: '' },
};

// ─── Main export ──────────────────────────────────────────────────────────────

export function OnboardingFlow() {
  const { theme: storedTheme } = useThemeStore();
  const [screen, setScreen] = useState<Screen>('welcome');
  const [data, setData] = useState<WizardData>({
    theme: storedTheme,
    infraType: 'local',
    selectedModes: ['chat', 'cowork', 'code', 'browser'],
    workspacePath: '~/allternit-workspace',
    defaultProvider: undefined,
    defaultModelId: undefined,
    configuredKeys: {},
    sshConfig: { host: '', port: 22, username: 'root', authType: 'password', privateKey: '~/.ssh/id_rsa', password: '' },
  });

  const direction = useRef(1);
  const { completeOnboarding } = useOnboardingStore();
  const update = useCallback((d: Partial<WizardData>) => setData(p => ({ ...p, ...d })), []);


  const goNext = () => {
    direction.current = 1;
    const idx = screenIdx(screen);
    if (idx < SCREEN_ORDER.length - 1) setScreen(SCREEN_ORDER[idx + 1]);
  };
  const goBack = () => {
    direction.current = -1;
    const idx = screenIdx(screen);
    if (idx > 0) setScreen(SCREEN_ORDER[idx - 1]);
  };

  const finish = () => {
    // Persist configured API keys to sessionStorage so the runtime can pick them up.
    // Keys are ephemeral — they are not stored in the onboarding Zustand store.
    if (data.configuredKeys) {
      Object.entries(data.configuredKeys).forEach(([provider, key]) => {
        sessionStorage.setItem(`allternit_key_${provider}`, key);
      });
    }
    completeOnboarding({
      theme: data.theme,
      defaultProvider: data.defaultModelId
        ? `${data.defaultProvider}::${data.defaultModelId}`
        : data.defaultProvider,
      apiKeysConfigured: data.apiKeysConfigured || Object.keys(data.configuredKeys ?? {}).length > 0,
      defaultWorkspacePath: data.workspacePath,
      preferredModes: data.selectedModes,
    });
  };

  const isFullWidth = screen === 'welcome' || screen === 'done';
  const meta = STEP_META[screen] ?? { title: '', sub: '' };

  return (
    <motion.div
      variants={CARD_ENTRANCE}
      initial="hidden"
      animate="visible"
      style={{
        width: 'calc(100vw - 48px)',
        height: 'calc(100vh - 48px)',
        maxWidth: 1100,
        maxHeight: 800,
        borderRadius: 20,
        border: '1px solid var(--shell-dialog-border)',
        background: 'var(--shell-dialog-bg)',
        boxShadow: 'var(--shadow-xl), 0 0 0 1px color-mix(in srgb, var(--accent-primary) 5%, transparent) inset',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Inner layout: sidebar + content OR full-width */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Left sidebar — only visible for inner steps */}
        <AnimatePresence initial={false}>
          {!isFullWidth && (
            <motion.div
              key="sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 196, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ overflow: 'hidden', flexShrink: 0 }}
            >
              <div style={{ width: 196 }}>
                <StepSidebar screen={screen} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Step header (inner steps only) */}
          {!isFullWidth && (
            <div style={{
              padding: '24px 28px 0',
              flexShrink: 0,
            }}>
              <h2 style={{
                fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em',
                color: 'var(--ui-text-primary)', margin: 0, lineHeight: 1.25,
              }}>
                {meta.title}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--ui-text-muted)', margin: '4px 0 0' }}>
                {meta.sub}
              </p>
            </div>
          )}

          {/* Animated step content */}
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
            <AnimatePresence custom={direction.current} mode="wait">
              <motion.div
                key={screen}
                custom={direction.current}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                style={{ padding: isFullWidth ? 0 : '20px 28px 24px' }}
              >
                {screen === 'welcome' && <WelcomeScreen onNext={goNext} />}
                {screen === 'infra'   && <InfraStep data={data} onUpdate={update} />}
                {screen === 'appearance' && <AppearanceStep theme={data.theme} onChange={(t) => update({ theme: t })} />}
                {screen === 'modes'   && <ModesStep data={data} onUpdate={update} />}
                {screen === 'done'    && <DoneScreen data={data} onFinish={finish} />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer nav — inner steps only */}
          {!isFullWidth && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 28px',
              borderTop: '1px solid var(--ui-border-subtle)',
              flexShrink: 0,
            }}>
              <motion.button
                onClick={goBack}
                whileHover={{ color: 'var(--ui-text-primary)' }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 10,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  color: 'var(--ui-text-muted)',
                }}
              >
                <CaretLeft size={13} />
                Back
              </motion.button>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <motion.button
                  onClick={goNext}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '9px 20px', borderRadius: 999,
                    background: screen === 'modes' && !data.defaultProvider
                      ? 'var(--surface-panel-muted)'
                      : 'var(--accent-primary)',
                    color: screen === 'modes' && !data.defaultProvider
                      ? 'var(--ui-text-muted)'
                      : 'var(--text-inverse)',
                    fontSize: 13, fontWeight: 700,
                    border: screen === 'modes' && !data.defaultProvider
                      ? '1px solid var(--ui-border-default)'
                      : 'none',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'background 200ms, color 200ms',
                  }}
                >
                  {screen === 'modes'
                    ? data.defaultProvider ? 'Finish' : 'Skip for now'
                    : 'Continue'}
                  <CaretRight size={13} />
                </motion.button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
