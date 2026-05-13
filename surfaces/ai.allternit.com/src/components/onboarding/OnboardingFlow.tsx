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
import { motion, AnimatePresence, type Variants } from 'framer-motion';
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
  CloudArrowDown,
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
import { runtimeBackendApi } from '@/api/infrastructure/runtime-backend';
import { openInBrowser } from '@/lib/openInBrowser';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardData {
  theme: 'light' | 'dark' | 'system';
  infraType: 'local' | 'manual' | 'connect' | 'purchase' | 'remote';
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

const CARD_ENTRANCE: Variants = {
  hidden:  { opacity: 0, scale: 0.96, y: 8 },
  visible: { opacity: 1, scale: 1,    y: 0, transition: { duration: 0.28, ease: [0.25, 0.1, 0.25, 1] as any } },
};

const stepVariants: Variants = {
  enter:  (d: number) => ({ x: d * 36, opacity: 0 }),
  center: {
    x: 0, opacity: 1,
    transition: { duration: 0.24, ease: [0.25, 0.1, 0.25, 1] as any },
  },
  exit: (d: number) => ({
    x: d * -36, opacity: 0,
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] as any },
  }),
};

// ─── Step sidebar ─────────────────────────────────────────────────────────────

function StepSidebar({ screen }: { screen: Screen }) {
  const cIdx = screenIdx(screen);
  return (
    <div className="flex w-[196px] flex-shrink-0 flex-col gap-0 border-r border-ui-border-subtle bg-surface-panel px-5 py-7">
      {/* Logo + brand */}
      <div className="mb-8 flex items-center gap-2.5">
        <MatrixLogo state="idle" size={36} />
        <div>
          <div className="text-[13px] font-bold tracking-[-0.01em] text-ui-text-primary">
            Allternit
          </div>
          <div className="mt-px text-xs text-ui-text-muted">
            Setup wizard
          </div>
        </div>
      </div>

      {/* Step list with connecting lines */}
      <div className="flex-1">
        {INNER_STEPS.map((step, i) => {
          const stepScreenIdx = i + 1;
          const isDone = cIdx > stepScreenIdx;
          const isActive = cIdx === stepScreenIdx;

          return (
            <div key={step.key} className="flex gap-3">
              {/* Dot + line column */}
              <div className="flex w-6 flex-col items-center">
                <motion.div
                  animate={{
                    background: isDone ? 'var(--accent-primary)' : isActive
                      ? 'color-mix(in srgb, var(--accent-primary) 12%, var(--surface-panel))'
                      : 'var(--surface-panel)',
                    borderColor: isDone || isActive ? 'var(--accent-primary)' : 'var(--ui-border-default)',
                  }}
                  transition={{ duration: 0.2 }}
                  className="flex size-6 flex-shrink-0 items-center justify-center rounded-full border-2"
                >
                  {isDone ? (
                    <Check weight="bold" size={12} className="text-text-inverse" />
                  ) : (
                    <span className={`text-xs font-bold ${isActive ? 'text-accent-primary' : 'text-ui-text-muted'}`}>
                      {step.num}
                    </span>
                  )}
                </motion.div>

                {i < INNER_STEPS.length - 1 && (
                  <motion.div
                    animate={{ background: cIdx > stepScreenIdx + 1 ? 'var(--accent-primary)' : 'var(--ui-border-subtle)' }}
                    transition={{ duration: 0.3 }}
                    className="my-1 min-h-7 w-0.5 flex-1 rounded-px"
                  />
                )}
              </div>

              {/* Text */}
              <div className={`pb-7 pt-0.5 ${i < INNER_STEPS.length - 1 ? 'pb-7' : 'pb-0'}`}>
                <div className={`text-[13px] leading-tight text-ui-text-primary transition-colors duration-200 ${isActive ? 'font-semibold' : 'font-medium'} ${isDone || isActive ? 'text-ui-text-primary' : 'text-ui-text-muted'}`}>
                  {step.label}
                </div>
                <div className="mt-0.5 text-xs leading-snug text-ui-text-muted">
                  {step.hint}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-ui-border-subtle pt-4 text-xs leading-relaxed text-ui-text-muted">
        3 steps · takes<br />
        <span className="font-semibold text-accent-primary">~90 seconds</span>
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
    accent: 'var(--status-warning)',
    Icon: Robot,
  },
  {
    label: 'A:// code',
    sub: 'Write, review, and ship code with AI at your side.',
    accent: 'var(--status-success)',
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
    accent: 'var(--status-info)',
    Icon: ShieldCheck,
  },
];

// ─── Welcome screen ───────────────────────────────────────────────────────────

function WelcomeScreen({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex h-full min-h-0 w-full">
      {/* Left — brand + copy + CTA */}
      <div className="flex flex-shrink-0 flex-col justify-center border-r border-ui-border-subtle px-[52px] py-12 basis-auto">
        {/* Gizzi mascot */}
        <div className="mb-7">
          <GizziMascot emotion="pleased" size={72} />
        </div>

        <h1 className="mb-3 text-[32px] font-extrabold leading-tight tracking-[-0.035em] text-ui-text-primary">
          Welcome to{' '}
          <span className="text-accent-primary">Allternit.</span>
        </h1>

        <p className="mb-8 max-w-[300px] text-sm leading-7 text-ui-text-secondary">
          Your private AI platform — any model, real agents, your own server.
          No subscriptions. No data sharing.
        </p>

        {/* Reassurance pill */}
        <div className="mb-7 inline-flex items-center gap-1.5 self-start rounded-full border border-solid border-[color-mix(in_srgb,var(--accent-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--accent-primary)_8%,var(--surface-panel))] px-3.5 py-1.5 text-xs text-ui-text-secondary">
          <Sparkle size={12} className="text-accent-primary" weight="fill" />
          90 seconds · no technical experience needed
        </div>

        {/* CTA */}
        <motion.button
          onClick={onNext}
          whileHover={{ scale: 1.02, boxShadow: '0 8px 32px color-mix(in srgb, var(--accent-primary) 40%, transparent)' }}
          whileTap={{ scale: 0.98 }}
          className="self-start flex items-center gap-2.5 rounded-full border-none bg-accent-primary px-7 py-3.5 text-[15px] font-bold text-text-inverse shadow-md"
        >
          Get Started
          <ArrowRight weight="bold" size={16} />
        </motion.button>

        <div className="mt-4 flex items-center gap-2 text-xs text-ui-text-muted">
          Where it runs
          <span className="inline-block size-0.5 rounded-full bg-current" />
          Style
          <span className="inline-block size-0.5 rounded-full bg-current" />
          Your AI
        </div>
      </div>

      {/* Right — interactive A:// preview */}
      <div className="flex flex-1 items-start justify-center overflow-hidden bg-[color-mix(in_srgb,var(--accent-primary)_3%,var(--surface-panel))] px-8 py-6">
        <AuthPreview />
      </div>
    </div>
  );
}

// ─── Non-technical hint box ───────────────────────────────────────────────────

function HintBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3.5 flex items-start gap-2.5 rounded-xl border border-solid border-[color-mix(in_srgb,var(--accent-primary)_14%,transparent)] bg-[color-mix(in_srgb,var(--accent-primary)_5%,var(--surface-panel))] px-3.5 py-2.5">
      <Sparkle size={13} weight="fill" className="mt-px flex-shrink-0 text-accent-primary" />
      <p className="m-0 text-xs leading-relaxed text-ui-text-secondary">
        {children}
      </p>
    </div>
  );
}

// ─── Infrastructure step ──────────────────────────────────────────────────────

// Detect running inside Allternit Electron desktop
function isElectronDesktop() {
  return typeof window !== 'undefined' && !!(window as any).allternit?.tunnel;
}

// Detect user OS for download links
function getUserOS(): 'mac' | 'windows' | 'linux' {
  if (typeof navigator === 'undefined') return 'mac';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('linux')) return 'linux';
  return 'mac';
}

const inputClassName = "flex-1 px-3 py-2.5 rounded-lg text-[13px] bg-surface-canvas border border-ui-border-default text-ui-text-primary outline-none";


function InfraStep({ data, onUpdate }: { data: WizardData; onUpdate: (d: Partial<WizardData>) => void }) {
  const [showPw, setShowPw] = useState(false);
  const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'ok' | 'err'>('idle');
  const [connMsg, setConnMsg] = useState('');
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [installing, setInstalling] = useState(false);

  // Local backend detection state
  const [localStatus, setLocalStatus] = useState<'checking' | 'found' | 'not-found'>('checking');
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [isElectron] = useState(isElectronDesktop);
  const [electronTunnel, setElectronTunnel] = useState<{ status: string; url?: string } | null>(null);
  const [os] = useState(getUserOS);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manual URL auto-test state
  const [urlTestStatus, setUrlTestStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [urlTestError, setUrlTestError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualToken, setManualToken] = useState('');
  const urlDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Local backend auto-detection ───────────────────────────────────────────
  const probeLocal = useCallback(async () => {
    if (isElectron) {
      try {
        const state = await (window as any).allternit.tunnel.getState();
        setElectronTunnel(state);
        if (state.status === 'running' && state.url) {
          setLocalStatus('found');
          setLocalUrl(`https://${state.url}`);
          return;
        }
      } catch { /* fall through to port probe */ }
    }
    for (const port of [8013, 4096, 3001, 8080]) {
      try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 2000);
        const res = await fetch(`http://localhost:${port}/v1/global/health`, { signal: ctrl.signal });
        if (res.ok) { setLocalStatus('found'); setLocalUrl(`http://localhost:${port}`); return; }
      } catch { /* next port */ }
    }
    setLocalStatus('not-found');
  }, [isElectron]);

  useEffect(() => {
    if (data.infraType !== 'local') { if (pollRef.current) clearInterval(pollRef.current); return; }
    probeLocal();
    pollRef.current = setInterval(() => { if (localStatus !== 'found') probeLocal(); }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.infraType]);

  useEffect(() => {
    if (!isElectron) return;
    try {
      return (window as any).allternit.tunnel.onStateChange((state: any) => {
        setElectronTunnel(state);
        if (state.status === 'running' && state.url) { setLocalStatus('found'); setLocalUrl(`https://${state.url}`); }
      });
    } catch { return undefined; }
  }, [isElectron]);

  const activateLocal = async () => {
    if (!localUrl) return;
    setConnStatus('testing'); setConnMsg('Connecting…');
    try {
      await runtimeBackendApi.registerManualBackend({ name: 'Local Backend', gatewayUrl: localUrl });
      setConnStatus('ok'); setConnMsg('Connected!');
    } catch (e: any) { setConnStatus('err'); setConnMsg(e.message || 'Failed'); }
  };


  // ── Manual URL auto-test ────────────────────────────────────────────────────
  const testUrl = useCallback(async (url: string) => {
    if (!url.trim()) { setUrlTestStatus('idle'); return; }
    setUrlTestStatus('checking'); setUrlTestError(null);
    try {
      const normalized = url.startsWith('http') ? url : `https://${url}`;
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(`${normalized.replace(/\/$/, '')}/v1/global/health`, { signal: ctrl.signal });
      if (res.ok) {
        setUrlTestStatus('ok');
        if (!manualName) setManualName(new URL(normalized).hostname.split('.')[0] || 'My Backend');
      } else { setUrlTestStatus('fail'); setUrlTestError(`Server returned ${res.status}`); }
    } catch (e: any) {
      setUrlTestStatus('fail');
      setUrlTestError(e?.name === 'AbortError' ? 'Timed out — unreachable' : 'Could not connect');
    }
  }, [manualName]);

  const handleUrlChange = (url: string) => {
    setManualUrl(url);
    if (urlDebounceRef.current) clearTimeout(urlDebounceRef.current);
    setUrlTestStatus('idle');
    if (url.length > 5) urlDebounceRef.current = setTimeout(() => testUrl(url), 700);
  };

  const connectManual = async () => {
    if (!manualUrl) return;
    setConnStatus('testing'); setConnMsg('Registering backend…');
    try {
      const normalized = manualUrl.startsWith('http') ? manualUrl : `https://${manualUrl}`;
      await runtimeBackendApi.registerManualBackend({ name: manualName || 'My Backend', gatewayUrl: normalized, gatewayToken: manualToken || undefined });
      setConnStatus('ok'); setConnMsg('Backend connected!');
    } catch (e: any) { setConnStatus('err'); setConnMsg(e.message || 'Failed'); }
  };

  // ── SSH ─────────────────────────────────────────────────────────────────────
  const options: { id: WizardData['infraType']; Icon: React.ElementType; label: string; desc: string }[] = [
    { id: 'local',    Icon: HardDrive, label: 'Use this computer',   desc: isElectron ? 'Desktop detected — AI engine running locally' : 'Download the app — it automatically connects your browser on install' },
    { id: 'manual',   Icon: Globe,     label: 'Enter backend URL',   desc: 'Paste any backend URL — we\'ll test and connect automatically' },
    { id: 'connect',  Icon: WifiHigh,  label: 'I have a server',     desc: 'Connect your VPS, NAS, or cloud box via SSH' },
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
    <div className="flex flex-col gap-2.5">
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
            className={`flex items-center gap-3.5 rounded-2xl border-2 px-4 py-3.5 text-left transition-colors duration-150 ${sel ? 'border-accent-primary bg-[color-mix(in_srgb,var(--accent-primary)_8%,var(--surface-panel))]' : 'border-ui-border-subtle bg-surface-panel'}`}
          >
            <div className={`flex size-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${sel ? 'bg-[color-mix(in_srgb,var(--accent-primary)_16%,var(--surface-panel))] text-accent-primary' : 'bg-surface-panel-muted text-ui-text-muted'}`}>
              <Icon size={18} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold leading-tight text-ui-text-primary">
                {label}
              </div>
              <div className="mt-0.5 text-xs text-ui-text-muted">
                {desc}
              </div>
            </div>

            {/* Radio */}
            <motion.div
              animate={{
                background: sel ? 'var(--accent-primary)' : 'transparent',
                borderColor: sel ? 'var(--accent-primary)' : 'var(--ui-border-default)',
              }}
              className="flex size-4.5 flex-shrink-0 items-center justify-center rounded-full border-2"
            >
              {sel && <Check weight="bold" size={12} className="text-text-inverse" />}
            </motion.div>
          </motion.button>
        );
      })}

      {/* Local — smart detection panel */}
      <AnimatePresence>
        {data.infraType === 'local' && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            className="overflow-hidden rounded-2xl border border-ui-border-subtle bg-surface-panel p-4"
          >
            {/* Electron: local backend is always available at localhost */}
            {isElectron ? (
              localStatus === 'checking' ? (
                <div className="flex items-center gap-2.5 text-[13px] text-ui-text-muted">
                  <ArrowClockwise size={16} className="animate-spin flex-shrink-0" />
                  Starting AI engine…
                </div>
              ) : localStatus === 'found' ? (
                <div>
                  <div className="mb-2.5 flex items-center gap-2.5 rounded-lg border border-solid border-[color-mix(in_srgb,var(--status-success)_25%,transparent)] bg-status-success-bg p-2.5">
                    <CheckCircle weight="fill" size={16} className="flex-shrink-0 text-status-success" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-ui-text-primary">AI engine is running</div>
                      <div className="text-xs text-ui-text-muted">Connected to this computer's local backend</div>
                    </div>
                    <button
                      onClick={activateLocal}
                      disabled={connStatus === 'testing' || connStatus === 'ok'}
                      className={`flex-shrink-0 rounded-lg border-none px-3.5 py-1.5 text-xs font-bold text-text-inverse ${connStatus === 'ok' ? 'cursor-default bg-status-success' : 'cursor-pointer bg-accent-primary'}`}
                    >
                      {connStatus === 'testing' ? 'Connecting…' : connStatus === 'ok' ? 'Connected ✓' : 'Connect'}
                    </button>
                  </div>
                  {electronTunnel?.status === 'running' && electronTunnel.url && (
                    <div className="rounded-lg bg-surface-canvas p-2 text-xs text-ui-text-muted">
                      Web access active — your browser can also reach this at{' '}
                      <span className="font-mono text-ui-text-secondary">{electronTunnel.url}</span>
                    </div>
                  )}
                  {connMsg && (
                    <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${connStatus === 'err' ? 'bg-status-error-bg text-status-error' : 'bg-status-success-bg text-status-success'}`}>
                      {connMsg}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs leading-normal text-ui-text-secondary">
                  AI engine not detected. Make sure the backend service is running and try again.
                </div>
              )
            ) : localStatus === 'checking' ? (
              /* Checking */
              <div className="flex items-center gap-2.5 text-[13px] text-ui-text-muted">
                <ArrowClockwise size={16} className="animate-spin flex-shrink-0" />
                Looking for Allternit on this computer…
              </div>
            ) : localStatus === 'found' ? (
              /* Found locally */
              <div className="flex items-center gap-2.5 rounded-lg border border-solid border-[color-mix(in_srgb,var(--status-success)_25%,transparent)] bg-status-success-bg p-2.5">
                <CheckCircle weight="fill" size={16} className="flex-shrink-0 text-status-success" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-ui-text-primary">Backend found</div>
                  <div className="text-xs text-ui-text-muted">{localUrl}</div>
                </div>
                <button onClick={activateLocal} disabled={connStatus === 'testing'} className="flex-shrink-0 cursor-pointer rounded-lg border-none bg-accent-primary px-3.5 py-1.5 text-xs font-bold text-text-inverse">
                  {connStatus === 'testing' ? 'Connecting…' : connStatus === 'ok' ? 'Connected ✓' : 'Use this'}
                </button>
              </div>
            ) : (
              /* Not found — show download */
              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-accent-primary">
                  Get the Desktop App
                </div>
                <div className="mb-3 text-xs leading-normal text-ui-text-secondary">
                  The Allternit desktop app runs on your {os === 'mac' ? 'Mac' : os === 'windows' ? 'Windows PC' : 'Linux machine'} and automatically connects your browser — no commands, no copy-pasting URLs.
                </div>
                {/* TODO: Update href to point to the real download page once hosting is set up.
                    Suggested infrastructure: allternit.com/download with OS-specific links to
                    Cloudflare R2 or GitHub Releases artifacts. */}
                <a
                  href="https://allternit.com/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="box-border block w-full rounded-lg bg-accent-primary py-2.5 text-center text-[13px] font-bold text-text-inverse no-underline"
                >
                  Download for {os === 'mac' ? 'Mac' : os === 'windows' ? 'Windows' : 'Linux'}
                </a>
                <div className="mt-2.5 text-xs text-ui-text-muted">
                  After installing, open the app — it automatically connects this browser. This page updates when it's ready.
                </div>
                {connMsg && (
                  <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${connStatus === 'err' ? 'bg-status-error-bg text-status-error' : 'bg-status-success-bg text-status-success'}`}>
                    {connMsg}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Backend URL form — auto-test on type */}
      <AnimatePresence>
        {data.infraType === 'manual' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl border border-ui-border-subtle bg-surface-panel p-4"
          >
            <div className="mb-3 text-xs font-bold uppercase tracking-widest text-accent-primary">
              Backend URL
            </div>

            {/* URL input with inline status */}
            <div className="relative mb-2">
              <input
                type="text"
                value={manualUrl}
                onChange={e => handleUrlChange(e.target.value)}
                placeholder="https://your-tunnel.trycloudflare.com"
                className={`${inputClassName} box-border w-full pr-9`}
              />
              <div className="pointer-events-none absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center">
                {urlTestStatus === 'checking' && <ArrowClockwise size={14} className="animate-spin text-ui-text-muted" />}
                {urlTestStatus === 'ok'       && <CheckCircle weight="fill" size={14} className="text-status-success" />}
                {urlTestStatus === 'fail'     && <Warning weight="fill" size={14} className="text-status-error" />}
              </div>
            </div>

            {urlTestStatus === 'fail' && urlTestError && (
              <div className="mb-2 rounded-lg bg-status-error-bg px-2.5 py-1.5 text-xs text-status-error">
                {urlTestError}
              </div>
            )}

            <input
              type="text"
              value={manualName}
              onChange={e => setManualName(e.target.value)}
              placeholder="Connection name (e.g., My MacBook)"
              className={`${inputClassName} box-border mb-2 w-full`}
            />

            {/* Auth token — collapsed by default */}
            <details className="mb-3">
              <summary className="cursor-pointer select-none px-0 py-1 text-xs text-ui-text-muted">
                Auth token (optional)
              </summary>
              <input
                type="text"
                value={manualToken}
                onChange={e => setManualToken(e.target.value)}
                placeholder="Bearer token or Basic auth"
                className={`${inputClassName} box-border mt-2 w-full`}
              />
            </details>

            <button
              onClick={connectManual}
              disabled={!manualUrl || urlTestStatus === 'checking' || connStatus === 'testing'}
              className={`w-full rounded-lg border-none py-2.5 text-[13px] font-bold transition-colors duration-200 ${manualUrl && urlTestStatus !== 'fail' ? 'cursor-pointer bg-accent-primary text-text-inverse' : 'cursor-not-allowed bg-surface-panel-muted text-ui-text-muted'}`}
            >
              {connStatus === 'testing' ? 'Connecting…' : connStatus === 'ok' ? 'Connected ✓' : 'Connect Backend'}
            </button>

            {connMsg && (
              <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${connStatus === 'err' ? 'bg-status-error-bg text-status-error' : 'bg-status-success-bg text-status-success'}`}>
                {connMsg}
              </div>
            )}

            {urlTestStatus !== 'ok' && !manualUrl && (
              <div className="mt-2.5 rounded-lg bg-surface-canvas px-3 py-2.5 text-xs text-ui-text-muted">
                <strong>Tip:</strong> If you have the desktop app, run <code className="rounded bg-surface-panel px-1.5 py-0.5">cloudflared tunnel --url http://localhost:4096</code> and paste the URL above.
              </div>
            )}
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
            className="overflow-hidden rounded-2xl border border-ui-border-subtle bg-surface-panel p-4"
          >
            <div className="mb-3 text-xs font-bold uppercase tracking-widest text-accent-primary">
              SSH Details
            </div>

            <div className="mb-2 flex gap-2">
              <input
                type="text" value={data.sshConfig.host}
                onChange={e => onUpdate({ sshConfig: { ...data.sshConfig, host: e.target.value } })}
                placeholder="Hostname or IP"
                className={inputClassName}
              />
              <input
                type="number" value={data.sshConfig.port}
                onChange={e => onUpdate({ sshConfig: { ...data.sshConfig, port: parseInt(e.target.value) || 22 } })}
                placeholder="22" className={`${inputClassName} w-18 flex-shrink-0`}
              />
            </div>

            <input
              type="text" value={data.sshConfig.username}
              onChange={e => onUpdate({ sshConfig: { ...data.sshConfig, username: e.target.value } })}
              placeholder="Username"
              className={`${inputClassName} mb-2 w-full`}
            />

            {/* Auth type toggle */}
            <div className="mb-2 flex gap-1.5">
              {(['key', 'password'] as const).map((type) => {
                const sel = data.sshConfig.authType === type;
                return (
                  <button
                    key={type}
                    onClick={() => onUpdate({ sshConfig: { ...data.sshConfig, authType: type } })}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${sel ? 'border-accent-primary bg-[color-mix(in_srgb,var(--accent-primary)_10%,var(--surface-panel))] text-accent-primary' : 'border-ui-border-default bg-transparent text-ui-text-muted'}`}
                  >
                    {type === 'key' ? <Key size={12} /> : <Lock size={12} />}
                    {type === 'key' ? 'SSH Key' : 'Password'}
                  </button>
                );
              })}
            </div>

            {/* Auth fields */}
            {data.sshConfig.authType === 'password' ? (
              <div className="relative mb-2">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={data.sshConfig.password || ''}
                  onChange={e => onUpdate({ sshConfig: { ...data.sshConfig, password: e.target.value } })}
                  placeholder="Password"
                  className={`${inputClassName} w-full pr-10`}
                />
                <button
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent p-0 text-ui-text-muted"
                >
                  {showPw ? <EyeSlash size={14} /> : <Eye size={14} />}
                </button>
              </div>
            ) : (
              <input
                type="text" value={data.sshConfig.privateKey || '~/.ssh/id_rsa'}
                onChange={e => onUpdate({ sshConfig: { ...data.sshConfig, privateKey: e.target.value } })}
                placeholder="~/.ssh/id_rsa"
                className={`${inputClassName} mb-2 w-full`}
              />
            )}

            <div className={`flex gap-2 ${connMsg ? 'mb-2' : 'mb-0'}`}>
              <button
                onClick={testConn} disabled={connStatus === 'testing' || installing}
                className={`flex-1 cursor-pointer rounded-lg border border-ui-border-default bg-transparent py-2.5 text-[13px] font-semibold text-accent-primary ${connStatus === 'testing' || installing ? 'opacity-40' : 'opacity-100'}`}
              >
                {connStatus === 'testing' ? 'Testing…' : 'Test Connection'}
              </button>
              <button
                onClick={doInstall} disabled={connStatus !== 'ok' || installing}
                className={`flex-1 rounded-lg border-none py-2.5 text-[13px] font-bold transition-colors duration-200 ${connStatus === 'ok' ? 'cursor-pointer bg-accent-primary text-text-inverse' : 'cursor-not-allowed bg-surface-panel-muted text-ui-text-muted'}`}
              >
                {installing ? 'Installing…' : 'Install Backend'}
              </button>
            </div>

            {connMsg && (
              <div className={`rounded-lg px-3 py-2.5 text-xs ${connStatus === 'err' ? 'bg-status-error-bg text-status-error' : connStatus === 'ok' ? 'bg-status-success-bg text-status-success' : 'bg-surface-hover text-ui-text-secondary'}`}>
                {connMsg}
              </div>
            )}

            {progress && (
              <div className="mt-2.5">
                <div className="mb-1.5 flex justify-between text-xs text-ui-text-muted">
                  <span>{progress.message}</span><span>{progress.progress}%</span>
                </div>
                <div className="h-1 overflow-hidden rounded bg-ui-border-subtle">
                  <motion.div
                    animate={{ width: `${progress.progress}%` }}
                    transition={{ duration: 0.4 }}
                    className="h-full rounded bg-accent-primary"
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
    openInBrowser(url);
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
      className="overflow-hidden"
    >
      <div className="flex flex-col gap-3 rounded-2xl border border-ui-border-subtle bg-surface-panel p-4">
        <div className="text-xs font-bold uppercase tracking-widest text-accent-primary">
          Choose a VPS Provider
        </div>

        {/* Provider cards */}
        <div className="flex flex-col gap-2">
          {VPS_PROVIDERS.map((provider) => (
            <motion.button
              key={provider.id}
              onClick={() => openProvider(provider.url, provider.id)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border-none px-3.5 py-3 text-left transition-all duration-150 ${selectedProvider === provider.id ? 'bg-[color-mix(in_srgb,var(--accent-primary)_8%,var(--surface-panel))] outline-2 outline-accent-primary' : 'bg-surface-panel-muted outline-2 outline-transparent'}`}
            >
              {/* Logo */}
              <div className="flex size-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ui-border-subtle bg-surface-panel">
                <img
                  src={provider.logo}
                  alt={provider.name}
                  width={20} height={20}
                  className="object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold leading-tight text-ui-text-primary">
                  {provider.name}
                </div>
                <div className="mt-px text-xs text-ui-text-muted">
                  {provider.description}
                </div>
              </div>

              <div className="flex flex-shrink-0 flex-col items-end gap-1">
                <span className="text-xs font-bold text-accent-primary">
                  {provider.startingPrice}
                </span>
                <div className="flex items-center gap-1 text-xs text-ui-text-muted">
                  Open <ArrowSquareOut size={12} />
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Tip */}
        <div className="flex items-start gap-2 rounded-lg border border-solid border-[color-mix(in_srgb,var(--accent-primary)_15%,transparent)] bg-[color-mix(in_srgb,var(--accent-primary)_6%,var(--surface-panel))] px-3 py-2.5">
          <Warning size={14} className="mt-px flex-shrink-0 text-accent-primary" />
          <span className="text-xs leading-normal text-ui-text-secondary">
            After purchasing, come back here. Enter your VPS IP and root credentials below to install the Allternit backend automatically.
          </span>
        </div>

        {/* "I already have my VPS" toggle */}
        <button
          onClick={() => setShowConnectForm(f => !f)}
          className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-ui-border-default bg-transparent py-2 text-[13px] font-semibold text-accent-primary"
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
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-2 pt-1">
                <div className="text-xs font-bold uppercase tracking-widest text-ui-text-muted">
                  VPS Connection
                </div>

                <div className="flex gap-2">
                  <input
                    type="text" value={sshConfig.host}
                    onChange={e => onUpdate({ sshConfig: { ...sshConfig, host: e.target.value } })}
                    placeholder="VPS IP address"
                    className={inputClassName}
                  />
                  <input
                    type="number" value={sshConfig.port}
                    onChange={e => onUpdate({ sshConfig: { ...sshConfig, port: parseInt(e.target.value) || 22 } })}
                    placeholder="22" className={`${inputClassName} w-18 flex-shrink-0`}
                  />
                </div>

                <input
                  type="text" value={sshConfig.username || 'root'}
                  onChange={e => onUpdate({ sshConfig: { ...sshConfig, username: e.target.value } })}
                  placeholder="root"
                  className={`${inputClassName} w-full`}
                />

                {/* Auth type toggle */}
                <div className="flex gap-1.5">
                  {(['password', 'key'] as const).map((type) => {
                    const sel = sshConfig.authType === type;
                    return (
                      <button
                        key={type}
                        onClick={() => onUpdate({ sshConfig: { ...sshConfig, authType: type } })}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${sel ? 'border-accent-primary bg-[color-mix(in_srgb,var(--accent-primary)_10%,var(--surface-panel))] text-accent-primary' : 'border-ui-border-default bg-transparent text-ui-text-muted'}`}
                      >
                        {type === 'key' ? <Key size={12} /> : <Lock size={12} />}
                        {type === 'key' ? 'SSH Key' : 'Password'}
                      </button>
                    );
                  })}
                </div>

                {sshConfig.authType === 'password' ? (
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={sshConfig.password || ''}
                      onChange={e => onUpdate({ sshConfig: { ...sshConfig, password: e.target.value } })}
                      placeholder="Root password"
                      className={`${inputClassName} w-full pr-10`}
                    />
                    <button
                      onClick={() => setShowPw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent p-0 text-ui-text-muted"
                    >
                      {showPw ? <EyeSlash size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                ) : (
                  <input
                    type="text" value={sshConfig.privateKey || '~/.ssh/id_rsa'}
                    onChange={e => onUpdate({ sshConfig: { ...sshConfig, privateKey: e.target.value } })}
                    placeholder="~/.ssh/id_rsa"
                    className={`${inputClassName} w-full`}
                  />
                )}

                <div className="flex gap-2">
                  <button
                    onClick={testConn} disabled={connStatus === 'testing' || installing}
                    className={`flex-1 cursor-pointer rounded-lg border border-ui-border-default bg-transparent py-2.5 text-[13px] font-semibold text-accent-primary ${connStatus === 'testing' || installing ? 'opacity-40' : 'opacity-100'}`}
                  >
                    {connStatus === 'testing' ? 'Testing…' : 'Test Connection'}
                  </button>
                  <button
                    onClick={doInstall} disabled={connStatus !== 'ok' || installing}
                    className={`flex-1 rounded-lg border-none py-2.5 text-[13px] font-bold transition-colors duration-200 ${connStatus === 'ok' ? 'cursor-pointer bg-accent-primary text-text-inverse' : 'cursor-not-allowed bg-surface-panel-muted text-ui-text-muted'}`}
                  >
                    {installing ? 'Installing…' : 'Install Backend'}
                  </button>
                </div>

                {connMsg && (
                  <div className={`rounded-lg px-3 py-2.5 text-xs ${connStatus === 'err' ? 'bg-status-error-bg text-status-error' : connStatus === 'ok' ? 'bg-status-success-bg text-status-success' : 'bg-surface-hover text-ui-text-secondary'}`}>
                    {connMsg}
                  </div>
                )}

                {progress && (
                  <div>
                    <div className="mb-1.5 flex justify-between text-xs text-ui-text-muted">
                      <span>{progress.message}</span><span>{progress.progress}%</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded bg-ui-border-subtle">
                      <motion.div
                        animate={{ width: `${progress.progress}%` }}
                        transition={{ duration: 0.4 }}
                        className="h-full rounded bg-accent-primary"
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
  { id: 'dark',   label: 'Dark',   desc: 'Sleek & focused',  Icon: Moon,    swatches: ['var(--ui-text-inverse)', '#2A211A', '#3C2E24'] },
  { id: 'light',  label: 'Light',  desc: 'Clean & bright',   Icon: Sun,     swatches: ['#FDF8F3', '#F5EDE3', '#E8D9C8'] },
  { id: 'system', label: 'System', desc: 'Follows your OS',  Icon: Monitor, swatches: ['var(--ui-text-inverse)', '#FDF8F3', '#B08D6E'] },
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
    <div className="flex flex-col gap-2.5">
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
            className={`flex cursor-pointer items-center gap-3.5 rounded-2xl border-none px-4 py-3.5 text-left transition-all duration-150 ${sel ? 'bg-[color-mix(in_srgb,var(--accent-primary)_8%,var(--surface-panel))] outline-2 outline-accent-primary' : 'bg-surface-panel outline-2 outline-ui-border-subtle'}`}
          >
            {/* Swatch strip */}
            <div className="flex h-9 w-13 flex-shrink-0 overflow-hidden rounded-lg border border-ui-border-subtle">
              {opt.swatches.map((c, i) => (
                <div key={i} className="flex-1" style={{ background: c }} />
              ))}
            </div>

            <div className="flex-1">
              <div className={`text-[13px] font-semibold transition-colors duration-150 ${sel ? 'text-accent-primary' : 'text-ui-text-primary'}`}>
                {opt.label}
              </div>
              <div className="mt-0.5 text-xs text-ui-text-muted">
                {opt.desc}
              </div>
            </div>

            <opt.Icon size={16} className={`flex-shrink-0 transition-colors duration-150 ${sel ? 'text-accent-primary' : 'text-ui-text-muted'}`} />

            <motion.div
              animate={{
                background: sel ? 'var(--accent-primary)' : 'transparent',
                borderColor: sel ? 'var(--accent-primary)' : 'var(--ui-border-default)',
              }}
              className="flex size-4.5 flex-shrink-0 items-center justify-center rounded-full border-2"
            >
              {sel && <Check weight="bold" size={12} className="text-text-inverse" />}
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

  // Local Brain download state
  const [lbPullState, setLbPullState] = useState<'idle' | 'pulling' | 'done' | 'error'>('idle');
  const [lbPullProgress, setLbPullProgress] = useState<{ status: string; total?: number; completed?: number } | null>(null);

  const localBrainAlreadyPulled = discovery?.ollama.models.some(
    (m) => m.modelId === 'llama3.2:3b' || m.modelId.startsWith('llama3.2:3b') || m.modelId === 'llama3.2:3b:latest'
  ) ?? false;

  const lbPullPct =
    lbPullProgress?.total && lbPullProgress.completed
      ? Math.round((lbPullProgress.completed / lbPullProgress.total) * 100)
      : null;

  async function startLocalBrainDownload() {
    setLbPullState('pulling');
    setLbPullProgress(null);
    try {
      const res = await fetch('/api/local-brain', { method: 'POST' });
      if (!res.ok) { setLbPullState('error'); return; }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split(String.fromCharCode(10));
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6)) as { status: string; total?: number; completed?: number };
            setLbPullProgress(ev);
            if (ev.status === 'success' || ev.status === 'done') {
              setLbPullState('done');
              onUpdate({ defaultProvider: 'ollama', defaultModelId: 'llama3.2:3b' });
            } else if (ev.status === 'error') {
              setLbPullState('error');
            }
          } catch {}
        }
      }
    } catch {
      setLbPullState('error');
    }
  }

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
    <div className="flex flex-col gap-3">
      <HintBox>
        Connect the AI "brain" you want to use. If you have Ollama or other tools installed, we found them automatically. Or paste an API key from a cloud provider.
      </HintBox>

      {/* ── Local / CLI section ── */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ui-text-muted">
          Found on this machine
          {scanning && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="flex"
            >
              <ArrowClockwise size={12} className="text-accent-primary" />
            </motion.div>
          )}
        </div>

        {scanning && (
          <div className="rounded-xl border border-ui-border-subtle bg-surface-panel px-3.5 py-3 text-xs text-ui-text-muted">
            Scanning for Ollama, LM Studio and AI CLI tools…
          </div>
        )}

        {!scanning && !hasLocalModels && (
          <div className="rounded-xl border border-ui-border-subtle bg-surface-panel px-3.5 py-3 text-xs text-ui-text-muted">
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
              className={`mb-1.5 flex w-full cursor-pointer items-center gap-3 rounded-xl border-none px-3.5 py-3 text-left transition-all duration-150 ${sel ? 'bg-[color-mix(in_srgb,var(--accent-primary)_8%,var(--surface-panel))] outline-2 outline-accent-primary' : 'bg-surface-panel outline-2 outline-ui-border-subtle'}`}
            >
              <div className={`flex size-8 flex-shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold tracking-wider ${sel ? 'bg-[color-mix(in_srgb,var(--accent-primary)_18%,var(--surface-panel))] text-accent-primary' : 'bg-surface-panel-muted text-ui-text-muted'}`}>
                {m.source === 'ollama' ? 'OL' : m.source === 'lmstudio' ? 'LM' : 'AI'}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-ui-text-primary">
                    {m.name}
                  </span>
                  {m.size && (
                    <span className="rounded bg-[color-mix(in_srgb,var(--ui-text-muted)_12%,transparent)] px-1 py-0.5 text-xs font-bold text-ui-text-muted">
                      {m.size}
                    </span>
                  )}
                  {m.badge && (
                    <span className="rounded bg-[color-mix(in_srgb,#10b981_15%,transparent)] px-1.5 py-0.5 text-xs font-bold tracking-wider text-status-success">
                      {m.badge}
                    </span>
                  )}
                </div>
                <div className="mt-px text-xs text-ui-text-muted">
                  {m.modelId}
                </div>
              </div>

              <motion.div
                animate={{
                  background: sel ? 'var(--accent-primary)' : 'transparent',
                  borderColor: sel ? 'var(--accent-primary)' : 'var(--ui-border-default)',
                }}
                className="flex size-4 flex-shrink-0 items-center justify-center rounded-full border-2"
              >
                {sel && <Check weight="bold" size={12} className="text-text-inverse" />}
              </motion.div>
            </motion.button>
          );
        })}
      </div>

      {/* ── Local Brain section ── */}
      {!scanning && !localBrainAlreadyPulled && (
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-ui-text-muted">
            Local Brain
          </div>

          {!discovery?.ollama.running ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-ui-border-subtle bg-surface-panel px-3.5 py-3 text-xs text-ui-text-muted">
              <HardDrive size={16} className="flex-shrink-0" />
              <span>
                Install{' '}
                <strong className="text-ui-text-primary">Ollama</strong>
                {' '}to run AI offline — no API key needed.{' '}
                <a
                  href="https://ollama.com/download"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-primary underline"
                >
                  Get Ollama →
                </a>
              </span>
            </div>
          ) : lbPullState === 'pulling' ? (
            <div className="rounded-xl border-2 border-accent-primary bg-[color-mix(in_srgb,var(--accent-primary)_5%,var(--surface-panel))] p-3">
              <div className="mb-2 flex items-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="flex text-accent-primary"
                >
                  <ArrowClockwise size={13} />
                </motion.div>
                <span className="text-[13px] font-semibold text-ui-text-primary">
                  Downloading Local Brain
                </span>
                {lbPullPct !== null && (
                  <span className="ml-auto text-xs text-accent-primary">
                    {lbPullPct}%
                  </span>
                )}
              </div>
              <div className="h-1 overflow-hidden rounded bg-ui-border-subtle">
                <div
                  className="h-full rounded bg-accent-primary transition-width duration-300 ease-in-out"
                  style={{ width: lbPullPct !== null ? `${lbPullPct}%` : '5%' }}
                 />
              </div>
              <div className="mt-1.5 text-xs text-ui-text-muted">
                {lbPullProgress?.status ?? 'Preparing…'} · llama3.2:3b (~2 GB)
              </div>
            </div>
          ) : lbPullState === 'done' ? (
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2.5 rounded-xl border-2 border-[#10b981] bg-[color-mix(in_srgb,#10b981_8%,var(--surface-panel))] p-3"
            >
              <CheckCircle size={20} weight="fill" className="flex-shrink-0 text-status-success" />
              <div>
                <div className="text-[13px] font-semibold text-ui-text-primary">
                  Local Brain ready
                </div>
                <div className="text-xs text-ui-text-muted">
                  llama3.2:3b · offline · selected as your brain
                </div>
              </div>
            </motion.div>
          ) : lbPullState === 'error' ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-ui-border-subtle bg-surface-panel p-3 text-xs">
              <Warning size={15} className="flex-shrink-0 text-status-error" />
              <span className="text-ui-text-muted">Download failed — </span>
              <button
                onClick={startLocalBrainDownload}
                className="cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-accent-primary"
              >
                try again
              </button>
            </div>
          ) : (
            <motion.button
              onClick={startLocalBrainDownload}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full cursor-pointer items-center gap-3 rounded-xl border-none p-3 text-left bg-surface-panel outline-2 outline-ui-border-subtle transition-all duration-150 flex"
            >
              <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent)] text-accent-primary">
                <CloudArrowDown size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-ui-text-primary">
                    Local Brain
                  </span>
                  <span className="rounded bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent)] px-1 py-0.5 text-xs font-bold text-accent-primary">
                    ~2 GB
                  </span>
                  <span className="rounded bg-[color-mix(in_srgb,#10b981_15%,transparent)] px-1.5 py-0.5 text-xs font-bold tracking-wider text-status-success">
                    Offline · private
                  </span>
                </div>
                <div className="mt-px text-xs text-ui-text-muted">
                  llama3.2:3b — works on any machine, no API key needed
                </div>
              </div>
              <div className="flex-shrink-0 rounded bg-accent-primary px-2.5 py-1 text-xs font-bold text-text-inverse">
                Download
              </div>
            </motion.button>
          )}
        </div>
      )}

      {/* ── Cloud providers section ── */}
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-ui-text-muted">
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
            <div key={p.id} className="mb-1.5">
              {/* Provider row */}
              <motion.button
                onClick={() => setExpandedProvider(isExpanded ? null : p.id)}
                whileHover={{ scale: 1.005 }}
                className={`flex w-full cursor-pointer items-center gap-3 border-none p-3 text-left transition-all duration-150 ${isExpanded ? 'rounded-t-xl' : 'rounded-xl'} ${sel ? 'bg-[color-mix(in_srgb,var(--accent-primary)_8%,var(--surface-panel))] outline-2 outline-accent-primary' : isExpanded ? 'bg-surface-panel outline-2 outline-ui-border-default' : 'bg-surface-panel outline-2 outline-ui-border-subtle'}`}
              >
                <div
                  className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg text-ui-text-primary"
                  style={{ background: p.logoBg }}
                >
                  <p.Logo size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-ui-text-primary">
                      {p.name}
                    </span>
                    {p.badge && !isValid && (
                      <span
                        className="rounded px-1.5 py-0.5 text-xs font-bold tracking-wider"
                        style={{ background: `color-mix(in srgb, ${p.badgeColor} 15%, transparent)`, color: p.badgeColor }}
                      >
                        {p.badge}
                      </span>
                    )}
                    {isValid && (
                      <span className="flex items-center rounded bg-[color-mix(in_srgb,#10b981_15%,transparent)] px-1.5 py-0.5 text-xs font-bold tracking-wider text-status-success">
                        <Check weight="bold" size={12} className="mr-0.5" /> Connected
                      </span>
                    )}
                  </div>
                  <div className="mt-px text-xs text-ui-text-muted">
                    {p.tagline}
                  </div>
                </div>

                <CaretRight
                  size={13}
                  className={`flex-shrink-0 text-ui-text-muted transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
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
                    className="overflow-hidden rounded-b-xl border-2 border-t-0 border-ui-border-default bg-surface-panel"
                  >
                    <div className="flex flex-col gap-2 p-3">
                      {/* Key input */}
                      <div className="relative">
                        <input
                          type={showKey[p.id] ? 'text' : 'password'}
                          value={keyDraft[p.id] ?? ''}
                          onChange={(e) => {
                            setKeyDraft((d) => ({ ...d, [p.id]: e.target.value }));
                            if (keyStatus[p.id] !== 'idle') setKeyStatus((s) => ({ ...s, [p.id]: 'idle' }));
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') validateKey(p.id); }}
                          placeholder={p.keyPlaceholder}
                          className={`${inputClassName} w-full pr-20 font-mono`}
                          autoFocus
                        />
                        <button
                          onClick={() => setShowKey((s) => ({ ...s, [p.id]: !s[p.id] }))}
                          className="absolute right-10 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent p-1 text-ui-text-muted"
                        >
                          {showKey[p.id] ? <EyeSlash size={13} /> : <Eye size={13} />}
                        </button>
                        <button
                          onClick={() => validateKey(p.id)}
                          disabled={isChecking || (keyDraft[p.id] ?? '').trim().length < 10}
                          className={`absolute right-1.5 top-1/2 flex -translate-y-1/2 cursor-pointer items-center gap-1 rounded border-none px-2 py-1 text-xs font-bold transition-all duration-150 ${isChecking ? 'bg-surface-panel-muted text-ui-text-muted' : 'bg-accent-primary text-text-inverse'} ${(keyDraft[p.id] ?? '').trim().length < 10 ? 'opacity-40' : 'opacity-100'}`}
                        >
                          {isChecking ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                              className="flex"
                            >
                              <ArrowClockwise size={12} />
                            </motion.div>
                          ) : 'Test'}
                        </button>
                      </div>

                      {/* Error / hint */}
                      {keyError[p.id] && status === 'invalid' && (
                        <div className="rounded-lg bg-status-error-bg px-2.5 py-2 text-xs text-status-error">
                          {keyError[p.id]}
                        </div>
                      )}

                      {!keyError[p.id] && (
                        <div className="text-xs text-ui-text-muted">
                          {p.keyHint}
                        </div>
                      )}

                      {/* Model picker once key is valid */}
                      {isValid && models.length > 0 && (
                        <div className="flex flex-col gap-1.5 pt-1">
                          <div className="text-xs font-bold uppercase tracking-widest text-ui-text-muted">
                            Choose default model
                          </div>
                          <div className="flex flex-col gap-1">
                            {models.map((m) => {
                              const mSel = selectedModel === m.id;
                              return (
                                <button
                                  key={m.id}
                                  onClick={() => onUpdate({ defaultModelId: m.id, defaultProvider: p.id })}
                                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors duration-150 ${mSel ? 'border-accent-primary bg-[color-mix(in_srgb,var(--accent-primary)_8%,var(--surface-panel))]' : 'border-ui-border-subtle bg-surface-panel-muted'}`}
                                >
                                  {mSel && <Check weight="bold" size={12} className="flex-shrink-0 text-accent-primary" />}
                                  <span className={`text-xs text-ui-text-primary ${mSel ? 'font-semibold' : 'font-normal'}`}>
                                    {m.name}
                                  </span>
                                  <span className="ml-auto font-mono text-xs text-ui-text-muted">
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
        <div className="mt-0.5 text-center text-xs text-ui-text-muted">
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
  { key: 'code',    label: 'A:// Code',    Icon: Code,        color: 'var(--status-success)', bg: 'rgba(16,185,129,0.1)'  },
  { key: 'browser', label: 'A:// Browser', Icon: Globe,       color: '#ec4899', bg: 'rgba(236,72,153,0.1)'  },
  { key: 'agents',  label: 'A:// Agents',  Icon: Robot,       color: 'var(--status-warning)', bg: 'var(--status-warning-bg)'  },
  { key: 'private', label: 'Private',      Icon: ShieldCheck, color: 'var(--status-info)', bg: 'rgba(6,182,212,0.1)'   },
];

function ModePreviewChat() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex justify-end">
        <div className="max-w-[72%] rounded-t-2xl rounded-bl-2xl rounded-br-md border border-solid border-[rgba(99,102,241,0.2)] bg-[rgba(99,102,241,0.15)] px-3 py-2 text-xs leading-normal text-ui-text-primary">
          Explain quantum computing simply
        </div>
      </div>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex size-5 flex-shrink-0 items-center justify-center rounded-full border border-solid border-[rgba(99,102,241,0.2)] bg-[rgba(99,102,241,0.15)]">
          <MatrixLogo state="idle" size={13} />
        </div>
        <div className="flex-1 rounded-tr-2xl rounded-b-2xl rounded-tl-md border border-ui-border-subtle bg-surface-panel px-3 py-2 text-xs leading-relaxed text-ui-text-secondary">
          Quantum computers use qubits that can exist as both 0 and 1 simultaneously — unlike classical bits. This lets them solve certain problems exponentially faster.
        </div>
      </div>
      <div className="flex items-center gap-1 pl-7">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="size-1 rounded-full bg-[rgba(99,102,241,0.5)]"
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
    { text: '✓ Scanning workspace…',           color: 'var(--status-success)' },
    { text: '✓ Found issue in auth.ts:42',     color: 'var(--status-success)' },
    { text: '~ Applying null-check fix…',      color: 'var(--status-warning)' },
    { text: '',                                color: '' },
    { text: '1 file patched — 0 errors remain', color: 'rgba(255,255,255,0.4)' },
  ];
  return (
    <div className="rounded-lg border border-ui-border-muted bg-[rgba(0,0,0,0.35)] px-3.5 py-3 font-mono text-xs">
      {lines.map((l, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08 + i * 0.07, duration: 0.22 }}
          className={`leading-[1.7] ${l.text ? 'h-auto' : 'h-[6px]'}`}
          style={{ color: l.color || 'transparent' }}
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
    <div className="flex flex-col gap-2">
      {/* Browser chrome bar */}
      <div className="flex items-center gap-1.5 rounded-lg border border-ui-border-muted bg-[rgba(0,0,0,0.25)] px-2.5 py-1.5">
        <div className="flex gap-1">
          {['#ff5f57','#febc2e','#28c840'].map(c => (
            <div key={c} className="size-2 rounded-full opacity-70" style={{ background: c }} />
          ))}
        </div>
        <div className="flex-1 rounded border border-ui-border-muted bg-surface-hover px-2 py-1 font-mono text-xs text-[rgba(255,255,255,0.35)]">
          competitor.com/pricing
        </div>
      </div>
      {/* Steps */}
      <div className="flex flex-col gap-1 pl-1">
        {steps.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.12, duration: 0.25 }}
            className="flex items-center gap-2 text-xs"
          >
            <div
              className="size-1 flex-shrink-0 rounded-full"
              style={{ background: i < 2 ? '#ec4899' : 'rgba(255,255,255,0.2)' }}
             />
            <span className={`leading-snug ${i < 2 ? 'text-ui-text-primary' : 'text-ui-text-secondary'}`}>
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
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-solid border-[rgba(245,158,11,0.15)] bg-[rgba(245,158,11,0.08)] px-2.5 py-2 text-[12.5px] font-semibold text-[rgba(245,158,11,0.9)]">
        Task: Research AI landscape + compile report
      </div>
      <div className="flex flex-col gap-1.5 pl-0.5">
        {tasks.map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 + i * 0.1, duration: 0.22 }}
            className="flex items-center gap-2 text-xs"
          >
            <div
              className={`flex size-4 flex-shrink-0 items-center justify-center rounded-full border ${t.done ? 'border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.2)]' : t.active ? 'border-[rgba(245,158,11,0.3)] bg-surface-hover' : 'border-ui-border-default bg-surface-hover'}`}
            >
              {t.done ? (
                <Check size={12} weight="bold" className="text-status-warning" />
              ) : t.active ? (
                <motion.div
                  className="size-1.5 rounded-full bg-status-warning"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                />
              ) : null}
            </div>
            <span className={`leading-snug ${t.done ? 'text-ui-text-muted line-through opacity-55' : t.active ? 'text-ui-text-primary' : 'text-ui-text-muted'}`}>
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
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 rounded-lg border border-solid border-[rgba(6,182,212,0.18)] bg-[rgba(6,182,212,0.08)] px-3 py-2">
        <motion.div
          className="size-2 flex-shrink-0 rounded-full bg-status-info"
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
        <span className="text-xs font-semibold text-[rgba(6,182,212,0.9)]">
          Running entirely on your machine
        </span>
      </div>
      {[
        { label: 'Model',   value: 'llama3.2 · Ollama' },
        { label: 'Device',  value: 'Your computer' },
        { label: 'Network', value: 'None — fully offline' },
      ].map(({ label, value }) => (
        <div key={label} className="flex items-center justify-between text-xs">
          <span className="text-ui-text-muted">{label}</span>
          <span className="font-medium text-ui-text-primary">{value}</span>
        </div>
      ))}
      <div className="pt-1">
        <div className="mb-1 flex justify-between text-xs text-ui-text-muted">
          <span>Inference load</span><span>72%</span>
        </div>
        <div className="h-1 overflow-hidden rounded bg-surface-active">
          <motion.div
            className="h-full rounded"
            style={{ background: 'linear-gradient(90deg, #06b6d4, #0891b2)' }}
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
    <div className="flex flex-col gap-3">
      {/* Preview card */}
      <div
        className="overflow-hidden rounded-2xl border bg-surface-panel transition-colors duration-350"
        style={{ borderColor: `color-mix(in srgb, ${activeTab.color} 22%, var(--ui-border-subtle))` }}
      >
        {/* Colored top bar */}
        <div
          className="flex items-center gap-2.5 border-b border-ui-border-subtle px-3.5 py-3 transition-colors duration-350"
          style={{ background: `color-mix(in srgb, ${activeTab.color} 6%, var(--surface-panel))` }}
        >
          <div
            className="flex size-6 items-center justify-center rounded-lg transition-colors duration-350"
            style={{ background: activeTab.bg }}
          >
            <activeTab.Icon size={14} weight="bold" style={{ color: activeTab.color }} />
          </div>
          <span
            className="text-xs font-bold tracking-[-0.01em] transition-colors duration-350"
            style={{ color: activeTab.color }}
          >
            {activeTab.label}
          </span>
        </div>
        {/* Animated preview */}
        <div className="min-h-36 px-4 py-3.5">
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
      <div className="flex flex-wrap gap-1">
        {MODE_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActive(tab.key); setUserPicked(true); }}
            className={`flex cursor-pointer items-center gap-1 rounded-full border-none px-2.5 py-1 text-xs transition-all duration-150 ${active === tab.key ? 'font-bold' : 'font-medium'}`}
            style={{
              background: active === tab.key ? tab.bg : 'transparent',
              color: active === tab.key ? tab.color : 'var(--ui-text-muted)',
              outline: active === tab.key ? `1px solid color-mix(in srgb, ${tab.color} 30%, transparent)` : '1px solid transparent',
            }}
          >
            <tab.Icon size={12} weight={active === tab.key ? 'bold' : 'regular'} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Auto-cycle progress dots */}
      {!userPicked && (
        <div className="flex justify-center gap-1">
          {MODE_TABS.map(tab => (
            <div
              key={tab.key}
              className="h-0.5 rounded transition-all duration-300 ease-in-out"
              style={{
                width: active === tab.key ? 18 : 6,
                background: active === tab.key ? tab.color : 'var(--ui-border-default)',
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
    <div className="flex h-full min-h-0 items-stretch gap-0">
      {/* Left — celebration + summary + CTA */}
      <div className="flex w-80 flex-shrink-0 flex-col items-center justify-center border-r border-ui-border-subtle px-8 pb-9 pt-10 text-center">
        {/* MatrixLogo with success ring */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 340, damping: 24 }}
          className="relative mb-6 inline-flex"
        >
          <motion.div
            animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.15, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="pointer-events-none absolute inset-[-14px] rounded-full border border-solid border-[color-mix(in_srgb,var(--accent-primary)_35%,transparent)]"
          />
          <MatrixLogo state="idle" size={52} />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.45, type: 'spring', stiffness: 320, damping: 18 }}
            className="absolute bottom-[-4px] right-[-4px] flex size-5 items-center justify-center rounded-full shadow-[0_2px_8px_rgba(16,185,129,0.45)]"
            style={{ background: 'linear-gradient(135deg, #34d399, #10b981)'}}
          >
            <Check weight="bold" size={12} className="text-ui-text-primary" />
          </motion.div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="mb-1.5 text-xl font-bold tracking-[-0.025em] text-ui-text-primary"
        >
          Allternit is ready.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.3 }}
          className="mb-6 max-w-[220px] text-[13px] leading-normal text-ui-text-muted"
        >
          Everything is configured. Here's what you set up —
        </motion.p>

        {/* Setup summary */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, duration: 0.28 }}
          className="mb-7 flex w-full flex-col gap-2 rounded-xl border border-ui-border-subtle bg-surface-panel px-3.5 py-3"
        >
          {[
            { label: 'Runs on',  value: infraLabel },
            ...(modelLabel ? [{ label: 'AI model', value: modelLabel }] : []),
            { label: 'API keys', value: keyCount > 0 ? `${keyCount} configured` : 'None — use local models' },
            { label: 'Modes',    value: `${data.selectedModes.length} enabled` },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <span className="text-ui-text-muted">{label}</span>
              <span className="max-w-35 truncate whitespace-nowrap text-right font-semibold text-ui-text-primary">{value}</span>
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
          className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-full border-none bg-accent-primary py-3 text-sm font-bold text-text-inverse shadow-md"
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
        className="flex min-w-0 flex-1 flex-col justify-center px-9 py-8"
      >
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-ui-text-muted">
          What you can do now
        </p>
        <ModeShowcase />
      </motion.div>
    </div>
  );
}

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
    // Notify the desktop shell that onboarding is complete so it can update its own store.
    if (typeof window !== 'undefined' && (window as any).allternit?.app?.completeOnboarding) {
      (window as any).allternit.app.completeOnboarding().catch(() => {});
    }
  };

  const isFullWidth = screen === 'welcome' || screen === 'done';
  const meta = STEP_META[screen] ?? { title: '', sub: '' };

  return (
    <motion.div
      variants={CARD_ENTRANCE}
      initial="hidden"
      animate="visible"
      className="flex h-[calc(100vh-48px)] w-[calc(100vw-48px)] max-h-[800px] max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-shell-dialog-border bg-shell-dialog-bg shadow-xl"
    >
      {/* Inner layout: sidebar + content OR full-width */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left sidebar — only visible for inner steps */}
        <AnimatePresence initial={false}>
          {!isFullWidth && (
            <motion.div
              key="sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 196, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
              className="flex-shrink-0 overflow-hidden"
            >
              <div className="w-[196px]">
                <StepSidebar screen={screen} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right content area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Step header (inner steps only) */}
          {!isFullWidth && (
            <div className="flex-shrink-0 px-7 pb-0 pt-6">
              <h2 className="m-0 text-lg font-bold leading-tight tracking-[-0.02em] text-ui-text-primary">
                {meta.title}
              </h2>
              <p className="m-0 mt-1 text-[13px] text-ui-text-muted">
                {meta.sub}
              </p>
            </div>
          )}

          {/* Animated step content */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            <AnimatePresence custom={direction.current} mode="wait">
              <motion.div
                key={screen}
                custom={direction.current}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className={isFullWidth ? '' : 'px-7 pb-6 pt-5'}
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
            <div className="flex flex-shrink-0 items-center justify-between border-t border-ui-border-subtle px-7 py-3.5">
              <motion.button
                onClick={goBack}
                whileHover={{ color: 'var(--ui-text-primary)' }}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border-none bg-transparent px-3.5 py-2 text-[13px] font-semibold text-ui-text-muted"
              >
                <CaretLeft size={13} />
                Back
              </motion.button>

              <div className="flex flex-col items-end gap-1">
                <motion.button
                  onClick={goNext}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className={`flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold shadow-sm transition-colors duration-200 ${screen === 'modes' && !data.defaultProvider ? 'border border-ui-border-default bg-surface-panel-muted text-ui-text-muted' : 'border-none bg-accent-primary text-text-inverse'}`}
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
