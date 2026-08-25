"use client";

import React, { useEffect, useState, useCallback } from 'react';
import * as QRCodeModule from 'react-qr-code';
const QRCode = (QRCodeModule as any).default?.QRCode ?? (QRCodeModule as any).default ?? QRCodeModule;
import {
  Folder,
  Coffee,
  Globe,
  Monitor,
  SquaresFour,
  Check,
  ArrowsClockwise,
  Copy,
  DeviceMobile,
  CaretDown,
  Bell,
  Code,
  Spinner,
  X,
  Sun,
  Warning,
  DotsThreeVertical,
  Broom,
  ShieldWarning,
  Brain,
  Trash,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useSettingsState } from '@/hooks/useSettingsState';
import { usePlatformAuth } from '@/lib/platform-auth-client';
import { getDispatchStatus, getDispatchDevAddress, mintDispatchToken, type DispatchStatusResponse } from '@/lib/dispatch/handoff';
import {
  CodePermissionsDropdown,
  type CodePermissionOption,
} from '@/components/dispatch/CodePermissionsDropdown';
import { openRemoteControlWindow } from '@/lib/open-remote-control-window';
import { RemoteSessionPanel } from '@/components/dispatch/RemoteSessionPanel';

// ─── token generation ────────────────────────────────────────────────────────
function generateDispatchToken(): string {
  const arr = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── ToggleSwitch ─────────────────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none',
        checked ? 'bg-blue-500' : 'bg-[var(--border-default)]',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block size-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

// ─── Setup row (toggle or checkmark) ─────────────────────────────────────────
type RowVariant = 'toggle' | 'check' | 'button';

interface SetupRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  variant: RowVariant;
  checked?: boolean;
  onToggle?: (v: boolean) => void;
  buttonLabel?: string;
  onButtonClick?: () => void;
  children?: React.ReactNode;
}

function SetupRow({ icon, title, description, variant, checked, onToggle, buttonLabel, onButtonClick, children }: SetupRowProps) {
  return (
    <div className="rounded-2xl border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] overflow-hidden shadow-sm">
      <div className="flex items-center gap-4 p-5">
        <div className="text-[var(--text-secondary)] shrink-0 size-6 flex items-center justify-center">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-medium text-[var(--text-primary)]">{title}</div>
          <div className="text-[13px] text-[var(--text-tertiary)] mt-0.5">{description}</div>
        </div>
        {variant === 'toggle' && (
          <ToggleSwitch checked={!!checked} onChange={onToggle ?? (() => {})} />
        )}
        {variant === 'check' && (
          <Check size={18} className="text-[var(--text-secondary)] shrink-0" weight="bold" />
        )}
        {variant === 'button' && (
          <button
            type="button"
            onClick={onButtonClick}
            className="px-4 py-1.5 rounded-xl border border-solid border-[var(--border-default)] bg-transparent text-[13px] font-medium text-[var(--text-primary)] cursor-pointer hover:bg-[var(--surface-hover)] transition-colors shrink-0"
          >
            {buttonLabel}
          </button>
        )}
      </div>
      {children && (
        <div className="px-5 pb-5 pt-0 border-t border-solid border-[var(--border-subtle)]">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── SubPermissionRow ─────────────────────────────────────────────────────────
interface SubPermRow {
  label: string;
  description: string;
  granted: boolean;
  onRequest?: () => void;
}

function SubPermissionRow({ label, description, granted, onRequest }: SubPermRow) {
  return (
    <div className="flex items-start gap-3 pt-4">
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-[var(--text-primary)]">{label}</div>
        <div className="text-[12px] text-[var(--text-tertiary)] mt-0.5 leading-relaxed">{description}</div>
      </div>
      {granted ? (
        <Check size={16} className="text-[var(--text-secondary)] mt-0.5 shrink-0" weight="bold" />
      ) : (
        <button
          type="button"
          onClick={onRequest}
          className="px-3.5 py-1.5 rounded-xl border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] text-[12px] font-medium text-[var(--text-primary)] cursor-pointer hover:bg-[var(--surface-hover)] transition-colors shrink-0"
        >
          Request
        </button>
      )}
    </div>
  );
}

// ─── Phone ↔ laptop illustration ──────────────────────────────────────────────
function PhoneLaptopIllustration() {
  return (
    <div className="flex items-center gap-2 select-none">
      {/* Phone */}
      <div className="relative w-[38px] h-[66px] rounded-[10px] border-2 border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-sm flex flex-col items-center pt-2.5 px-1.5 pb-1.5">
        <div className="w-full flex flex-col gap-1 mb-2">
          <div className="w-full h-1.5 bg-[var(--border-subtle)] rounded-sm" />
          <div className="w-3/4 h-1.5 bg-[var(--border-subtle)] rounded-sm" />
        </div>
        <div className="w-5 h-4 rounded-sm bg-[var(--border-subtle)] mb-1" />
        <div className="mt-auto w-6 h-2 rounded-full bg-[var(--border-subtle)]" />
      </div>

      {/* Curly cord */}
      <svg width="48" height="24" viewBox="0 0 48 24" fill="none" className="text-[#d4856a]">
        <path
          d="M2 12 C6 4, 12 4, 16 12 C20 20, 26 20, 30 12 C34 4, 40 4, 46 12"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Laptop */}
      <div className="relative w-[74px] h-[52px] flex flex-col items-center">
        <div className="w-full h-[42px] rounded-[8px] border-2 border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-sm flex items-center justify-center relative overflow-hidden">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--text-tertiary)]">
            <path d="M4.5 2L10.5 14L13 9L19 8L4.5 2Z" />
          </svg>
        </div>
        <div className="w-[88px] h-[6px] rounded-b-[4px] border-b-2 border-l-2 border-r-2 border-[var(--border-default)] bg-[var(--bg-elevated)] mt-[-2px]" />
      </div>
    </div>
  );
}

// ─── Dispatch options menu ────────────────────────────────────────────────────
function DispatchOptionsMenu({
  onClearMemory,
  onDeleteConversation,
}: {
  onClearMemory?: () => void;
  onDeleteConversation?: () => void;
}) {
  const [open, setOpen] = useState(false);

  const items = [
    {
      id: 'clear-tasks',
      label: 'Clear background tasks',
      icon: Broom,
      destructive: false,
      onClick: () => {
        setOpen(false);
        console.log('[Dispatch] Clear background tasks');
      },
    },
    {
      id: 'report',
      label: 'Report content',
      icon: ShieldWarning,
      destructive: false,
      onClick: () => {
        setOpen(false);
        window.location.href = 'mailto:support@allternit.com?subject=Dispatch%20content%20report';
      },
    },
    {
      id: 'clear-memory',
      label: 'Clear memory',
      icon: Brain,
      destructive: true,
      onClick: () => {
        setOpen(false);
        onClearMemory?.();
        window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType: 'memory' } }));
      },
    },
    {
      id: 'delete-conversation',
      label: 'Delete conversation',
      icon: Trash,
      destructive: true,
      onClick: () => {
        setOpen(false);
        onDeleteConversation?.();
      },
    },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] bg-transparent border-none cursor-pointer p-1 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
        aria-label="Dispatch options"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <DotsThreeVertical size={18} weight="bold" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-50 min-w-[220px] rounded-xl border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-sm py-1"
            role="menu"
          >
            {items.map((item, index) => {
              const Icon = item.icon;
              return (
                <React.Fragment key={item.id}>
                  {index === 2 && <div className="my-1 border-t border-solid border-[var(--border-subtle)]" />}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={item.onClick}
                    className={cn(
                      'w-full flex items-center gap-2.5 text-left px-3 py-2 cursor-pointer border-none bg-transparent hover:bg-[var(--surface-hover)] transition-colors text-[13px]',
                      item.destructive ? 'text-[var(--status-error)]' : 'text-[var(--text-primary)]'
                    )}
                  >
                    <Icon size={16} weight={item.destructive ? 'fill' : 'bold'} />
                    {item.label}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Dashed timestamp separator ───────────────────────────────────────────────
function TimestampSeparator() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 border-t border-dashed border-[var(--border-subtle)]" />
      <span className="text-[11px] text-[var(--text-tertiary)] font-medium">
        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
      <div className="flex-1 border-t border-dashed border-[var(--border-subtle)]" />
    </div>
  );
}



// ─── Main View ────────────────────────────────────────────────────────────────
export function DispatchView(): React.ReactNode {
  // ── persisted settings ──────────────────────────────────────────────────────
  const [fileAccess, setFileAccess] = useSettingsState('dispatch.fileAccess', true);
  const [keepAwake, setKeepAwake] = useSettingsState('dispatch.keepAwake', false);
  const [notifications, setNotifications] = useSettingsState('dispatch.notifications', false);
  const [computerControl, setComputerControl] = useSettingsState('dispatch.computerControl', false);
  const [setupComplete, setSetupComplete] = useSettingsState('dispatch.setupComplete', false);
  const [codePermission, setCodePermission] = useSettingsState<CodePermissionOption>('dispatch.codePermission', 'manual');

  // sub-permissions for computer control (default accessibility to true so the
  // setup screen matches the reference UI; screen recording still needs a request)
  const [accessibilityGranted, setAccessibilityGranted] = useSettingsState('dispatch.accessibility', true);
  const [screenRecordingGranted, setScreenRecordingGranted] = useSettingsState('dispatch.screenRecording', false);

  // ── QR / session ────────────────────────────────────────────────────────────
  const [token, setToken] = useState<string>(() => generateDispatchToken());
  const { getToken } = usePlatformAuth();

  // Hosted handoff (allternit-cloud-api /dispatch/handoff/mint): bind the QR
  // token to one of the user's paired runtimes so a phone claiming it pairs
  // with THIS machine's runtime — that is what makes local and cloud code
  // sessions correspond (both resolve to the same gizzi-code store). On the
  // dev server, or with no paired runtime, minting fails and the local
  // random token + dev endpoints keep the old flow.
  useEffect(() => {
    let cancelled = false;
    mintDispatchToken(getToken)
      .then((minted) => {
        if (!cancelled) setToken(minted.token);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [handoffStatus, setHandoffStatus] = useState<DispatchStatusResponse | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);

  // ── wake lock ───────────────────────────────────────────────────────────────
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  // ── dismissible UI ──────────────────────────────────────────────────────────
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [qrPanelDismissed, setQrPanelDismissed] = useState(false);

  // ── composer ────────────────────────────────────────────────────────────────
  const [composerValue, setComposerValue] = useState('');
  const [messages, setMessages] = useState<Array<{ id: string; role: 'user'; text: string }>>([]);

  // ── remote hub tabs ─────────────────────────────────────────────────────────
  const [activeHubTab, setActiveHubTab] = useState<'handoff' | 'active-sessions' | 'remote-sessions'>('handoff');

  // Build the QR URL. In development we ask the dev server for the LAN address
  // so a phone on the same network can actually reach this computer.
  useEffect(() => {
    let cancelled = false;
    async function buildUrl() {
      if (typeof window === 'undefined') return;
      const base = (await getDispatchDevAddress()) || window.location.origin;
      if (cancelled) return;
      setQrUrl(`${base}/dispatch/join?token=${token}&ts=${Date.now()}`);
      setHandoffStatus(null);
      setHandoffError(null);
    }
    void buildUrl();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Poll the handoff status so the desktop view knows when a phone has scanned the QR code.
  useEffect(() => {
    if (!token || !qrUrl) return;
    let cancelled = false;
    const poll = () => {
      getDispatchStatus(token, getToken)
        .then((status) => {
          if (cancelled) return;
          setHandoffStatus(status);
          setHandoffError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setHandoffError(err instanceof Error ? err.message : String(err));
        });
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token, qrUrl]);

  // Acquire / release wake lock when keepAwake changes
  useEffect(() => {
    if (!keepAwake) {
      wakeLock?.release().catch(() => {});
      setWakeLock(null);
      return;
    }
    if ('wakeLock' in navigator) {
      (navigator as any).wakeLock.request('screen').then((lock: WakeLockSentinel) => {
        setWakeLock(lock);
        lock.addEventListener('release', () => setWakeLock(null));
      }).catch(() => {});
    }
  }, [keepAwake]);

  const handleRefreshToken = () => {
    setToken(generateDispatchToken());
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!qrUrl) return;
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleNotificationsToggle = async (v: boolean) => {
    if (v && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotifications(perm === 'granted');
    } else {
      setNotifications(v);
    }
  };

  const handleSendMessage = useCallback(() => {
    const text = composerValue.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role: 'user', text }]);
    setComposerValue('');
  }, [composerValue]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!setupComplete) {
    return (
      <div className="h-full w-full overflow-y-auto bg-[var(--bg-elevated)] text-[var(--text-primary)] flex flex-col">
        <div className="w-full max-w-lg mx-auto px-8 pt-10 pb-14 flex flex-col items-center">
          {/* Illustration */}
          <div className="mb-6">
            <PhoneLaptopIllustration />
          </div>

          <h1
            className="text-3xl font-medium tracking-tight text-[var(--text-primary)] m-0 mb-2 text-center"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Get ready to dispatch
          </h1>
          <p className="text-[14px] text-[var(--text-tertiary)] m-0 mb-8 text-center">
            Update these anytime in{' '}
            <button
              type="button"
              className="text-blue-500 underline bg-transparent border-none cursor-pointer p-0 text-[14px]"
              onClick={() => window.dispatchEvent(new CustomEvent('allternit:open-settings', { detail: { section: 'dispatch' } }))}
            >
              Settings
            </button>
            .
          </p>

          <div className="w-full flex flex-col gap-3">
            <SetupRow
              icon={<Folder size={20} />}
              title="Give Allternit access to your files"
              description="macOS will ask when you click Finish."
              variant="toggle"
              checked={fileAccess}
              onToggle={setFileAccess}
            />
            <SetupRow
              icon={<Coffee size={20} />}
              title="Keep this computer awake"
              description="Prevents sleep while Dispatch is running."
              variant="toggle"
              checked={keepAwake}
              onToggle={setKeepAwake}
            />
            <SetupRow
              icon={<Globe size={20} />}
              title="Allternit is ready to use Chrome"
              description="Lets Dispatch navigate, click, and fill forms in your browser."
              variant="check"
            />
            <SetupRow
              icon={<Monitor size={20} />}
              title="Let Allternit control your computer"
              description="Allows Allternit to click, type, and open apps."
              variant="toggle"
              checked={computerControl}
              onToggle={(v) => {
                setComputerControl(v);
                if (v && !accessibilityGranted) setAccessibilityGranted(true);
              }}
            >
              {computerControl && (
                <div className="divide-y divide-[var(--border-subtle)]">
                  <SubPermissionRow
                    label="Accessibility"
                    description="Required for mouse and keyboard tracking and control."
                    granted={accessibilityGranted}
                  />
                  <SubPermissionRow
                    label="Screen recording"
                    description="Required for screen visibility. macOS may ask you to restart Allternit."
                    granted={screenRecordingGranted}
                    onRequest={() => setScreenRecordingGranted(true)}
                  />
                </div>
              )}
            </SetupRow>
            <SetupRow
              icon={<SquaresFour size={20} />}
              title="All connectors are on"
              description="Dispatch can use every connector you've authenticated."
              variant="check"
            />
          </div>

          <button
            type="button"
            onClick={() => setSetupComplete(true)}
            className="mt-8 w-full py-3.5 rounded-2xl bg-[var(--text-primary)] text-[var(--bg-elevated)] text-[15px] font-semibold cursor-pointer border-none hover:opacity-90 transition-opacity"
          >
            Finish setup
          </button>
        </div>
      </div>
    );
  }

  // ── Active dispatch session ──────────────────────────────────────────────────
  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      <div className="w-full max-w-6xl mx-auto px-8 pt-10 pb-12 flex flex-col flex-1 min-h-0">
        {/* Header — same pattern as Artifacts Library / Automation Tasks / Projects */}
        <div className="flex items-center justify-between gap-4 shrink-0">
          <div>
            <h1
              className="text-3xl font-medium tracking-tight m-0"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Remote Control
            </h1>
            <p className="m-0 mt-1 text-sm text-[var(--text-secondary)]">Monitor, hand off, and control your agents across machines.</p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <DispatchOptionsMenu
              onClearMemory={() => setMessages([])}
              onDeleteConversation={() => {
                setMessages([]);
                handleRefreshToken();
              }}
            />
          </div>
        </div>

        <div className="flex-1 flex min-h-0 mt-8 border-t border-solid border-[var(--border-subtle)]">
      {/* ── Left sidebar ── */}
      <div className="w-[280px] shrink-0 border-r border-solid border-[var(--border-subtle)] flex flex-col overflow-y-auto">
        {/* Settings panel */}
        <div className="border-b border-solid border-[var(--border-subtle)]">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">Settings</span>
            <CaretDown size={14} className="text-[var(--text-tertiary)]" />
          </div>
          <div className="px-4 pb-4 space-y-3">
            {/* Keep awake */}
            <div className="flex items-center gap-3">
              <Sun size={16} className="text-[var(--text-tertiary)]" />
              <span className="flex-1 text-[13px] text-[var(--text-secondary)]">Keep awake</span>
              <ToggleSwitch checked={keepAwake} onChange={setKeepAwake} />
            </div>
            {/* Notifications */}
            <div className="flex items-center gap-3">
              <Bell size={16} className="text-[var(--text-tertiary)]" />
              <span className="flex-1 text-[13px] text-[var(--text-secondary)]">Mobile notifications</span>
              <ToggleSwitch checked={notifications} onChange={handleNotificationsToggle} />
            </div>
            {/* Computer use */}
            <div className="flex items-center gap-3">
              <Monitor size={16} className="text-[var(--text-tertiary)]" />
              <span className="flex-1 text-[13px] text-[var(--text-secondary)]">Computer use</span>
              {computerControl && (
                <Warning size={14} className="text-amber-500 shrink-0" weight="fill" />
              )}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('allternit:open-settings', { detail: { section: 'dispatch' } }))}
                className="text-[12px] text-[var(--text-primary)] border border-solid border-[var(--border-default)] rounded-lg px-2.5 py-1 bg-transparent cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
              >
                Open settings
              </button>
            </div>
            {/* Code permissions */}
            <div className="flex items-center gap-3">
              <Code size={16} className="text-[var(--text-tertiary)]" />
              <span className="flex-1 text-[13px] text-[var(--text-secondary)]">Code permissions</span>
              <CodePermissionsDropdown value={codePermission} onChange={setCodePermission} />
            </div>
          </div>
        </div>

        {/* Outputs panel */}
        <div className="border-b border-solid border-[var(--border-subtle)]">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">Outputs</span>
            <CaretDown size={14} className="text-[var(--text-tertiary)]" />
          </div>
          <div className="px-4 pb-4">
            <div className="rounded-xl bg-[var(--surface-hover)] border border-dashed border-[var(--border-default)] px-3 py-3">
              <p className="m-0 text-[12px] text-[var(--text-tertiary)] italic">
                Files Allternit shares will appear here.
              </p>
            </div>
          </div>
        </div>

        {/* Bridge hint card */}
        <div className="px-4 py-4">
          <div className="relative rounded-2xl border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 shadow-sm">
            <p className="m-0 text-[13px] text-[var(--text-secondary)] leading-relaxed">
              Dispatch to Allternit and check in from anywhere—a task, a code session, in one continuous thread.
            </p>
            <div className="absolute left-4 -bottom-3 inline-flex items-center px-2.5 py-1 rounded-lg bg-[var(--text-primary)] text-[var(--bg-elevated)] text-[11px] font-semibold shadow-sm">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        {/* Reset setup */}
        <div className="mt-auto px-4 py-4">
          <button
            type="button"
            onClick={() => setSetupComplete(false)}
            className="w-full text-[12px] text-[var(--text-tertiary)] bg-transparent border border-solid border-[var(--border-subtle)] rounded-xl py-2 cursor-pointer hover:text-[var(--text-secondary)] hover:border-[var(--border-default)] transition-colors"
          >
            Reconfigure setup
          </button>
        </div>
      </div>

      {/* ── Main area ── */}
      <div
        className="flex-1 flex flex-col overflow-hidden relative"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--border-subtle) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        {/* Remote hub tabs */}
        {handoffStatus?.runtimeId && (
          <div className="mx-6 mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveHubTab('handoff')}
              className={cn(
                'px-4 py-2 rounded-xl text-[13px] font-medium transition-colors',
                activeHubTab === 'handoff'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-default)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              )}
            >
              Handoff
            </button>
            <button
              type="button"
              onClick={() => setActiveHubTab('active-sessions')}
              className={cn(
                'px-4 py-2 rounded-xl text-[13px] font-medium transition-colors',
                activeHubTab === 'active-sessions'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-default)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              )}
            >
              Active sessions
            </button>
            <button
              type="button"
              onClick={() => openRemoteControlWindow()}
              className={cn(
                'px-4 py-2 rounded-xl text-[13px] font-medium transition-colors',
                'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              )}
            >
              Remote sessions
            </button>
          </div>
        )}

        {activeHubTab === 'handoff' && (<>
          {/* Handoff banner */}
        {!bannerDismissed && (
          <div className="mx-6 mt-6 p-4 pr-5 rounded-2xl bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] flex items-start gap-4 shadow-sm">
            <div className="size-9 rounded-xl bg-[var(--border-subtle)] flex items-center justify-center shrink-0 mt-0.5">
              <DeviceMobile size={18} className="text-[var(--text-secondary)]" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="m-0 mb-1 text-[15px] font-semibold text-[var(--text-primary)]">
                Work with Allternit, right on your computer
              </h2>
              <p className="m-0 text-[13px] text-[var(--text-tertiary)] leading-relaxed">
                Allternit can work with your files, browse Chrome, and use connectors.
                Dispatch a task or a code session from the mobile app, and Allternit will
                keep working as long as your computer stays awake.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="bg-transparent border-none cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] shrink-0 p-0.5"
              aria-label="Dismiss banner"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* QR handoff section — shows the beginning "Turn on" panel until a phone connects */}
        {handoffStatus?.claimed ? (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-[var(--bg-elevated)] border border-solid border-[var(--status-success)] flex items-center gap-3 shadow-sm">
            <div className="size-9 rounded-xl bg-[var(--status-success)]/15 flex items-center justify-center shrink-0">
              <DeviceMobile size={18} className="text-[var(--status-success)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">Phone connected</div>
              <div className="text-[12px] text-[var(--text-tertiary)]">
                {handoffStatus.device ?? 'Mobile device'} · joined{' '}
                {handoffStatus.claimedAt
                  ? new Date(handoffStatus.claimedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'just now'}
              </div>
            </div>
            <Check size={18} className="text-[var(--status-success)] shrink-0" weight="bold" />
          </div>
        ) : !qrPanelDismissed ? (
          <div className="mx-6 mt-4">
            {showQR ? (
              <div className="p-5 rounded-2xl bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] flex items-center gap-6 shadow-sm">
                {/* QR */}
                <div className="p-3 bg-white rounded-xl shadow-sm shrink-0">
                  {qrUrl ? (
                    <QRCode value={qrUrl} size={140} level="M" />
                  ) : (
                    <div className="size-[140px] flex items-center justify-center">
                      <Spinner size={24} className="animate-spin text-[var(--text-tertiary)]" />
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col gap-3">
                  <div>
                    <h3 className="m-0 mb-1 text-[14px] font-semibold text-[var(--text-primary)]">
                      Scan to hand off this session
                    </h3>
                    <p className="m-0 text-[12px] text-[var(--text-tertiary)] leading-relaxed">
                      Point your phone camera at the QR code to continue this session in the Allternit mobile app.
                    </p>
                  </div>
                  {/* URL row */}
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--border-subtle)] border border-solid border-[var(--border-default)]">
                    <code className="flex-1 text-[11px] text-[var(--text-secondary)] truncate font-mono">
                      {qrUrl || 'Generating…'}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1 rounded-lg border-none text-[11px] font-bold cursor-pointer transition-colors shrink-0',
                        copied
                          ? 'bg-green-500 text-white'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-white'
                      )}
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRefreshToken}
                      className="flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] bg-transparent border-none cursor-pointer hover:text-[var(--text-secondary)] p-0"
                    >
                      <ArrowsClockwise size={13} /> Regenerate
                    </button>
                    <span className="text-[var(--border-default)]">·</span>
                    <span className="text-[11px] text-[var(--text-tertiary)]">One-time token · expires on refresh</span>
                  </div>
                  {handoffError && (
                    <div className="text-[11px] text-[var(--status-error)]">
                      Handoff check failed: {handoffError}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setQrPanelDismissed(true)}
                  className="bg-transparent border-none cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] p-0.5 self-start shrink-0"
                  aria-label="Dismiss QR panel"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] flex items-center gap-3 shadow-sm">
                <Bell size={16} className="text-[var(--text-tertiary)]" />
                <p className="flex-1 m-0 text-[13px] text-[var(--text-secondary)]">
                  Get notified on your phone when Allternit messages you here.
                </p>
                <button
                  type="button"
                  onClick={() => setShowQR(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-[var(--text-primary)] text-[var(--bg-elevated)] text-[12px] font-semibold cursor-pointer border-none hover:opacity-90 transition-opacity shrink-0"
                >
                  Turn on
                </button>
                <button
                  type="button"
                  onClick={() => setQrPanelDismissed(true)}
                  className="bg-transparent border-none cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] p-0.5 shrink-0"
                  aria-label="Dismiss phone notification panel"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        ) : null}

        {/* Session messages */}
        <div className="flex-1 overflow-y-auto mx-6 mt-6 mb-6 flex flex-col gap-4">
          <TimestampSeparator />

          {/* Welcome bubble */}
          <div className="bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] rounded-2xl p-5 shadow-sm max-w-2xl">
            <p className="m-0 text-[14px] text-[var(--text-primary)] leading-relaxed">
              Hey, glad you're here. Tell me what's on your plate — no ask is too big or small. You could ask me to:
            </p>
            <ul className="mt-3 mb-0 pl-5 space-y-1.5 text-[14px] text-[var(--text-secondary)] leading-relaxed">
              <li>Find a confirmation in Downloads and check the order status on the site.</li>
              <li>Open a GitHub project on your computer, make a quick code change, and run the tests.</li>
              <li>Scan for a bug report, find the file, and open a Code session to fix it.</li>
              <li>Search your repos for an error message and trace where it comes from.</li>
            </ul>
            <p className="mt-3 mb-0 text-[13px] text-[var(--text-tertiary)] leading-relaxed">
              You can also control this conversation from your phone. Download the Allternit app for iOS or Android, then go to the Dispatch tab.
            </p>
          </div>

          {/* User messages */}
          {messages.map((m) => (
            <div key={m.id} className="self-end bg-[var(--text-primary)] text-[var(--bg-elevated)] rounded-2xl px-5 py-3 shadow-sm max-w-2xl">
              <p className="m-0 text-[14px] leading-relaxed">{m.text}</p>
            </div>
          ))}
        </div>

        {/* Composer */}
        <div className="mx-6 mb-6">
          <div className="flex items-center gap-3 p-3.5 pl-5 rounded-2xl bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] shadow-sm">
            <span className="text-[var(--text-tertiary)] text-[22px] leading-none font-light select-none">+</span>
            <input
              type="text"
              value={composerValue}
              onChange={(e) => setComposerValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Allternit anything"
              className="flex-1 bg-transparent border-none outline-none text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!composerValue.trim()}
              className="size-8 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] disabled:opacity-40 bg-transparent border-none cursor-pointer"
              aria-label="Send message"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M3.5 13.09L20.5 4.5L12 20.5L10 14L3.5 13.09Z" />
              </svg>
            </button>
            <button
              type="button"
              className="size-8 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] bg-transparent border-none cursor-pointer"
              aria-label="Voice input"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </>)}

      {activeHubTab === 'active-sessions' && handoffStatus?.runtimeId && (
        <div className="flex-1 overflow-hidden mx-6 mt-6 mb-6">
          <RemoteSessionPanel
            runtimeId={handoffStatus.runtimeId}
            getToken={getToken}
          />
        </div>
      )}
      </div>
    </div>
  </div>
</div>
  );
}

export default DispatchView;
