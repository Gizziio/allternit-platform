'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, CircleAlert, TriangleAlert } from 'lucide-react';
import { AProtocolWordmark } from '@/components/AProtocolWordmark';

/**
 * Post-install onboarding for the Allternit browser extension.
 * Opened in a tab by the extension's chrome.runtime.onInstalled handler
 * (https://platform.allternit.com/extension/installed?source=install).
 *
 * Click-through: risks/errors disclosure → feature intros → get started.
 * Also detects the extension (content script sets
 * document.documentElement.dataset.allternitExtensionReady) and pairs the
 * page↔extension token bridge via externally_connectable messaging.
 */

// No Chrome Web Store listing exists yet — point install CTA at docs until one does.
const EXTENSION_INSTALL_URL = 'https://docs.allternit.com';
const DOCS_LEARN_MORE_URL = 'https://docs.allternit.com';

const SAND = '#D4B08C';
const SAND_BORDER = 'rgba(212,176,140,0.16)';
const RED = '#E5484D';

type ExtStatus = 'checking' | 'connected' | 'unpaired' | 'not-detected';

type ChromeRuntimeBridge = {
  runtime?: {
    sendMessage: (
      extensionId: string,
      message: unknown,
    ) => Promise<{ ok?: boolean; token?: string | null } | undefined>;
  };
};

export default function ExtensionInstalledPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [extStatus, setExtStatus] = useState<ExtStatus>('checking');

  const next = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(6, s + 1));
  }, []);

  // Detect the extension (content script stamps the <html> dataset at
  // document_end) and, once found, pair the token bridge so the platform can
  // drive the agent. Mirrors the handshake in the extension's content.ts.
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;

    const pair = async (extensionId: string) => {
      const chromeApi = (window as unknown as { chrome?: ChromeRuntimeBridge }).chrome;
      if (!chromeApi?.runtime?.sendMessage) {
        if (!cancelled) setExtStatus('unpaired');
        return;
      }
      try {
        const res = await chromeApi.runtime.sendMessage(extensionId, {
          type: 'ALLTERNIT_PAIR_REQUEST',
        });
        if (!cancelled && res?.ok && res.token) {
          localStorage.setItem('AllternitExtUserAuthToken', res.token);
          setExtStatus('connected');
        } else if (!cancelled) {
          setExtStatus('unpaired');
        }
      } catch {
        if (!cancelled) setExtStatus('unpaired');
      }
    };

    const check = () => {
      if (cancelled) return;
      const extensionId = document.documentElement.dataset.allternitExtensionReady;
      if (extensionId) {
        void pair(extensionId);
        return;
      }
      attempts += 1;
      if (attempts < 15) {
        timer = window.setTimeout(check, 200);
      } else {
        setExtStatus('not-detected');
      }
    };

    check();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#1A1612] text-[#E8E2DA] flex flex-col items-center px-6 py-10 select-none">
      {/* Wordmark */}
      <div className="mb-4" aria-label="Allternit">
        <AProtocolWordmark theme="light" height={18} />
      </div>

      {/* Extension status pill */}
      <StatusPill status={extStatus} />

      {/* Carousel */}
      <div className="flex-1 w-full max-w-[420px] flex flex-col items-center justify-center">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: 32 * direction }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -32 * direction }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="w-full flex flex-col items-center text-center"
          >
            {step === 0 && <DisclosureStep />}
            {step === 1 && <AutomateStep />}
            {step === 2 && <TabGroupStep />}
            {step === 3 && <FirstTaskStep />}
            {step === 4 && <VaultStep />}
            {step === 5 && <MemoryStep />}
            {step === 6 && <AllSetStep />}
          </motion.div>
        </AnimatePresence>

        {/* Primary action */}
        <button
          type="button"
          onClick={() => (step < 3 ? next() : navigate('/shell'))}
          className="mt-8 rounded-lg bg-[#E8E2DA] px-6 py-2.5 text-sm font-medium text-[#1A1612] transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4B08C]"
        >
          {step === 0 ? 'I understand' : step < 6 ? 'Next' : "Let's go"}
        </button>

        {/* Progress dots */}
        <div className="mt-6 flex items-center gap-2" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <span
              key={i}
              className="size-1.5 rounded-full transition-colors"
              style={{ background: i === step ? SAND : 'rgba(212,176,140,0.25)' }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

/* ─── Status pill ─────────────────────────────────────────────────────────── */

function StatusPill({ status }: { status: ExtStatus }) {
  if (status === 'checking') {
    return (
      <p className="mb-2 text-xs text-[#98908A]">
        <Dot color="#98908A" /> Checking for the extension…
      </p>
    );
  }
  if (status === 'connected') {
    return (
      <p className="mb-2 text-xs text-[#C9BBA9]">
        <Dot color="#79C47C" /> Extension connected
      </p>
    );
  }
  if (status === 'unpaired') {
    return (
      <p className="mb-2 text-xs text-[#C9BBA9]">
        <Dot color={SAND} /> Extension detected — reload this page to finish pairing
      </p>
    );
  }
  return (
    <p className="mb-2 text-xs text-[#98908A]">
      <Dot color="#6B6259" /> Extension not detected —{' '}
      <a
        href={EXTENSION_INSTALL_URL}
        target="_blank"
        rel="noreferrer"
        className="text-[#D4B08C] underline underline-offset-2 hover:text-[#E8D9C8]"
      >
        get the extension
      </a>
    </p>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-1.5 rounded-full mr-1.5 align-middle"
      style={{ background: color }}
    />
  );
}

/* ─── Step 0: disclosure ──────────────────────────────────────────────────── */

function DisclosureStep() {
  return (
    <>
      <h1 className="font-[var(--font-research)] text-2xl mb-6">Before you begin</h1>
      <div className="w-full rounded-xl border border-[#2E2822] divide-y divide-[#2E2822] text-left">
        <DisclosureRow icon={<CircleAlert size={18} className="shrink-0 text-[#C9BBA9]" />}>
          Allternit acts autonomously and is susceptible to errors — it can misclick, mistype, or
          misread a page. Review its work; you are responsible for actions taken on your behalf.
        </DisclosureRow>
        <DisclosureRow icon={<Camera size={18} className="shrink-0 text-[#C9BBA9]" />}>
          Allternit can take screenshots and read page content while working. For privacy, avoid
          using it on sensitive sites like health and banking platforms.
        </DisclosureRow>
        <DisclosureRow
          icon={<TriangleAlert size={18} className="shrink-0" style={{ color: RED }} />}
          danger
        >
          Malicious actors can hide instructions in websites, emails, and documents that trick AI
          into taking harmful actions without your knowledge.{' '}
          <a
            href={DOCS_LEARN_MORE_URL}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:opacity-80"
          >
            Learn more
          </a>
        </DisclosureRow>
      </div>
    </>
  );
}

function DisclosureRow({
  icon,
  children,
  danger,
}: {
  icon: ReactNode;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <span className="mt-0.5">{icon}</span>
      <p
        className="m-0 text-[13px] leading-relaxed"
        style={{ color: danger ? RED : '#C9BBA9' }}
      >
        {children}
      </p>
    </div>
  );
}

/* ─── Step 1: automate repetitive tasks ───────────────────────────────────── */

function AutomateStep() {
  return (
    <>
      <BrowserWindowIllustration>
        {/* checklist card */}
        <rect x="118" y="26" width="56" height="56" rx="8" fill="#241E18" stroke={SAND_BORDER} />
        <line x1="128" y1="40" x2="162" y2="40" stroke={SAND} strokeWidth="2" opacity="0.7" />
        <line x1="128" y1="52" x2="156" y2="52" stroke={SAND} strokeWidth="2" opacity="0.45" />
        <line x1="128" y1="64" x2="160" y2="64" stroke={SAND} strokeWidth="2" opacity="0.45" />
        <path d="M124 38 l2.5 2.5 l4 -4.5" stroke={SAND} strokeWidth="1.6" fill="none" />
        <path d="M124 50 l2.5 2.5 l4 -4.5" stroke={SAND} strokeWidth="1.6" fill="none" />
      </BrowserWindowIllustration>
      <h1 className="font-[var(--font-research)] text-2xl mt-8 mb-3">
        Automate your repetitive tasks
      </h1>
      <p className="m-0 max-w-[340px] text-sm leading-relaxed text-[#B0A79C]">
        Allternit can take on your multi-step work like QA testing, researching sales leads, and
        data entry across multiple sites. You can focus elsewhere knowing Allternit is working in
        the background.
      </p>
    </>
  );
}

/* ─── Step 2: tab group access ────────────────────────────────────────────── */

function TabGroupStep() {
  return (
    <>
      <svg width="220" height="110" viewBox="0 0 220 110" fill="none" aria-hidden="true">
        {/* window body */}
        <rect x="30" y="34" width="160" height="66" rx="8" fill="#241E18" stroke="#2E2822" />
        {/* active tab */}
        <path
          d="M30 42 a8 8 0 0 1 8 -8 h56 v14 h-64 z"
          fill="#2A211A"
          stroke={SAND_BORDER}
        />
        {/* tab-group label pill */}
        <rect x="40" y="21" width="52" height="15" rx="7.5" fill={SAND} />
        <text x="66" y="32" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#1A1612">
          Agent
        </text>
        {/* sibling tabs */}
        <rect x="102" y="24" width="30" height="10" rx="3" stroke={SAND_BORDER} />
        <rect x="140" y="24" width="30" height="10" rx="3" stroke={SAND_BORDER} />
        {/* page content lines */}
        <line x1="44" y1="56" x2="120" y2="56" stroke={SAND} strokeWidth="2" opacity="0.5" />
        <line x1="44" y1="66" x2="150" y2="66" stroke={SAND} strokeWidth="2" opacity="0.3" />
        <line x1="44" y1="76" x2="135" y2="76" stroke={SAND} strokeWidth="2" opacity="0.3" />
      </svg>
      <h1 className="font-[var(--font-research)] text-2xl mt-8 mb-3">
        Allternit has tab group access
      </h1>
      <p className="m-0 max-w-[340px] text-sm leading-relaxed text-[#B0A79C]">
        If Allternit is open in a tab group, it can access the URLs, context, and content of the
        tabs in that group to get work done.
      </p>
    </>
  );
}

/* ─── Step 3: first task ──────────────────────────────────────────────────── */

function FirstTaskStep() {
  return (
    <>
      <svg width="220" height="110" viewBox="0 0 220 110" fill="none" aria-hidden="true">
        {/* browser window */}
        <rect x="14" y="14" width="150" height="82" rx="8" fill="#241E18" stroke="#2E2822" />
        <circle cx="26" cy="24" r="2.5" fill="#D97757" />
        <circle cx="34" cy="24" r="2.5" fill={SAND} opacity="0.6" />
        <circle cx="42" cy="24" r="2.5" fill={SAND} opacity="0.35" />
        <line x1="26" y1="44" x2="90" y2="44" stroke={SAND} strokeWidth="2" opacity="0.4" />
        <line x1="26" y1="54" x2="110" y2="54" stroke={SAND} strokeWidth="2" opacity="0.25" />
        <line x1="26" y1="64" x2="100" y2="64" stroke={SAND} strokeWidth="2" opacity="0.25" />
        {/* side panel */}
        <rect x="170" y="14" width="44" height="82" rx="8" fill="#2A211A" stroke={SAND_BORDER} />
        <text x="192" y="32" textAnchor="middle" fontSize="11" fontFamily="monospace" fill={SAND}>
          A://
        </text>
        <rect x="177" y="42" width="30" height="16" rx="4" fill="#1A1612" stroke={SAND_BORDER} />
        <line x1="181" y1="50" x2="203" y2="50" stroke={SAND} strokeWidth="1.5" opacity="0.6" />
        <rect x="177" y="64" width="30" height="16" rx="4" stroke={SAND} opacity="0.8" />
        <line x1="181" y1="72" x2="199" y2="72" stroke={SAND} strokeWidth="1.5" opacity="0.4" />
      </svg>
      <h1 className="font-[var(--font-research)] text-2xl mt-8 mb-3">
        Give Allternit your first task
      </h1>
      <p className="m-0 max-w-[340px] text-sm leading-relaxed text-[#B0A79C]">
        Click the Allternit icon in your toolbar to open the side panel and describe a task —
        Allternit will navigate, click, and type to complete it.
      </p>
    </>
  );
}

/* ─── Step 4: password vault ──────────────────────────────────────────────── */

function VaultStep() {
  return (
    <>
      <svg width="220" height="110" viewBox="0 0 220 110" fill="none" aria-hidden="true">
        <rect x="40" y="10" width="140" height="90" rx="8" fill="#241E18" stroke="#2E2822" />
        <circle cx="52" cy="20" r="2.5" fill="#D97757" />
        <circle cx="60" cy="20" r="2.5" fill={SAND} opacity="0.6" />
        <circle cx="68" cy="20" r="2.5" fill={SAND} opacity="0.35" />
        {/* lock body */}
        <rect x="90" y="48" width="40" height="34" rx="4" fill="#2A211A" stroke={SAND_BORDER} />
        {/* lock shackle */}
        <path d="M100 48 v-10 a10 10 0 0 1 20 0 v10" stroke={SAND} strokeWidth="3" fill="none" />
        {/* keyhole */}
        <circle cx="110" cy="62" r="3" fill={SAND} />
        <rect x="109" y="64" width="2" height="7" fill={SAND} />
      </svg>
      <h1 className="font-[var(--font-research)] text-2xl mt-8 mb-3">Agent-native password vault</h1>
      <p className="m-0 max-w-[340px] text-sm leading-relaxed text-[#B0A79C]">
        Allternit can fill logins for you. Open the extension settings to import from 1Password,
        Bitwarden, or Chrome, or add credentials manually.
      </p>
    </>
  );
}

/* ─── Step 5: memory & history ────────────────────────────────────────────── */

function MemoryStep() {
  return (
    <>
      <svg width="220" height="110" viewBox="0 0 220 110" fill="none" aria-hidden="true">
        <rect x="40" y="10" width="140" height="90" rx="8" fill="#241E18" stroke="#2E2822" />
        <circle cx="52" cy="20" r="2.5" fill="#D97757" />
        <circle cx="60" cy="20" r="2.5" fill={SAND} opacity="0.6" />
        <circle cx="68" cy="20" r="2.5" fill={SAND} opacity="0.35" />
        {/* brain / memory nodes */}
        <circle cx="85" cy="52" r="5" fill={SAND} opacity="0.8" />
        <circle cx="115" cy="42" r="5" fill={SAND} opacity="0.8" />
        <circle cx="135" cy="58" r="5" fill={SAND} opacity="0.8" />
        <circle cx="108" cy="72" r="5" fill={SAND} opacity="0.8" />
        <line x1="89" y1="51" x2="111" y2="45" stroke={SAND} strokeWidth="1.5" opacity="0.5" />
        <line x1="119" y1="45" x2="131" y2="54" stroke={SAND} strokeWidth="1.5" opacity="0.5" />
        <line x1="105" y1="68" x2="113" y2="47" stroke={SAND} strokeWidth="1.5" opacity="0.5" />
        <line x1="112" y1="70" x2="131" y2="61" stroke={SAND} strokeWidth="1.5" opacity="0.5" />
      </svg>
      <h1 className="font-[var(--font-research)] text-2xl mt-8 mb-3">Browsing memory</h1>
      <p className="m-0 max-w-[340px] text-sm leading-relaxed text-[#B0A79C]">
        Allternit remembers pages you visit and successful workflows so it can pick up where you
        left off across sessions. You can clear this data anytime in extension settings.
      </p>
    </>
  );
}

/* ─── Step 6: all set ─────────────────────────────────────────────────────── */

function AllSetStep() {
  return (
    <>
      <svg width="220" height="110" viewBox="0 0 220 110" fill="none" aria-hidden="true">
        <rect x="40" y="10" width="140" height="90" rx="8" fill="#241E18" stroke="#2E2822" />
        <circle cx="52" cy="20" r="2.5" fill="#D97757" />
        <circle cx="60" cy="20" r="2.5" fill={SAND} opacity="0.6" />
        <circle cx="68" cy="20" r="2.5" fill={SAND} opacity="0.35" />
        {/* checkmark */}
        <circle cx="110" cy="55" r="22" stroke={SAND} strokeWidth="2" opacity="0.3" />
        <path d="M98 55 l8 8 l16 -18" stroke={SAND} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h1 className="font-[var(--font-research)] text-2xl mt-8 mb-3">You're all set</h1>
      <p className="m-0 max-w-[340px] text-sm leading-relaxed text-[#B0A79C]">
        Click the Allternit icon in your toolbar to open the side panel and start automating.
        Use Ultrabrowse mode for deep research across multiple tabs.
      </p>
    </>
  );
}

/* ─── Shared illustration frame ───────────────────────────────────────────── */

function BrowserWindowIllustration({ children }: { children: ReactNode }) {
  return (
    <svg width="220" height="110" viewBox="0 0 220 110" fill="none" aria-hidden="true">
      <rect x="40" y="10" width="140" height="90" rx="8" fill="#241E18" stroke="#2E2822" />
      <circle cx="52" cy="20" r="2.5" fill="#D97757" />
      <circle cx="60" cy="20" r="2.5" fill={SAND} opacity="0.6" />
      <circle cx="68" cy="20" r="2.5" fill={SAND} opacity="0.35" />
      {children}
    </svg>
  );
}
